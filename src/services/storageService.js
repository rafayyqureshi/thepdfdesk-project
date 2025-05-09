const { BlobServiceClient } = require('@azure/storage-blob');
const fs = require('fs');
const path = require('path');
const azureConfig = require('../../config/azure-config');
const logger = require('../utils/logger');

class StorageService {
    constructor() {
        this.storageClients = new Map();
        this.containerClients = new Map();
        this.storageLocations = azureConfig.listStorageLocations();
        
        // Initialize all storage locations
        this.initializeAllStorageLocations();
    }

    initializeAllStorageLocations() {
        logger.info(`Initializing ${this.storageLocations.length} storage locations`);
        
        // Initialize each storage location
        this.storageLocations.forEach(location => {
            this.initializeStorageLocation(location.code);
        });
    }

    initializeStorageLocation(storageCode) {
        try {
            const storageConfig = azureConfig.getStorageConfig(storageCode);
            if (!storageConfig || !storageConfig.connectionString) {
                logger.warn(`Storage connection string not provided for storage code: ${storageCode}`);
                return false;
            }

            try {
                // Create blob service client for this storage location
                const blobServiceClient = BlobServiceClient.fromConnectionString(storageConfig.connectionString);
                this.storageClients.set(storageCode, blobServiceClient);
                
                // Create container client for this storage location
                const containerClient = blobServiceClient.getContainerClient(storageConfig.containerName);
                this.containerClients.set(storageCode, containerClient);
                
                // Initialize container
                this.initContainer(storageCode)
                    .then(() => {
                        logger.info(`Storage location initialized successfully: ${storageCode}`);
                    })
                    .catch(error => {
                        logger.error(`Failed to initialize storage location ${storageCode}: ${error.message}`);
                    });
                
                return true;
            } catch (error) {
                logger.error(`Failed to create storage client for ${storageCode}: ${error.message}`);
                return false;
            }
        } catch (error) {
            logger.error(`Error initializing storage location ${storageCode}: ${error.message}`);
            return false;
        }
    }

    async initContainer(storageCode) {
        const containerClient = this.getContainerClient(storageCode);
        if (!containerClient) {
            logger.error(`Container client not found for storage code: ${storageCode}`);
            return;
        }
        
        try {
            await containerClient.createIfNotExists();
            logger.info(`Storage container initialized for ${storageCode}`);
        } catch (error) {
            logger.error(`Failed to initialize storage container for ${storageCode}: ${error.message}`);
            // Don't throw the error to allow app to continue running
        }
    }

    getContainerClient(storageCode) {
        // If no storage code provided, use default
        const code = storageCode || azureConfig.storage.defaultCode;
        
        // Try to get the container client for this storage code
        let containerClient = this.containerClients.get(code);
        
        // If not found, use default
        if (!containerClient) {
            logger.warn(`Container client not found for storage code: ${code}, using default`);
            containerClient = this.containerClients.get(azureConfig.storage.defaultCode);
            
            // If default not found, return null
            if (!containerClient) {
                logger.error('Default container client not found');
                return null;
            }
        }
        
        return containerClient;
    }

    isStorageAvailable(storageCode) {
        return !!this.getContainerClient(storageCode);
    }

    async uploadFile(fileName, data, metadata = {}, storageCode = null) {
        try {
            const containerClient = this.getContainerClient(storageCode);
            if (!containerClient) {
                throw new Error(`Storage service is not available for code: ${storageCode || 'default'}`);
            }
            
            // Ensure original filename is preserved in metadata
            const enhancedMetadata = {
                ...metadata,
                storageCode: storageCode || azureConfig.storage.defaultCode,
                originalFileName: metadata.originalFileName || fileName
            };
            
            // Use the exact filename provided by the encryption service without any modifications
            // Trust that the encryption service has already created a clean filename
            // Do not process or modify the filename anymore to avoid adding timestamps or other characters
            const safeFileName = fileName;
            
            logger.info(`Uploading file to storage with exact name: "${safeFileName}" (code: ${storageCode || 'default'})`);
            
            const blockBlobClient = containerClient.getBlockBlobClient(safeFileName);
            
            await blockBlobClient.upload(data, data.length, {
                metadata: enhancedMetadata
            });

            const url = blockBlobClient.url;
            
            return {
                success: true,
                fileName: safeFileName, // Return exactly the same filename that was passed in
                url,
                metadata: enhancedMetadata,
                storageCode: storageCode || azureConfig.storage.defaultCode
            };
        } catch (error) {
            logger.error(`File upload failed: ${error.message}`);
            throw error;
        }
    }

    async listFiles(storageCode = null) {
        try {
            // If storage code provided, only list files from that location
            if (storageCode) {
                return this.listFilesFromLocation(storageCode);
            }
            
            // Otherwise, list files from all locations
            const allFiles = [];
            const errors = [];
            
            for (const location of this.storageLocations) {
                try {
                    const result = await this.listFilesFromLocation(location.code);
                    if (result.success) {
                        // Add storage location info to each file
                        const filesWithLocation = result.files.map(file => ({
                            ...file,
                            storageCode: location.code,
                            storageDescription: location.description
                        }));
                        
                        allFiles.push(...filesWithLocation);
                    } else {
                        errors.push(`Failed to list files from ${location.code}: ${result.error}`);
                    }
                } catch (error) {
                    errors.push(`Error listing files from ${location.code}: ${error.message}`);
                }
            }
            
            // Sort all files by timestamp
            allFiles.sort((a, b) => b.timestamp - a.timestamp);
            
            return {
                success: true,
                files: allFiles,
                errors: errors.length > 0 ? errors : undefined
            };
        } catch (error) {
            console.error('Storage list error:', error);
            logger.error(`Failed to list files: ${error.message}`);
            return { success: false, files: [], error: error.message };
        }
    }

