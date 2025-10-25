import { useState, useEffect, useMemo } from 'react';
import { getCustomerById, getDevicesForCustomer, getPaymentsForCustomer, releaseDevice } from '../services/api';
import { Customer, Device, EmiPayment, PaymentStatus, DeviceStatus } from '../types';
import Card from './common/Card';
import Button from './common/Button';
import Spinner from './common/Spinner';
import StatusBadge from './common/StatusBadge';
import ConfirmationModal from './common/ConfirmationModal';
import { ShieldCheckIcon } from './icons';
import Modal from './common/Modal';
import QrCodeModal from './QrCodeModal';

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

  // State for the release confirmation modal
  const [isReleaseModalOpen, setReleaseModalOpen] = useState(false);
  const [deviceToRelease, setDeviceToRelease] = useState<Device | null>(null);
  const [releaseLoading, setReleaseLoading] = useState(false);
  
  // State for viewing KYC image
  const [viewingImage, setViewingImage] = useState<string | null>(null);

  // State for QR Code modal
  const [isQrModalOpen, setQrModalOpen] = useState(false);
  const [selectedDeviceIdForQr, setSelectedDeviceIdForQr] = useState<string | null>(null);

  const openQrCodeModal = (deviceId: string) => {
    setSelectedDeviceIdForQr(deviceId);
    setQrModalOpen(true);
  };


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

  useEffect(() => {
    fetchCustomerData();
  }, [customerId]);

  const allPaymentsCleared = useMemo(() => {
    if (payments.length === 0 && devices.length > 0) return true; // Allows release if no EMI plan was created, but device exists
    if (payments.length === 0) return false;
    return payments.every(p => p.status === PaymentStatus.Paid);
  }, [payments, devices]);
  
  const handleReleaseDevice = async () => {
    if (!deviceToRelease) return;
    setReleaseLoading(true);
    try {
        await releaseDevice(deviceToRelease._id);
        setReleaseModalOpen(false);
        setDeviceToRelease(null);
        // Refresh all data to show updated status
        await fetchCustomerData(); 
    } catch (err) {
         if (err instanceof Error) {
          alert(`Error: ${err.message}`);
        }
    } finally {
        setReleaseLoading(false);
    }
  };

  const openReleaseConfirmation = (device: Device) => {
    setDeviceToRelease(device);
    setReleaseModalOpen(true);
  };


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
            <Button onClick={onBack} variant="secondary">{'<'} Back to Customer List</Button>
        </div>
        
        <Card className="mb-6">
            <h2 className="text-3xl font-bold mb-2 text-white">{customer.name}</h2>
            <p className="text-slate-400"><strong>Phone:</strong> {customer.phone}</p>
            <p className="text-slate-400"><strong>Address:</strong> {customer.address}</p>
        </Card>
        
        {/* KYC Documents Card */}
        {customer.kycDocs && customer.kycDocs.length > 0 && (
            <Card className="mb-6">
                <h3 className="text-xl font-semibold mb-4 text-white">KYC Documents</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {customer.kycDocs.map((doc, index) => (
                        <div key={index} className="relative group cursor-pointer" onClick={() => setViewingImage(doc.docUrl)}>
                            <img 
                                src={doc.docUrl} 
                                alt={doc.docType} 
                                className="w-full h-32 object-cover rounded-md transition-transform duration-200 group-hover:scale-105"
                            />
                            <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 rounded-md">
                                <p className="text-white text-center text-sm font-bold">{doc.docType}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </Card>
        )}

        {/* Device Finalization Section - only shows when all payments are cleared */}
        {allPaymentsCleared && (
          <Card className="mb-6 border-2 border-teal-500 bg-teal-900/20">
            <h3 className="text-xl font-semibold mb-2 text-teal-300">Device Finalization</h3>
            <p className="text-teal-400 mb-4">All EMIs for this customer have been paid. You can now release their devices from security management.</p>
            <div className="space-y-2">
                {devices.map(device => (
                    <div key={device._id} className="flex justify-between items-center bg-slate-800 p-3 rounded-md">
                        <div>
                            <p className="font-semibold text-white">{device.model}</p>
                            <p className="text-sm text-slate-400">{device.imei}</p>
                        </div>
                        {device.status !== DeviceStatus.Released ? (
                            <Button 
                                variant="success" 
                                size="sm" 
                                onClick={() => openReleaseConfirmation(device)}
                                disabled={releaseLoading}
                            >
                                <ShieldCheckIcon /> Release Device
                            </Button>
                        ) : (
                            <StatusBadge status={DeviceStatus.Released} />
                        )}
                    </div>
                ))}
            </div>
          </Card>
        )}


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
                                <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-slate-400 uppercase tracking-wider">Provisioning</th>
                            </tr>
                        </thead>
                         <tbody className="bg-slate-900 divide-y divide-slate-800">
                            {devices.length > 0 ? devices.map(d => (
                                <tr key={d._id}>
                                    <td className="px-6 py-4 whitespace-nowrap text-white">{d.model}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-slate-400">{d.imei}</td>
                                    <td className="px-6 py-4 whitespace-nowrap font-mono text-slate-400">{d.androidId}</td>
                                    <td className="px-6 py-4 whitespace-nowrap"><StatusBadge status={d.status} /></td>
                                    <td className="px-6 py-4 whitespace-nowrap text-center">
                                        <Button 
                                            variant="secondary" 
                                            size="sm"
                                            onClick={() => openQrCodeModal(d._id)}
                                        >
                                            QR Code
                                        </Button>
                                    </td>
                                </tr>
                            )) : (
                                <tr><td colSpan={5} className="text-center py-4 text-slate-400">No devices found.</td></tr>
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
                                <tr key={p._id}>
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

        {deviceToRelease && (
            <ConfirmationModal
                isOpen={isReleaseModalOpen}
                onClose={() => setReleaseModalOpen(false)}
                onConfirm={handleReleaseDevice}
                title="Confirm Device Release"
                variant="success"
                confirmText={releaseLoading ? 'Releasing...' : 'Yes, Release Device'}
            >
                Are you sure you want to permanently remove all security restrictions from device 
                <strong className="font-semibold text-white"> {deviceToRelease.model} ({deviceToRelease.imei})</strong>? 
                This action cannot be undone.
            </ConfirmationModal>
        )}

        {viewingImage && (
            <Modal isOpen={!!viewingImage} onClose={() => setViewingImage(null)} title="View KYC Document">
                <img src={viewingImage} alt="KYC Document Preview" className="max-w-full max-h-[80vh] mx-auto rounded-md" />
            </Modal>
        )}

        {selectedDeviceIdForQr && (
            <QrCodeModal
                isOpen={isQrModalOpen}
                onClose={() => setQrModalOpen(false)}
                deviceId={selectedDeviceIdForQr}
            />
        )}
    </div>
  );
};

export default CustomerDetailView;