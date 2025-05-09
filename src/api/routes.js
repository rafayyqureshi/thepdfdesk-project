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
            let downloadFileName;
            
            if (useStorage && encryptedResult.storageDetails) {
                // Use the clean filename from storage
                downloadFileName = encryptedResult.storageDetails.fileName;
                logger.info(`File encrypted and stored as: ${downloadFileName}`);
            } else {
                // For direct downloads, create a clean filename
                const fileNameParts = path.basename(originalFileName).split('.');
                const fileExt = fileNameParts.length > 1 ? fileNameParts.pop() : '';
                const baseName = fileNameParts.join('.');
                downloadFileName = `${baseName}.enc`;
                logger.info(`File encrypted for direct download as: ${downloadFileName}`);
            }
            
            // Ensure the actual storage code used is sent to the client
            const actualStorageCode = useStorage ? 
                encryptedResult.storageDetails.storageCode : 
                (storageCode || azureConfig.storage.defaultCode);
                
            res.set({
                'Content-Type': 'application/octet-stream',
                'Content-Disposition': `attachment; filename="${downloadFileName}"`,
                'X-Original-Name': originalFileName,
                'X-Original-Extension': path.extname(originalFileName),
                'X-Storage-Code': actualStorageCode
            });

            // Make sure to include the actual storage code in the response
            if (useStorage && encryptedResult.storageDetails) {
                encryptedResult.actualStorageCode = actualStorageCode;
            }

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
        logger.info(`Listing files from storage: ${storageCode || 'all locations'}`);
        
        const result = await storageService.listFiles(storageCode);
        
        // For specific storage location requests, force the storage code in the response
        if (storageCode && result.success && result.files) {
            // Set requested storage code on all files to ensure UI displays correctly
            result.files = result.files.map(file => {
                // Store actual metadata storage code for debugging
                const actualMetadataStorageCode = file.metadata?.storageCode;
                
                return {
                    ...file,
                    storageCode: storageCode, // Force display of requested storage code
                    actualMetadataStorageCode // Keep original for debugging
                };
            });
            
            // Add info about forced storage code
            result.requestedStorageCode = storageCode;
            result.forcedStorageDisplay = true;
        }
        
        res.json(result);
    } catch (error) {
        logger.error(`Failed to list files: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
});

// Download File with Storage_Code support
router.get('/downloadFile/:fileName', validateLicenseKey, async (req, res) => {
    try {
        let fileName = req.params.fileName;
        const requestedStorageCode = req.query.storageCode || null;
        
        logger.info(`Attempting to download file: ${fileName} from storage: ${requestedStorageCode || 'default'}`);
        
        // Handle case where filename might have timestamp or original extension
        // Try to clean it up for better matching
        if (fileName.match(/-\d{13,14}\.enc$/)) {
            // Remove timestamp if present
            const cleanFileName = fileName.replace(/-\d{13,14}(?=\.enc$)/, '');
            logger.info(`Cleaned up filename from ${fileName} to ${cleanFileName}`);
            fileName = cleanFileName;
        }
        
        // If no specific storage code requested, try to find the file in any storage location
        if (!requestedStorageCode) {
            // Get all storage locations
            const storageLocations = storageService.getStorageLocations();
            
            // Try each location until we find the file
            for (const location of storageLocations) {
                try {
                    const result = await storageService.downloadFile(fileName, location.code);
                    if (result && result.success) {
                        logger.info(`File found in storage location: ${location.code}`);
        
        res.set({
            'Content-Type': 'application/octet-stream',
            'Content-Disposition': `attachment; filename="${fileName}"`,
            'Content-Length': result.data.length,
                            'X-Storage-Code': location.code
        });
        
        res.send(result.data);
                        return;
                    }
                } catch (error) {
                    logger.debug(`File not found in ${location.code}: ${error.message}`);
                    // Continue to the next storage location
                }
            }
            
            // If we get here, the file was not found in any location
            throw new Error(`File ${fileName} not found in any storage location`);
        }
        
        // Try from the requested storage location
        try {
            const result = await storageService.downloadFile(fileName, requestedStorageCode);
            
            res.set({
                'Content-Type': 'application/octet-stream',
                'Content-Disposition': `attachment; filename="${fileName}"`,
                'Content-Length': result.data.length,
                'X-Storage-Code': result.storageCode || requestedStorageCode
            });
            
            res.send(result.data);
        } catch (error) {
            logger.error(`Download failed from storage ${requestedStorageCode}: ${error.message}`);
            
            // If the specified storage code is not default, try the default storage as fallback
            if (requestedStorageCode && requestedStorageCode !== azureConfig.storage.defaultCode) {
                try {
                    logger.info(`Attempting download from default storage as fallback`);
                    const result = await storageService.downloadFile(fileName, azureConfig.storage.defaultCode);
                    
                    res.set({
                        'Content-Type': 'application/octet-stream',
                        'Content-Disposition': `attachment; filename="${fileName}"`,
                        'Content-Length': result.data.length,
                        'X-Storage-Code': azureConfig.storage.defaultCode
                    });
                    
                    res.send(result.data);
                    return;
                } catch (secondError) {
                    // Both attempts failed
                    throw new Error(`File ${fileName} not found in ${requestedStorageCode} or default storage`);
                }
            }
            
            // No fallback available, rethrow original error
            throw error;
        }
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
        
        logger.info(`Retrieving document ${documentName} from storage ${storageCode || 'any'} using key ${keyName}`);
        
        // Retrieve and decrypt the document
        const decryptedResult = await encryptionService.retrieveDocument(
            documentName,
            keyName,
            storageCode || null
        );
        
        if (decryptedResult.isFile) {
            // Use original filename with extension if available
            let downloadFileName = 'decrypted_file';
            
            if (decryptedResult.originalFileName) {
                // If we have the original file name, use it
                if (decryptedResult.originalExtension) {
                    // If it already has the extension, use as is
                    downloadFileName = decryptedResult.originalFileName;
                } else {
                    // Otherwise append the extension if available
                    downloadFileName = `${decryptedResult.originalFileName}${decryptedResult.originalExtension || ''}`;
                }
            }
            
            logger.info(`Sending decrypted file for download: ${downloadFileName}`);

            res.set({
                'Content-Type': 'application/octet-stream',
                'Content-Disposition': `attachment; filename="${downloadFileName}"`,
                'Content-Length': decryptedResult.data.length,
                'X-Original-Name': decryptedResult.originalFileName || documentName,
                'X-Original-Extension': decryptedResult.originalExtension || '',
                'X-Storage-Code': decryptedResult.storageCode || storageCode || azureConfig.storage.defaultCode
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