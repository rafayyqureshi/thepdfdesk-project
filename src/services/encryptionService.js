// encryptionService.js
const crypto = require('crypto');
const path = require('path');
const keyVaultService = require('./keyVaultService');
const logger = require('../utils/logger');
const config = require('../../config/config');
const storageService = require('./storageService');
const azureConfig = require('../../config/azure-config');

class EncryptionService {
    constructor() {
        this.maxFileSize = config.storage.maxFileSize || 100 * 1024 * 1024;
    }

    async encrypt(data, keyName, useStorage = false, originalFileName = '', storageCode = null) {
        try {
            // Get the key first
            const key = await keyVaultService.getKey(keyName);
            if (!key || !key.success) {
                throw new Error('Invalid key response');
            }

            const isFile = Buffer.isBuffer(data);
            const inputBuffer = isFile ? data : Buffer.from(data, 'utf8');

            // Check file size limit
            if (inputBuffer.length > this.maxFileSize) {
                throw new Error(`File size exceeds limit of ${this.maxFileSize / (1024 * 1024)}MB`);
            }

            // Generate IV
            const iv = crypto.randomBytes(16);

            let encryptionKey;
            let encryptionType;

            if (key.type === 'AES') {
                encryptionKey = Buffer.from(key.value, 'base64');
                encryptionType = 'AES';
            } else {
                // For RSA, we'll still use AES but mark it as RSA
                encryptionType = 'RSA';
                encryptionKey = crypto.randomBytes(32); // Generate a random AES key
            }

            // Encrypt the data using AES
            const cipher = crypto.createCipheriv('aes-256-cbc', encryptionKey, iv);
            const encryptedBuffer = Buffer.concat([
                cipher.update(inputBuffer),
                cipher.final()
            ]);

            // Prepare the result object
            const result = {
                encryptionType,
                encryptedData: encryptedBuffer.toString('base64'),
                iv: iv.toString('hex'),
                keyName: keyName,
                isFile: isFile,
                originalFileName: originalFileName,
                originalExtension: isFile ? path.extname(originalFileName) : '',
                timestamp: new Date().toISOString(),
                originalSize: inputBuffer.length,
                encryptedSize: encryptedBuffer.length
            };

            // Add key data if it's RSA type
            if (encryptionType === 'RSA') {
                result.tempKey = encryptionKey.toString('base64');
            }

            // Handle storage if requested
            if (isFile && useStorage) {
                // Extract the base filename without any path or extension 
                // Assuming originalFileName contains something like "Phase-2-Sprint-II-Results (1).pdf"
                const fileName = this.createCleanEncryptedFilename(originalFileName);
                
                logger.info(`Uploading encrypted file with clean name: ${fileName}`);
                
                const storageResult = await storageService.uploadFile(
                    fileName,
                    Buffer.from(JSON.stringify(result)),
                    {
                        keyName,
                        originalFileName,
                        originalExtension: result.originalExtension,
                        timestamp: result.timestamp,
                        encryptionType
                    },
                    storageCode // Pass the storage code to the storage service
                );
                result.storageDetails = {
                    fileName: fileName, // Use our clean filename, not the one from storage service which might have been modified
                    url: storageResult.url,
                    metadata: storageResult.metadata,
                    storageCode: storageResult.storageCode || storageCode
                };
            }

            return result;

        } catch (error) {
            logger.error(`Encryption error: ${error.stack}`);
            throw error;
        }
    }

