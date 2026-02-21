import React from 'react';

const Step = ({ number, title, description }: { number: number; title: string; description: string }) => (
    <div className="flex gap-4">
        <div className="flex-shrink-0 w-9 h-9 rounded-full bg-brand-500/20 text-brand-400 flex items-center justify-center font-bold text-sm border border-brand-500/30">
            {number}
        </div>
        <div className="pt-1">
            <h4 className="text-base font-medium text-white mb-1">{title}</h4>
            <p className="text-sm text-slate-400 leading-relaxed">{description}</p>
        </div>
    </div>
);

const GuideView: React.FC = () => {
    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-3xl">
            <h1 className="text-2xl font-bold text-white mb-1">Setup Guide</h1>
            <p className="text-slate-400 mb-8">Step-by-step instructions for setting up EMI Secure on a customer's phone.</p>

            {/* Download Section */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 mb-10">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h2 className="text-lg font-semibold text-white">Download the App</h2>
                        <p className="text-sm text-slate-400 mt-1">Get the latest EMI Secure APK for the customer's device.</p>
                    </div>
                    <a
                        href="/EMI-Secure.apk"
                        download
                        className="inline-flex items-center justify-center gap-2 bg-brand-500 hover:bg-brand-400 text-white font-medium py-2.5 px-5 rounded-xl transition-colors flex-shrink-0"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Download APK
                    </a>
                </div>
            </div>

            {/* Steps */}
            <div className="space-y-8">
                <h3 className="text-lg font-semibold text-white border-b border-slate-800 pb-3">Installation Steps</h3>

                <Step
                    number={1}
                    title="Open This Website on Customer's Phone"
                    description="On the phone you are selling to the customer, open a browser and go to this website. Then download the APK file using the button above."
                />

                <Step
                    number={2}
                    title="Install the APK"
                    description="Open the downloaded file and tap 'Install'. If the browser asks for permission to install unknown apps, tap 'Settings' and enable 'Allow from this source', then try again."
                />

                <Step
                    number={3}
                    title="Open the App & Grant Permissions"
                    description="After installation, open the EMI Secure app. It will ask you to activate 'Device Administrator'. This is required for the lock feature to work. Tap 'Activate' or 'Allow'."
                />

                <Step
                    number={4}
                    title="Enter Device & Customer Details"
                    description="The app will show the device's Android ID automatically. Enter the customer's name, IMEI number, and phone model. Then enter your shop login credentials to link this device to your dashboard."
                />

                <Step
                    number={5}
                    title="Device is Now Linked!"
                    description="The phone will now appear in your 'Devices' tab on this dashboard. You can lock, unlock, or wipe the device remotely anytime from here."
                />
            </div>

            {/* Tips Section */}
            <div className="mt-10 bg-amber-500/10 border border-amber-500/20 rounded-2xl p-6">
                <h3 className="text-base font-semibold text-amber-400 mb-3">Important Tips</h3>
                <ul className="space-y-2 text-sm text-slate-300">
                    <li className="flex gap-2">
                        <span className="text-amber-400 flex-shrink-0">•</span>
                        Make sure the customer's phone has an active internet connection during setup.
                    </li>
                    <li className="flex gap-2">
                        <span className="text-amber-400 flex-shrink-0">•</span>
                        Do not uninstall the app after setup — it needs to stay installed for the lock to work.
                    </li>
                    <li className="flex gap-2">
                        <span className="text-amber-400 flex-shrink-0">•</span>
                        If the device shows as "Offline" in the dashboard, the phone may not have internet or the app may have been force-stopped.
                    </li>
                </ul>
            </div>
        </div>
    );
};

export default GuideView;
