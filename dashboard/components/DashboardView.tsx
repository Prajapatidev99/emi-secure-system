import { useState, useEffect, useCallback } from 'react';
import { getDashboardStats, getPendingPayments, lockDevice, unlockDevice, markPaymentAsPaid, hardResetDevice, getOfflineUnlockKey, sendReminder } from '../services/api';
import { EmiPayment, DeviceStatus } from '../types';
import Card from './common/Card';
import StatusBadge from './common/StatusBadge';
import Button from './common/Button';
import { LockClosedIcon, LockOpenIcon, CheckCircleIcon, ExclamationTriangleIcon, KeyIcon, BellIcon, MagnifyingGlassIcon } from './icons';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import Skeleton from './common/Skeleton';
import Spinner from './common/Spinner';
import ConfirmationModal from './common/ConfirmationModal';
import Modal from './common/Modal';

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
  const [reminderLoading, setReminderLoading] = useState<Record<string, boolean>>({});
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
  
  const [isOfflineKeyModalOpen, setOfflineKeyModalOpen] = useState(false);
  const [offlineKey, setOfflineKey] = useState<string | null>(null);
  const [offlineKeyLoading, setOfflineKeyLoading] = useState(false);

  
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

  const handleSendReminder = async (paymentId: string) => {
    setReminderLoading(prev => ({ ...prev, [paymentId]: true }));
    try {
      await sendReminder(paymentId);
      alert('Reminder sent successfully!');
    } catch (err) {
      console.error(`Failed to send reminder`, err);
       if (err instanceof Error) {
        if (err.message.includes('has no FCM token')) {
          alert('Failed to send reminder: This customer has not installed or opened the app yet. They must open the app once to receive notifications.');
        } else {
          alert(`Error: ${err.message}`);
        }
      }
    } finally {
      setReminderLoading(prev => ({ ...prev, [paymentId]: false }));
    }
  };

  const handleShowOfflineKey = async (deviceId: string) => {
    setOfflineKeyModalOpen(true);
    setOfflineKeyLoading(true);
    setOfflineKey(null);
    try {
        const data = await getOfflineUnlockKey(deviceId);
        setOfflineKey(data.unlockKey);
    } catch (err) {
        if (err instanceof Error) {
            setOfflineKey(`Error: ${err.message}`);
        } else {
            setOfflineKey('An unknown error occurred.');
        }
    } finally {
        setOfflineKeyLoading(false);
    }
  };

  const filteredPayments = payments.filter(payment =>
    payment.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    payment.deviceModel.toLowerCase().includes(searchTerm.toLowerCase()) ||
    payment.deviceImei.toLowerCase().includes(searchTerm.toLowerCase()) ||
    payment.simDetails?.slot1?.phoneNumber?.includes(searchTerm) ||
    payment.simDetails?.slot2?.phoneNumber?.includes(searchTerm)
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

  const renderDeviceActions = (payment: EmiPayment) => {
    if (payment.deviceStatus === DeviceStatus.Compromised || payment.deviceStatus === DeviceStatus.Released) {
        return <span className="text-sm text-slate-500">-</span>;
    }

    switch (payment.deviceStatus) {
      case DeviceStatus.Active:
        return (
          <Button
            onClick={() => confirmDeviceAction(payment, 'lock')}
            variant="danger"
            size="sm"
            disabled={actionLoading[payment.deviceId]}
          >
            <LockClosedIcon /> {actionLoading[payment.deviceId] ? 'Locking...' : 'Lock'}
          </Button>
        );
      case DeviceStatus.Locked:
        return (
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
              onClick={() => handleShowOfflineKey(payment.deviceId)}
              variant="secondary"
              size="sm"
            >
              <KeyIcon /> Offline Unlock
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
        );
      default:
        return null;
    }
  };

  return (
    <>
      <Card>
        <h3 className="text-xl font-semibold mb-4 text-white">Pending Payments & Device Control</h3>
        
        <div className="mb-4 relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <MagnifyingGlassIcon className="h-5 w-5 text-slate-500" />
          </div>
          <input
            type="text"
            placeholder="Search by customer, device model, IMEI, or Phone Number..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-3 py-2 border border-slate-700 rounded-md shadow-sm focus:outline-none focus:ring-brand-500 focus:border-brand-500 bg-slate-800 placeholder-slate-400 text-slate-200"
            aria-label="Search pending payments"
          />
        </div>

        {error && <p className="text-rose-400 text-center py-2">Error: {error}. Is the backend server running?</p>}

        {/* DESKTOP TABLE VIEW */}
        <div className="hidden md:block overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-700">
            <thead className="bg-slate-800">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Customer</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Device</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Due Date</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Payment Status</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Device Status</th>
                <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-slate-400 uppercase tracking-wider">Actions & Payments</th>
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
                          <td className="px-6 py-4 text-center"><Skeleton className="h-8 w-40 mx-auto" /></td>
                      </tr>
                  ))
              ) : filteredPayments.length > 0 ? filteredPayments.map((payment) => (
                <tr key={payment.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">{payment.customerName}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400">
                    <div className="font-medium text-slate-200">{payment.deviceModel}</div>
                    <div className="text-xs">IMEI1: {payment.deviceImei}</div>
                    {payment.deviceImei2 && <div className="text-xs">IMEI2: {payment.deviceImei2}</div>}
                    {payment.simDetails && (
                      <div className="mt-1 flex flex-col gap-0.5 border-t border-slate-800 pt-1">
                        {payment.simDetails.slot1 && (
                          <div className="text-[10px] text-brand-400 leading-tight">
                            Slot 1: {payment.simDetails.slot1.operator} {payment.simDetails.slot1.phoneNumber && `(${payment.simDetails.slot1.phoneNumber})`}
                          </div>
                        )}
                        {payment.simDetails.slot2 && (
                          <div className="text-[10px] text-brand-400 leading-tight">
                            Slot 2: {payment.simDetails.slot2.operator} {payment.simDetails.slot2.phoneNumber && `(${payment.simDetails.slot2.phoneNumber})`}
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400">{new Date(payment.dueDate).toLocaleDateString()}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <StatusBadge status={payment.status} />
                    {(payment.totalOverdueCount ?? 0) > 1 && (
                      <div className="text-[10px] text-rose-400 mt-1 font-bold">
                        +{payment.totalOverdueCount! - 1} more overdue
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <StatusBadge status={payment.deviceStatus} />
                    {payment.metadata && !payment.metadata.isDeviceOwner && payment.deviceStatus !== 'Released' && (
                      <div className="flex items-center gap-1 text-[10px] text-rose-400 mt-1 font-bold animate-pulse">
                        <ExclamationTriangleIcon className="w-3 h-3" /> NOT SECURED
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                     <div className="flex flex-col gap-2 items-center">
                        <div className="flex gap-2">
                           {renderDeviceActions(payment)}
                        </div>
                        <div className="flex gap-2">
                           <Button
                              onClick={() => handleSendReminder(payment.id)}
                              variant="secondary"
                              size="sm"
                              disabled={reminderLoading[payment.id]}
                              className={payment.status === 'Overdue' ? 'border-amber-500 text-amber-500 hover:bg-amber-500/10' : ''}
                           >
                              <BellIcon className="w-4 h-4" /> {reminderLoading[payment.id] ? '...' : (payment.status === 'Overdue' ? 'Warning' : 'Remind')}
                           </Button>
                           <Button
                              onClick={() => handleMarkAsPaid(payment.id)}
                              variant="success"
                              size="sm"
                              disabled={paymentLoading[payment.id]}
                           >
                              <CheckCircleIcon className="w-4 h-4" /> {paymentLoading[payment.id] ? '...' : 'Paid'}
                           </Button>
                        </div>
                     </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-slate-500 italic font-medium">No pending payments found matching your search.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* MOBILE CARD VIEW */}
        <div className="md:hidden space-y-4">
          {initialLoading ? (
            [...Array(3)].map((_, index) => (
              <div key={index} className="bg-slate-800/50 p-4 rounded-xl border border-slate-700 animate-pulse">
                <div className="h-4 w-32 bg-slate-700 rounded mb-4"></div>
                <div className="h-4 w-full bg-slate-700 rounded mb-2"></div>
                <div className="h-4 w-2/3 bg-slate-700 rounded"></div>
              </div>
            ))
          ) : filteredPayments.length > 0 ? (
            filteredPayments.map((payment) => (
              <div key={payment.id} className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden shadow-lg">
                <div className="p-4 border-b border-slate-700 flex justify-between items-start bg-slate-800/30">
                  <div>
                    <h4 className="text-white font-bold">{payment.customerName}</h4>
                    <p className="text-xs text-slate-400">{payment.deviceModel}</p>
                  </div>
                  <StatusBadge status={payment.status} />
                </div>
                
                <div className="p-4 space-y-3">
                   <div className="flex justify-between text-xs">
                      <span className="text-slate-500 uppercase font-semibold">Installment Due</span>
                      <span className="text-white">₹{payment.amount.toLocaleString()} on {new Date(payment.dueDate).toLocaleDateString()}</span>
                   </div>
                   
                   <div className="flex justify-between text-xs">
                      <span className="text-slate-500 uppercase font-semibold">IMEI</span>
                      <span className="text-slate-300 font-mono">{payment.deviceImei}</span>
                   </div>

                   {payment.simDetails?.slot1 && (
                      <div className="flex justify-between text-[10px] bg-brand-500/5 p-2 rounded border border-brand-500/10">
                         <span className="text-brand-400 opacity-80 uppercase font-bold">Active SIM</span>
                         <span className="text-brand-300 text-right">{payment.simDetails.slot1.operator} <br/> {payment.simDetails.slot1.phoneNumber}</span>
                      </div>
                   )}

                   <div className="pt-2 flex flex-col gap-3">
                      <div className="flex gap-2 justify-center">
                        {renderDeviceActions(payment)}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                           onClick={() => handleSendReminder(payment.id)}
                           variant="secondary"
                           size="sm"
                           disabled={reminderLoading[payment.id]}
                           className={`w-full ${payment.status === 'Overdue' ? 'border-amber-500 text-amber-500' : ''}`}
                        >
                           <BellIcon className="w-4 h-4 mr-1" /> {reminderLoading[payment.id] ? '...' : (payment.status === 'Overdue' ? 'Warning' : 'Remind')}
                        </Button>
                        <Button
                           onClick={() => handleMarkAsPaid(payment.id)}
                           variant="success"
                           size="sm"
                           className="w-full"
                           disabled={paymentLoading[payment.id]}
                        >
                           <CheckCircleIcon className="w-4 h-4 mr-1" /> {paymentLoading[payment.id] ? '...' : 'Paid'}
                        </Button>
                      </div>
                   </div>
                </div>
              </div>
            ))
          ) : (
            <div className="py-10 text-center text-slate-500 italic bg-slate-900/50 rounded-xl border border-slate-800 border-dashed">
              No pending payments found matching your search.
            </div>
          )}
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
      <Modal
        isOpen={isOfflineKeyModalOpen}
        onClose={() => setOfflineKeyModalOpen(false)}
        title="Offline Unlock Key"
      >
        <div className="text-center">
            <p className="text-slate-400 mb-4">Provide this permanent key to the customer to unlock their device without internet.</p>
            {offlineKeyLoading ? <Spinner /> : (
                <div className="bg-slate-900 p-4 rounded-lg">
                    <p className="text-3xl font-mono tracking-widest text-amber-300">{offlineKey}</p>
                </div>
            )}
        </div>
      </Modal>
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