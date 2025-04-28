// generateCertificate.js
const forge = require('node-forge');
const fs = require('fs');
const path = require('path');

// Create the ssl directory if it doesn't exist
const sslDir = path.join(__dirname, 'ssl');
if (!fs.existsSync(sslDir)) {
    fs.mkdirSync(sslDir);
}

// Generate a key pair
const keys = forge.pki.rsa.generateKeyPair(2048);

// Create a certificate
const cert = forge.pki.createCertificate();

// Set certificate details
cert.publicKey = keys.publicKey;
cert.serialNumber = '01';
cert.validity.notBefore = new Date();
cert.validity.notAfter = new Date();
cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);

// Add certificate attributes
const attrs = [{
    name: 'commonName',
    value: 'localhost'
}, {
    name: 'countryName',
    value: 'US'
}, {
    name: 'organizationName',
    value: 'KeyVaultManager Development'
}, {
    shortName: 'OU',
    value: 'Development'
}];

cert.setSubject(attrs);
cert.setIssuer(attrs);

// Sign the certificate
cert.sign(keys.privateKey, forge.md.sha256.create());

// Convert to PEM format
const privatePem = forge.pki.privateKeyToPem(keys.privateKey);
const certPem = forge.pki.certificateToPem(cert);

// Save the files
fs.writeFileSync(path.join(sslDir, 'private.key'), privatePem);
fs.writeFileSync(path.join(sslDir, 'certificate.crt'), certPem);

console.log('SSL certificate and private key have been generated in the ssl directory.');