# EMI Secure System - Provisioning Guide

## 📱 Quick Start

This folder contains everything you need to provision customer devices.

### What's Included

1. **setup-guide.html** - Interactive web guide (open in browser)
2. **provision.sh** - Script for Termux (mobile provisioning)
3. **provision-windows.bat** - Script for Windows PC
4. **README.md** - This file

---

## 🚀 Choose Your Method

### Method 1: Mobile Only (No PC Required) ⭐ RECOMMENDED

**Cost:** ₹50-100 (USB OTG cable)

**Steps:**
1. Open `setup-guide.html` in your browser
2. Click "Mobile Only" tab
3. Follow the step-by-step guide
4. Use `provision.sh` script in Termux

**Perfect for:** Small businesses, on-the-go provisioning

---

### Method 2: With PC/Laptop

**Cost:** Free (if you have PC)

**Steps:**
1. Open `setup-guide.html` in your browser
2. Click "With PC/Laptop" tab
3. Install ADB on your computer
4. Use `provision-windows.bat` (Windows) or manual commands

**Perfect for:** Shops with computers, bulk provisioning

---

## 📖 Detailed Instructions

**Open `setup-guide.html` in any web browser for:**
- Complete step-by-step guide
- Copy-paste commands
- Troubleshooting tips
- Video tutorials (coming soon)

---

## 🔧 Quick Commands Reference

### For Termux (Mobile):
```bash
# One-time setup
pkg update && pkg upgrade -y
pkg install android-tools -y

# Every customer device
./provision.sh
```

### For PC:
```bash
# Install APK
adb install app-release.apk

# Set as Device Owner
adb shell dpm set-device-owner com.emiseure.customer/.MyDeviceAdminReceiver
```

---

## ❓ Need Help?

1. Open `setup-guide.html` for detailed instructions
2. Check the Troubleshooting section
3. Watch video tutorial (coming soon)

---

## 📞 Support

For technical support, contact your system administrator.
