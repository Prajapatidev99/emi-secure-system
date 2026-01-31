#!/data/data/com.termux/files/usr/bin/bash

echo "═══════════════════════════════════"
echo "  EMI Secure Device Provisioner"
echo "═══════════════════════════════════"
echo ""

echo "[1/3] Checking device connection..."
adb devices
if [ $? -ne 0 ]; then
    echo "❌ ERROR: No device connected"
    exit 1
fi

echo ""
echo "[2/3] Installing EMI Secure APK..."
adb install -r /sdcard/Download/app-release.apk
if [ $? -ne 0 ]; then
    echo "❌ ERROR: Failed to install APK"
    exit 1
fi

echo ""
echo "[3/3] Setting as Device Owner..."
adb shell dpm set-device-owner com.emiseure.customer/.MyDeviceAdminReceiver
if [ $? -ne 0 ]; then
    echo "❌ ERROR: Failed to set device owner"
    echo "Make sure:"
    echo "  - All Google accounts are removed"
    echo "  - USB debugging is enabled"
    exit 1
fi

echo ""
echo "═══════════════════════════════════"
echo "  ✅ SUCCESS! Device Provisioned"
echo "═══════════════════════════════════"
echo ""
echo "Next steps:"
echo "1. Disconnect USB cable"
echo "2. Open EMI Secure app"
echo "3. Tap 'Sync Status'"
echo "4. Copy Android ID and add to dashboard"
echo ""
