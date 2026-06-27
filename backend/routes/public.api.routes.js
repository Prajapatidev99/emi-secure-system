const express = require('express');
const https = require('https');
const { Device, DeviceStatus } = require('../models/device.model');
const { Payment, PaymentStatus } = require('../models/payment.model');
const Customer = require('../models/customer.model');

const router = express.Router();
const logger = require('../utils/logger');

// --- Diagnostic Route to get Server's Public IP ---
// This is used to help whitelist the correct IP in MongoDB Atlas
router.get('/get-ip', (_req, res) => {
    https.get('https://api.ipify.org', (resp) => {
        let data = '';
        resp.on('data', (chunk) => {
            data += chunk;
        });
        resp.on('end', () => {
            res.json({ publicIp: data });
        });
    }).on("error", (err) => {
        console.error("Error fetching public IP: ", err.message);
        res.status(500).json({ message: "Could not fetch the server's public IP address.", error: err.message });
    });
});

// --- Route for Android App to Sync FCM Token and SIM Metadata ---
router.post('/devices/sync-metadata', async (req, res) => {
    const { androidId, fcmToken, imei2, simDetails, isDeviceOwner, isAdbEnabled, appVersion, metadata } = req.body;
    
    if (!androidId) {
        return res.status(400).json({ message: 'Device Android ID is required.' });
    }

    try {
        let device = await Device.findOne({ androidId: androidId });
        
        // BUG FIX: If device not found by androidId, this might be a fresh install.
        // Try to link it using the IMEI provided in simDetails or imei2.
        if (!device) {
            const imei1 = simDetails?.slot1?.imei;
            const imei2FromSim = simDetails?.slot2?.imei;
            const searchImeis = [imei1, imei2FromSim, imei2].filter(Boolean);
            
            if (searchImeis.length > 0) {
                device = await Device.findOne({ imei: { $in: searchImeis } });
                if (device) {
                    // Found the device created by the shopkeeper! Link the new androidId.
                    device.androidId = androidId;
                    await device.save();
                    logger.info(`Linked new androidId ${androidId} to existing device IMEI ${device.imei}`);
                }
            }
        }

        if (!device) {
            return res.status(404).json({ message: 'Device registration not found on server.' });
        }

        // SECURITY: Provisioning Audit
        if (isDeviceOwner !== undefined && !isDeviceOwner && device.status !== DeviceStatus.Released) {
            logger.error(`🚨 SECURITY CRITICAL: Device ${device.imei} is NOT a Device Owner but is attempting to sync. Manual audit required.`);
        }

        // SECURITY: Detect SIM Swap
        if (simDetails && device.simDetails) {
            const old1 = device.simDetails.slot1?.simSerial;
            const new1 = simDetails.slot1?.simSerial;
            const old2 = device.simDetails.slot2?.simSerial;
            const new2 = simDetails.slot2?.simSerial;

            if ((new1 && old1 && new1 !== old1) || (new2 && old2 && new2 !== old2)) {
                logger.warn(`🚨 SECURITY: SIM SWAP detected for device ${device.imei}. Old: ${old1}/${old2}, New: ${new1}/${new2}`);
            }
        }

        const updateFields = {};
        if (fcmToken) updateFields.fcmToken = fcmToken;
        if (imei2) updateFields.imei2 = imei2;
        if (simDetails) updateFields.simDetails = simDetails;
        
        updateFields.metadata = {
            ...device.metadata,
            lastSync: new Date(),
            isDeviceOwner: isDeviceOwner ?? metadata?.isDeviceOwner ?? device.metadata?.isDeviceOwner,
            // BUG-06 FIX: app sends isAdbDisabled=true when ADB is OFF, so we invert it
            // to store as isAdbEnabled (true = ADB is ON = security risk)
            isAdbEnabled: isAdbEnabled !== undefined
                ? isAdbEnabled                                    // direct mapping if sent
                : (metadata?.isAdbDisabled !== undefined
                    ? !metadata.isAdbDisabled                     // invert: disabled→!enabled
                    : device.metadata?.isAdbEnabled),             // fallback to existing
            isFrpActive: metadata?.isFrpActive ?? device.metadata?.isFrpActive,
            isOemUnlockBlocked: metadata?.isOemUnlockBlocked ?? device.metadata?.isOemUnlockBlocked,
            isUsbDataDisabled: metadata?.isUsbDataDisabled ?? device.metadata?.isUsbDataDisabled,
            appVersion: appVersion ?? device.metadata?.appVersion
        };

        // BUG-07 FIX: Update lastSeen on every metadata sync
        updateFields.lastSeen = new Date();

        await Device.findByIdAndUpdate(device._id, { $set: updateFields });

        logger.info(`Metadata synced for device: ${androidId}`, { hasFcm: !!fcmToken, hasImei2: !!imei2 });
        res.status(200).json({ 
            message: 'Metadata synced successfully.',
            status: device.status
        });

    } catch (error) {
        logger.error('Metadata sync error:', { error: error.message, androidId });
        res.status(500).json({ message: 'Server error during metadata sync.' });
    }
});

