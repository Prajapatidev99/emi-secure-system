const { execSync } = require('child_process');
const fs = require('fs');
try {
    const output = execSync('keytool -list -v -keystore emi-secure.jks -storepass emi-secure-password -alias emi-key', { encoding: 'utf8' });
    const match = output.match(/SHA256:\s+([A-Z0-9:]+)/i);
    if (match) {
        const hex = match[1].replace(/:/g, '');
        const bytes = Buffer.from(hex, 'hex');
        const b64url = bytes.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
        const results = `RAW_HEX: ${hex}\nBASE64URL: ${b64url}\nLENGTH: ${bytes.length}`;
        fs.writeFileSync('result.txt', results, 'utf8');
        console.log('Full hash written to result.txt');
    } else {
        console.log('SHA256 not found');
    }
} catch (e) {
    console.error(e.message);
}
