
import React from 'react';
import { PaymentStatus, DeviceStatus } from '../../types';

interface StatusBadgeProps {
  status: PaymentStatus | DeviceStatus;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const statusStyles: Record<string, string> = {
    // Payment Statuses
    [PaymentStatus.Paid]: 'bg-teal-900 text-teal-300',
    [PaymentStatus.Pending]: 'bg-amber-900 text-amber-300',
    [PaymentStatus.Overdue]: 'bg-rose-900 text-rose-300',
    
    // Device Statuses
    [DeviceStatus.Active]: 'bg-sky-900 text-sky-300',
    [DeviceStatus.Locked]: 'bg-slate-700 text-slate-200',
    [DeviceStatus.Compromised]: 'bg-purple-900 text-purple-300',
  };

  const style = statusStyles[status] || 'bg-slate-700 text-slate-200';

  return (
    <span className={`px-2.5 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${style}`}>
      {status}
    </span>
  );
};

export default StatusBadge;
