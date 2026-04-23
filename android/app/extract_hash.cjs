
const fs = require('fs');
const crypto = require('crypto');

const apkPath = 'e:/gemini-app/backend/public/EMI-Secure.apk';
const fileBuffer = fs.readFileSync(apkPath);
const hashSum = crypto.createHash('sha256');
hashSum.update(fileBuffer);

const hex = hashSum.digest('hex');
const base64Url = crypto.createHash('sha256')
    .update(fileBuffer)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

console.log('--- CHECKSUM REPORT ---');
console.log('Hex: ' + hex);
console.log('Base64 URL-safe (QR Standard): ' + base64Url);
fs.writeFileSync('e:/gemini-app/backend/public/apk_checksum.txt', base64Url);
