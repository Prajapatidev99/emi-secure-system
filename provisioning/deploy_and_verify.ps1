# EMI Secure - Deploy & Verify Only
Write-Host "📦 Locating APK built by Android Studio..." -ForegroundColor Cyan
$src = "e:\gemini-app\android\app\build\outputs\apk\release\app-release.apk"
$dst = "e:\gemini-app\backend\public\EMI-Secure.apk"

if (-not (Test-Path $src)) {
    Write-Host "❌ Could not find the APK. Did you click 'Build' in Android Studio yet?" -ForegroundColor Red
    exit
}

Copy-Item $src $dst -Force
Write-Host "✅ Copied to Backend Public folder." -ForegroundColor Green

Write-Host "🛡️ Verifying Signature..." -ForegroundColor Cyan
$cert = & keytool -list -printcert -jarfile $dst
if ($cert -match "SHA256:") {
    Write-Host "✅ SIGNED SUCCESSFULLY! It is safe to push." -ForegroundColor Green
    $cert | Select-String "SHA256:"
} else {
    Write-Host "❌ WARNING: The file is NOT signed. Please rebuild with Signing Config." -ForegroundColor Red
}

Write-Host "🏁 DONE! Please push to Render now." -ForegroundColor Cyan
