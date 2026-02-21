import React from 'react';
import Logo from './Logo';

interface SetupGuideViewProps {
    onBack: () => void;
}

const SetupGuideView: React.FC<SetupGuideViewProps> = ({ onBack }) => {
    return (
        <div className="min-h-screen bg-slate-950 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mx-auto">
                <div className="mb-8 flex items-center justify-between">
                    <button
                        onClick={onBack}
                        className="text-slate-400 hover:text-white flex items-center gap-2 transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                        Back to Login
                    </button>
                    <Logo />
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-10 shadow-2xl">
                    <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">Setup Guide & Download</h1>
                    <p className="text-slate-400 text-lg mb-8">Follow these steps to download and install the EMI Secure app on a customer's device.</p>

                    {/* Download Section */}
                    <div className="bg-gradient-to-r from-brand-900/40 to-indigo-900/40 border border-brand-500/20 rounded-2xl p-6 mb-10 text-center">
                        <div className="inline-flex justify-center items-center w-16 h-16 rounded-full bg-brand-500/20 text-brand-400 mb-4">
                            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                        </div>
                        <h2 className="text-2xl font-semibold text-white mb-3">Get the Latest App</h2>
                        <p className="text-slate-300 mb-6">Download the official EMI Secure APK file directly to the device you want to lock.</p>
                        <a
                            href="/EMI-Secure.apk"
                            download
                            className="inline-flex justify-center items-center gap-2 bg-gradient-to-r from-brand-500 to-indigo-600 hover:from-brand-400 hover:to-indigo-500 text-white text-lg font-medium py-4 px-8 rounded-xl transition-all shadow-lg hover:shadow-brand-500/25 w-full sm:w-auto"
                        >
                            Download APK Now
                        </a>
                    </div>

                    {/* Instructions Section */}
                    <div className="space-y-8">
                        <h3 className="text-xl font-bold text-white border-b border-slate-800 pb-2">How to Use & Install</h3>

                        <div className="flex gap-4">
                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-800 text-brand-400 flex items-center justify-center font-bold">1</div>
                            <div>
                                <h4 className="text-lg font-medium text-white mb-1">Download the APK</h4>
                                <p className="text-slate-400 text-sm leading-relaxed">Open this exact website (<code className="bg-slate-950 px-1 py-0.5 rounded text-brand-300">our-website.com</code>) on the <b>customer's phone</b> you are selling. Click the "Download APK Now" button above.</p>
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-800 text-brand-400 flex items-center justify-center font-bold">2</div>
                            <div>
                                <h4 className="text-lg font-medium text-white mb-1">Install & Allow Permissions</h4>
                                <p className="text-slate-400 text-sm leading-relaxed">Open the downloaded file and tap "Install". If prompted, allow your browser to "Install unknown apps". Once installed, open the EMI Secure app.</p>
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-800 text-brand-400 flex items-center justify-center font-bold">3</div>
                            <div>
                                <h4 className="text-lg font-medium text-white mb-1">Grant Device Admin</h4>
                                <p className="text-slate-400 text-sm leading-relaxed">The app will ask you to activate "Device Administrator" privileges. This is crucial for the app to lock the screen. Please click "Activate" or "Allow".</p>
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-800 text-brand-400 flex items-center justify-center font-bold">4</div>
                            <div>
                                <h4 className="text-lg font-medium text-white mb-1">Enter Customer Details</h4>
                                <p className="text-slate-400 text-sm leading-relaxed">Inside the app, enter the IMEI and the Customer's Name. If needed, enter your exact Shop Login details to tie the device to your web dashboard.</p>
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-800 text-brand-400 flex items-center justify-center font-bold">5</div>
                            <div>
                                <h4 className="text-lg font-medium text-white mb-1">Manage from Dashboard</h4>
                                <p className="text-slate-400 text-sm leading-relaxed">You're done! Now you can open the web dashboard on your computer or phone to see the device listed. You can tap "Lock Device" anytime the EMI is overdue.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SetupGuideView;
