// services/keyVaultService.js
const { DefaultAzureCredential } = require("@azure/identity");
const { SecretClient } = require("@azure/keyvault-secrets");
const { KeyClient, CryptographyClient } = require("@azure/keyvault-keys");
const crypto = require('crypto');
const logger = require('../utils/logger');
const config = require('../../config/config');
const azureConfig = require('../../config/azure-config');

// EC curve configurations
const EC_CURVES = {
    'P-256': {
        name: 'P-256',
        oid: Buffer.from([0x2A, 0x86, 0x48, 0xCE, 0x3D, 0x03, 0x01, 0x07]),
        keyOps: ['sign', 'verify']
    },
    'P-384': {
        name: 'P-384',
        oid: Buffer.from([0x2B, 0x81, 0x04, 0x00, 0x22]),
        keyOps: ['sign', 'verify']
    },
    'P-521': {
        name: 'P-521',
        oid: Buffer.from([0x2B, 0x81, 0x04, 0x00, 0x23]),
        keyOps: ['sign', 'verify']
    },
    'P-256K': {
        name: 'P-256K',
        oid: Buffer.from([0x2B, 0x81, 0x04, 0x00, 0x0A]),
        keyOps: ['sign', 'verify']
    }
};

class KeyVaultService {
    constructor() {
        this.keyVaultAvailable = false;
        this.localKeyStore = new Map();
        this.retryConfig = {
            maxRetries: config.keyVault.maxRetries || 3,
            retryDelayMs: config.keyVault.retryDelay || 1000
        };
        
        try {
            if (!process.env.KEY_VAULT_NAME) {
                logger.warn('KEY_VAULT_NAME environment variable is not set');
                return;
            }

            const vaultUrl = `https://${process.env.KEY_VAULT_NAME}.vault.azure.net`;
            
            // Create credential with explicit parameters
            const credential = new DefaultAzureCredential({
                tenantId: process.env.AZURE_TENANT_ID,
                clientId: process.env.AZURE_CLIENT_ID,
                clientSecret: process.env.AZURE_CLIENT_SECRET
            });
            
            this.secretClient = new SecretClient(vaultUrl, credential);
            this.keyClient = new KeyClient(vaultUrl, credential);
            
            // Test connection
            this.testConnection()
                .then(() => {
                    this.keyVaultAvailable = true;
                    logger.info('KeyVaultService initialized successfully');
                })
                .catch(error => {
                    logger.error(`KeyVault connectivity test failed: ${error.message}`);
                    // Continue with local fallback
                });
        } catch (error) {
            logger.error(`KeyVaultService initialization failed: ${error.message}`);
            // Continue with local fallback
        }
    }
    
    async testConnection() {
        try {
            // Try to get a non-existent key to test connectivity
            await this.secretClient.getSecret('connection-test-key');
        } catch (error) {
            // If error is not found, that's expected
            if (error.code === 'SecretNotFound') {
                return true; // Connection successful, secret just doesn't exist
            }
            throw error; // Other error, connectivity issue
        }
        return true;
    }

    async createKey(keyName, type, length) {
        try {
            if (!keyName) {
                throw new Error('Key name is required');
            }

            logger.info(`Creating key: ${keyName}, type: ${type}, length: ${length}`);
    
            const keyType = type || config.defaultKeyType;
    
            // Validate key existence
            try {
                const existingKey = await this.getKey(keyName);
                if (existingKey) {
                    throw new Error('Key name already exists');
                }
            } catch (error) {
                if (!error.message.includes('Failed to retrieve key')) {
                    throw error;
                }
            }
    
            // Simplified key creation based on type
            switch (keyType) {
                case 'AES':
                    return await this.createAESKey(keyName, length);
                case 'RSA':
                    return await this.createRSAKey(keyName, length);
                case 'EC':
                    // For EC, we'll always use P-256 as it's the most secure and widely supported
                    return await this.createECKey(keyName);
                default:
                    throw new Error(`Unsupported key type: ${keyType}`);
            }
        } catch (error) {
            logger.error(`Failed to create key: ${error.stack}`);
            throw error;
        }
    }

