// Test the generateKey endpoint
async function testGenerateKey() {
    try {
        const response = await fetch('/api/generateKey', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': 'api-key-mvp-2024',
                'x-license-key': 'keyvaultmanager-mvp-2024'
            },
            body: JSON.stringify({
                keyName: 'testKey1',
                keyType: 'AES',
                keyLength: '256'
            })
        });

        const data = await response.json();
        console.log('Generate Key Response:', data);
    } catch (error) {
        console.error('Error:', error);
    }
}