const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const config = require('../../config/config');
const logger = require('../utils/logger');
const fs = require('fs');
const path = require('path');

class Database {
    constructor() {
        this.initializeDatabase();
    }

    async initializeDatabase() {
        try {
            // Create the data directory if it doesn't exist
            const dbDir = path.dirname(config.database.path);
            if (!fs.existsSync(dbDir)) {
                fs.mkdirSync(dbDir, { recursive: true });
            }

            this.db = await open({
                filename: config.database.path,
                driver: sqlite3.Database
            });
            
            await this.db.exec(`
                CREATE TABLE IF NOT EXISTS keys (
                    id TEXT PRIMARY KEY,
                    type TEXT NOT NULL,
                    length INTEGER NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                );
                
                CREATE TABLE IF NOT EXISTS configurations (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                );

                CREATE TABLE IF NOT EXISTS documents (
                    id TEXT PRIMARY KEY,
                    key_id TEXT NOT NULL,
                    storage_type TEXT NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (key_id) REFERENCES keys(id)
                );
            `);
            
            logger.info('Database initialized successfully');
        } catch (error) {
            logger.error(`Database initialization failed: ${error.message}`);
            throw new Error(`Database initialization failed: ${error.message}`);
        }
    }

    async storeKeyMetadata(keyId, type, length) {
        try {
            await this.db.run(
                'INSERT INTO keys (id, type, length) VALUES (?, ?, ?)',
                [keyId, type, length]
            );
            logger.info(`Key metadata stored: ${keyId}`);
        } catch (error) {
            logger.error(`Failed to store key metadata: ${error.message}`);
            throw error;
        }
    }

    async getKeyMetadata(keyId) {
        try {
            return await this.db.get('SELECT * FROM keys WHERE id = ?', [keyId]);
        } catch (error) {
            logger.error(`Failed to retrieve key metadata: ${error.message}`);
            throw error;
        }
    }

    async storeDocumentMetadata(documentId, keyId, storageType) {
        try {
            await this.db.run(
                'INSERT INTO documents (id, key_id, storage_type) VALUES (?, ?, ?)',
                [documentId, keyId, storageType]
            );
            logger.info(`Document metadata stored: ${documentId}`);
        } catch (error) {
            logger.error(`Failed to store document metadata: ${error.message}`);
            throw error;
        }
    }
}

module.exports = new Database();