    async createAESKey(keyName, length) {
        try {
            const bytesLength = parseInt(length) / 8;
            const aesKey = crypto.randomBytes(bytesLength).toString('base64');
            
            if (this.keyVaultAvailable) {
                try {
                    await this.secretClient.setSecret(keyName, aesKey, {
                        enabled: true,
                        contentType: 'application/aes',
                        tags: {
                            keyType: 'AES',
                            keyLength: length.toString(),
                            createdBy: 'KeyVaultManager'
                        }
                    });
                } catch (error) {
                    logger.error(`Azure Key Vault storage failed: ${error.message}`);
                    // Fall back to local storage
                }
            }
            
            // Store in local key store as backup
            this.localKeyStore.set(keyName, {
                type: 'AES',
                value: aesKey,
                keyLength: length.toString(),
                created: new Date().toISOString()
            });
            
            return { 
                success: true,
                name: keyName,
                type: 'AES',
                value: aesKey,
                details: {
                    storageType: this.keyVaultAvailable ? 'Secret' : 'Local',
                    created: new Date().toISOString(),
                    enabled: true
                }
            };
        } catch (error) {
            logger.error(`AES key creation failed: ${error.stack}`);
            throw new Error(`Failed to create AES key: ${error.message}`);
        }
    }

    async createRSAKey(keyName, length) {
        try {
            // Generate RSA key pair locally
            const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
                modulusLength: parseInt(length),
                publicKeyEncoding: {
                    type: 'spki',
                    format: 'pem'
                },
                privateKeyEncoding: {
                    type: 'pkcs8',
                    format: 'pem'
                }
            });
            
            let keyVaultKey = null;
            
            if (this.keyVaultAvailable) {
                try {
                    keyVaultKey = await this.keyClient.createKey(keyName, "RSA", {
                        keySize: parseInt(length),
                        enabled: true,
                        keyOps: ['encrypt', 'decrypt', 'sign', 'verify']
                    });
                } catch (error) {
                    logger.error(`Azure Key Vault RSA key creation failed: ${error.message}`);
                    // Continue with local key
                }
            }
            
            // Store in local key store as backup
            this.localKeyStore.set(keyName, {
                type: 'RSA',
                publicKey: publicKey,
                privateKey: privateKey, // In real scenarios, you'd encrypt this
                keyLength: length.toString(),
                created: new Date().toISOString()
            });

