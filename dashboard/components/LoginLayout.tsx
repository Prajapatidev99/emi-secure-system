import React from 'react';
import Logo from './Logo';

const LoginFeature = ({ title, description }: { title: string, description: string }) => (
    <div className="relative pl-9">
        {/* FIX: Replaced semantically incorrect <dt> and <dd> tags with <span> tags to create valid HTML and resolve a potential JSX parsing issue. */}
        <span className="inline font-semibold text-white">
            <svg className="absolute left-1 top-1 h-5 w-5 text-brand-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
            </svg>
            {title}
        </span>
        <span className="inline text-slate-400"> {description}</span>
    </div>
);


const LoginLayout: React.FC<{ children: React.ReactNode, onOpenSetupGuide?: () => void }> = ({ children, onOpenSetupGuide }) => {
    return (
        <div className="relative flex min-h-full flex-nowrap justify-center md:px-0">
            <div className="relative hidden w-0 flex-1 bg-slate-900 md:block">
                <div className="flex h-full flex-col justify-between p-12">
                    <div>
                        <Logo />
                        <p className="mt-4 text-lg leading-8 text-slate-300">Your complete phone financing and security solution.</p>
                    </div>
                    <div className="space-y-6">
                        <LoginFeature title="Remote Device Control." description="Lock, unlock, or wipe devices remotely for overdue payments." />
                        <LoginFeature title="Automated EMI Tracking." description="Generate payment schedules and monitor statuses effortlessly." />
                        <LoginFeature title="Total Security." description="Prevent uninstalls and factory resets with device owner provisioning." />
                    </div>

                    {/* Setup Guide Link */}
                    <div className="mt-8">
                        <button
                            onClick={onOpenSetupGuide}
                            className="inline-flex w-full justify-center items-center gap-2 bg-gradient-to-r from-brand-500 to-indigo-600 hover:from-brand-400 hover:to-indigo-500 text-white font-medium py-3 px-6 rounded-xl transition-all shadow-lg hover:shadow-brand-500/25"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            View Setup Guide
                        </button>
                    </div>

                    <div className="text-xs text-slate-500">
                        &copy; 2025 EMI Secure. All rights reserved.
                    </div>
                </div>
            </div>
            <div className="flex-0 flex w-full max-w-md items-center bg-slate-950 px-4 py-12 sm:px-6 md:px-12 lg:px-16">
                <div className="w-full">
                    {children}
                </div>
            </div>
        </div>
    );
};
// FIX: Add default export to allow the component to be imported in App.tsx.
export default LoginLayout;