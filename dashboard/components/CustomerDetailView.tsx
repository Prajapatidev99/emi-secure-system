
import { useState, useEffect } from 'react';
import { getCustomerById, getDevicesForCustomer, getPaymentsForCustomer } from '../services/api';
import { Customer, Device, EmiPayment } from '../types';
import Card from './common/Card';
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
        <Card className="border border-rose-500/30 bg-rose-900/20">
            <p className="text-center font-bold text-rose-400">An Error Occurred</p>
            <p className="text-center text-rose-500 mt-2">{error}</p>
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
            <h2 className="text-3xl font-bold mb-2 text-white">{customer.name}</h2>
            <p className="text-slate-400"><strong>Phone:</strong> {customer.phone}</p>
            <p className="text-slate-400"><strong>Address:</strong> {customer.address}</p>
        </Card>

        <div className="grid grid-cols-1 gap-6">
            <Card>
                <h3 className="text-xl font-semibold mb-4 text-white">Registered Devices</h3>
                 <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-700">
                        <thead className="bg-slate-800">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Model</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">IMEI</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Android ID</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Status</th>
                            </tr>
                        </thead>
                         <tbody className="bg-slate-900 divide-y divide-slate-800">
                            {devices.length > 0 ? devices.map(d => (
                                <tr key={d.id}>
                                    <td className="px-6 py-4 whitespace-nowrap text-white">{d.model}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-slate-400">{d.imei}</td>
                                    <td className="px-6 py-4 whitespace-nowrap font-mono text-slate-400">{d.androidId}</td>
                                    <td className="px-6 py-4 whitespace-nowrap"><StatusBadge status={d.status} /></td>
                                </tr>
                            )) : (
                                <tr><td colSpan={4} className="text-center py-4 text-slate-400">No devices found.</td></tr>
                            )}
                         </tbody>
                    </table>
                 </div>
            </Card>
            
            <Card>
                <h3 className="text-xl font-semibold mb-4 text-white">Payment History</h3>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-700">
                        <thead className="bg-slate-800">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Device Model</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Amount</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Due Date</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Status</th>
                            </tr>
                        </thead>
                         <tbody className="bg-slate-900 divide-y divide-slate-800">
                             {payments.length > 0 ? payments.map(p => (
                                <tr key={p.id}>
                                    <td className="px-6 py-4 whitespace-nowrap text-white">{p.deviceModel}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-slate-400">₹{p.amount.toFixed(2)}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-slate-400">{new Date(p.dueDate).toLocaleDateString()}</td>
                                    <td className="px-6 py-4 whitespace-nowrap"><StatusBadge status={p.status} /></td>
                                </tr>
                             )) : (
                                <tr><td colSpan={4} className="text-center py-4 text-slate-400">No payment history found.</td></tr>
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