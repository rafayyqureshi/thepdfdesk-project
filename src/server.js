const express = require('express');
const cors = require('cors');
const path = require('path');
const https = require('https');
const fs = require('fs');
const routes = require('./api/routes');
const logger = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 3000;

// SSL Configuration
const sslOptions = {
    key: fs.readFileSync(path.join(__dirname, '../ssl/private.key')),
    cert: fs.readFileSync(path.join(__dirname, '../ssl/certificate.crt'))
};

// CORS configuration
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'x-api-key', 'x-license-key']
}));

// Debug middleware
app.use((req, res, next) => {
    logger.info(`Incoming ${req.method} request to ${req.url}`);
    logger.info('Request headers:', req.headers);
    next();
});

// Middleware for parsing JSON and urlencoded data
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, '../public')));

// API routes
app.use('/api', routes);

// Error handling middleware
app.use((err, req, res, next) => {
    logger.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

// Catch-all route for SPA
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Create HTTPS server
const httpsServer = https.createServer(sslOptions, app);

// Start both HTTP and HTTPS servers
httpsServer.listen(PORT, () => {
    logger.info(`Secure server running on https://localhost:${PORT}`);
    logger.info(`Environment: ${process.env.NODE_ENV}`);
});

// HTTP server for development
app.listen(PORT + 1, () => {
    logger.info(`HTTP server running on http://localhost:${PORT + 1}`);
});

module.exports = app;