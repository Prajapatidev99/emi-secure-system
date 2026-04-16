# EMI Secure - Automatic Build & Deploy Script
$ErrorActionPreference = "Stop"

Write-Host "🔍 Searching for Java..." -ForegroundColor Cyan
$jbrPath = "C:\Program Files\Android\Android Studio\jbr"
if (-not (Test-Path $jbrPath)) {
    $jbrPath = Get-ChildItem -Path "C:\Program Files\Android\Android Studio" -Recurse -Filter "bin" | Where-Object { $_.FullName -match "jbr" } | Select-Object -First 1 -ExpandProperty FullName
    if ($jbrPath) { $jbrPath = Split-Path $jbrPath -Parent }
}

if (-not $jbrPath) {
    Write-Host "❌ Java not found. Please build using Android Studio menu." -ForegroundColor Red
    exit
}

Write-Host "✅ Java found: $jbrPath" -ForegroundColor Green
$env:JAVA_HOME = $jbrPath

Write-Host "🔨 Building APK..." -ForegroundColor Cyan
cd e:\gemini-app\android
.\gradlew assembleRelease

$apkSource = "e:\gemini-app\android\app\build\outputs\apk\release\app-release.apk"
$apkDest = "e:\gemini-app\backend\public\EMI-Secure.apk"

if (Test-Path $apkSource) {
    Write-Host "📦 Copying APK..." -ForegroundColor Cyan
    if (-not (Test-Path "e:\gemini-app\backend\public")) { New-Item -ItemType Directory -Path "e:\gemini-app\backend\public" -Force }
    Copy-Item $apkSource $apkDest -Force
    
    Write-Host "🛡️ Verifying..." -ForegroundColor Cyan
    $certInfo = & keytool -list -printcert -jarfile $apkDest
    if ($certInfo -match "SHA256:") {
        Write-Host "✅ SIGNED SUCCESSFULLY!" -ForegroundColor Green
        $certInfo | Select-String "SHA256:"
    } else {
        Write-Host "❌ NOT SIGNED!" -ForegroundColor Red
    }
} else {
    Write-Host "❌ Build failed - File not found." -ForegroundColor Red
}

Write-Host "🏁 DONE! Please push backend and scan 'Cert Hash' QR." -ForegroundColor Cyan
