// tests/testKeyVault.js
require('dotenv').config();
const KeyVaultService = require('../src/services/keyVaultService');

async function testKeyVault() {
    try {
        console.log('Creating KeyVaultService instance...');
        const keyVaultService = new KeyVaultService();
        console.log('KeyVaultService instance created successfully');

        // Test RSA key creation
        console.log('Creating RSA key...');
        const rsaKey = await keyVaultService.createKey('test-rsa-key-1', 'RSA', 2048);
        console.log('RSA Key created:', rsaKey);

        // Test RSA key retrieval
        console.log('Retrieving RSA key...');
        const retrievedRsa = await keyVaultService.getKey('test-rsa-key-1');
        console.log('Retrieved RSA key:', retrievedRsa);

    } catch (error) {
        console.error('Test failed:', error);
    }
}

// Run the test
console.log('Starting KeyVault test...');
testKeyVault();