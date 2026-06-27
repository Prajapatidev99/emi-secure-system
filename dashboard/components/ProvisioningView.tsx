import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { QrCodeIcon, TerminalIcon, CheckCircleIcon, ShieldCheckIcon } from './icons';

type ProvisionMethod = 'qr' | 'laptop';

const DEFAULT_APK_HASH = 'jWrZX07E5nKKaUwwUFUlUoLIMSJbHcWGnoB4nzuowYs=';

const ProvisioningView: React.FC = () => {
    const [method, setMethod] = useState<ProvisionMethod>('qr');
    const [apkUrl, setApkUrl] = useState('https://emi-secure-system.onrender.com/EMI-Secure.apk');
    const [checksum, setChecksum] = useState(DEFAULT_APK_HASH);
    const [wifiSsid, setWifiSsid] = useState('');
    const [wifiPassword, setWifiPassword] = useState('');

    const packageName = "com.emiseure.customer";
    const receiverName = "com.emiseure.customer.MyDeviceAdminReceiver";
    const componentName = `${packageName}/${receiverName}`;

    const generateQrJson = () => {
        const config: any = {
            "android.app.extra.PROVISIONING_DEVICE_ADMIN_COMPONENT_NAME": componentName,
            "android.app.extra.PROVISIONING_DEVICE_ADMIN_PACKAGE_NAME": packageName,
            "android.app.extra.PROVISIONING_DEVICE_ADMIN_PACKAGE_DOWNLOAD_LOCATION": apkUrl,
            "android.app.extra.PROVISIONING_LEAVE_ALL_SYSTEM_APPS_ENABLED": true,
            "android.app.extra.PROVISIONING_SKIP_ENCRYPTION": true,
        };

        if (checksum) {
            config["android.app.extra.PROVISIONING_DEVICE_ADMIN_PACKAGE_CHECKSUM"] = checksum.trim();
        }

        if (wifiSsid) {
            config["android.app.extra.PROVISIONING_WIFI_SSID"] = wifiSsid;
            config["android.app.extra.PROVISIONING_WIFI_SECURITY_TYPE"] = "WPA";
            if (wifiPassword) {
                config["android.app.extra.PROVISIONING_WIFI_PASSWORD"] = wifiPassword;
            }
        }

        return JSON.stringify(config);
    };

    const downloadBatScript = () => {
        const scriptContent = `@echo off
echo ========================================
echo EMI Secure - Laptop Provisioning Tool
echo ========================================
echo.
echo Step 1: Checking device...
adb wait-for-device
echo Device detected.
echo.
echo Step 2: Downloading & Installing App...
adb install -r "${apkUrl}"
if %errorlevel% neq 0 (
    echo [!] Install failed. Checking local app-release.apk...
    adb install -r app-release.apk
)
echo.
echo Step 3: Setting as Device Owner...
adb shell dpm set-device-owner ${componentName}
echo.
echo ========================================
echo SUCCESS! Disconnect and open EMI Secure.
echo ========================================
pause`;
        const blob = new Blob([scriptContent], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'provision-device.bat';
        link.click();
    };

    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
            <header className="mb-8">
                <h1 className="text-3xl font-bold text-white mb-2">Provisioning Center</h1>
                <p className="text-slate-400">Choose a method to set up new customer devices.</p>
            </header>

            {/* Method Tabs */}
            <div className="flex p-1 bg-slate-900/50 border border-slate-800 rounded-2xl w-full sm:w-fit mb-8">
                <button
                    onClick={() => setMethod('qr')}
                    className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-medium transition-all ${
                        method === 'qr' 
                        ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/20' 
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                >
                    <QrCodeIcon className="w-5 h-5" />
                    Automatic (QR)
                </button>
                <button
                    onClick={() => setMethod('laptop')}
                    className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-medium transition-all ${
                        method === 'laptop' 
                        ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/20' 
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                >
                    <TerminalIcon className="w-5 h-5" />
                    Manual (Laptop)
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Configuration Panel */}
                <div className="lg:col-span-12 xl:col-span-7 space-y-6">
                    <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6 sm:p-8 backdrop-blur-sm">
                        <h2 className="text-xl font-semibold text-white mb-6">Device Configuration</h2>
                        
                        <div className="space-y-5">
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-2">APK Download URL</label>
                                <input 
                                    type="text" 
                                    value={apkUrl}
                                    onChange={(e) => setApkUrl(e.target.value)}
                                    className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand-500 transition-colors"
                                    placeholder="https://your-server.com/app.apk"
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-400 mb-2">Wi-Fi Name (SSID)</label>
                                    <input 
                                        type="text" 
                                        value={wifiSsid}
                                        onChange={(e) => setWifiSsid(e.target.value)}
                                        className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand-500"
                                        placeholder="Optional"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-400 mb-2">Wi-Fi Password</label>
                                    <input 
                                        type="password" 
                                        value={wifiPassword}
                                        onChange={(e) => setWifiPassword(e.target.value)}
                                        className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand-500"
                                        placeholder="Optional"
                                    />
                                </div>
                            </div>

                            {method === 'qr' && (
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="text-sm font-medium text-slate-400">Signature Hash (SHA-256)</label>
                                        <div className="flex gap-2">
                                            <button 
                                                onClick={() => setChecksum('jWrZX07E5nKKaUwwUFUlUoLIMSJbHcWGnoB4nzuowYs=')}
                                                className="text-[10px] px-2 py-1 rounded bg-brand-500/10 text-brand-400 border border-brand-500/20 hover:bg-brand-500/20 transition-all"
                                            >
                                                File Hash (Recommended)
                                            </button>
                                            <button 
                                                onClick={() => setChecksum('iCfUqPD3x0SqbgqHXnJ5gcbtg0iJA26D9HmxAYMFxMM')}
                                                className="text-[10px] px-2 py-1 rounded bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700 transition-all"
                                            >
                                                Cert Hash
                                            </button>
                                            <button 
                                                onClick={() => setChecksum('')}
                                                className="text-[10px] px-2 py-1 rounded bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700 transition-all"
                                            >
                                                No Hash
                                            </button>
                                        </div>
                                    </div>
                                    <input 
                                        type="text" 
                                        value={checksum}
                                        onChange={(e) => setChecksum(e.target.value)}
                                        className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-brand-500"
                                        placeholder="Base64 encoded hash"
                                    />
                                    <p className="mt-2 text-[10px] text-slate-500 italic">
                                        If you get "Checksum Error," click <b>No Hash</b> or <b>File Hash</b> and try again.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Guide Card */}
                    <div className="bg-brand-500/5 border border-brand-500/10 rounded-3xl p-6 sm:p-8">
                        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                             {method === 'qr' ? 'How to setup' : 'Laptop Steps'}
                        </h3>
                        {method === 'qr' ? (
                            <ul className="space-y-4">
                                <li className="flex gap-4">
                                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-brand-500/20 text-brand-400 flex items-center justify-center text-xs font-bold border border-brand-500/30">1</span>
                                    <p className="text-slate-400 text-sm">Factory reset the phone you want to provision.</p>
                                </li>
                                <li className="flex gap-4">
                                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-brand-500/20 text-brand-400 flex items-center justify-center text-xs font-bold border border-brand-500/30">2</span>
                                    <p className="text-slate-400 text-sm">On the first "Welcome" screen, tap the screen 6 times in the same spot.</p>
                                </li>
                                <li className="flex gap-4">
                                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-brand-500/20 text-brand-400 flex items-center justify-center text-xs font-bold border border-brand-500/30">3</span>
                                    <p className="text-slate-400 text-sm">A QR scanner will open. Scan the code on the right.</p>
                                </li>
                            </ul>
                        ) : (
                            <div className="space-y-6">
                                <ul className="space-y-4 text-sm text-slate-400">
                                    <li className="flex gap-3"><CheckCircleIcon className="w-4 h-4 text-brand-400 mt-0.5" /> Enable Developer Options & USB Debugging on phone.</li>
                                    <li className="flex gap-3"><CheckCircleIcon className="w-4 h-4 text-brand-400 mt-0.5" /> Connect phone to laptop via USB cable.</li>
                                    <li className="flex gap-3"><CheckCircleIcon className="w-4 h-4 text-brand-400 mt-0.5" /> Run the commands below in your Terminal/CMD.</li>
                                </ul>
                                
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center px-1">
                                      <p className="text-xs font-bold text-slate-500 uppercase tracking-widest leading-none">Command sequence</p>
                                      <button 
                                        onClick={() => {
                                          navigator.clipboard.writeText(`adb install -r "${apkUrl}" && adb shell dpm set-device-owner ${componentName}`);
                                          alert('Commands copied!');
                                        }}
                                        className="text-[10px] text-brand-400 font-bold uppercase hover:text-white transition-colors"
                                      >
                                        Copy All
                                      </button>
                                    </div>
                                    <div className="bg-slate-950 rounded-xl p-4 font-mono text-sm border border-slate-800 text-brand-400 overflow-x-auto">
                                        <div className="flex items-start gap-2 mb-2">
                                          <span className="text-slate-700 select-none">$</span>
                                          <code className="whitespace-nowrap">adb install -r "{apkUrl}"</code>
                                        </div>
                                        <div className="flex items-start gap-2">
                                          <span className="text-slate-700 select-none">$</span>
                                          <code className="whitespace-nowrap">adb shell dpm set-device-owner {componentName}</code>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={downloadBatScript}
                                        className="flex items-center gap-2 text-brand-400 hover:text-brand-300 transition-colors text-xs font-medium pt-1"
                                    >
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M12 4v16m8-8H4" strokeWidth={2} strokeLinecap="round" /></svg>
                                        Download .bat script for Windows
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Status / Output Panel */}
                <div className="lg:col-span-12 xl:col-span-5">
                    <div className="sticky top-8 space-y-6">
                        {method === 'qr' ? (
                            <div className="bg-white rounded-[2rem] p-6 sm:p-10 flex flex-col items-center justify-center shadow-2xl shadow-blue-500/10 overflow-hidden ring-1 ring-slate-200">
                                <div className="bg-slate-50 p-6 rounded-[1.5rem] border border-slate-100 shadow-inner max-w-full">
                                    <QRCodeSVG 
                                        value={generateQrJson()} 
                                        size={280}
                                        level="H"
                                        includeMargin={false}
                                        className="max-w-[200px] h-auto sm:max-w-none sm:w-[280px]"
                                    />
                                </div>
                                <div className="text-center mt-8">
                                    <h4 className="text-slate-900 font-bold text-xl mb-2 tracking-tight">Setup QR Code</h4>
                                    <p className="text-slate-500 text-sm max-w-[240px] leading-relaxed">
                                      Point the phone's setup scanner at this screen.
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-8 backdrop-blur-sm text-center">
                                <div className="w-20 h-20 bg-brand-500/20 text-brand-400 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-brand-500/20">
                                    <TerminalIcon className="w-10 h-10" />
                                </div>
                                <h4 className="text-white font-bold text-xl mb-2">USB Ready</h4>
                                <p className="text-slate-400 text-sm mb-8">Follow the laptop instructions to provision via cable.</p>
                                <div className="p-4 bg-slate-950/50 rounded-2xl border border-slate-800 text-left">
                                    <p className="text-xs text-slate-500 mb-2 uppercase font-bold tracking-widest">Target Package</p>
                                    <code className="text-brand-400 text-xs block truncate">{packageName}</code>
                                </div>
                            </div>
                        )}

                        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6">
                            <div className="flex items-center gap-3 mb-4">
                                <ShieldCheckIcon className="w-6 h-6 text-brand-500" />
                                <h4 className="text-white font-semibold">Public Link Test</h4>
                            </div>
                            <p className="text-sm text-slate-400 leading-relaxed mb-4">
                                Before scanning the QR, ensure this link works on a normal phone browser:
                            </p>
                            <a 
                                href={apkUrl} 
                                target="_blank" 
                                rel="noreferrer"
                                className="block w-full bg-slate-950/50 border border-slate-800 text-brand-400 p-3 rounded-xl text-xs font-mono truncate hover:bg-slate-950 transition-colors"
                            >
                                {apkUrl}
                            </a>
                        </div>

                        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6">
                            <div className="flex items-center gap-3 mb-4">
                                <ShieldCheckIcon className="w-6 h-6 text-brand-500" />
                                <h4 className="text-white font-semibold">Security Note</h4>
                            </div>
                            <p className="text-sm text-slate-400 leading-relaxed">
                                Provisioning as "Device Owner" grants full control over the phone. 
                                Ensure you have the customer's consent before proceeding.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProvisioningView;
