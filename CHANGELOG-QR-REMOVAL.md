# QR Code Provisioning Removed

## Summary
QR code provisioning has been removed from the EMI Secure System in favor of the more reliable ADB-based provisioning method.

## Files Removed
- `dashboard/components/QrCodeModal.tsx` - QR code modal component

## Files Modified
- `backend/routes/api.routes.js` - Removed `/devices/:deviceId/provisioning-qr` endpoint
- `dashboard/services/api.ts` - Removed `getQrCodeData()` function
- `dashboard/components/CustomerDetailView.tsx` - Removed QR code button and modal

## Reason for Removal
- QR code provisioning doesn't work on many devices (especially Chinese brands)
- Requires factory reset
- ADB method is more reliable and works on ALL devices
- Simplifies the system

## New Provisioning Method
Use ADB-based provisioning as documented in:
- `setup-guide.html` - Interactive guide
- `provisioning/provision.sh` - Termux script (mobile)
- `provisioning/provision-windows.bat` - Windows script (PC)

See the setup guide for complete instructions.