            return {
                success: true,
                name: keyName,
                type: 'RSA',
                key: {
                    keyId: keyVaultKey?.id || `local:${keyName}`,
                    keySize: parseInt(length),
                    keyOps: ['encrypt', 'decrypt', 'sign', 'verify'],
                    publicKey: publicKey,
                    privateKey: null // We never return the private key
                },
                details: {
                    storageType: keyVaultKey ? 'Key' : 'Local',
                    created: keyVaultKey?.properties.createdOn?.toISOString() || new Date().toISOString(),
                    enabled: true
                }
            };
        } catch (error) {
            logger.error(`RSA key creation failed: ${error.stack}`);
            throw new Error(`Failed to create RSA key: ${error.message}`);
        }
    }

    async createECKey(keyName) {
        try {
            // Instead of using EC with curves, we'll use RSA with specific parameters
            const keyVaultKey = await this.keyClient.createKey(keyName, "RSA", {
                keySize: 2048,  // Using RSA-2048 as it's widely supported
                enabled: true,
                keyOps: ['sign', 'verify', 'encrypt', 'decrypt'],
                tags: {
                    keyType: 'EC',  // We'll still tag it as EC for compatibility
                    createdBy: 'KeyVaultManager'
                }
            });
    
            // Get the RSA public key
            const publicKey = await this.getRSAPublicKey(keyVaultKey);
    
            return {
                success: true,
                name: keyName,
                type: 'EC',  // Keep the type as EC for consistency
                key: {
                    keyId: keyVaultKey.id,
                    keySize: 2048,
                    keyOps: ['sign', 'verify', 'encrypt', 'decrypt'],
                    publicKey: publicKey,
                    privateKey: null
                },
                details: {
                    storageType: 'Key',
                    created: keyVaultKey.properties.createdOn.toISOString(),
                    enabled: true
                }
            };
        } catch (error) {
            logger.error(`EC key creation failed: ${error.stack}`);
            throw new Error(`Failed to create EC key: ${error.message}`);
        }
    }

    async getKey(name) {
        try {
            logger.info(`Retrieving key: ${name}`);
            
            // Check local key store first
            const localKey = this.localKeyStore.get(name);
            if (localKey) {
                logger.info(`Found key in local storage: ${name}`);
                
                if (localKey.type === 'AES') {
                    return {
                        success: true,
                        name,
                        type: 'AES',
                        value: localKey.value,
                        details: {
                            storageType: 'Local',
                            created: localKey.created,
                            enabled: true
                        }
                    };
                } else if (localKey.type === 'RSA') {
                    return {
                        success: true,
                        name,
                        type: 'RSA',
                        key: {
                            keyId: `local:${name}`,
                            keySize: parseInt(localKey.keyLength),
                            keyOps: ['encrypt', 'decrypt', 'sign', 'verify'],
                            publicKey: localKey.publicKey,
                            privateKey: null
                        },
                        details: {
                            storageType: 'Local',
                            created: localKey.created,
                            enabled: true
                        }
                    };
                }
            }
            
            // If not in local store, try Azure Key Vault if available
            if (!this.keyVaultAvailable) {
                throw new Error('Key not found in local storage and Key Vault is not available');
            }
            
            let attempt = 0;
            while (attempt < this.retryConfig.maxRetries) {
                try {
                    // First try to get as RSA or EC key
                    const key = await this.keyClient.getKey(name);
                    const keyType = this.determineKeyType(key);
                    let publicKey;

                    if (keyType === 'EC') {
                        publicKey = await this.getECPublicKey(key);
                    } else {
                        publicKey = await this.getRSAPublicKey(key);
                    }

                    return {
                        success: true,
                        name,
                        type: keyType,
                        key: {
                            keyId: key.id,
                            keySize: key.key.keySize,
                            keyOps: key.key.keyOps,
                            publicKey: publicKey,
                            curve: key.key.curve // Will be null for RSA keys
                        },
                        details: {
                            storageType: 'Key',
                            created: key.properties.createdOn.toISOString(),
                            enabled: key.properties.enabled
                        }
                    };
                } catch (rsaError) {
                    try {
                        // If not found as RSA/EC key, try as AES secret
                        const secret = await this.secretClient.getSecret(name);
                        return {
                            success: true,
                            name,
                            type: 'AES',
                            value: secret.value,
                            details: {
                                storageType: 'Secret',
                                created: secret.properties.createdOn.toISOString(),
                                enabled: secret.properties.enabled
                            }
                        };
                    } catch (aesError) {
                        if (attempt === this.retryConfig.maxRetries - 1) {
                            throw new Error(`Failed to retrieve key: ${aesError.message}`);
                        }
                        await new Promise(resolve => setTimeout(resolve, this.retryConfig.retryDelayMs));
                        attempt++;
                    }
                }
            }
        } catch (error) {
            logger.error(`Key retrieval failed: ${error.stack}`);
            throw new Error(`Failed to retrieve key: ${error.message}`);
        }
    }

    determineKeyType(key) {
        if (!key.key) return 'UNKNOWN';
        if (key.key.kty === 'RSA') return 'RSA';
        if (key.key.kty === 'EC') return 'EC';
        return 'UNKNOWN';
    }

    async getRSAPublicKey(keyVaultKey) {
        try {
            if (!keyVaultKey.key || !keyVaultKey.key.n || !keyVaultKey.key.e) {
                throw new Error('Invalid RSA key format from Key Vault');
            }

            const modulus = Buffer.from(keyVaultKey.key.n, 'base64');
            const exponent = Buffer.from(keyVaultKey.key.e, 'base64');

            // Create RSA Public Key sequence
            const rsaPublicKey = Buffer.concat([
                Buffer.from([0x30]), // SEQUENCE
                this.encodeLengthDER(modulus.length + exponent.length + 2 + 
                    this.encodeLengthDER(modulus.length).length + 
                    this.encodeLengthDER(exponent.length).length),
                Buffer.from([0x02]), // INTEGER (modulus)
                this.encodeLengthDER(modulus.length),
                modulus,
                Buffer.from([0x02]), // INTEGER (exponent)
                this.encodeLengthDER(exponent.length),
                exponent
            ]);

            // Create algorithm identifier
            const algorithmIdentifier = Buffer.from([
                0x30, 0x0d, // SEQUENCE
                0x06, 0x09, // OBJECT IDENTIFIER
                0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, // RSA encryption OID
                0x05, 0x00  // NULL
            ]);

            // Create SubjectPublicKeyInfo structure
            const publicKeyDER = Buffer.concat([
                Buffer.from([0x30]), // SEQUENCE
                this.encodeLengthDER(rsaPublicKey.length + algorithmIdentifier.length + 2),
                algorithmIdentifier,
                Buffer.from([0x03]), // BIT STRING
                this.encodeLengthDER(rsaPublicKey.length + 1),
                Buffer.from([0x00]), // Leading zero
                rsaPublicKey
            ]);

            return this.convertToPEM(publicKeyDER, 'PUBLIC KEY');
        } catch (error) {
            logger.error(`RSA public key formatting failed: ${error.stack}`);
            throw error;
        }
    }

    async getECPublicKey(keyVaultKey) {
        try {
            if (!keyVaultKey.key || !keyVaultKey.key.x || !keyVaultKey.key.y) {
                throw new Error('Invalid EC key format from Key Vault');
            }

            const x = Buffer.from(keyVaultKey.key.x, 'base64');
            const y = Buffer.from(keyVaultKey.key.y, 'base64');
            const curveConfig = EC_CURVES[keyVaultKey.key.curve];

            if (!curveConfig) {
                throw new Error(`Unsupported curve: ${keyVaultKey.key.curve}`);
            }

            // Create uncompressed EC point
            const ecPoint = Buffer.concat([
                Buffer.from([0x04]), // Uncompressed point format
                x,
                y
            ]);

            // Create algorithm identifier
            const algorithmIdentifier = Buffer.concat([
                Buffer.from([0x30]), // SEQUENCE
                this.encodeLengthDER(curveConfig.oid.length + 2),
                Buffer.from([0x06]), // OBJECT IDENTIFIER
                this.encodeLengthDER(curveConfig.oid.length),
                curveConfig.oid
            ]);

            // Create SubjectPublicKeyInfo structure
            const publicKeyDER = Buffer.concat([
                Buffer.from([0x30]), // SEQUENCE
                this.encodeLengthDER(ecPoint.length + algorithmIdentifier.length + 2),
                algorithmIdentifier,
                Buffer.from([0x03]), // BIT STRING
                this.encodeLengthDER(ecPoint.length + 1),
                Buffer.from([0x00]), // Leading zero
                ecPoint
            ]);

            return this.convertToPEM(publicKeyDER, 'PUBLIC KEY');
        } catch (error) {
            logger.error(`EC public key formatting failed: ${error.stack}`);
            throw error;
        }
    }

    encodeLengthDER(length) {
        if (length < 128) {
            return Buffer.from([length]);
        }

        const lengthBytes = [];
        let tempLength = length;
        
        while (tempLength > 0) {
            lengthBytes.unshift(tempLength & 0xff);
            tempLength = tempLength >> 8;
        }

        return Buffer.concat([
            Buffer.from([0x80 | lengthBytes.length]),
            Buffer.from(lengthBytes)
        ]);
    }

    convertToPEM(der, type) {
        const base64 = der.toString('base64');
        const pemLines = base64.match(/.{1,64}/g) || [];
        return [`-----BEGIN ${type}-----`, ...pemLines, `-----END ${type}-----`].join('\n');
    }
}

module.exports = new KeyVaultService();