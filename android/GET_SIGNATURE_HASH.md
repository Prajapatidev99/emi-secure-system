# How to Get APK Signature Hash for QR Provisioning

To use QR Code provisioning with maximum security (preventing other apps from spoofing yours), you need the **SHA-256 Signature Hash** of your signing certificate.

### 1. The Easy Way (Using Keytool)

If you have your `app-release.apk` file, run this command in your terminal:

```bash
keytool -list -printcert -jarfile app-release.apk
```

**What to look for:**
Find the line that starts with `SHA256:`. It will look like a long string of hex numbers separated by colons:
`FA:2D:A1:08:95:B1:3A...`

### 2. Converting to Base64 (Required for QR)

Android provisioning needs this hash in **Base64Url** format (without padding). 

You can use an online converter or this PowerShell command:

```powershell
$hash = "FA:2D:A1:08:..." # Paste your SHA256 hex here
$bytes = $hash.Split(':') | ForEach-Object { [System.Convert]::ToByte($_, 16) }
$base64 = [System.Convert]::ToBase64String($bytes).Replace('+', '-').Replace('/', '_').TrimEnd('=')
Write-Output $base64
```

### 3. Verification

Once you have the Base64 string (e.g., `-i2hGJWxOs...`), paste it into the **Signature Hash** field in the Dashboard's Provisioning tool.

---

> [!TIP]
> **Don't have the hash?** No problem. QR provisioning still works without it, but the device will show a warning that the "identity of the app cannot be verified" during setup. It is recommended to add it for a professional experience.
