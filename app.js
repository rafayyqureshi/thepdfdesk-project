const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const routes = require('./routes/routes');
const { corsMiddleware } = require('./utils/validation');
const logger = require('./utils/logger');
const swaggerUi = require('swagger-ui-express');
const swaggerSpecs = require('./config/swagger.config');

const app = express();

// Body parser middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// CORS middleware
app.use(corsMiddleware);

// Debug middleware
app.use((req, res, next) => {
    logger.info(`Request URL: ${req.url}`);
    logger.info('Request headers:', req.headers);
    next();
});

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Swagger documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpecs));

// API routes
app.use('/api', routes);

// Root route to serve the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
    logger.error(`Error: ${err.stack}`);
    res.status(500).json({ 
        error: 'Internal Server Error',
        message: err.message,
        path: req.path
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Not Found' });
});

const PORT = process.env.PORT || 3000;

// Only start server if not being required by another module
if (!module.parent) {
    app.listen(PORT, () => {
        logger.info(`Server running on port ${PORT}`);
        console.log(`Server is running on http://localhost:${PORT}`);
        console.log(`Swagger documentation available at http://localhost:${PORT}/api-docs`);
    });
}

module.exports = app;