// --- Public route for Android app to get its own status ---
router.post('/device-status', async (req, res) => {
    const { androidId } = req.body;
    if (!androidId) {
        return res.status(400).json({ message: 'Device Android ID is required.' });
    }
    try {
        const device = await Device.findOne({ androidId }).populate('customerId', 'name');
        if (!device) {
            return res.status(404).json({ message: 'This device is not registered yet. Please ensure background services are running so it can sync.' });
        }

        // BUG-07 FIX: Update lastSeen on device-status check
        device.lastSeen = new Date();
        await device.save();

        const nextPayment = await Payment.findOne({
            deviceId: device._id,
            status: { $in: [PaymentStatus.Pending, PaymentStatus.Overdue] }
        }).sort({ dueDate: 'asc' });

        // BUG-17 FIX: Populate the shopkeeper (User) from the customer's userId ref
        // device.customerId is already populated as a Customer doc (from the previous query)
        // We need the Customer's userId ref to get the shopkeeper's name/phone
        const customer = await Customer.findById(device.customerId._id || device.customerId)
            .populate('userId', 'shopName phone');
        const shopkeeper = customer?.userId;  // populated User doc
        const supportName = shopkeeper?.shopName || 'Retailer';
        const supportPhone = shopkeeper?.phone || '';

        if (nextPayment) {
            res.json({
                deviceStatus: device.status,
                paymentStatus: nextPayment.status,
                nextDueDate: nextPayment.dueDate.toISOString().split('T')[0],
                amountDue: nextPayment.amount,
                customerName: device.customerId ? device.customerId.name : 'N/A',
                support_name: supportName,
                support_phone: supportPhone
                // SECURITY: Never send unlockKey over public API
            });
        } else {
            res.json({
                deviceStatus: device.status,
                paymentStatus: 'All Clear',
                message: 'All EMIs have been paid. Thank you!',
                customerName: device.customerId ? device.customerId.name : 'N/A',
                support_name: supportName,
                support_phone: supportPhone
                // SECURITY: Never send unlockKey over public API
            });
        }
    } catch (error) {
        logger.error('Error fetching device status:', { error: error.message, androidId });
        res.status(500).json({ message: 'Server error while fetching device status.' });
    }
});

// --- Route for Android App to Send Location Updates ---
router.post('/devices/location', async (req, res) => {
    const { androidId, latitude, longitude, accuracy, timestamp } = req.body;

    if (!androidId || latitude === undefined || longitude === undefined) {
        return res.status(400).json({ message: 'androidId, latitude, and longitude are required.' });
    }

    try {
        const device = await Device.findOne({ androidId });

        if (!device) {
            return res.status(404).json({ message: 'Device not registered.' });
        }

        // Update current location
        device.location = {
            latitude,
            longitude,
            accuracy: accuracy || 0,
            lastUpdated: new Date(timestamp || Date.now())
        };

        // Add to location history (limit to last 100 entries)
        device.locationHistory.push({
            latitude,
            longitude,
            accuracy: accuracy || 0,
            timestamp: new Date(timestamp || Date.now())
        });

        // Keep only last 100 location history entries
        if (device.locationHistory.length > 100) {
            device.locationHistory = device.locationHistory.slice(-100);
        }

        // BUG-07 FIX: Update lastSeen on location update
        device.lastSeen = new Date();

        await device.save();

        res.status(200).json({ message: 'Location updated successfully.' });

    } catch (error) {
        logger.error('Location update error:', { error: error.message, androidId });
        res.status(500).json({ message: 'Server error during location update.', error: error.message });
    }
});

// -------------------------------------------------------------------
// 🔄 POST-FACTORY-RESET SUPPORT ENDPOINTS
// -------------------------------------------------------------------

/**
 * GET /apk-info
 * Returns APK download URL, checksum, and provisioning QR config.
 * Called by freshly installed app to check for updates and get provisioning info.
 */
