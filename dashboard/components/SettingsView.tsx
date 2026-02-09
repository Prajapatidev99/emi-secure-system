import React, { useState } from 'react';
import Button from './common/Button';
import { ShieldCheckIcon, WarningIcon } from './icons';
import Spinner from './common/Spinner';
import Modal from './Modal';

interface SettingsViewProps {
    onLogout: () => void;
}

const SettingsView: React.FC<SettingsViewProps> = ({ onLogout }) => {
    const [shopName, setShopName] = useState('');
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [showDeleteModal, setShowDeleteModal] = useState(false);

    const handleUpdateProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccess(null);
        setLoading(true);

        try {
            // TODO: Implement API call to update profile
            await new Promise(resolve => setTimeout(resolve, 1000)); // Simulated API call
            setSuccess('Profile updated successfully!');
            setShopName('');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to update profile');
        } finally {
            setLoading(false);
        }
    };

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccess(null);

        if (newPassword !== confirmPassword) {
            setError('New passwords do not match');
            return;
        }

        if (newPassword.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }

        setLoading(true);
        try {
            // TODO: Implement API call to change password
            await new Promise(resolve => setTimeout(resolve, 1000)); // Simulated API call
            setSuccess('Password changed successfully!');
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to change password');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteAccount = async () => {
        setLoading(true);
        try {
            // TODO: Implement API call to delete account
            await new Promise(resolve => setTimeout(resolve, 1000)); // Simulated API call
            onLogout();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to delete account');
        } finally {
            setLoading(false);
            setShowDeleteModal(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto">
            {/* Header with EMI Secure Branding */}
            <div className="mb-8">
                <div className="flex items-center gap-3 mb-2">
                    <div className="bg-gradient-to-br from-brand-600 to-purple-700 p-3 rounded-xl shadow-lg">
                        <ShieldCheckIcon className="w-8 h-8 text-white" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-white">Settings</h1>
                        <p className="text-slate-400">Manage your account and preferences</p>
                    </div>
                </div>
            </div>

            {/* Success/Error Messages */}
            {success && (
                <div className="mb-6 bg-emerald-900/50 text-emerald-300 border border-emerald-500/30 p-4 rounded-lg">
                    {success}
                </div>
            )}
            {error && (
                <div className="mb-6 bg-rose-900/50 text-rose-300 border border-rose-500/30 p-4 rounded-lg">
                    {error}
                </div>
            )}

            <div className="space-y-6">
                {/* Profile Section */}
                <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-6">
                    <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                        <svg className="w-5 h-5 text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        Profile Information
                    </h2>

                    <form onSubmit={handleUpdateProfile} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                Shop Name
                            </label>
                            <input
                                type="text"
                                value={shopName}
                                onChange={(e) => setShopName(e.target.value)}
                                className="w-full rounded-md border-0 bg-white/5 py-2.5 px-3 text-white shadow-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-inset focus:ring-brand-500 sm:text-sm"
                                placeholder="Enter new shop name"
                            />
                        </div>

                        <Button type="submit" disabled={loading || !shopName}>
                            {loading ? <Spinner size="sm" /> : 'Update Profile'}
                        </Button>
                    </form>
                </div>

                {/* Security Section */}
                <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-6">
                    <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                        <svg className="w-5 h-5 text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                        Change Password
                    </h2>

                    <form onSubmit={handleChangePassword} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                Current Password
                            </label>
                            <input
                                type="password"
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                autoComplete="current-password"
                                className="w-full rounded-md border-0 bg-white/5 py-2.5 px-3 text-white shadow-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-inset focus:ring-brand-500 sm:text-sm"
                                placeholder="••••••••"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                New Password
                            </label>
                            <input
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                autoComplete="new-password"
                                className="w-full rounded-md border-0 bg-white/5 py-2.5 px-3 text-white shadow-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-inset focus:ring-brand-500 sm:text-sm"
                                placeholder="••••••••"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                Confirm New Password
                            </label>
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                autoComplete="new-password"
                                className="w-full rounded-md border-0 bg-white/5 py-2.5 px-3 text-white shadow-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-inset focus:ring-brand-500 sm:text-sm"
                                placeholder="••••••••"
                            />
                        </div>

                        <Button type="submit" disabled={loading || !currentPassword || !newPassword || !confirmPassword}>
                            {loading ? <Spinner size="sm" /> : 'Change Password'}
                        </Button>
                    </form>
                </div>

                {/* Danger Zone */}
                <div className="bg-rose-900/20 border border-rose-500/30 rounded-lg p-6">
                    <h2 className="text-xl font-semibold text-rose-300 mb-4 flex items-center gap-2">
                        <WarningIcon className="w-5 h-5" />
                        Danger Zone
                    </h2>

                    <p className="text-slate-300 mb-4 text-sm">
                        Once you delete your account, there is no going back. All your customers, devices, and payment data will be permanently deleted.
                    </p>

                    <button
                        onClick={() => setShowDeleteModal(true)}
                        className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-md transition-colors duration-200 font-medium"
                    >
                        Delete Account
                    </button>
                </div>
            </div>

            {/* Delete Confirmation Modal */}
            <Modal
                isOpen={showDeleteModal}
                onClose={() => setShowDeleteModal(false)}
                title="Delete Account"
            >
                <div>
                    <div className="flex items-center gap-3 mb-4">
                        <div className="bg-rose-600/20 p-3 rounded-full">
                            <WarningIcon className="w-8 h-8 text-rose-400" />
                        </div>
                    </div>

                    <p className="text-slate-300 mb-6">
                        Are you absolutely sure? This action cannot be undone. All your data will be permanently deleted.
                    </p>

                    <div className="flex gap-3">
                        <button
                            onClick={() => setShowDeleteModal(false)}
                            className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-md transition-colors duration-200"
                            disabled={loading}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleDeleteAccount}
                            className="flex-1 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-md transition-colors duration-200 font-medium"
                            disabled={loading}
                        >
                            {loading ? <Spinner size="sm" /> : 'Yes, Delete My Account'}
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default SettingsView;
