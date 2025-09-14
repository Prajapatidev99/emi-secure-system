import React, { useState, useEffect, useCallback } from 'react';
import { getDashboardStats, getPendingPayments, lockDevice, unlockDevice, markPaymentAsPaid, hardResetDevice } from '../services/api';
import { EmiPayment, DeviceStatus } from '../types';
import Card from './common/Card';
import StatusBadge from './common/StatusBadge';
import Button from './common/Button';
import { LockClosedIcon, LockOpenIcon, CheckCircleIcon, ExclamationTriangleIcon } from './icons';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import Skeleton from './common/Skeleton';
import Spinner from './common/Spinner';
import ConfirmationModal from './common/ConfirmationModal';

interface DashboardStats {
    totalEmiCollected: number;
    overduePayments: number;
    lockedDevices: number;
    monthlyData: { name: string; revenue: number }[];
}

const LockPanel = () => {
  const [payments, setPayments] = useState<EmiPayment[]>([]);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const [paymentLoading, setPaymentLoading] = useState<Record<string, boolean>>({});
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [confirmationDetails, setConfirmationDetails] = useState<{
    payment: EmiPayment;
    action: 'lock' | 'unlock' | 'reset';
    title: string;
    message: React.ReactNode;
    variant: 'danger' | 'success';
  } | null>(null);

  
  const fetchPayments = useCallback(async () => {
    try {
      setError(null);
      const data = await getPendingPayments();
      setPayments(data);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to fetch pending payments.');
      }
    }
  }, []);

  useEffect(() => {
    setInitialLoading(true);
    fetchPayments().finally(() => setInitialLoading(false));
  }, [fetchPayments]);

  const handleDeviceAction = async (deviceId: string, action: 'lock' | 'unlock' | 'reset') => {
    setActionLoading(prev => ({ ...prev, [deviceId]: true }));
    try {
      if (action === 'lock') {
        await lockDevice(deviceId);
      } else if (action === 'unlock') {
        await unlockDevice(deviceId);
      } else if (action === 'reset') {
        await hardResetDevice(deviceId);
      }
      // Refresh data after action
      fetchPayments();
    } catch (err) {
      console.error(`Failed to ${action} device`, err);
       if (err instanceof Error) {
        alert(`Error: ${err.message}`);
      }
    } finally {
      setActionLoading(prev => ({ ...prev, [deviceId]: false }));
    }
  };

  const confirmDeviceAction = (payment: EmiPayment, action: 'lock' | 'unlock' | 'reset') => {
    // FIX: Explicitly type `details` to match the properties required by `confirmationDetails` state.
    // This resolves a TypeScript error where the inferred type of `{}` was missing properties.
    let details: { title: string; message: React.ReactNode; variant: 'danger' | 'success' };
    switch(action) {
      case 'lock':
        details = {
          title: 'Confirm Device Lock',
          message: (
            <>
              Are you sure you want to lock device{' '}
              <strong className="font-semibold text-white">{payment.deviceModel} ({payment.deviceImei})</strong>?
            </>
          ),
          variant: 'danger' as const,
        };
        break;
      case 'unlock':
         details = {
          title: 'Confirm Device Unlock',
          message: (
            <>
              Are you sure you want to unlock device{' '}
              <strong className="font-semibold text-white">{payment.deviceModel} ({payment.deviceImei})</strong>?
            </>
          ),
          variant: 'success' as const,
        };
        break;
      case 'reset':
         details = {
          title: 'DANGER: Confirm Hard Reset',
          message: (
            <>
              <p>This action is irreversible and will perform a <strong>factory reset</strong>, wiping all data from device{' '}
              <strong className="font-semibold text-white">{payment.deviceModel} ({payment.deviceImei})</strong>.</p>
              <p className="mt-2 text-amber-300">This command will only succeed if the app was provisioned as a "Device Owner" as per the guide. Are you absolutely sure?</p>
            </>
          ),
          variant: 'danger' as const,
        };
        break;
    }

    setConfirmationDetails({
      payment,
      action,
      ...details
    });
    setShowConfirmation(true);
  };
  
  const executeConfirmedAction = () => {
    if (!confirmationDetails) return;
    handleDeviceAction(confirmationDetails.payment.deviceId, confirmationDetails.action);
    setShowConfirmation(false);
    setConfirmationDetails(null);
  };

  const cancelAction = () => {
    setShowConfirmation(false);
    setConfirmationDetails(null);
  };


  const handleMarkAsPaid = async (paymentId: string) => {
    setPaymentLoading(prev => ({ ...prev, [paymentId]: true }));
    try {
      await markPaymentAsPaid(paymentId);
      // Refresh data after action
      fetchPayments();
    } catch (err) {
      console.error(`Failed to mark payment as paid`, err);
       if (err instanceof Error) {
        alert(`Error: ${err.message}`);
      }
    } finally {
      setPaymentLoading(prev => ({ ...prev, [paymentId]: false }));
    }
  };

  const filteredPayments = payments.filter(payment =>
    payment.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    payment.deviceModel.toLowerCase().includes(searchTerm.toLowerCase()) ||
    payment.deviceImei.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  const getConfirmText = () => {
    if (!confirmationDetails) return 'Confirm';
    switch (confirmationDetails.action) {
      case 'lock': return 'Yes, Lock Device';
      case 'unlock': return 'Yes, Unlock Device';
      case 'reset': return 'Yes, I Understand, Reset Device';
      default: return 'Confirm';
    }
  };

  return (
    <>
      <Card>
        <h3 className="text-xl font-semibold mb-4 text-white">Pending Payments & Device Control</h3>
        
        <div className="mb-4">
          <input
            type="text"
            placeholder="Search by customer, device model, or IMEI..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-2 border border-slate-700 rounded-md shadow-sm focus:outline-none focus:ring-brand-500 focus:border-brand-500 bg-slate-800 placeholder-slate-400"
            aria-label="Search pending payments"
          />
        </div>

        {error && <p className="text-rose-400 text-center py-2">Error: {error}. Is the backend server running?</p>}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-700">
            <thead className="bg-slate-800">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Customer</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Device</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Due Date</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Payment Status</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Device Status</th>
                <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-slate-400 uppercase tracking-wider">Device Actions</th>
                <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-slate-400 uppercase tracking-wider">Record Payment</th>
              </tr>
            </thead>
            <tbody className="bg-slate-900 divide-y divide-slate-800">
              {initialLoading ? (
                 [...Array(5)].map((_, index) => (
                      <tr key={index}>
                          <td className="px-6 py-4"><Skeleton className="h-4 w-24" /></td>
                          <td className="px-6 py-4"><Skeleton className="h-4 w-32" /></td>
                          <td className="px-6 py-4"><Skeleton className="h-4 w-20" /></td>
                          <td className="px-6 py-4"><Skeleton className="h-6 w-20 rounded-full" /></td>
                          <td className="px-6 py-4"><Skeleton className="h-6 w-20 rounded-full" /></td>
                          <td className="px-6 py-4 text-center"><Skeleton className="h-8 w-24 mx-auto" /></td>
                          <td className="px-6 py-4 text-center"><Skeleton className="h-8 w-24 mx-auto" /></td>
                      </tr>
                  ))
              ) : filteredPayments.length > 0 ? filteredPayments.map((payment) => (
                <tr key={payment.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">{payment.customerName}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400">{payment.deviceModel} ({payment.deviceImei})</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400">{new Date(payment.dueDate).toLocaleDateString()}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm"><StatusBadge status={payment.status} /></td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm"><StatusBadge status={payment.deviceStatus} /></td>
                  <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium space-x-2">
                    {payment.deviceStatus === DeviceStatus.Active ? (
                      <Button
                        onClick={() => confirmDeviceAction(payment, 'lock')}
                        variant="danger"
                        size="sm"
                        disabled={actionLoading[payment.deviceId]}
                      >
                        <LockClosedIcon /> {actionLoading[payment.deviceId] ? 'Locking...' : 'Lock'}
                      </Button>
                    ) : payment.deviceStatus === DeviceStatus.Locked ? (
                      <>
                        <Button
                          onClick={() => confirmDeviceAction(payment, 'unlock')}
                          variant="success"
                          size="sm"
                          disabled={actionLoading[payment.deviceId]}
                        >
                          <LockOpenIcon /> {actionLoading[payment.deviceId] ? 'Unlocking...' : 'Unlock'}
                        </Button>
                        <Button
                          onClick={() => confirmDeviceAction(payment, 'reset')}
                          variant="danger"
                          size="sm"
                          disabled={actionLoading[payment.deviceId]}
                        >
                          <ExclamationTriangleIcon /> {actionLoading[payment.deviceId] ? 'Resetting...' : 'Reset'}
                        </Button>
                      </>
                    ) : null}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                     <Button
                        onClick={() => handleMarkAsPaid(payment.id)}
                        variant="success"
                        size="sm"
                        disabled={paymentLoading[payment.id]}
                      >
                        <CheckCircleIcon /> {paymentLoading[payment.id] ? 'Saving...' : 'Mark as Paid'}
                      </Button>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={8} className="text-center py-4 text-slate-400">
                    No pending or overdue payments found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
      {confirmationDetails && (
        <ConfirmationModal
          isOpen={showConfirmation}
          onClose={cancelAction}
          onConfirm={executeConfirmedAction}
          title={confirmationDetails.title}
          variant={confirmationDetails.variant}
          confirmText={getConfirmText()}
        >
          {confirmationDetails.message}
        </ConfirmationModal>
      )}
    </>
  );
};

interface StatCardProps {
  title: string;
  value: string | number;
  loading: boolean;
  colorClass?: string;
}

const StatCard = ({ title, value, loading, colorClass = '' }: StatCardProps) => (
    <Card>
        <h4 className="text-slate-400">{title}</h4>
        {loading ? (
            <Skeleton className="h-8 w-3/4 mt-1" />
        ) : (
            <p className={`text-3xl font-bold ${colorClass || 'text-white'}`}>{value}</p>
        )}
    </Card>
);

const DashboardView = () => {
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [loadingStats, setLoadingStats] = useState(true);

    useEffect(() => {
        setLoadingStats(true);
        getDashboardStats()
            .then(setStats)
            .catch(err => {
                console.error("Failed to fetch dashboard stats:", err);
            })
            .finally(() => setLoadingStats(false));
    }, []);

    return (
        <div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
                <StatCard 
                    title="Total EMI Collected" 
                    value={`₹${stats?.totalEmiCollected.toLocaleString() ?? '0'}`} 
                    loading={loadingStats} 
                />
                <StatCard 
                    title="Overdue Payments" 
                    value={stats?.overduePayments ?? '0'} 
                    loading={loadingStats} 
                    colorClass="text-rose-500"
                />
                <StatCard 
                    title="Locked Devices" 
                    value={stats?.lockedDevices ?? '0'} 
                    loading={loadingStats} 
                    colorClass="text-amber-500"
                />
            </div>
            
            <div className="grid grid-cols-1 gap-6 mb-6">
                <Card>
                    <h3 className="text-xl font-semibold mb-4 text-white">Monthly Revenue</h3>
                    <div style={{ width: '100%', height: 300 }}>
                       {loadingStats ? (
                            <div className="flex items-center justify-center h-full">
                                <Spinner />
                            </div>
                        ) : (
                            <ResponsiveContainer>
                                <BarChart data={stats?.monthlyData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke={"#334155"} />
                                    <XAxis dataKey="name" tick={{ fill: '#94a3b8' }} />
                                    <YAxis tick={{ fill: '#94a3b8' }} />
                                    <Tooltip 
                                      contentStyle={{ 
                                        backgroundColor: '#0f172a',
                                        borderColor: '#1e293b'
                                      }}
                                    />
                                    <Legend wrapperStyle={{ color: '#94a3b8' }}/>
                                    <Bar dataKey="revenue" fill="#3b82f6" />
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </Card>
            </div>

            <LockPanel />
        </div>
    );
};

export default DashboardView;