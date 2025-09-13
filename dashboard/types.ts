
export enum PaymentStatus {
  Paid = 'Paid',
  Pending = 'Pending',
  Overdue = 'Overdue',
}

export enum DeviceStatus {
    Active = 'Active',
    Locked = 'Locked',
    Compromised = 'Compromised',
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  address: string;
  kycDocs: string[]; // URLs to documents
}

export interface Device {
  id: string;
  imei: string;
  androidId: string;
  model: string;
  status: DeviceStatus;
}

export interface EmiPayment {
  id: string;
  customerId: string;
  customerName: string;
  deviceImei: string;
  deviceModel: string;
  deviceId: string;
  deviceStatus: DeviceStatus;
  amount: number;
  dueDate: string;
  status: PaymentStatus;
}