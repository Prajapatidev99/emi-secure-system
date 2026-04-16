const { execSync } = require('child_process');
const fs = require('fs');
try {
    const output = execSync('keytool -list -v -keystore emi-secure.jks -storepass emi-secure-password -alias emi-key', { encoding: 'utf8' });
    const match = output.match(/SHA256:\s+([A-F0-9:]+)/i);
    if (match) {
        const hex = match[1];
        const bytes = Buffer.from(hex.replace(/:/g, ''), 'hex');
        const b64url = bytes.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
        const results = `HEX: ${hex}\nBASE64URL: ${b64url}`;
        fs.writeFileSync('result.txt', results, 'utf8');
        console.log('Results written to result.txt');
    } else {
        console.log('SHA256 not found in output');
    }
} catch (e) {
    console.error(e.message);
}
