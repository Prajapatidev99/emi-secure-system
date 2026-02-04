@echo off
echo ========================================
echo EMI Secure Device Provisioning Tool
echo ========================================
echo.

echo Step 1: Checking ADB connection...
:CHECK_DEVICE
adb get-state >nul 2>&1
if %errorlevel% equ 0 (
    echo Device connected successfully.
    goto :DEVICE_FOUND
)

adb devices | findstr "unauthorized" >nul
if %errorlevel% equ 0 (
    echo Device is UNAUTHORIZED. Please check your phone and allow USB debugging.
    timeout /t 3 >nul
    goto :CHECK_DEVICE
)

echo Waiting for device...
timeout /t 2 >nul
goto :CHECK_DEVICE

:DEVICE_FOUND

echo.
echo Step 2: Installing EMI Secure APK...
adb install -r app-release.apk
if %errorlevel% neq 0 (
    echo ERROR: Failed to install APK
    pause
    exit /b 1
)

echo.
echo Step 3: Setting as Device Owner...
adb shell dpm set-device-owner com.emiseure.customer/.MyDeviceAdminReceiver
if %errorlevel% neq 0 (
    echo ERROR: Failed to set device owner
    echo Make sure:
    echo - No Google accounts are added
    echo - USB debugging is enabled
    echo - Device is not encrypted
    pause
    exit /b 1
)

echo.
echo ========================================
echo SUCCESS! Device is now provisioned
echo ========================================
echo.
echo Next steps:
echo 1. Disconnect USB cable
echo 2. Launch EMI Secure app
echo 3. Tap "Sync Status" to link device
echo 4. Enter Android ID in dashboard
echo.
pause
