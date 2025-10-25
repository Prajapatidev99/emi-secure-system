import React, { useState, useEffect, useCallback } from 'react';
import { getDevices, linkDevice } from '../services/api';
import { DeviceWithCustomer } from '../types';
import Card from './common/Card';
import Skeleton from './common/Skeleton';
import Button from './common/Button';
import Modal from './common/Modal';
import QrCodeModal from './QrCodeModal';
import StatusBadge from './common/StatusBadge';

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
                After provisioning the phone with the QR code, the app will start and display its permanent Android ID. Enter that ID here to complete the process.
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
                    placeholder="e.g., 1a2b3c4d5e6f7g8h"
                />
            </div>
            <div className="flex justify-end mt-6 space-x-2">
                <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
                <Button type="submit" disabled={loading}>{loading ? 'Linking...' : 'Link Device'}</Button>
            </div>
        </form>
    );
};


const DevicesView: React.FC = () => {
  const [devices, setDevices] = useState<DeviceWithCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // State for modals
  const [qrModalDeviceId, setQrModalDeviceId] = useState<string | null>(null);
  const [linkModalDevice, setLinkModalDevice] = useState<DeviceWithCustomer | null>(null);
  
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

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);
  
  const handleLinkSuccess = () => {
    setLinkModalDevice(null);
    fetchDevices(); // Refresh list after successful link
  };

  const DeviceTableSkeleton = () => (
    [...Array(5)].map((_, index) => (
      <tr key={index}>
        <td className="px-6 py-4"><Skeleton className="h-4 w-24" /></td>
        <td className="px-6 py-4"><Skeleton className="h-4 w-32" /></td>
        <td className="px-6 py-4"><Skeleton className="h-4 w-40" /></td>
        <td className="px-6 py-4"><Skeleton className="h-6 w-24 rounded-full" /></td>
        <td className="px-6 py-4"><Skeleton className="h-6 w-24 rounded-full" /></td>
        <td className="px-6 py-4 text-center"><Skeleton className="h-8 w-32 mx-auto" /></td>
      </tr>
    ))
  );

  return (
    <>
      <Card>
        <h2 className="text-2xl font-bold mb-4 text-white">Device Provisioning & Management</h2>
        {error && <p className="text-rose-400 text-center py-4">Error: {error}</p>}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-700">
            <thead className="bg-slate-800">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Customer</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Device Model</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">IMEI</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Link Status</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Device Status</th>
                <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-slate-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-slate-900 divide-y divide-slate-800">
              {loading ? (
                <DeviceTableSkeleton />
              ) : devices.map(device => (
                <tr key={device._id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">{device.customerId?.name || 'N/A'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400">{device.model}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-slate-400">{device.imei}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {device.androidId ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-teal-900 text-teal-300">
                            Linked
                        </span>
                    ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-900 text-amber-300">
                            Not Linked
                        </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm"><StatusBadge status={device.status} /></td>
                  <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium space-x-2">
                    <Button variant="secondary" size="sm" onClick={() => setQrModalDeviceId(device._id)}>
                        Provision (QR)
                    </Button>
                    {!device.androidId && (
                        <Button variant="primary" size="sm" onClick={() => setLinkModalDevice(device)}>
                            Link Device
                        </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {qrModalDeviceId && (
        <QrCodeModal 
            isOpen={!!qrModalDeviceId}
            onClose={() => setQrModalDeviceId(null)}
            deviceId={qrModalDeviceId}
        />
      )}
      
      {linkModalDevice && (
        <Modal 
            isOpen={!!linkModalDevice} 
            onClose={() => setLinkModalDevice(null)} 
            title={`Link Device: ${linkModalDevice.model}`}
        >
            <LinkDeviceForm 
                device={linkModalDevice}
                onSuccess={handleLinkSuccess}
                onCancel={() => setLinkModalDevice(null)}
            />
        </Modal>
      )}
    </>
  );
};

export default DevicesView;