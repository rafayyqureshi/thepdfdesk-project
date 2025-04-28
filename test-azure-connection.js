// Simple script to test Azure Storage connectivity
const { BlobServiceClient } = require('@azure/storage-blob');
require('dotenv').config();

async function testAzureConnection() {
  try {
    console.log('Testing Azure Storage connection...');
    console.log('Connection string being used (partially masked):');
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
    // Show just the account name part for security
    const accountName = connectionString.match(/AccountName=([^;]+)/)[1];
    console.log(`Connection string contains AccountName=${accountName}`);
    
    // Create the BlobServiceClient
    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    
    // Get container name from env or use default
    const containerName = process.env.STORAGE_CONTAINER_NAME || 'encrypted-files';
    console.log(`Using container: ${containerName}`);
    
    // Get a reference to a container
    const containerClient = blobServiceClient.getContainerClient(containerName);
    
    // First try to check if container exists
    console.log('Checking if container exists...');
    const exists = await containerClient.exists();
    console.log(`Container exists: ${exists}`);
    
    if (!exists) {
      console.log('Container does not exist. Attempting to create it...');
      const createResult = await containerClient.create();
      console.log('Container created successfully:', createResult.requestId);
    }
    
    // Try to list blobs to verify access
    console.log('Listing blobs in container...');
    let i = 0;
    for await (const blob of containerClient.listBlobsFlat()) {
      console.log(`Blob ${i++}: ${blob.name}`);
      if (i > 5) {
        console.log('... and more blobs (showing only first 5)');
        break;
      }
    }
    
    if (i === 0) {
      console.log('No blobs found in container. Trying to upload a test blob...');
      const blockBlobClient = containerClient.getBlockBlobClient(`test-blob-${new Date().getTime()}.txt`);
      const uploadResult = await blockBlobClient.upload('This is a test blob', 16);
      console.log(`Test blob uploaded successfully: ${blockBlobClient.name}`);
    }
    
    console.log('Azure Storage connection test SUCCESSFUL');
    return true;
  } catch (error) {
    console.error('Azure Storage connection test FAILED');
    console.error('Error details:', error.message);
    if (error.code) console.error('Error code:', error.code);
    if (error.statusCode) console.error('Status code:', error.statusCode);
    console.error('Full error:', error);
    return false;
  }
}

// Run the test
testAzureConnection()
  .then(success => {
    console.log(`Test complete. Success: ${success}`);
    process.exit(success ? 0 : 1);
  })
  .catch(err => {
    console.error('Unhandled error in test:', err);
    process.exit(1);
  }); 