// config.js
const path = require('path');
require('dotenv').config();

const config = {
    licenseKey: "keyvaultmanager-mvp-2024",
    apiKey: "api-key-mvp-2024",
    
    // Key Types Configuration
    keyTypes: {
        AES: {
            name: "AES",
            lengths: [128, 256],
            defaultLength: process.env.DEFAULT_AES_LENGTH || "256"
        },
        RSA: {
            name: "RSA",
            lengths: [2048, 3072, 4096],
            defaultLength: process.env.DEFAULT_RSA_LENGTH || "2048"
        },
        EC: {
            name: "EC",
            curves: ["P-256", "P-384", "P-521", "P-256K"],
            defaultCurve: process.env.DEFAULT_EC_CURVE || "P-256"
        }
    },

    // Default Key Settings (from .env or fallback)
    defaultKeyType: process.env.DEFAULT_KEY_TYPE || "AES",
    
    // Database Configuration
    database: {
        path: path.join(__dirname, '../data/keyvaultmanager.db')
    },

    // Logging Configuration
    logging: {
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
        format: process.env.LOG_FORMAT || 'combined'
    },

    // Storage Configuration
    storage: {
        useAzureStorage: process.env.USE_AZURE_STORAGE === 'true' || true,
        maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 100 * 1024 * 1024, // 100MB default
        containerName: process.env.STORAGE_CONTAINER_NAME || 'encrypted-files',
        allowedFileTypes: [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'text/plain',
            'application/json'
        ]
    },

    // Key Vault Settings
    keyVault: {
        maxRetries: parseInt(process.env.KEY_VAULT_MAX_RETRIES) || 3,
        retryDelay: parseInt(process.env.KEY_VAULT_RETRY_DELAY) || 1000,
    },

    // Validation Functions
    validation: {
        isValidKeyType: (type) => {
            return ["AES", "RSA", "EC"].includes(type);
        },
        
        isValidKeyLength: (type, length) => {
            if (type === "AES") {
                return config.keyTypes.AES.lengths.includes(parseInt(length));
            }
            if (type === "RSA") {
                return config.keyTypes.RSA.lengths.includes(parseInt(length));
            }
            return true; // For EC, length validation is handled separately
        },

        isValidECCurve: (curve) => {
            return config.keyTypes.EC.curves.includes(curve);
        },

        getDefaultLength: (type) => {
            switch(type) {
                case "AES":
                    return config.keyTypes.AES.defaultLength;
                case "RSA":
                    return config.keyTypes.RSA.defaultLength;
                case "EC":
                    return config.keyTypes.EC.defaultCurve;
                default:
                    return config.keyTypes.AES.defaultLength;
            }
        }
    }
};

module.exports = config;