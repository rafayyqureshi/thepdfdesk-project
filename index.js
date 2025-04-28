require('dotenv').config();

// Add this verification right after
console.log('Environment Variables Check:', {
    KEY_VAULT_NAME: process.env.KEY_VAULT_NAME,
    TENANT_ID: process.env.AZURE_TENANT_ID,
    CLIENT_ID: process.env.AZURE_CLIENT_ID,
    HAS_SECRET: process.env.AZURE_CLIENT_SECRET ? 'Yes' : 'No'
});

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const routes = require('./src/api/routes');
const logger = require('./src/utils/logger');

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));

// Add this to debug the requests
app.use((req, res, next) => {
    logger.info(`Incoming ${req.method} request to ${req.path}`);
    next();
});

// Static files
app.use(express.static('public'));

// API routes
app.use('/api', routes);

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'x-api-key', 'x-license-key']
}));

// Root route with error handling
app.get('/', (req, res, next) => {
    try {
        res.sendFile(path.join(__dirname, 'public', 'index.html'), (err) => {
            if (err) {
                logger.error(`Error serving index.html: ${err.message}`);
                next(err);
            }
        });
    } catch (error) {
        logger.error(`Error in root route: ${error.message}`);
        next(error);
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    logger.error(`Error: ${err.message}`);
    logger.error(err.stack);
    res.status(500).json({ 
        error: 'Internal Server Error',
        message: err.message,
        path: req.path
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    logger.info(`PDFdesk SDK server running on port ${PORT}`);
    logger.info(`Environment: ${process.env.NODE_ENV}`);
    logger.info(`Root directory: ${__dirname}`);
    logger.info(`Public path: ${path.join(__dirname, 'public', 'index.html')}`);
});