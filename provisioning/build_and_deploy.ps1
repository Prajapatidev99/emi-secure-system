# EMI Secure - Build & Deploy
$ErrorActionPreference = "Stop"
Write-Host "🔍 Finding Java..." -ForegroundColor Cyan
$jbr = "C:\Program Files\Android\Android Studio\jbr"
if (-not (Test-Path $jbr)) { 
    $jbr = Get-ChildItem -Path "C:\Program Files\Android\Android Studio" -Recurse -Filter "bin" | Where-Object { $_.FullName -match "jbr" } | Select-Object -First 1 -ExpandProperty FullName
    if ($jbr) { $jbr = Split-Path $jbr -Parent }
}
if (-not $jbr) { Write-Host "❌ Java not found." -ForegroundColor Red; exit }
$env:JAVA_HOME = $jbr
Write-Host "🔨 Building..." -ForegroundColor Cyan
cd ..\android
.\gradlew assembleRelease
$src = "e:\gemini-app\android\app\build\outputs\apk\release\app-release.apk"
$dst = "e:\gemini-app\backend\public\EMI-Secure.apk"
if (Test-Path $src) {
    Copy-Item $src $dst -Force
    Write-Host "🛡️ Verifying..." -ForegroundColor Cyan
    $cert = & keytool -list -printcert -jarfile $dst
    if ($cert -match "SHA256:") { 
        Write-Host "✅ SIGNED SUCCESSFULLY" -ForegroundColor Green
        $cert | Select-String "SHA256:"
    }
}
Write-Host "🏁 DONE" -ForegroundColor Cyan
