const express = require('express');
const router = express.Router();
const multer = require('multer');
const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit
});
const keyVaultService = require('../services/keyVaultService');
const encryptionService = require('../services/encryptionService');
const storageService = require('../services/storageService');
const { validateApiKey, validateLicenseKey } = require('../utils/validation');
const logger = require('../utils/logger');
const config = require('../../config/config');
const azureConfig = require('../../config/azure-config');
const path = require('path');

router.use(validateApiKey);

// Generate Key
router.post('/generateKey', validateLicenseKey, async (req, res) => {
    try {
        const { keyName, keyType = 'AES', keyLength } = req.body;
        
        if (!keyName) {
            throw new Error('Key name is required');
        }

        // Don't parse keyLength as int for EC keys
        const processedKeyLength = keyType === 'EC' ? 
            keyLength : 
            parseInt(keyLength);

        const key = await keyVaultService.createKey(
            keyName, 
            keyType, 
            processedKeyLength
        );
        
        logger.info(`Key generated successfully: ${keyName}`);
        res.json(key);
    } catch (error) {
        logger.error(`Key generation failed: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
});

// Retrieve Key
router.post('/retrieveKey', validateLicenseKey, async (req, res) => {
    try {
        const { keyName } = req.body;
        if (!keyName) {
            throw new Error('Key name is required');
        }

        const key = await keyVaultService.getKey(keyName);
        logger.info(`Key retrieved: ${keyName}`);
        
        res.json(key);
    } catch (error) {
        logger.error(`Key retrieval failed: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
});

// Encrypt with Storage_Code support
router.post('/encrypt', upload.single('file'), async (req, res) => {
    try {
        const keyName = req.body.keyName;
        const useStorage = req.body.useStorage === 'true';
        const storageCode = req.body.storageCode || null; // Get the storage_code parameter
        let dataToEncrypt;
        let originalFileName = '';

        if (!keyName) {
            throw new Error('Key name is required');
        }

        if (req.file) {
            dataToEncrypt = req.file.buffer;
            originalFileName = req.file.originalname;
            
            if (req.file.size > config.storage.maxFileSize) {
                throw new Error(`File size exceeds limit of ${config.storage.maxFileSize / (1024 * 1024)}MB`);
            }
        } else if (req.body.data) {
            dataToEncrypt = req.body.data;
        } else {
            throw new Error('No file or data provided');
        }

        const encryptedResult = await encryptionService.encrypt(
            dataToEncrypt,
            keyName,
            useStorage,
            originalFileName,
            storageCode // Pass the storage_code parameter to the encryptionService
        );

        if (req.file) {
            // For files, prepare for download
            const downloadFileName = useStorage ? 
                encryptedResult.storageDetails.fileName : 
                `${originalFileName}.enc`;
                
            res.set({
                'Content-Type': 'application/octet-stream',
                'Content-Disposition': `attachment; filename="${downloadFileName}"`,
                'X-Original-Name': originalFileName,
                'X-Original-Extension': path.extname(originalFileName),
                'X-Storage-Code': storageCode || azureConfig.storage.defaultCode
            });

            // Send encrypted data as file
            const responseData = Buffer.from(JSON.stringify(encryptedResult));
            res.send(responseData);
        } else {
            // For text data
            res.json({
                success: true,
                encryptedData: encryptedResult
            });
        }

    } catch (error) {
        logger.error(`Encryption failed: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
});

// Decrypt
router.post('/decrypt', upload.single('file'), async (req, res) => {
    try {
        const keyName = req.body.keyName;
        let encryptedData;

        if (!keyName) {
            throw new Error('Key name is required');
        }

        if (req.file) {
            try {
                // Read the encrypted file content
                const fileContent = req.file.buffer.toString();
                try {
                    // First try parsing as JSON
                    encryptedData = JSON.parse(fileContent);
                } catch (parseError) {
                    // If JSON parsing fails, try parsing as base64
                    try {
                        const decodedContent = Buffer.from(fileContent, 'base64').toString();
                        encryptedData = JSON.parse(decodedContent);
                    } catch (decodeError) {
                        throw new Error('Invalid encrypted file format');
                    }
                }
            } catch (error) {
                throw new Error(`Failed to parse encrypted file: ${error.message}`);
            }
        } else if (req.body.data) {
            try {
                encryptedData = typeof req.body.data === 'string' ? 
                    JSON.parse(req.body.data) : req.body.data;
            } catch (error) {
                throw new Error('Invalid encrypted data format');
            }
        } else {
            throw new Error('No encrypted data provided');
        }

        const decryptedResult = await encryptionService.decrypt(encryptedData, keyName);

        if (decryptedResult.isFile) {
            // Use original filename with extension if available
            const originalFileName = decryptedResult.originalFileName || 'decrypted_file';
            const extension = decryptedResult.originalExtension || '';
            const downloadFileName = extension ? 
                originalFileName : // If we have the original filename with extension
                `${originalFileName}${extension}`; // Otherwise append extension

            res.set({
                'Content-Type': 'application/octet-stream',
                'Content-Disposition': `attachment; filename="${downloadFileName}"`,
                'Content-Length': decryptedResult.data.length
            });
            res.send(decryptedResult.data);
        } else {
            res.json({
                success: true,
                decryptedData: decryptedResult.data.toString()
            });
        }
    } catch (error) {
        logger.error(`Decryption failed: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
});

// List Files with Storage_Code support
router.get('/listFiles', validateLicenseKey, async (req, res) => {
    try {
        const storageCode = req.query.storageCode || null;
        const files = await storageService.listFiles(storageCode);
        res.json(files);
    } catch (error) {
        logger.error(`Failed to list files: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
});

// Download File with Storage_Code support
router.get('/downloadFile/:fileName', validateLicenseKey, async (req, res) => {
    try {
        const fileName = req.params.fileName;
        const storageCode = req.query.storageCode || null;
        const result = await storageService.downloadFile(fileName, storageCode);
        
        res.set({
            'Content-Type': 'application/octet-stream',
            'Content-Disposition': `attachment; filename="${fileName}"`,
            'Content-Length': result.data.length,
            'X-Storage-Code': result.storageCode || azureConfig.storage.defaultCode
        });
        
        res.send(result.data);
    } catch (error) {
        logger.error(`File download failed: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
});

// Create Secret
router.post('/createSecret', validateLicenseKey, async (req, res) => {
    try {
        const { secretName, secretValue } = req.body;
        
        if (!secretName || !secretValue) {
            throw new Error('Secret name and value are required');
        }

        await keyVaultService.secretClient.setSecret(secretName, secretValue);
        logger.info(`Secret created: ${secretName}`);
        
        res.json({
            success: true,
            name: secretName,
            details: {
                created: new Date().toISOString()
            }
        });
    } catch (error) {
        logger.error(`Secret creation failed: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
});

// Retrieve Secret
router.post('/retrieveSecret', validateLicenseKey, async (req, res) => {
    try {
        const { secretName } = req.body;
        if (!secretName) {
            throw new Error('Secret name is required');
        }

        const secret = await keyVaultService.secretClient.getSecret(secretName);
        logger.info(`Secret retrieved: ${secretName}`);

        res.json({
            success: true,
            name: secretName,
            value: secret.value,
            details: {
                created: secret.properties.createdOn.toISOString(),
                updated: secret.properties.updatedOn?.toISOString(),
                enabled: secret.properties.enabled
            }
        });
    } catch (error) {
        logger.error(`Secret retrieval failed: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
});

// NEW ENDPOINT: Retrieve and decrypt document in one operation
router.get('/retrieveDocument', validateLicenseKey, async (req, res) => {
    try {
        const { documentName, keyName, storageCode } = req.query;
        
        if (!documentName) {
            throw new Error('Document name is required');
        }
        
        if (!keyName) {
            throw new Error('Key name is required');
        }
        
        // Retrieve and decrypt the document
        const decryptedResult = await encryptionService.retrieveDocument(
            documentName,
            keyName,
            storageCode || null
        );
        
        if (decryptedResult.isFile) {
            // Use original filename with extension if available
            const originalFileName = decryptedResult.originalFileName || 'decrypted_file';
            const extension = decryptedResult.originalExtension || '';
            const downloadFileName = extension ? 
                originalFileName : // If we have the original filename with extension
                `${originalFileName}${extension}`; // Otherwise append extension

            res.set({
                'Content-Type': 'application/octet-stream',
                'Content-Disposition': `attachment; filename="${downloadFileName}"`,
                'Content-Length': decryptedResult.data.length,
                'X-Original-Name': originalFileName,
                'X-Original-Extension': decryptedResult.originalExtension,
                'X-Storage-Code': decryptedResult.storageCode || azureConfig.storage.defaultCode
            });
            res.send(decryptedResult.data);
        } else {
            res.json({
                success: true,
                decryptedData: decryptedResult.data.toString(),
                metadata: decryptedResult.metadata
            });
        }
    } catch (error) {
        logger.error(`Document retrieval failed: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
});

// Get available storage locations
router.get('/storageLocations', validateLicenseKey, async (req, res) => {
    try {
        const locations = storageService.getStorageLocations();
        res.json({
            success: true,
            locations: locations
        });
    } catch (error) {
        logger.error(`Failed to get storage locations: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;