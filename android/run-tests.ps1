# ============================================
# EMI Secure - Test Runner Script
# ============================================
# Builds the APKs and runs Espresso tests on:
# 1. Connected emulator/device (local)
# 2. Firebase Test Lab (optional, requires gcloud)
# ============================================

param(
    [switch]$FirebaseTestLab,
    [string]$Device = "",
    [switch]$BuildOnly
)

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host " EMI Secure - Test Runner" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# -----------------------------------------------
# Step 1: Build Debug APK + Test APK
# -----------------------------------------------
Write-Host "[1/3] Building Debug APK..." -ForegroundColor Yellow
& .\gradlew.bat :app:assembleDebug
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Debug APK build failed!" -ForegroundColor Red
    exit 1
}
Write-Host "Debug APK built." -ForegroundColor Green

Write-Host "[2/3] Building Test APK..." -ForegroundColor Yellow
& .\gradlew.bat :app:assembleDebugAndroidTest
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Test APK build failed!" -ForegroundColor Red
    exit 1
}
Write-Host "Test APK built." -ForegroundColor Green

$debugApk = "app\build\outputs\apk\debug\app-debug.apk"
$testApk = "app\build\outputs\apk\androidTest\debug\app-debug-androidTest.apk"

if ($BuildOnly) {
    Write-Host ""
    Write-Host "Build-only mode. APKs are ready:" -ForegroundColor Green
    Write-Host "  Debug APK: $debugApk" -ForegroundColor White
    Write-Host "  Test APK:  $testApk" -ForegroundColor White
    exit 0
}

# -----------------------------------------------
# Step 2: Run tests locally or on Firebase
# -----------------------------------------------
if ($FirebaseTestLab) {
    # Firebase Test Lab execution
    Write-Host "[3/3] Running on Firebase Test Lab..." -ForegroundColor Yellow
    
    $gcloud = Get-Command gcloud -ErrorAction SilentlyContinue
    if (-not $gcloud) {
        Write-Host "ERROR: gcloud CLI not found!" -ForegroundColor Red
        Write-Host "Install it from: https://cloud.google.com/sdk/docs/install" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Or use the APKs manually:" -ForegroundColor White
        Write-Host "  1. Go to https://console.firebase.google.com/project/phone-emi/testlab" -ForegroundColor White
        Write-Host "  2. Click 'Run a test' > 'Instrumentation'" -ForegroundColor White
        Write-Host "  3. Upload: $debugApk" -ForegroundColor White
        Write-Host "  4. Upload: $testApk" -ForegroundColor White
        exit 1
    }

    Write-Host "Uploading to Firebase Test Lab (project: phone-emi)..." -ForegroundColor Yellow
    Write-Host "Testing on multiple devices and API levels..." -ForegroundColor Yellow
    
    & gcloud firebase test android run `
        --type instrumentation `
        --app $debugApk `
        --test $testApk `
        --project phone-emi `
        --device model=Pixel6,version=33 `
        --device model=Pixel6,version=34 `
        --device model=Pixel6,version=30 `
        --timeout 5m `
        --results-dir "test-results-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "All Firebase Test Lab tests PASSED!" -ForegroundColor Green
    } else {
        Write-Host ""
        Write-Host "Some tests FAILED. Check the Firebase Console for details:" -ForegroundColor Red
        Write-Host "  https://console.firebase.google.com/project/phone-emi/testlab" -ForegroundColor Yellow
    }
} else {
    # Local emulator/device execution
    Write-Host "[3/3] Running tests on connected device/emulator..." -ForegroundColor Yellow
    
    # Check for connected devices
    $adb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
    if (-not (Test-Path $adb)) { $adb = "adb" }
    
    $devices = & $adb devices 2>$null | Select-String "device$"
    if (-not $devices) {
        Write-Host "ERROR: No connected devices or emulators found!" -ForegroundColor Red
        Write-Host ""
        Write-Host "Start an emulator first:" -ForegroundColor Yellow
        Write-Host "  .\setup-emulators.ps1    (to create emulators)" -ForegroundColor White
        Write-Host "  emulator -avd EMI_Test_API34  (to start one)" -ForegroundColor White
        exit 1
    }
    
    Write-Host "Found devices:" -ForegroundColor Green
    & $adb devices

    & .\gradlew.bat :app:connectedDebugAndroidTest
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "========================================" -ForegroundColor Green
        Write-Host " ALL TESTS PASSED!" -ForegroundColor Green
        Write-Host "========================================" -ForegroundColor Green
    } else {
        Write-Host ""
        Write-Host "========================================" -ForegroundColor Red
        Write-Host " SOME TESTS FAILED" -ForegroundColor Red
        Write-Host "========================================" -ForegroundColor Red
        Write-Host "Check: app\build\reports\androidTests\connected\index.html" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "Test results saved to:" -ForegroundColor White
Write-Host "  app\build\reports\androidTests\connected\index.html" -ForegroundColor Yellow
