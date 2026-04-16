// ============================================
// EMI Secure - Example Appium Test (Node.js)
// ============================================
// This test simulates a user trying to "hack" the
// phone by pressing the Home button and navigating
// to Android Settings to try and uninstall the app.
// ============================================

const { remote } = require('webdriverio');

// Configuration for connecting to the Android Emulator
const capabilities = {
    platformName: 'Android',
    'appium:automationName': 'UiAutomator2',
    'appium:deviceName': 'Android Emulator', // Or your physical device name
    // Point this to your built Debug APK
    'appium:app': 'E:\\gemini-app\\android\\app\\build\\outputs\\apk\\debug\\app-debug.apk',
    'appium:appPackage': 'com.emiseure.customer',
    'appium:appActivity': '.MainActivity',
    'appium:autoGrantPermissions': true
};

const wdioOptions = {
    hostname: '127.0.0.1',
    port: 4723, // Default Appium port
    logLevel: 'info',
    capabilities,
};

async function runTest() {
    console.log("Starting Appium Test...");
    const driver = await remote(wdioOptions);

    try {
        console.log("1. App launched. Waiting 3 seconds...");
        await driver.pause(3000);

        // ==========================================================
        // 🕵️ THE "HACKING" ATTEMPT 
        // ==========================================================
        console.log("2. Simulating user pressing the physical Android HOME button");
        // pressKeyCode(3) is the Android Home Button
        await driver.pressKeyCode(3);
        await driver.pause(2000);

        console.log("3. User is trying to open Android Settings");
        // Appium can open ANY app on the phone! Let's open the Settings app.
        await driver.startActivity('com.android.settings', '.Settings');
        await driver.pause(2000);

        console.log("4. User is hunting for the 'Apps' menu...");
        // Find a UI element on the screen containing the text "Apps" and click it
        // Note: Android UI changes by manufacturer. This works on Stock Android emulators.
        const appsMenu = await driver.$('//*[@text="Apps" or @text="Apps & notifications"]');

        if (await appsMenu.isExisting()) {
            await appsMenu.click();
            console.log("   -> Clicked 'Apps' menu.");
        } else {
            console.log("   -> Could not find 'Apps' menu. (This is good if Lock Task Mode blocked it!)");
        }

        await driver.pause(3000);

        // In a real test, we would continue to try and click "Uninstall" on EMI Secure
        // and Assert that an error pops up because Device Owner prevents uninstallation.

    } catch (error) {
        console.error("Test failed: ", error);
    } finally {
        console.log("Test complete. Shutting down.");
        // Close the app and disconnect
        await driver.deleteSession();
    }
}

// Run the function
runTest();
