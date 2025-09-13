import React, { useState, useEffect } from 'react';
import { getDevices } from '../services/api';
import { Device } from '../types';
import Card from './common/Card';
import Skeleton from './common/Skeleton';

// Extend the Device type to include populated customer data from the backend
type DeviceWithCustomer = Device & {
  customerId: { name: string } | null;
  _id: string;
};

const DevicesView: React.FC = () => {
  const [devices, setDevices] = useState<DeviceWithCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    getDevices()
      .then(setDevices)
      .catch(err => {
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError('Failed to fetch devices.');
        }
      })
      .finally(() => setLoading(false));
  }, []);
  
  const DeviceTableSkeleton = () => (
    [...Array(5)].map((_, index) => (
      <tr key={index}>
        <td className="px-6 py-4 whitespace-nowrap"><Skeleton className="h-4 w-32" /></td>
        <td className="px-6 py-4 whitespace-nowrap"><Skeleton className="h-4 w-24" /></td>
        <td className="px-6 py-4 whitespace-nowrap"><Skeleton className="h-4 w-40" /></td>
        <td className="px-6 py-4 whitespace-nowrap"><Skeleton className="h-4 w-40" /></td>
      </tr>
    ))
  );

  return (
    <Card>
      <h2 className="text-2xl font-bold mb-4">Registered Devices</h2>
       <div className="bg-amber-100 border-l-4 border-amber-500 text-amber-700 p-4 mb-4 rounded-md" role="alert">
            <p className="font-bold">Troubleshooting Registration</p>
            <p>If the Android app still shows "Device not registered", compare the <strong>Android ID</strong> on your phone screen with the ID listed here. If they don't match exactly, register the device again with the correct ID.</p>
        </div>
        
      {error && <p className="text-red-500 text-center py-4">Error: {error}. Is the backend server running?</p>}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
          <thead className="bg-slate-50 dark:bg-slate-700">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">Customer</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">Device Model</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">IMEI</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">Android ID</th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
            {loading ? (
              <DeviceTableSkeleton />
            ) : devices.length > 0 ? devices.map((device) => (
              <tr key={device._id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{device.customerId?.name || 'N/A'}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">{device.model}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">{device.imei}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-slate-500 dark:text-slate-400">{device.androidId}</td>
              </tr>
            )) : (
              <tr>
                <td colSpan={4} className="text-center py-4 text-slate-500 dark:text-slate-400">
                  No devices have been registered yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
};

export default DevicesView;