    async listFilesFromLocation(storageCode) {
        try {
            const containerClient = this.getContainerClient(storageCode);
            if (!containerClient) {
                return { 
                    success: false, 
                    files: [], 
                    error: `Storage service is not available for code: ${storageCode || 'default'}` 
                };
            }
            
            logger.info(`Listing files from storage location: ${storageCode}`);
            const files = [];
            
            for await (const blob of containerClient.listBlobsFlat()) {
                try {
                    const blobClient = containerClient.getBlobClient(blob.name);
                    const properties = await blobClient.getProperties();
                    
                    // IMPORTANT: Always use the requested storage code for display consistency
                    // The user is viewing this specific storage location, so all files should 
                    // be shown as belonging to this location for UI clarity
                    const displayStorageCode = storageCode;
                    
                    files.push({
                        name: blob.name,
                        url: blobClient.url,
                        size: blob.properties.contentLength,
                        timestamp: blob.properties.createdOn,
                        metadata: properties.metadata,
                        storageCode: displayStorageCode, // Use the requested storage location
                        originalMetadataStorageCode: properties.metadata?.storageCode // Keep original for reference
                    });
                } catch (error) {
                    logger.error(`Error getting properties for blob ${blob.name}: ${error.message}`);
                }
            }
            
            logger.info(`Found ${files.length} files in storage location: ${storageCode}`);
            
            return {
                success: true,
                requestedStorageCode: storageCode, // Include the requested storage code
                files: files.sort((a, b) => b.timestamp - a.timestamp)
            };
        } catch (error) {
            logger.error(`Failed to list files from ${storageCode}: ${error.message}`);
            return { 
                success: false, 
                files: [], 
                error: `Failed to list files from ${storageCode}: ${error.message}` 
            };
        }
    }

    async downloadFile(fileName, storageCode = null) {
        try {
            const containerClient = this.getContainerClient(storageCode);
            if (!containerClient) {
                throw new Error(`Storage service is not available for code: ${storageCode || 'default'}`);
            }
            
            logger.info(`Downloading file ${fileName} from storage ${storageCode || 'default'}`);
            
            // Try with the exact filename first
            let cleanFileName = fileName;
            
            // Check if the blob exists first
            let blockBlobClient = containerClient.getBlockBlobClient(cleanFileName);
            let exists = await blockBlobClient.exists();
            
            // If not found and the name doesn't already have a timestamp pattern, try to list all blobs
            // to find a match with timestamp
            if (!exists && !cleanFileName.match(/-\d{13,14}\.enc$/)) {
                logger.info(`File ${cleanFileName} not found directly, searching for similar filenames`);
                
                // Extract base name (without extension)
                const baseNameMatch = cleanFileName.match(/^(.+?)(?:\.enc)?$/);
                const baseName = baseNameMatch ? baseNameMatch[1] : cleanFileName;
                
                // Find all blobs that start with this base name
                const matchingBlobs = [];
                for await (const blob of containerClient.listBlobsFlat({ prefix: baseName })) {
                    matchingBlobs.push(blob.name);
                }
                
                if (matchingBlobs.length > 0) {
                    logger.info(`Found ${matchingBlobs.length} potential matches: ${matchingBlobs.join(', ')}`);
                    
                    // Use the first matching blob (could be sorted by recency)
                    cleanFileName = matchingBlobs[0];
                    blockBlobClient = containerClient.getBlockBlobClient(cleanFileName);
                    exists = true;
                    logger.info(`Using closest match: ${cleanFileName}`);
                }
            }
            
            if (!exists) {
                throw new Error(`The specified blob ${fileName} does not exist in storage location ${storageCode || 'default'}`);
            }
            
            const downloadResponse = await blockBlobClient.download(0);
            const properties = await blockBlobClient.getProperties();
            
            logger.info(`Successfully downloaded file ${cleanFileName} from ${storageCode || 'default'}`);
            
            return {
                success: true,
                data: await this.streamToBuffer(downloadResponse.readableStreamBody),
                metadata: properties,
                storageCode: storageCode || azureConfig.storage.defaultCode,
                fileName: cleanFileName
            };
        } catch (error) {
            logger.error(`File download failed: ${error.message}`);
            throw error;
        }
    }

    async streamToBuffer(readableStream) {
        return new Promise((resolve, reject) => {
            const chunks = [];
            readableStream.on("data", (data) => {
                chunks.push(data instanceof Buffer ? data : Buffer.from(data));
            });
            readableStream.on("end", () => {
                resolve(Buffer.concat(chunks));
            });
            readableStream.on("error", reject);
        });
    }
    
    getStorageLocations() {
        return this.storageLocations;
    }
}

module.exports = new StorageService();