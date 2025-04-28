const swaggerJsdoc = require('swagger-jsdoc');
const path = require('path');

const options = {
    swaggerDefinition: {
        openapi: '3.0.0',
        info: {
            title: 'KeyVaultManager API Documentation',
            version: '1.0.0',
            description: 'API documentation for KeyVaultManager services',
            contact: {
                name: 'KeyVaultManager Support'
            }
        },
        servers: [
            {
                url: `https://localhost:${process.env.PORT || 3000}/api`,
                description: 'Development server (HTTPS)'
            },
            {
                url: `http://localhost:${(process.env.PORT || 3000) + 1}/api`,
                description: 'Development server (HTTP)'
            }
        ],
        components: {
            securitySchemes: {
                ApiKeyAuth: {
                    type: 'apiKey',
                    in: 'header',
                    name: 'x-api-key',
                    description: 'API key (use "api-key-mvp-2024")'
                },
                LicenseKeyAuth: {
                    type: 'apiKey',
                    in: 'header',
                    name: 'x-license-key',
                    description: 'License key (use "keyvaultmanager-mvp-2024")'
                }
            }
        },
        security: [
            {
                ApiKeyAuth: [],
                LicenseKeyAuth: []
            }
        ]
    },
    apis: [path.join(__dirname, '../api/routes.js')],
};

const specs = swaggerJsdoc(options);
module.exports = specs;