router.get('/apk-info', (req, res) => {
    const backendUrl = process.env.BACKEND_URL || `${req.protocol}://${req.get('host')}`;
    const apkUrl = `${backendUrl}/EMI-Secure.apk`;

    // Read SHA-256 checksum from file if available (written during build/deploy)
    let apkChecksum = process.env.APK_SHA256_CHECKSUM || '';
    try {
        const fs = require('fs');
        const path = require('path');
        const checksumFile = path.join(__dirname, '..', 'public', 'apk_checksum.txt');
        if (fs.existsSync(checksumFile)) {
            apkChecksum = fs.readFileSync(checksumFile, 'utf8').trim();
        }
    } catch (e) {
        logger.warn('Could not read APK checksum file:', { error: e.message });
    }

    // Zero-Touch provisioning QR config JSON
    const provisioningConfig = {
        'android.app.extra.PROVISIONING_DEVICE_ADMIN_COMPONENT_NAME':
            'com.emiseure.customer/.MyDeviceAdminReceiver',
        'android.app.extra.PROVISIONING_DEVICE_ADMIN_PACKAGE_DOWNLOAD_LOCATION': apkUrl,
        'android.app.extra.PROVISIONING_DEVICE_ADMIN_PACKAGE_CHECKSUM': apkChecksum,
        'android.app.extra.PROVISIONING_SKIP_ENCRYPTION': false,
        'android.app.extra.PROVISIONING_LOCALE': 'en_IN',
        'android.app.extra.PROVISIONING_TIME_ZONE': 'Asia/Kolkata',
        'android.app.extra.PROVISIONING_ADMIN_EXTRAS_BUNDLE': {
            backend_url: backendUrl,
            auto_lock_on_provision: true
        }
    };

    res.json({
        apkUrl,
        apkChecksum,
        version: process.env.APK_VERSION || '1.0',
        provisioningConfig,
        instructions: {
            zeroTouch: 'During Android setup wizard: Vol Down x3 + tap screen to trigger DPC download',
            manual: 'Download APK from apkUrl, install, then run: adb shell dpm set-device-owner com.emiseure.customer/.MyDeviceAdminReceiver'
        }
    });
});

/**
 * POST /check-imei
 * Check if a device with this IMEI should be locked.
 * Used by freshly reset devices that lost their androidId registration.
 * IMEI survives factory resets (hardware identifier).
 */
// TODO: Add rate limiting middleware (e.g., express-rate-limit) to prevent brute-force IMEI scanning
router.post('/check-imei', async (req, res) => {
    const { imei, newAndroidId, fcmToken, imei2 } = req.body;

    if (!imei) {
        return res.status(400).json({ message: 'IMEI is required.' });
    }

    try {
        const device = await Device.findOne({ imei });

        if (!device) {
            // Device not in our system — allow normal setup
            return res.status(404).json({
                message: 'Device not registered in EMI system.',
                shouldLock: false
            });
        }

        // BUG-05 FIX: Secure androidId update with verification
        // After factory reset the device WILL have a new FCM token, so we can't rely
        // on FCM matching alone. Instead:
        //   - Allow if the device has NO existing androidId (first provisioning / post-reset blank)
        //   - Allow if the request includes the device's IMEI2 as verification
        //   - Allow if the existing fcmToken matches (same device, token refresh)
        //   - Otherwise reject the update
        if (newAndroidId && newAndroidId !== device.androidId) {
            const hasNoExistingId = !device.androidId;
            const imei2Matches = imei2 && device.imei2 && imei2 === device.imei2;
            const fcmMatches = fcmToken && device.fcmToken && fcmToken === device.fcmToken;

            if (hasNoExistingId || imei2Matches || fcmMatches) {
                logger.info(`Refreshing Android ID for IMEI ${imei}: (factory reset)`, { oldId: device.androidId, newId: newAndroidId });
                device.androidId = newAndroidId;

                // If FCM token changed (post-reset), update it but flag as suspicious
                if (fcmToken && fcmToken !== device.fcmToken) {
                    logger.warn(`🚨 SECURITY: FCM token changed during androidId update for IMEI ${imei}. Possible post-reset re-registration.`);
                    device.fcmToken = fcmToken;
                }

                // BUG-07 FIX: Update lastSeen on check-imei
                device.lastSeen = new Date();
                await device.save();
            } else {
                logger.warn(`🚨 SECURITY: Rejected androidId update for IMEI ${imei}. No valid verification provided.`, {
                    hasExistingId: !!device.androidId,
                    fcmProvided: !!fcmToken,
                    imei2Provided: !!imei2
                });
                return res.status(403).json({
                    message: 'Android ID update rejected. Verification failed.',
                    shouldLock: device.status === 'Locked'
                });
            }
        }

        const shouldLock = device.status === 'Locked';

        // BUG-05 FIX: Only require reprovisioning for Locked or Compromised devices
        const requiresReprovisioning = device.status === DeviceStatus.Locked || device.status === DeviceStatus.Compromised;

        res.json({
            shouldLock,
            deviceStatus: device.status,
            // SECURITY: Never send unlockKey over public API
            message: shouldLock
                ? 'This device is locked. Contact your EMI provider.'
                : 'Device is active.',
            requiresReprovisioning
        });

    } catch (error) {
        logger.error('IMEI check error:', { error: error.message, imei });
        res.status(500).json({ message: 'Server error during IMEI check.', error: error.message });
    }
});

