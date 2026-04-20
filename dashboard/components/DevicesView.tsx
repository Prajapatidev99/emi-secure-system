
import React, { useState, useEffect, useCallback, useMemo } from 'react';
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

    const validation = useMemo(() => {
        const errors: Record<string, string> = {};
        if (androidId.length > 0 && androidId.length < 10) errors.id = "ID is too short";
        return { errors, isValid: androidId.length >= 10 };
    }, [androidId]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validation.isValid) return;
        setLoading(true);
        setError(null);
        try {
            await linkDevice(device._id, androidId);
            onSuccess();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An unknown error occurred.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
                <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-xl text-sm animate-shake">
                    {error}
                </div>
            )}
            <p className="text-slate-400 text-sm leading-relaxed">
                Connect the device to a computer and run the ADB command. The app will display its unique <strong className="text-white">Android ID</strong>. Enter it here to bind the device.
            </p>
            <div>
                <label htmlFor="androidId" className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Android ID</label>
                <input
                    type="text"
                    id="androidId"
                    value={androidId}
                    onChange={(e) => setAndroidId(e.target.value)}
                    placeholder="e.g. ad1234567890abcdef"
                    className={`block w-full px-4 py-3 bg-slate-700 border ${validation.errors.id ? 'border-rose-500/50' : 'border-slate-600'} rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition-all font-mono`}
                />
                {validation.errors.id && <p className="text-[10px] text-rose-400 mt-1 font-medium">{validation.errors.id}</p>}
            </div>
            <div className="flex flex-col sm:flex-row gap-3 pt-4">
                <Button type="button" variant="secondary" onClick={onCancel} className="flex-1">Cancel</Button>
                <Button type="submit" disabled={loading || !validation.isValid} className="flex-1">
                    {loading ? 'Binding...' : '⚡ Link Device'}
                </Button>
            </div>
        </form>
    );
};

const DevicesView: React.FC<{ walletBalance: number | null; onDeviceRegistered: () => void }> = ({ walletBalance }) => {
  const [devices, setDevices] = useState<DeviceWithCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [linkModalDevice, setLinkModalDevice] = useState<DeviceWithCustomer | null>(null);
  
  const [deviceToDelete, setDeviceToDelete] = useState<DeviceWithCustomer | null>(null);
  const [isDeleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchDevices = useCallback(() => {
    setLoading(true);
    setError(null);
    getDevices()
        .then(setDevices)
        .catch(err => {
            setError(err instanceof Error ? err.message : 'Failed to fetch devices.');
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
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-brand-500/10 rounded-lg">
            <svg className="w-6 h-6 text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Active Devices</h2>
        </div>

        {walletBalance !== null && walletBalance < 200 && (
          <div className="mb-6 flex items-start gap-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl px-5 py-4 animate-in slide-in-from-top-4">
            <div className="pt-1">
              <svg className="w-5 h-5 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold text-rose-300">Balance Too Low (₹{walletBalance})</p>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                You need at least <strong className="text-white font-semibold">₹200</strong> in your wallet to register new devices. 
                Existing devices will continue to function.
              </p>
            </div>
          </div>
        )}
        
        {error && <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-xl text-sm mb-6">{error}</div>}

        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-800">
          <table className="min-w-full divide-y divide-slate-800">
            <thead className="bg-slate-800/50">
              <tr>
                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Customer</th>
                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Model</th>
                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Status</th>
                <th className="px-6 py-4 text-right text-[10px] font-bold text-slate-500 uppercase tracking-widest">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-slate-900/30 divide-y divide-slate-800">
              {loading ? [...Array(3)].map((_, i) => <tr key={i}><td colSpan={4} className="px-6 py-4"><Skeleton className="h-6 w-full opacity-10"/></td></tr>) : 
                devices.length > 0 ? devices.map(device => (
                <tr key={device._id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="px-6 py-4 text-sm font-semibold text-white">{device.customerId?.name || 'Unassigned'}</td>
                  <td className="px-6 py-4 text-sm text-slate-400">{device.model}</td>
                  <td className="px-6 py-4"><StatusBadge status={device.status} /></td>
                  <td className="px-6 py-4 text-right space-x-2">
                    {!device.androidId && (
                        <Button variant="primary" size="sm" onClick={() => setLinkModalDevice(device)}>Link</Button>
                    )}
                    <Button variant="danger" size="sm" onClick={() => openDeleteModal(device)}>Delete</Button>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={4} className="text-center py-10 text-slate-500 text-sm">No devices found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Card Stack */}
        <div className="md:hidden space-y-4">
          {loading ? [...Array(3)].map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-2xl opacity-10"/>) : 
            devices.length > 0 ? devices.map(device => (
            <div key={device._id} className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5 space-y-4 shadow-sm active:scale-[0.98] transition-all">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Model</p>
                  <p className="text-white font-bold text-lg leading-tight">{device.model}</p>
                  <p className="text-xs text-slate-400 mt-1">{device.customerId?.name || 'No Customer Linked'}</p>
                </div>
                <StatusBadge status={device.status} />
              </div>
              
              <div className="grid grid-cols-2 gap-3 pt-2">
                {!device.androidId ? (
                   <Button variant="primary" size="md" className="w-full text-xs py-3" onClick={() => setLinkModalDevice(device)}>
                    ⚡ Link Device
                   </Button>
                ) : (
                   <div className="text-[10px] bg-slate-700/50 text-slate-400 rounded-lg p-3 text-center border border-slate-600/30 flex items-center justify-center">
                     Hardware Linked ✅
                   </div>
                )}
                <Button variant="danger" size="md" className="w-full text-xs py-3" onClick={() => openDeleteModal(device)}>
                  Delete
                </Button>
              </div>
            </div>
          )) : (
            <div className="text-center py-10 bg-slate-900/20 border border-dashed border-slate-800 rounded-2xl">
              <p className="text-slate-500 text-sm">No devices in list</p>
            </div>
          )}
        </div>
      </Card>

      {linkModalDevice && (
        <Modal isOpen={!!linkModalDevice} onClose={() => setLinkModalDevice(null)} title="Hardware Linking">
            <LinkDeviceForm device={linkModalDevice} onSuccess={() => { setLinkModalDevice(null); fetchDevices(); }} onCancel={() => setLinkModalDevice(null)} />
        </Modal>
      )}

      {deviceToDelete && (
          <ConfirmationModal
            isOpen={isDeleteModalOpen}
            onClose={() => setDeleteModalOpen(false)}
            onConfirm={handleDeleteConfirm}
            title="Remove Device"
            variant="danger"
            confirmText={deleteLoading ? "Removing..." : "Proceed with Removal"}
          >
            Are you sure you want to remove <strong className="text-white">{deviceToDelete.model}</strong>? 
            This will wipe its EMI history from the portal.
          </ConfirmationModal>
      )}
    </>
  );
};

export default DevicesView;
