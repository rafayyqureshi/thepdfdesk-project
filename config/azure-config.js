// config/azure-config.js
const azureConfig = {
    keyVault: {
        name: process.env.KEY_VAULT_NAME,
        url: `https://${process.env.KEY_VAULT_NAME}.vault.azure.net`
    },
    storage: {
        // Default storage connection
        connectionString: process.env.AZURE_STORAGE_CONNECTION_STRING,
        containerName: 'encrypted-files',
        defaultCode: process.env.DEFAULT_STORAGE_CODE || 'default',
        // Multiple storage locations configuration
        locations: {
            // Default location - always available
            default: {
                connectionString: process.env.AZURE_STORAGE_CONNECTION_STRING,
                containerName: process.env.STORAGE_CONTAINER_NAME || 'encrypted-files',
                description: 'Default storage location'
            }
            // Additional locations will be loaded from .env or added programmatically
        }
    },
    credentials: {
        tenantId: process.env.AZURE_TENANT_ID,
        clientId: process.env.AZURE_CLIENT_ID,
        clientSecret: process.env.AZURE_CLIENT_SECRET
    },
    keyTypes: {
        AES: {
            lengths: [128, 256],
            defaultLength: 256,
            keyOps: ['encrypt', 'decrypt']
        },
        RSA: {
            lengths: [2048, 3072, 4096],
            defaultLength: 2048,
            keyOps: ['encrypt', 'decrypt', 'sign', 'verify', 'wrapKey', 'unwrapKey']
        },
        EC: {
            curves: {
                'P-256': {
                    name: 'P-256',
                    oid: [0x2A, 0x86, 0x48, 0xCE, 0x3D, 0x03, 0x01, 0x07],
                    keyOps: ['sign', 'verify', 'wrapKey', 'unwrapKey'],
                    defaultUsage: true
                },
                'P-384': {
                    name: 'P-384',
                    oid: [0x2B, 0x81, 0x04, 0x00, 0x22],
                    keyOps: ['sign', 'verify', 'wrapKey', 'unwrapKey']
                },
                'P-521': {
                    name: 'P-521',
                    oid: [0x2B, 0x81, 0x04, 0x00, 0x23],
                    keyOps: ['sign', 'verify', 'wrapKey', 'unwrapKey']
                },
                'P-256K': {
                    name: 'P-256K',
                    oid: [0x2B, 0x81, 0x04, 0x00, 0x0A],
                    keyOps: ['sign', 'verify', 'wrapKey', 'unwrapKey']
                }
            }
        }
    },
    retry: {
        maxRetries: parseInt(process.env.KEY_VAULT_MAX_RETRIES) || 3,
        retryDelayMs: parseInt(process.env.KEY_VAULT_RETRY_DELAY) || 1000
    },
    // Initialize additional storage locations from environment variables
    initializeStorageLocations: function() {
        // Look for environment variables matching the pattern STORAGE_CODE_*
        Object.keys(process.env).forEach(key => {
            if (key.startsWith('STORAGE_CODE_')) {
                const storageCode = key.replace('STORAGE_CODE_', '').toLowerCase();
                const connectionStringKey = `STORAGE_CONNECTION_${storageCode.toUpperCase()}`;
                const containerNameKey = `STORAGE_CONTAINER_${storageCode.toUpperCase()}`;
                
                if (process.env[connectionStringKey]) {
                    this.storage.locations[storageCode] = {
                        connectionString: process.env[connectionStringKey],
                        containerName: process.env[containerNameKey] || 'encrypted-files',
                        description: process.env[key] || `Storage location: ${storageCode}`
                    };
                }
            }
        });
        
        return this;
    },
    getStorageConfig: function(storageCode) {
        if (!storageCode) {
            return this.storage.locations[this.storage.defaultCode];
        }
        
        const normalizedCode = storageCode.toLowerCase();
        return this.storage.locations[normalizedCode] || 
               this.storage.locations[this.storage.defaultCode];
    },
    validateKeyParameters: function(keyType, length) {
        const typeConfig = this.keyTypes[keyType];
        if (!typeConfig) {
            throw new Error(`Unsupported key type: ${keyType}`);
        }

        if (keyType === 'EC') {
            if (!typeConfig.curves[length]) {
                throw new Error(`Unsupported EC curve: ${length}`);
            }
        } else {
            const lengthNum = parseInt(length);
            if (!typeConfig.lengths.includes(lengthNum)) {
                throw new Error(`Invalid key length for ${keyType}: ${length}`);
            }
        }
    },
    getKeyConfig: function(keyType) {
        const config = this.keyTypes[keyType];
        if (!config) {
            throw new Error(`Unsupported key type: ${keyType}`);
        }
        return config;
    },
    getECCurveConfig: function(curveName) {
        const curveConfig = this.keyTypes.EC.curves[curveName];
        if (!curveConfig) {
            throw new Error(`Unsupported EC curve: ${curveName}`);
        }
        return curveConfig;
    },
    listStorageLocations: function() {
        return Object.keys(this.storage.locations).map(code => ({
            code,
            description: this.storage.locations[code].description,
            containerName: this.storage.locations[code].containerName,
            isDefault: code === this.storage.defaultCode
        }));
    }
};

// Initialize storage locations from environment variables
azureConfig.initializeStorageLocations();

module.exports = azureConfig;