# 📱 EMI Secure - Device Testing Guide

Test the EMI Secure app across multiple Android versions and manufacturers to catch device-specific bugs.

---

## Quick Start

```powershell
# 1. Create emulators (one-time setup)
.\setup-emulators.ps1

# 2. Start an emulator
& "$env:LOCALAPPDATA\Android\Sdk\emulator\emulator.exe" -avd EMI_Test_API34

# 3. Run all tests
.\run-tests.ps1
```

---

## 🔥 Firebase Crashlytics (Automatic Crash Reporting)

Crashlytics is now integrated. After installing the app on any device:

1. Open **Firebase Console** → [phone-emi project](https://console.firebase.google.com/project/phone-emi/crashlytics)
2. Every crash report will include:
   - **Device Model** (e.g., "SM-A155F", "Redmi Note 12")
   - **Manufacturer** (e.g., "Samsung", "Xiaomi", "vivo")
   - **Android Version** (e.g., "14", "13", "10")
   - **Exact line of code** that crashed

> **Note:** Crashlytics activates after the app runs for the first time on a device. It may take a few minutes to appear in the console.

---

## 🧪 Running Tests Locally

### On a Connected Emulator
```powershell
# Start an emulator
& "$env:LOCALAPPDATA\Android\Sdk\emulator\emulator.exe" -avd EMI_Test_API34

# Run Espresso tests
.\run-tests.ps1
```

### On a Physical Device
1. Connect your phone via USB
2. Enable **Developer Options** → **USB Debugging**
3. Run: `.\run-tests.ps1`

### Build APKs Only (No Test Run)
```powershell
.\run-tests.ps1 -BuildOnly
```

---

## ☁️ Firebase Test Lab (Test on 20+ Real Devices)

Firebase Test Lab runs your tests on real physical devices hosted by Google.

### Option A: Using gcloud CLI
```powershell
# Install gcloud: https://cloud.google.com/sdk/docs/install
# Login and set project:
gcloud auth login
gcloud config set project phone-emi

# Run tests on Firebase Test Lab
.\run-tests.ps1 -FirebaseTestLab
```

### Option B: Manual Upload (No gcloud needed)
1. Build APKs: `.\run-tests.ps1 -BuildOnly`
2. Go to [Firebase Test Lab](https://console.firebase.google.com/project/phone-emi/testlab)
3. Click **"Run a test"** → **"Instrumentation"**
4. Upload **app-debug.apk** and **app-debug-androidTest.apk**
5. Select devices (Samsung, Xiaomi, Pixel, etc.)
6. Click **"Start"**

### Free Tier
- **Spark plan:** 15 tests/day on virtual devices, 5 tests/day on physical devices
- **Blaze plan:** Pay-as-you-go for unlimited testing

---

## 📋 Test Coverage

| Test File | Tests | What It Verifies |
|-----------|-------|-----------------|
| `MainActivityTest.kt` | 11 | App launch, status card, error handling, UI layout |
| `LockScreenActivityTest.kt` | 9 | Lock screen render, keypad visibility, button presence |

### Critical Tests for EMI Secure:
- **`appLaunches_withoutCrashing`** — Catches startup crashes on specific OEMs
- **`lockScreen_launchesWithoutCrashing`** — Lock screen crashes can brick the phone for the user
- **`errorLayout_isInitiallyHidden`** — Ensures proper UI state on fresh launch

---

## 🎯 Recommended Test Matrix

| Device | API Level | Why Test This |
|--------|-----------|---------------|
| Pixel 6 | API 34 | Stock Android 14 baseline |
| Pixel 6 | API 33 | Stock Android 13 |
| Pixel 6 | API 29 | Oldest supported (Android 10) |
| Samsung Galaxy | API 33+ | One UI differences |
| Xiaomi Redmi | API 33+ | MIUI battery/background kill |
| Vivo/Oppo | API 33+ | ColorOS/FuntouchOS restrictions |

> **Tip:** Use Firebase Test Lab for Samsung/Xiaomi/Vivo testing since these devices are available there but not as emulators.
