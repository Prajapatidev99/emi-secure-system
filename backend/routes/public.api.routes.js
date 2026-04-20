const express = require('express');
const https = require('https');
const { Device, DeviceStatus } = require('../models/device.model');
const { Payment, PaymentStatus } = require('../models/payment.model');

const router = express.Router();

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
    const { androidId, fcmToken, imei2, simDetails, isDeviceOwner, isAdbEnabled, appVersion } = req.body;
    
    if (!androidId) {
        return res.status(400).json({ message: 'Device Android ID is required.' });
    }

    try {
        const device = await Device.findOne({ androidId: androidId });
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
            isDeviceOwner: isDeviceOwner ?? device.metadata?.isDeviceOwner,
            isAdbEnabled: isAdbEnabled ?? device.metadata?.isAdbEnabled,
            appVersion: appVersion ?? device.metadata?.appVersion
        };

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
            return res.status(404).json({ message: 'This device is not registered.' });
        }

        const nextPayment = await Payment.findOne({
            deviceId: device._id,
            status: { $in: [PaymentStatus.Pending, PaymentStatus.Overdue] }
        }).sort({ dueDate: 'asc' });

        if (nextPayment) {
            res.json({
                deviceStatus: device.status,
                paymentStatus: nextPayment.status,
                nextDueDate: nextPayment.dueDate.toISOString().split('T')[0],
                amountDue: nextPayment.amount,
                customerName: device.customerId ? device.customerId.name : 'N/A',
                // SECURITY: Never send unlockKey over public API
            });
        } else {
            res.json({
                deviceStatus: device.status,
                paymentStatus: 'All Clear',
                message: 'All EMIs have been paid. Thank you!',
                customerName: device.customerId ? device.customerId.name : 'N/A',
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
router.post('/check-imei', async (req, res) => {
    const { imei, newAndroidId } = req.body;

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

        // 🔄 If device has a new Android ID after factory reset, update it
        if (newAndroidId && newAndroidId !== device.androidId) {
            logger.info(`Refreshing Android ID for IMEI ${imei}: (factory reset)`, { oldId: device.androidId, newId: newAndroidId });
            device.androidId = newAndroidId;
            await device.save();
        }

        const shouldLock = device.status === 'Locked';

        res.json({
            shouldLock,
            deviceStatus: device.status,
            // SECURITY: Never send unlockKey over public API
            message: shouldLock
                ? 'This device is locked. Contact your EMI provider.'
                : 'Device is active.',
            requiresReprovisioning: true // Admin must re-run provisioning script
        });

    } catch (error) {
        logger.error('IMEI check error:', { error: error.message, imei });
        res.status(500).json({ message: 'Server error during IMEI check.', error: error.message });
    }
});

module.exports = router;