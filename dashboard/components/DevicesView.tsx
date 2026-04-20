
import React, { useState, useEffect, useCallback } from 'react';
import { getDevices, linkDevice, deleteDevice } from '../services/api';
import { DeviceWithCustomer } from '../types';
import Card from './common/Card';
import Skeleton from './common/Skeleton';
import Button from './common/Button';
import Modal from './common/Modal';
import StatusBadge from './common/StatusBadge';
import ConfirmationModal from './common/ConfirmationModal';

const LinkDeviceForm = ({ device, onSuccess, onCancel }: { device: DeviceWithCustomer, onSuccess: () => void, onCancel: () => void }) => {
    const [androidId, setAndroidId] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            await linkDevice(device._id, androidId);
            onSuccess();
        } catch (err) {
            if (err instanceof Error) setError(err.message);
            else setError('An unknown error occurred.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit}>
            {error && <p className="bg-rose-900/50 text-rose-300 border border-rose-500/30 p-3 rounded-md mb-4 text-center">{error}</p>}
            <p className="text-slate-400 mb-4">
                After running the ADB command, the app will display its permanent Android ID. Enter it here.
            </p>
            <div>
                <label htmlFor="androidId" className="block text-sm font-medium text-slate-300">Android ID from Device</label>
                <input
                    type="text"
                    id="androidId"
                    value={androidId}
                    onChange={(e) => setAndroidId(e.target.value)}
                    required
                    className="mt-1 block w-full px-3 py-2 border border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-brand-500 focus:border-brand-500 bg-slate-700 text-white"
                />
            </div>
            <div className="flex justify-end mt-6 space-x-2">
                <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
                <Button type="submit" disabled={loading}>{loading ? 'Linking...' : 'Link Device'}</Button>
            </div>
        </form>
    );
};

const DevicesView: React.FC<{ walletBalance: number | null; onDeviceRegistered: () => void }> = ({ walletBalance, onDeviceRegistered: _onDeviceRegistered }) => {
  const [devices, setDevices] = useState<DeviceWithCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [linkModalDevice, setLinkModalDevice] = useState<DeviceWithCustomer | null>(null);
  
  // Deletion state
  const [deviceToDelete, setDeviceToDelete] = useState<DeviceWithCustomer | null>(null);
  const [isDeleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchDevices = useCallback(() => {
    setLoading(true);
    setError(null);
    getDevices()
        .then(setDevices)
        .catch(err => {
            if (err instanceof Error) setError(err.message);
            else setError('Failed to fetch devices.');
        })
        .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchDevices(); }, [fetchDevices]);

  const handleDeleteConfirm = async () => {
    if (!deviceToDelete) return;
    setDeleteLoading(true);
    try {
        await deleteDevice(deviceToDelete._id);
        setDeleteModalOpen(false);
        setDeviceToDelete(null);
        fetchDevices();
    } catch (err) {
        if (err instanceof Error) alert(err.message);
    } finally {
        setDeleteLoading(false);
    }
  };

  const openDeleteModal = (device: DeviceWithCustomer) => {
    setDeviceToDelete(device);
    setDeleteModalOpen(true);
  };
  
  return (
    <>
      <Card>
        <h2 className="text-2xl font-bold mb-4 text-white">Device Management</h2>

        {/* Low balance warning banner */}
        {walletBalance !== null && walletBalance < 200 && (
          <div className="mb-5 flex items-start gap-3 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
            <svg className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            <div>
              <p className="text-sm font-semibold text-red-400">Insufficient Wallet Balance</p>
              <p className="text-xs text-slate-400 mt-0.5">
                Your current balance is <strong className="text-white">₹{walletBalance}</strong>. You need at least <strong className="text-white">₹200</strong> to register a new device.
                Please contact your administrator to recharge your wallet.
              </p>
            </div>
          </div>
        )}
        
        {error && <p className="text-rose-400 text-center py-4">Error: {error}</p>}

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-700">
            <thead className="bg-slate-800">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Customer</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Model</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-400 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-slate-900 divide-y divide-slate-800">
              {loading ? [...Array(5)].map((_, i) => <tr key={i}><td colSpan={4}><Skeleton className="h-8 w-full my-2"/></td></tr>) : 
                devices.length > 0 ? devices.map(device => (
                <tr key={device._id}>
                  <td className="px-6 py-4 text-white">{device.customerId?.name || 'N/A'}</td>
                  <td className="px-6 py-4 text-slate-400">{device.model}</td>
                  <td className="px-6 py-4"><StatusBadge status={device.status} /></td>
                  <td className="px-6 py-4 text-right space-x-2">
                    {!device.androidId && (
                        <Button variant="primary" size="sm" onClick={() => setLinkModalDevice(device)}>Link Device</Button>
                    )}
                    <Button variant="danger" size="sm" onClick={() => openDeleteModal(device)}>Delete</Button>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={4} className="text-center py-4 text-slate-400">
                    No devices found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
      {linkModalDevice && (
        <Modal isOpen={!!linkModalDevice} onClose={() => setLinkModalDevice(null)} title="Link Device">
            <LinkDeviceForm device={linkModalDevice} onSuccess={() => { setLinkModalDevice(null); fetchDevices(); }} onCancel={() => setLinkModalDevice(null)} />
        </Modal>
      )}

      {deviceToDelete && (
          <ConfirmationModal
            isOpen={isDeleteModalOpen}
            onClose={() => setDeleteModalOpen(false)}
            onConfirm={handleDeleteConfirm}
            title="Delete Device"
            variant="danger"
            confirmText={deleteLoading ? "Deleting..." : "Delete Permanently"}
          >
            Are you sure you want to delete device <strong className="text-white">{deviceToDelete.model}</strong>?
            <br/><br/>
            <span className="text-rose-400 font-bold">WARNING:</span> This will also delete all associated EMI payment records for this device. This action cannot be undone.
          </ConfirmationModal>
      )}
    </>
  );
};

export default DevicesView;
