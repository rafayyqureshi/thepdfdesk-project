# KeyVaultManager Documentation

## Table of Contents
1. [System Overview](#1-system-overview)
2. [Technical Specifications](#2-technical-specifications)
3. [Installation Guide](#3-installation-guide)
4. [Usage Guide](#4-usage-guide)
5. [Security Features](#5-security-features)
6. [Error Handling](#6-error-handling)
7. [API Documentation](#7-api-documentation)
8. [SQLite Database](#8-sqlite-database)
9. [Azure Blob Storage](#9-azure-blob-storage)
10. [Code Obfuscation](#10-code-obfuscation)
11. [Multi-Storage Testing Guide](#11-multi-storage-testing-guide)

## 1. System Overview

### Introduction
KeyVaultManager is a secure document encryption SDK that provides robust encryption and decryption capabilities using Azure Key Vault integration. The system supports multiple encryption algorithms and provides a user-friendly interface for key management and document handling.

### Architecture
- **Frontend**: Modern web interface for key management and document operations
- **Backend**: Node.js server with Express framework
- **Key Storage**: Azure Key Vault integration
- **Database**: SQLite for metadata storage
- **File Storage**: Azure Blob Storage (optional)

### Key Features
- Multiple encryption algorithm support (AES, RSA)
- Secure key management through Azure Key Vault
- File and text encryption capabilities
- Performance metrics tracking
- Automatic file handling
- Custom key naming support
- Secret management
- Blob storage integration

## 2. Technical Specifications

### Supported Key Types
1. **AES (Advanced Encryption Standard)**
   - Default Size: 256-bit
   - Recommended for: Large documents, general encryption
   - Storage: Azure Key Vault Secrets

2. **RSA (Rivest-Shamir-Adleman)**
   - Default Size: 2048-bit
   - Recommended for: Small data encryption, digital signatures
   - Storage: Azure Key Vault Keys

### Performance Specifications
- Maximum file size: 100MB
- RSA chunk size: Automatically calculated based on key size
- Response time tracking for all operations

## 3. Installation Guide

### Prerequisites
- Node.js v14 or higher
- npm v6 or higher
- Azure subscription
- Azure Key Vault instance
- Azure Storage account (optional)

### Environment Setup
1. Clone the repository
2. Create a `.env` file with the following configurations:
```bash
KEY_VAULT_NAME=your-keyvault-name
AZURE_TENANT_ID=your-tenant-id
AZURE_CLIENT_ID=your-client-id
AZURE_CLIENT_SECRET=your-client-secret
AZURE_STORAGE_CONNECTION_STRING=your-storage-connection-string
USE_AZURE_STORAGE=true
PORT=3000
NODE_ENV=production
```

### Installation Steps
```bash
# Install dependencies
npm install

# Start the server
npm start
```

### Authentication
- API Key required for all requests
- License Key required for key management operations

## 4. Usage Guide

### Key Generation
1. Access the web interface
2. Navigate to "Generate Key" section
3. Enter key name
4. Select key type (AES/RSA)
5. Select key length (optional - uses defaults if not specified)
6. Click "Generate Key"

### Document Encryption
1. Select the key to use
2. Upload file or enter text
3. Enable "Store in Azure Blob Storage" if you want to store the encrypted file
4. Click "Encrypt"
5. Download encrypted file or copy encrypted text

### Document Decryption
1. Select the key used for encryption
2. Upload encrypted file or paste encrypted text
3. Click "Decrypt"
4. Download decrypted file or view decrypted text

### Working with Blob Storage

#### Storing Files
1. During encryption, check the "Store in Azure Blob Storage" option
2. The file will be automatically uploaded after encryption
3. You'll receive a confirmation with the storage details

#### Retrieving and Decrypting Files
1. Go to the "Storage Status" section
2. Click "Refresh Storage List" to view all stored files
3. For each file, you'll see:
   - File name
   - Creation date
   - Size
   - Associated key name
4. To retrieve and decrypt:
   a. Click "Download" next to the desired file
   b. Go to the "Decrypt" section
   c. Enter the associated key name
   d. Upload the downloaded file
   e. Click "Decrypt"
   f. Download or view the decrypted content

#### Programmatic Access
```javascript
// Download encrypted file from blob
const downloadResponse = await fetch(`/api/downloadFile/filename.enc`, {
    method: 'GET',
    headers: {
        'x-api-key': 'your-api-key',
        'x-license-key': 'your-license-key'
    }
});
const encryptedFile = await downloadResponse.blob();

// Decrypt the file
const formData = new FormData();
formData.append('keyName', 'your-key-name');
formData.append('file', encryptedFile);

const decryptResponse = await fetch('/api/decrypt', {
    method: 'POST',
    headers: {
        'x-api-key': 'your-api-key',
        'x-license-key': 'your-license-key'
    },
    body: formData
});

// Handle decrypted file
const decryptedFile = await decryptResponse.blob();
```

## 9. Azure Blob Storage

### Configuration
```bash
AZURE_STORAGE_CONNECTION_STRING=your_storage_connection_string
USE_AZURE_STORAGE=true
```

### Features
- Automatic container creation
- Metadata storage with encryption details
- Stream processing for large files
- Encryption metadata tracking
- Secure file retrieval and storage

### Storage Structure
- Files are stored with a unique identifier
- Metadata includes:
  - Original filename
  - Creation timestamp
  - Key name used for encryption
  - Original file extension
  - Encryption type
  - File size

### Best Practices
- Regularly monitor storage usage
- Implement file retention policies
- Keep track of key-file associations
- Back up storage metadata
- Monitor access patterns
- Implement proper error handling for storage operations

### Common Operations
#### Listing Files
```javascript
GET /api/listFiles
Headers:
  x-api-key: your-api-key
  x-license-key: your-license-key
```

#### Downloading Files
```javascript
GET /api/downloadFile/{filename}
Headers:
  x-api-key: your-api-key
  x-license-key: your-license-key
```

#### File Metadata
- Each stored file includes metadata about:
  - Encryption parameters
  - Original file details
  - Key association
  - Timestamps
  - Access patterns

## 5. Security Features

### Key Management
- Secure key storage in Azure Key Vault
- RSA keys stored as native Key Vault keys
- AES keys stored as Key Vault secrets
- Automatic key type detection
- Custom key naming support

### Encryption Standards
- AES-256 for document encryption
- RSA-2048 for small data encryption
- Secure IV generation for AES
- PKCS1 OAEP padding for RSA

### Best Practices
- Use AES for large documents
- Use RSA only for small data
- Maintain secure storage of key names
- Regular key rotation recommended

## 6. Error Handling

### Common Error Response Format
```json
{
    "error": "Error message",
    "details": "Additional error information"
}
```

### Error Types
#### Key Generation Errors
- Duplicate key names
- Invalid key parameters
- Azure Key Vault access issues

#### Encryption Errors
- File size limits
- Invalid key types
- Buffer handling errors

#### Decryption Errors
- Invalid encrypted data
- Missing keys
- File corruption

### Troubleshooting
- Check key availability
- Verify key type matches operation
- Ensure file size limits are not exceeded
- Verify Azure Key Vault connectivity

## 7. API Documentation

### Key Management APIs

#### 1. Generate Key
- **Endpoint**: `/api/generateKey`
- **Method**: POST
- **Headers Required**:
```json
{
  "x-api-key": "API Key",
  "x-license-key": "License Key",
  "Content-Type": "application/json"
}
```
- **Request Body**:
```json
{
  "keyName": "string",    // Required: Name for the key
  "keyType": "string",    // Optional: "AES" or "RSA" (default: AES)
  "keyLength": "string"   // Optional: "256" for AES, "2048" for RSA
}
```
- **Response**:
```json
{
  "success": true,
  "name": "keyName",
  "type": "AES|RSA",
  "details": {
    "storageType": "Secret|Key",
    "created": "timestamp",
    "enabled": true
  }
}
```

#### 2. Retrieve Key
- **Endpoint**: `/api/retrieveKey`
- **Method**: POST
- **Headers**: Same as Generate Key
- **Request Body**:
```json
{
  "keyName": "string"    // Required: Name of the key to retrieve
}
```
- **Response**: Same format as Generate Key

### Document Operations

#### 1. Encrypt
- **Endpoint**: `/api/encrypt`
- **Method**: POST
- **Headers Required**: 
  - `x-api-key`: API Key
  - `x-license-key`: License Key
- **Request Body** (multipart/form-data):
```
keyName: string          // Required: Name of the key to use
file: File              // Document to encrypt (or)
data: string            // Text to encrypt
useStorage: boolean     // Optional: Store in Azure Blob Storage
```
- **Response**:
```json
{
  "success": true,
  "encryptedData": {
    "encryptionType": "AES|RSA",
    "encryptedData": "base64-encoded-string",
    "iv": "hex-string",
    "keyName": "string",
    "isFile": boolean,
    "originalFileName": "string",
    "originalExtension": "string",
    "timestamp": "ISO-date-string",
    "originalSize": number,
    "encryptedSize": number,
    "storageDetails": {    // Only if useStorage is true
      "fileName": "string",
      "url": "string",
      "metadata": object
    }
  }
}
```

#### 2. Decrypt
- **Endpoint**: `/api/decrypt`
- **Method**: POST
- **Headers**: Same as Encrypt
- **Request Body** (multipart/form-data):
```
keyName: string          // Required: Name of the key used for encryption
file: File              // Encrypted file to decrypt (or)
data: string            // Encrypted data in JSON format
```
- **Response**:
```json
{
  "success": true,
  "data": "decrypted-content",
  "isFile": boolean,
  "originalFileName": "string",
  "originalExtension": "string",
  "originalSize": number,
  "decryptedSize": number,
  "timestamp": "ISO-date-string",
  "encryptionType": "AES|RSA"
}
```

### Blob Storage Operations

#### 1. List Files
- **Endpoint**: `/api/listFiles`
- **Method**: GET
- **Headers Required**:
```json
{
  "x-api-key": "API Key",
  "x-license-key": "License Key"
}
```
- **Response**:
```json
{
  "success": true,
  "files": [
    {
      "name": "string",
      "url": "string",
      "size": number,
      "timestamp": "ISO-date-string",
      "metadata": {
        "keyName": "string",
        "originalFileName": "string",
        "originalExtension": "string",
        "encryptionType": "string"
      }
    }
  ]
}
```

#### 2. Download File
- **Endpoint**: `/api/downloadFile/{filename}`
- **Method**: GET
- **Headers Required**:
```json
{
  "x-api-key": "API Key",
  "x-license-key": "License Key"
}
```
- **Response**: Binary file content with headers:
```
Content-Type: application/octet-stream
Content-Disposition: attachment; filename="filename"
Content-Length: file-size
```

### Secret Management

#### 1. Create Secret
- **Endpoint**: `/api/createSecret`
- **Method**: POST
- **Headers**: Same as Generate Key
- **Request Body**:
```json
{
  "secretName": "string",
  "secretValue": "string"
}
```
- **Response**:
```json
{
  "success": true,
  "name": "string",
  "details": {
    "created": "ISO-date-string"
  }
}
```

#### 2. Retrieve Secret
- **Endpoint**: `/api/retrieveSecret`
- **Method**: POST
- **Headers**: Same as Create Secret
- **Request Body**:
```json
{
  "secretName": "string"
}
```
- **Response**:
```json
{
  "success": true,
  "name": "string",
  "value": "string",
  "details": {
    "created": "ISO-date-string",
    "updated": "ISO-date-string",
    "enabled": boolean
  }
}
```

## 8. SQLite Database

### Database Schema
```sql
CREATE TABLE keys (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    length INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE configurations (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE documents (
    id TEXT PRIMARY KEY,
    key_id TEXT NOT NULL,
    storage_type TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (key_id) REFERENCES keys(id)
);
```

### Stored Information
- `keys` table: Key metadata
- `configurations` table: System configurations
- `documents` table: Document metadata

## 9. Azure Blob Storage

### Configuration
```bash
AZURE_STORAGE_CONNECTION_STRING=your_storage_connection_string
USE_AZURE_STORAGE=true
```

### Features
- Automatic container creation
- Metadata storage
- Stream processing for large files
- Encryption metadata tracking

## 10. Code Obfuscation

### What is Code Obfuscation?
Code obfuscation is a security practice that makes the source code harder to understand while maintaining its functionality. This helps protect your intellectual property and makes reverse engineering more difficult.

### Setting Up Obfuscation

#### Installation
```bash
# Install the obfuscator as a development dependency
npm install javascript-obfuscator --save-dev
```

#### Basic Configuration
Create a file named `obfuscator.config.js` in your project root:
```javascript
module.exports = {
    // Basic protection
    compact: true,
    controlFlowFlattening: true,
    deadCodeInjection: true,
    
    // Enhanced security
    debugProtection: true,
    disableConsoleOutput: true,
    
    // Identifier transformation
    identifierNamesGenerator: 'hexadecimal',
    
    // Additional protection
    selfDefending: true,
    stringArray: true
};
```

### Configuration Options Explained

#### Essential Options
- `compact: true` - Removes newlines and spaces to reduce code size
- `controlFlowFlattening: true` - Makes code flow harder to follow
- `deadCodeInjection: true` - Adds meaningless code to confuse analysis

#### Security Options
- `debugProtection: true` - Prevents debugging using dev tools
- `disableConsoleOutput: true` - Removes console.log statements
- `selfDefending: true` - Prevents code formatting/beautification

#### Customization Options
- `identifierNamesGenerator: 'hexadecimal'` - Converts variable names to hex
- `stringArray: true` - Moves strings to a separate array

### Using the Obfuscator

#### Add Script to package.json
```json
{
  "scripts": {
    "obfuscate": "javascript-obfuscator ./src --output ./dist --config obfuscator.config.js"
  }
}
```

#### Running Obfuscation
```bash
# Obfuscate your code
npm run obfuscate
```

### Best Practices

#### Do's
- Always test obfuscated code thoroughly
- Keep original source code in a secure location
- Use source maps in development
- Obfuscate only the production build
- Regular security audits of obfuscated code

#### Don'ts
- Don't obfuscate third-party libraries
- Don't rely solely on obfuscation for security
- Don't obfuscate development builds
- Don't lose track of your original source code

### Advanced Configuration Example
```javascript
module.exports = {
    // Basic settings
    compact: true,
    controlFlowFlattening: true,
    controlFlowFlatteningThreshold: 0.75,
    deadCodeInjection: true,
    deadCodeInjectionThreshold: 0.4,
    
    // Enhanced protection
    debugProtection: true,
    debugProtectionInterval: 4000,
    disableConsoleOutput: true,
    
    // Name obfuscation
    identifierNamesGenerator: 'hexadecimal',
    identifiersPrefix: '_0x',
    
    // String protection
    stringArray: true,
    stringArrayEncoding: ['base64'],
    stringArrayThreshold: 0.75,
    
    // Additional security
    selfDefending: true,
    transformObjectKeys: true,
    unicodeEscapeSequence: false
};
```

### Troubleshooting

#### Common Issues
1. **Performance Impact**
   - Reduce `controlFlowFlatteningThreshold`
   - Adjust `deadCodeInjectionThreshold`

2. **Debug Issues**
   - Use source maps in development
   - Disable `debugProtection` temporarily

3. **Size Concerns**
   - Adjust `stringArrayThreshold`
   - Consider selective obfuscation

#### Validation Steps
1. Test functionality after obfuscation
2. Verify performance metrics
3. Check browser compatibility
4. Validate source maps
5. Monitor runtime behavior

### Example Output
```javascript
// Original Code
function calculateTotal(price, quantity) {
    return price * quantity;
}

// Obfuscated Code
var _0x4a8f=['\x72\x65\x74\x75\x72\x6E'];
(function(_0x2d8f1f,_0x4a8f1d){
    var _0x4a8f1f=function(_0x2d8f1f){
        while(--_0x2d8f1f){
            _0x4a8f1d['push'](_0x4a8f1d['shift']());
        }
    };
    _0x4a8f1f(++_0x2d8f1f);
}(_0x4a8f,0x1a9));
```

## 11. Multi-Storage Testing Guide

This guide will help you test the new multi-storage functionality in KeyVaultManager using the included test UI and Postman collections.

### Getting Started

1. Ensure your KeyVaultManager server is running:
   ```
   npm start
   ```

2. Open the test UI in your browser:
   - Navigate to `multistorage-test.html` in your browser
   - This can be done by opening the file directly or using a local HTTP server

### Postman Collections

We've provided a Postman collection for testing:

**KeyVaultManager-MultiStorage.postman_collection.json** - Complete collection with all endpoints and tests for multi-storage functionality

To use this collection:
- Import it into Postman
- Ensure your server is running
- Execute the requests in sequence

### Testing Steps

#### 1. Storage Information

The first tab shows storage information:
- Click "List Storage Locations" to see all configured storage locations
- Click "List All Files" to see files across all storage locations

#### 2. Key Management

Before testing encryption/decryption:
- Generate a key using the "Generate Key" button
- The default values (test-key, AES, 256 bits) should work fine

#### 3. File Operations

Test encryption and decryption:
- **Encrypt File**: Upload a file or enter text, select a storage location
- **Decrypt File**: Upload an encrypted file for decryption

#### 4. Multi-Storage Tests

Test specific multi-storage features:
- List files from specific storage locations
- Download files from specific storage locations
- Retrieve and decrypt documents directly
- Test cross-storage isolation (should fail as expected)

### Testing Multi-Storage Features

#### File Storage in Different Locations

1. Create a key if you haven't already
2. Go to "File Operations" tab
3. Upload a file to the Default storage
4. Upload another file to ClientA storage
5. Go to "Storage Info" tab and list all files
6. Verify files appear in the correct locations

#### Cross-Storage Security Test

1. Upload a file to ClientA storage
2. Go to "Multi-Storage Tests" tab
3. In the "Cross-Storage Test" section, enter the file name
4. Set Original Storage to "ClientA" and Target Storage to "ClientB"
5. Click "Test Cross-Storage Access"
6. This should correctly fail, confirming storage isolation

#### One-Step Retrieval & Decryption

1. Upload a file to a storage location (note the filename)
2. Go to "Multi-Storage Tests" tab
3. In the "Retrieve and Decrypt" section, enter the filename and key name
4. Click "Retrieve Document"
5. The file should be retrieved and decrypted in one step

### Troubleshooting

- If you encounter "port in use" errors, ensure no other Node.js processes are running
- If files don't appear in the list, click "List All Files" to refresh
- Check the browser console for detailed error messages

### Notes

- The UI automatically extracts filenames from responses for re-use in downloads
- Storage locations are color-coded for easier identification
- All API calls use the credentials specified at the top of the page
