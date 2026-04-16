# EMI Secure - Signature Guard
Write-Host "🔍 checking e:\gemini-app\backend\public\EMI-Secure.apk..." -ForegroundColor Cyan
$target = "e:\gemini-app\backend\public\EMI-Secure.apk"

if (-not (Test-Path $target)) {
    Write-Host "❌ File not found! Please copy your APK to this folder first." -ForegroundColor Red
    exit
}

$cert = & keytool -list -printcert -jarfile $target
if ($cert -match "SHA256:") {
    Write-Host "`n✅ SUCCESS: THIS APK IS SIGNED!" -ForegroundColor Green -BackgroundColor Black
    Write-Host "You are safe to git push to Render." -ForegroundColor Green
    Write-Host "`nFingerprint (Use this if scan fails):" -ForegroundColor Cyan
    $cert | Select-String "SHA256:"
} else {
    Write-Host "`n❌ DANGER: THIS APK IS NOT SIGNED!" -ForegroundColor Red -BackgroundColor Black
    Write-Host "Do NOT push this to Render. It will cause a Checksum Error." -ForegroundColor Yellow
}
