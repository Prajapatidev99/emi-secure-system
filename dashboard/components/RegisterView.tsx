import React, { useState } from 'react';
import { register } from '../services/api';
import Button from './common/Button';
import { UserCircleIcon, KeyIcon, ShieldCheckIcon } from './icons';
import Spinner from './common/Spinner';

interface RegisterViewProps {
    onRegisterSuccess: (token: string) => void;
    onSwitchToLogin: () => void;
}

const RegisterView: React.FC<RegisterViewProps> = ({ onRegisterSuccess, onSwitchToLogin }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [shopName, setShopName] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        // Validation
        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        if (password.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }

        setLoading(true);
        try {
            const data = await register(email, password, shopName);
            if (data.token) {
                onRegisterSuccess(data.token);
            }
        } catch (err) {
            if (err instanceof Error) {
                setError(err.message);
            } else {
                setError('An unknown error occurred.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div>
            {/* Animated EMI Secure Logo */}
            <div className="flex justify-center mb-6">
                <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-brand-500 to-purple-600 rounded-full blur-xl opacity-50 animate-pulse"></div>
                    <div className="relative bg-gradient-to-br from-brand-600 to-purple-700 p-4 rounded-2xl shadow-2xl transform hover:scale-105 transition-transform duration-300">
                        <ShieldCheckIcon className="w-12 h-12 text-white" />
                    </div>
                </div>
            </div>

            {/* Animated Title */}
            <h1 className="text-4xl font-bold text-center mb-2 bg-gradient-to-r from-brand-400 via-purple-400 to-brand-500 bg-clip-text text-transparent animate-gradient">
                EMI Secure
            </h1>
            <h2 className="text-2xl font-bold leading-9 tracking-tight text-white text-center">
                Create Your Account
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-400 text-center">
                Start managing your customers and devices securely
            </p>

            <div className="mt-10">
                <form onSubmit={handleSubmit} className="space-y-6">
                    {error && (
                        <div className="bg-rose-900/50 text-rose-300 border border-rose-500/30 p-3 rounded-md text-center text-sm animate-shake">
                            {error}
                        </div>
                    )}

                    {/* Shop Name */}
                    <div>
                        <label htmlFor="shopName" className="block text-sm font-medium leading-6 text-slate-300">
                            Shop Name
                        </label>
                        <div className="relative mt-2">
                            <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                <svg className="h-5 w-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                </svg>
                            </span>
                            <input
                                type="text"
                                id="shopName"
                                name="shopName"
                                value={shopName}
                                onChange={(e) => setShopName(e.target.value)}
                                required
                                className="block w-full rounded-md border-0 bg-white/5 py-2.5 pl-10 pr-3 text-white shadow-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-inset focus:ring-brand-500 sm:text-sm sm:leading-6 transition-all duration-200"
                                placeholder="My Electronics Shop"
                            />
                        </div>
                    </div>

                    {/* Email */}
                    <div>
                        <label htmlFor="email" className="block text-sm font-medium leading-6 text-slate-300">
                            Email Address
                        </label>
                        <div className="relative mt-2">
                            <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                <UserCircleIcon />
                            </span>
                            <input
                                type="email"
                                id="email"
                                name="email"
                                autoComplete="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                className="block w-full rounded-md border-0 bg-white/5 py-2.5 pl-10 pr-3 text-white shadow-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-inset focus:ring-brand-500 sm:text-sm sm:leading-6 transition-all duration-200"
                                placeholder="you@example.com"
                            />
                        </div>
                    </div>

                    {/* Password */}
                    <div>
                        <label htmlFor="password" className="block text-sm font-medium leading-6 text-slate-300">
                            Password
                        </label>
                        <div className="relative mt-2">
                            <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                <KeyIcon />
                            </span>
                            <input
                                type="password"
                                id="password"
                                name="password"
                                autoComplete="new-password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                className="block w-full rounded-md border-0 bg-white/5 py-2.5 pl-10 pr-3 text-white shadow-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-inset focus:ring-brand-500 sm:text-sm sm:leading-6 transition-all duration-200"
                                placeholder="••••••••"
                            />
                        </div>
                    </div>

                    {/* Confirm Password */}
                    <div>
                        <label htmlFor="confirmPassword" className="block text-sm font-medium leading-6 text-slate-300">
                            Confirm Password
                        </label>
                        <div className="relative mt-2">
                            <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                <KeyIcon />
                            </span>
                            <input
                                type="password"
                                id="confirmPassword"
                                name="confirmPassword"
                                autoComplete="new-password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                                className="block w-full rounded-md border-0 bg-white/5 py-2.5 pl-10 pr-3 text-white shadow-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-inset focus:ring-brand-500 sm:text-sm sm:leading-6 transition-all duration-200"
                                placeholder="••••••••"
                            />
                        </div>
                    </div>

                    <div>
                        <Button type="submit" className="w-full group" disabled={loading}>
                            {loading ? (
                                <Spinner size="sm" />
                            ) : (
                                <span className="flex items-center justify-center gap-2">
                                    <ShieldCheckIcon className="w-5 h-5" />
                                    Create Account
                                </span>
                            )}
                        </Button>
                    </div>
                </form>

                {/* Switch to Login */}
                <p className="mt-6 text-center text-sm text-slate-400">
                    Already have an account?{' '}
                    <button
                        onClick={onSwitchToLogin}
                        className="font-semibold text-brand-400 hover:text-brand-300 transition-colors duration-200"
                    >
                        Sign in
                    </button>
                </p>
            </div>
        </div>
    );
};

export default RegisterView;