// -------------------------------------------------------------------
// 🔒 DEVICE SECURITY & LOCK STATUS ENDPOINTS (Bug 2 Fix)
// -------------------------------------------------------------------

/**
 * POST /device/check-lock-status
 * Called by DeviceOwnerFallbackManager.kt to check if the device should be locked.
 * Expects: { fcmToken, androidId }
 * Returns: { shouldLock: boolean, deviceStatus: string }
 */
router.post('/device/check-lock-status', async (req, res) => {
    const { fcmToken, androidId } = req.body;

    if (!fcmToken && !androidId) {
        return res.status(400).json({ message: 'fcmToken or androidId is required.' });
    }

    try {
        // Look up device by androidId first, fallback to fcmToken
        let device = null;
        if (androidId) {
            device = await Device.findOne({ androidId });
        }
        if (!device && fcmToken) {
            device = await Device.findOne({ fcmToken });
        }

        if (!device) {
            return res.status(404).json({ message: 'Device not found.' });
        }

        // Update lastSync and lastSeen
        device.metadata = device.metadata || {};
        device.metadata.lastSync = new Date();
        device.lastSeen = new Date();
        await device.save();

        // SECURITY: Never send unlockKey over public API
        res.json({
            shouldLock: device.status === DeviceStatus.Locked,
            deviceStatus: device.status
        });

    } catch (error) {
        logger.error('Check lock status error:', { error: error.message, androidId, fcmToken: fcmToken ? '***' : undefined });
        res.status(500).json({ message: 'Server error during lock status check.' });
    }
});

/**
 * POST /device/report-lock
 * Called by DeviceOwnerFallbackManager.kt to report lock enforcement.
 * Expects: { fcmToken, isLocked: true }
 * Returns: { success: boolean, message: string }
 */
router.post('/device/report-lock', async (req, res) => {
    const { fcmToken, isLocked } = req.body;

    if (!fcmToken) {
        return res.status(400).json({ message: 'fcmToken is required.' });
    }

    try {
        const device = await Device.findOne({ fcmToken });

        if (!device) {
            return res.status(404).json({ message: 'Device not found.' });
        }

        // Log the lock enforcement report
        logger.info(`Lock enforcement report for IMEI ${device.imei}: isLocked=${isLocked}`, {
            deviceId: device._id,
            status: device.status,
            isLocked
        });

        // Update lastSync and lastSeen
        device.metadata = device.metadata || {};
        device.metadata.lastSync = new Date();
        device.lastSeen = new Date();
        await device.save();

        res.json({ success: true, message: 'Lock enforcement recorded' });

    } catch (error) {
        logger.error('Report lock error:', { error: error.message, fcmToken: '***' });
        res.status(500).json({ message: 'Server error during lock report.' });
    }
});

/**
 * POST /devices/security-event
 * Called by FactoryResetProtectionManager.kt to report security events.
 * Expects: { deviceId, eventType, fcmToken, resetCount, timestamp }
 * Returns: { success: boolean }
 */
router.post('/devices/security-event', async (req, res) => {
    const { deviceId, eventType, fcmToken, resetCount, timestamp } = req.body;

    if (!fcmToken && !deviceId) {
        return res.status(400).json({ message: 'fcmToken or deviceId is required.' });
    }

    try {
        // Find device by fcmToken first, fallback to matching deviceId against androidId or _id
        let device = null;
        if (fcmToken) {
            device = await Device.findOne({ fcmToken });
        }
        if (!device && deviceId) {
            device = await Device.findOne({ androidId: deviceId });
            if (!device) {
                // Try matching by MongoDB _id if deviceId looks like an ObjectId
                if (deviceId.match(/^[0-9a-fA-F]{24}$/)) {
                    device = await Device.findById(deviceId);
                }
            }
        }

        if (!device) {
            return res.status(404).json({ message: 'Device not found.' });
        }

        // Log the security event
        logger.warn(`🚨 SECURITY EVENT for IMEI ${device.imei}: ${eventType}`, {
            deviceId: device._id,
            eventType,
            resetCount,
            timestamp,
            currentStatus: device.status
        });

        // If factory reset detected, mark device as compromised
        if (eventType === 'FACTORY_RESET') {
            device.isCompromised = true;
            logger.error(`🚨 FACTORY RESET detected for IMEI ${device.imei}. Device marked as compromised.`);
        }

        // Update lastSeen
        device.lastSeen = new Date();
        await device.save();

        res.json({ success: true });

    } catch (error) {
        logger.error('Security event error:', { error: error.message, deviceId, eventType });
        res.status(500).json({ message: 'Server error during security event processing.' });
    }
});

module.exports = router;