// utils/validation.js
const config = require('../../config/config');

const validateApiKey = (req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    const defaultApiKey = 'api-key-mvp-2024';
    
    // First check if it's a browser request
    const isBrowserRequest = req.headers['user-agent']?.includes('Mozilla');
    
    if (isBrowserRequest) {
        // For browser requests, set the default API key
        req.headers['x-api-key'] = defaultApiKey;
        return next();
    }

    // For non-browser requests, validate the provided API key
    if (!apiKey || apiKey !== defaultApiKey) {
        return res.status(401).json({ error: 'Invalid API key' });
    }

    next();
};

const validateLicenseKey = (req, res, next) => {
    const licenseKey = req.headers['x-license-key'];
    const defaultLicenseKey = 'keyvaultmanager-mvp-2024';
    
    // First check if it's a browser request
    const isBrowserRequest = req.headers['user-agent']?.includes('Mozilla');
    
    if (isBrowserRequest) {
        // For browser requests, set the default license key
        req.headers['x-license-key'] = defaultLicenseKey;
        return next();
    }

    // For non-browser requests, validate the provided license key
    if (!licenseKey || licenseKey !== defaultLicenseKey) {
        return res.status(401).json({ error: 'Invalid license key' });
    }

    next();
};

module.exports = {
    validateApiKey,
    validateLicenseKey
};