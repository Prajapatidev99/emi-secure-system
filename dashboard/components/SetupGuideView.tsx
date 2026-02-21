import React from 'react';
import Logo from './Logo';

interface SetupGuideViewProps {
    onBack: () => void;
}

const SetupGuideView: React.FC<SetupGuideViewProps> = ({ onBack }) => {
    return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center px-4">
            <div className="text-center max-w-sm w-full">
                <div className="flex justify-center mb-6">
                    <Logo />
                </div>
                <h2 className="text-xl font-semibold text-white mb-2">Download App</h2>
                <p className="text-sm text-slate-400 mb-8">Install the EMI Secure app on the customer's device.</p>
                <a
                    href="/EMI-Secure.apk"
                    download
                    className="inline-flex w-full justify-center items-center gap-2 bg-brand-500 hover:bg-brand-400 text-white font-medium py-3 px-6 rounded-xl transition-colors"
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Download APK
                </a>
                <button
                    onClick={onBack}
                    className="mt-6 text-sm text-slate-500 hover:text-slate-300 transition-colors"
                >
                    ← Back to Login
                </button>
            </div>
        </div>
    );
};

export default SetupGuideView;
