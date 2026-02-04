#!/data/data/com.termux/files/usr/bin/bash

echo "═══════════════════════════════════"
echo "  EMI Secure Device Provisioner"
echo "═══════════════════════════════════"
echo ""

echo "Select Connection Method:"
echo "1) USB Cable (OTG)"
echo "2) Wireless (Wi-Fi)"
read -p "Enter choice (1 or 2): " METHOD

if [ "$METHOD" == "2" ]; then
    echo ""
    echo "⚠️  Ensure both phones are on the SAME Wi-Fi/Hotspot."
    echo "1. On Customer Phone: Settings > Developer Options > Wireless Debugging"
    echo "2. Enable it, then tap 'Wireless Debugging' text."
    echo "3. Tap 'Pair device with pairing code'."
    echo ""
    
    read -p "Enter IP address & Port (e.g., 192.168.1.5:34555): " IP_PORT
    read -p "Enter Pairing Code (6 digits): " PAIR_CODE
    
    echo "Pairing..."
    adb pair $IP_PORT $PAIR_CODE
    
    # Extract IP and connect (Wireless Debugging port changes after pairing)
    # We ask user for the CONNECT port which might be different, but often adb auto-connects
    # or we need to ask for the main port shown on the Wireless Debugging screen (not the pairing popup)
    
    echo ""
    echo "✅ Paired!"
    echo "Now look at 'Wireless Debugging' main screen."
    echo "Enter the IP & Port shown there (It might be different port than pairing!)"
    read -p "Enter IP:Port to Connect: " CONNECT_ADDR
    
    adb connect $CONNECT_ADDR
else
    # USB Mode (Original Logic)
    echo "[1/3] Checking USB device connection..."
    # Loop until device is found and authorized
    while true; do
        STATE=$(adb get-state 2>&1)
        
        if [[ "$STATE" == *"device"* ]] && [[ "$STATE" != *"no devices"* ]]; then
            echo "✅ Device connected and authorized."
            break
        elif [[ "$STATE" == *"unauthorized"* ]]; then
            echo "⚠️  Device unauthorized. Please check your phone and allow USB debugging."
            sleep 2
        elif [[ "$STATE" == *"more than one"* ]]; then
             echo "❌ Multiple devices found. Please connect only one device."
             exit 1
        else
            echo -ne "Waiting for device... \r"
            sleep 2
        fi
    done
fi

echo ""
echo "[2/3] Checking App Installation..."
if adb shell pm list packages | grep -q "com.emiseure.customer"; then
    echo "✅ App already installed."
    read -p "Do you want to UPDATE the app? (y/n): " UPDATE_CHOICE
    if [[ "$UPDATE_CHOICE" == "y" || "$UPDATE_CHOICE" == "Y" ]]; then
        echo "Updating EMI Secure APK..."
        adb install -r /sdcard/Download/app-release.apk
        if [ $? -ne 0 ]; then
            echo "❌ ERROR: Failed to update APK"
            exit 1
        fi
        echo "✅ Update Complete"
    else
        echo "Skipping update..."
    fi
else
    echo "Installing EMI Secure APK..."
    adb install -r /sdcard/Download/app-release.apk
    if [ $? -ne 0 ]; then
        echo "❌ ERROR: Failed to install APK"
        exit 1
    fi
fi

echo ""
echo "[3/3] Setting as Device Owner..."
OWNER_OUTPUT=$(adb shell dpm set-device-owner com.emiseure.customer/.MyDeviceAdminReceiver 2>&1)
EXIT_CODE=$?

if [ $EXIT_CODE -ne 0 ]; then
    if echo "$OWNER_OUTPUT" | grep -q "already set"; then
        echo "✅ Device Owner is already active (Skipping)"
    else
        echo "❌ ERROR: Failed to set device owner"
        echo "Output: $OWNER_OUTPUT"
        echo "Make sure:"
        echo "  - All Google accounts are removed"
        echo "  - USB debugging is enabled"
        exit 1
    fi
else
    echo "✅ Device Owner set successfully"
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
