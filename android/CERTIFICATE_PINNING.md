# Certificate Pinning Setup Guide

## What is Certificate Pinning?

Certificate pinning prevents Man-In-The-Middle (MITM) attacks by ensuring the app only trusts specific SSL certificates from your backend server. Even if an attacker has a valid CA certificate, they cannot intercept your app's traffic.

## How to Extract Your Backend's Certificate Hash

Run this command to get the SHA-256 hash of your backend's SSL certificate:

```bash
openssl s_client -connect emi-secure-system.onrender.com:443 </dev/null 2>/dev/null | \
  openssl x509 -pubkey -noout | \
  openssl pkey -pubin -outform der | \
  openssl dgst -sha256 -binary | \
  base64
```

This will output something like:
```
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=
```

## Update the Certificate Pins

1. Open `SecureNetworkClient.kt`
2. Replace the placeholder hashes in the `certificatePinner` section:

```kotlin
.certificatePinner(
    CertificatePinner.Builder()
        .add("emi-secure-system.onrender.com", "sha256/YOUR_ACTUAL_HASH_HERE=")
        .add("emi-secure-system.onrender.com", "sha256/BACKUP_HASH_HERE=")  // Optional backup
        .build()
)
```

## Important Notes

⚠️ **WARNING**: If your backend's SSL certificate changes (e.g., renewal), the app will FAIL to connect until you update the pins and release a new version.

💡 **Recommendation**: 
- Pin both the current certificate AND the backup/next certificate
- Set up monitoring to alert you before certificate expiration
- Consider implementing a fallback mechanism or remote pin updates for production

## Testing Certificate Pinning

1. Build and run the app
2. Try to intercept traffic using a proxy (e.g., Charles Proxy, Burp Suite)
3. The app should REJECT the connection with a certificate validation error

## For Development

During development, you may want to disable certificate pinning to use debugging proxies. You can:

1. Create a debug build variant without pinning
2. Or comment out the `.certificatePinner()` section temporarily

**NEVER disable pinning in production releases!**
