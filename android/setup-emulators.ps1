# ============================================
# EMI Secure - Android Emulator Setup Script
# ============================================
# Creates emulators for testing across Android versions:
# - API 29 (Android 10) - Oldest common version
# - API 33 (Android 13) - Mid-range
# - API 34 (Android 14) - Latest
# ============================================

$ErrorActionPreference = "Stop"

# Detect Android SDK path
$SDK_PATH = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } 
            elseif ($env:ANDROID_SDK_ROOT) { $env:ANDROID_SDK_ROOT }
            else { "$env:LOCALAPPDATA\Android\Sdk" }

$SDKMANAGER = "$SDK_PATH\cmdline-tools\latest\bin\sdkmanager.bat"
$AVDMANAGER = "$SDK_PATH\cmdline-tools\latest\bin\avdmanager.bat"
$EMULATOR = "$SDK_PATH\emulator\emulator.exe"

# Check if tools exist
if (-not (Test-Path $SDKMANAGER)) {
    # Try alternative path
    $SDKMANAGER = Get-ChildItem "$SDK_PATH\cmdline-tools" -Recurse -Filter "sdkmanager.bat" | Select-Object -First 1 -ExpandProperty FullName
    $AVDMANAGER = Get-ChildItem "$SDK_PATH\cmdline-tools" -Recurse -Filter "avdmanager.bat" | Select-Object -First 1 -ExpandProperty FullName
}

if (-not $SDKMANAGER -or -not (Test-Path $SDKMANAGER)) {
    Write-Host "ERROR: sdkmanager not found. Install Android SDK Command-line Tools." -ForegroundColor Red
    Write-Host "In Android Studio: Settings > Languages & Frameworks > Android SDK > SDK Tools > Android SDK Command-line Tools" -ForegroundColor Yellow
    exit 1
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host " EMI Secure - Emulator Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Define emulator configurations
$emulators = @(
    @{ API = "29"; Name = "EMI_Test_API29"; Display = "Android 10 (API 29)" },
    @{ API = "33"; Name = "EMI_Test_API33"; Display = "Android 13 (API 33)" },
    @{ API = "34"; Name = "EMI_Test_API34"; Display = "Android 14 (API 34)" }
)

foreach ($emu in $emulators) {
    $api = $emu.API
    $name = $emu.Name
    $display = $emu.Display
    $image = "system-images;android-$api;google_apis;x86_64"

    Write-Host "[$display] Downloading system image..." -ForegroundColor Yellow
    
    # Accept licenses and download
    echo "y" | & $SDKMANAGER --install $image 2>$null
    
    # Check if AVD already exists
    $existing = & $AVDMANAGER list avd 2>$null | Select-String $name
    if ($existing) {
        Write-Host "[$display] AVD '$name' already exists, skipping." -ForegroundColor Green
        continue
    }

    Write-Host "[$display] Creating AVD: $name" -ForegroundColor Yellow
    echo "no" | & $AVDMANAGER create avd `
        --name $name `
        --package $image `
        --device "pixel_6" `
        --force 2>$null
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[$display] AVD '$name' created successfully!" -ForegroundColor Green
    } else {
        Write-Host "[$display] Failed to create AVD. You may need to accept licenses:" -ForegroundColor Red
        Write-Host "  Run: & '$SDKMANAGER' --licenses" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Setup Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Available emulators:" -ForegroundColor White
& $EMULATOR -list-avds 2>$null
Write-Host ""
Write-Host "To start an emulator:" -ForegroundColor White
Write-Host "  & '$EMULATOR' -avd EMI_Test_API34" -ForegroundColor Yellow
Write-Host ""
Write-Host "To run tests on it:" -ForegroundColor White
Write-Host "  .\run-tests.ps1" -ForegroundColor Yellow
