

import React from 'react';

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


const LoginLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="relative flex min-h-full flex-nowrap justify-center md:px-0">
        <div className="relative hidden w-0 flex-1 bg-slate-900 md:block">
             <div className="flex h-full flex-col justify-between p-12">
                <div>
                     <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
                        <span className="bg-gradient-to-r from-brand-500 to-purple-500 bg-clip-text text-transparent">EMI Secure</span>
                    </h1>
                    <p className="mt-4 text-lg leading-8 text-slate-300">Your complete phone financing and security solution.</p>
                </div>
                <div className="space-y-6">
                    <LoginFeature title="Remote Device Control." description="Lock, unlock, or wipe devices remotely for overdue payments." />
                    <LoginFeature title="Automated EMI Tracking." description="Generate payment schedules and monitor statuses effortlessly." />
                    <LoginFeature title="Total Security." description="Prevent uninstalls and factory resets with device owner provisioning." />
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

export default LoginLayout;