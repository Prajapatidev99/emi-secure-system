import React, { useState, useEffect } from 'react';
import { getCustomerById, getDevicesForCustomer, getPaymentsForCustomer } from '../services/api';
import { Customer, Device, EmiPayment } from '../types';
import Card from './common/Card';
import Skeleton from './common/Skeleton';
import Button from './common/Button';
import Spinner from './common/Spinner';
import StatusBadge from './common/StatusBadge';

interface CustomerDetailViewProps {
  customerId: string;
  onBack: () => void;
}

const CustomerDetailView = ({ customerId, onBack }: CustomerDetailViewProps) => {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [payments, setPayments] = useState<EmiPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCustomerData = async () => {
      setLoading(true);
      setError(null);
      try {
        const customerData = getCustomerById(customerId);
        const devicesData = getDevicesForCustomer(customerId);
        const paymentsData = getPaymentsForCustomer(customerId);

        const [customerResult, devicesResult, paymentsResult] = await Promise.all([
          customerData,
          devicesData,
          paymentsData,
        ]);
        
        setCustomer(customerResult);
        setDevices(devicesResult);
        setPayments(paymentsResult);

      } catch (err) {
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError('Failed to fetch customer details.');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchCustomerData();
  }, [customerId]);

  if (loading) {
    return (
        <div className="flex justify-center items-center h-64">
            <Spinner size="lg" />
        </div>
    );
  }
  
  if (error) {
    return (
        <Card className="border border-red-400 bg-red-50 dark:bg-rose-900/20 dark:border-rose-500/30">
            <p className="text-center font-bold text-red-600 dark:text-rose-400">An Error Occurred</p>
            <p className="text-center text-red-500 dark:text-rose-500 mt-2">{error}</p>
        </Card>
    );
  }

  if (!customer) {
    return <p className="text-center py-4">Customer not found.</p>;
  }

  return (
    <div>
        <div className="mb-4">
            <Button onClick={onBack} variant="secondary">{'\u2190'} Back to Customer List</Button>
        </div>
        
        <Card className="mb-6">
            <h2 className="text-3xl font-bold mb-2">{customer.name}</h2>
            <p className="text-slate-600 dark:text-slate-400"><strong>Phone:</strong> {customer.phone}</p>
            <p className="text-slate-600 dark:text-slate-400"><strong>Address:</strong> {customer.address}</p>
        </Card>

        <div className="grid grid-cols-1 gap-6">
            <Card>
                <h3 className="text-xl font-semibold mb-4">Registered Devices</h3>
                 <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                        <thead className="bg-slate-50 dark:bg-slate-700">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">Model</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">IMEI</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">Android ID</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">Status</th>
                            </tr>
                        </thead>
                         <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                            {devices.length > 0 ? devices.map(d => (
                                <tr key={d.id}>
                                    <td className="px-6 py-4 whitespace-nowrap">{d.model}</td>
                                    <td className="px-6 py-4 whitespace-nowrap">{d.imei}</td>
                                    <td className="px-6 py-4 whitespace-nowrap font-mono">{d.androidId}</td>
                                    <td className="px-6 py-4 whitespace-nowrap"><StatusBadge status={d.status} /></td>
                                </tr>
                            )) : (
                                <tr><td colSpan={4} className="text-center py-4">No devices found.</td></tr>
                            )}
                         </tbody>
                    </table>
                 </div>
            </Card>
            
            <Card>
                <h3 className="text-xl font-semibold mb-4">Payment History</h3>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                        <thead className="bg-slate-50 dark:bg-slate-700">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">Device Model</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">Amount</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">Due Date</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">Status</th>
                            </tr>
                        </thead>
                         <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                             {payments.length > 0 ? payments.map(p => (
                                <tr key={p.id}>
                                    <td className="px-6 py-4 whitespace-nowrap">{p.deviceModel}</td>
                                    <td className="px-6 py-4 whitespace-nowrap">₹{p.amount.toFixed(2)}</td>
                                    <td className="px-6 py-4 whitespace-nowrap">{new Date(p.dueDate).toLocaleDateString()}</td>
                                    <td className="px-6 py-4 whitespace-nowrap"><StatusBadge status={p.status} /></td>
                                </tr>
                             )) : (
                                <tr><td colSpan={4} className="text-center py-4">No payment history found.</td></tr>
                             )}
                         </tbody>
                    </table>
                </div>
            </Card>
        </div>
    </div>
  );
};

export default CustomerDetailView;