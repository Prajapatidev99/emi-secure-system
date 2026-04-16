# 🤖 EMI Secure - Appium Setup & Testing Guide

Appium allows you to write tests that act like a real user—pressing the physical Home button, adjusting Android settings, and interacting with the lock screen.

Here is exactly how you set up Appium and write your first security test.

---

## 🛠️ Step 1: Install the Requirements

Appium runs as a local server (using Node.js) that talks to your Android Emulator or physical phone via ADB. It takes commands from your test script (which we will write in Node.js/JavaScript).

Open your **Terminal/PowerShell** and run these commands:

```powershell
# 1. Install the Appium Server globally using npm (Node.js required)
npm install -g appium

# 2. Install the Appium UIAutomator2 Driver (This allows Appium to control Android)
appium driver install uiautomator2

# 3. Create a folder for your tests in your project
cd e:\gemini-app\android
mkdir tests\appium
cd tests\appium

# 4. Initialize a new Node project and install the WebdriverIO client
npm init -y
npm install webdriverio
```

---

## 🧪 Step 2: Write an Appium Test

With Appium, you write a script that sends commands to the Appium server. Here is an example test that verifies a user **cannot uninstall the app** from the Android Settings menu (because they are locked out).

Create a file called `bypass_test.js` inside your `tests\appium` folder (I have created this file for you as an example!).

---

## ▶️ Step 3: How to Run the Test

To run an Appium test, you need three things running at the same time:

1. **An Android Emulator** (or a plugged-in physical phone).
2. **The Appium Server** (running in one terminal).
3. **Your Test Script** (running in another terminal).

### Terminal 1: Start Appium Server
```powershell
appium
```
*Leave this running! It will say `[Appium] Welcome to Appium...`*

### Terminal 2: Run Your Script
Make sure your emulator is running, then execute the script:
```powershell
cd e:\gemini-app\android\tests\appium
node bypass_test.js
```

Watch the emulator! You will see the script automatically clicking the Home button, opening the Settings app, and looking for your EMI Secure app to try and uninstall it!