    async decrypt(encryptedData, keyName) {
        try {
            let dataToDecrypt = encryptedData;

            // If the input is a Buffer (from file), convert to string first
            if (Buffer.isBuffer(encryptedData)) {
                dataToDecrypt = encryptedData.toString('utf8');
            }

            // Parse JSON if it's a string
            if (typeof dataToDecrypt === 'string') {
                try {
                    dataToDecrypt = JSON.parse(dataToDecrypt);
                } catch (error) {
                    logger.error('JSON parse error:', error);
                    throw new Error('Invalid encrypted data format');
                }
            }

            // Validate the encrypted data structure
            if (!dataToDecrypt || !dataToDecrypt.encryptedData || !dataToDecrypt.iv) {
                logger.error('Invalid data structure:', dataToDecrypt);
                throw new Error('Invalid or incomplete encrypted data structure');
            }

            let decryptionKey;
            if (dataToDecrypt.encryptionType === 'RSA') {
                // For RSA type, use the temporary key that was stored
                if (!dataToDecrypt.tempKey) {
                    throw new Error('Missing temporary key for RSA decryption');
                }
                decryptionKey = Buffer.from(dataToDecrypt.tempKey, 'base64');
            } else {
                // For AES type, get the key from Key Vault
                const key = await keyVaultService.getKey(keyName);
                if (!key || !key.value) {
                    throw new Error('Invalid key or key not found');
                }
                decryptionKey = Buffer.from(key.value, 'base64');
            }

            // Create decipher and decrypt
            const decipher = crypto.createDecipheriv(
                'aes-256-cbc',
                decryptionKey,
                Buffer.from(dataToDecrypt.iv, 'hex')
            );

            const decryptedBuffer = Buffer.concat([
                decipher.update(Buffer.from(dataToDecrypt.encryptedData, 'base64')),
                decipher.final()
            ]);

            return {
                data: decryptedBuffer,
                isFile: dataToDecrypt.isFile,
                originalFileName: dataToDecrypt.originalFileName,
                originalExtension: dataToDecrypt.originalExtension,
                originalSize: dataToDecrypt.originalSize,
                decryptedSize: decryptedBuffer.length,
                timestamp: dataToDecrypt.timestamp,
                encryptionType: dataToDecrypt.encryptionType
            };

        } catch (error) {
            logger.error(`Decryption error: ${error.stack}`);
            throw error;
        }
    }

    /**
     * Retrieve and decrypt a document from storage in one operation
     * @param {string} documentName - Name of the document to retrieve
     * @param {string} keyName - Name of the key to use for decryption
     * @param {string} storageCode - Storage location for the file
     * @returns {Promise<object>} - Decrypted file details
     */
    async retrieveDocument(documentName, keyName, storageCode = null) {
        try {
            logger.info(`Retrieving document ${documentName} from storage ${storageCode || 'default'} using key ${keyName}`);
            
            // Download the encrypted file from storage
            const downloadResult = await storageService.downloadFile(documentName, storageCode);
            
            if (!downloadResult || !downloadResult.success) {
                throw new Error('Failed to download the file from storage');
            }
            
            // Parse the encrypted data
            let encryptedData;
            try {
                const fileContent = downloadResult.data.toString();
                encryptedData = JSON.parse(fileContent);
            } catch (error) {
                throw new Error(`Failed to parse encrypted file: ${error.message}`);
            }
            
            // Decrypt the data
            const decryptedResult = await this.decrypt(encryptedData, keyName);
            
            // Return the decrypted result with additional metadata
            return {
                ...decryptedResult,
                storageCode: downloadResult.storageCode,
                metadata: downloadResult.metadata?.metadata
            };
        } catch (error) {
            logger.error(`Document retrieval and decryption failed: ${error.stack}`);
            throw new Error(`Failed to retrieve and decrypt document: ${error.message}`);
        }
    }

    /**
     * Creates a clean filename for encrypted files
     * @param {string} originalFileName - The original file name
     * @returns {string} - A clean filename with .enc extension and no timestamp
     */
    createCleanEncryptedFilename(originalFileName) {
        // Extract just the base name (without path)
        const baseName = path.basename(originalFileName);
        
        // Extract name parts - everything before the last dot
        const nameParts = baseName.split('.');
        
        // If there's an extension, remove it, otherwise use the whole name
        let nameWithoutExtension;
        if (nameParts.length > 1) {
            // Remove the last part (extension)
            nameParts.pop();
            nameWithoutExtension = nameParts.join('.');
        } else {
            nameWithoutExtension = baseName;
        }
        
        // Remove any existing timestamps that might be present
        nameWithoutExtension = nameWithoutExtension.replace(/-\d{13,14}$/, '');
        
        // Replace problematic characters with underscores, but preserve spaces, 
        // parentheses, and hyphens to maintain readability
        const cleanName = nameWithoutExtension.replace(/[^a-zA-Z0-9\s().\-_]/g, '_');
        
        // Ensure there's no timestamp in the format we're seeing in the issue
        const finalName = cleanName.replace(/-\d{13}(?=\.enc)?$/, '');
        
        // Log the original and clean names for debugging
        logger.info(`Original filename: "${originalFileName}", Clean name: "${finalName}.enc"`);
        
        // Return the cleaned name with .enc extension
        return `${finalName}.enc`;
    }
}

module.exports = new EncryptionService();