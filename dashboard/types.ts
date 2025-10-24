

export enum PaymentStatus {
  Paid = 'Paid',
  Pending = 'Pending',
  Overdue = 'Overdue',
}

export enum DeviceStatus {
    Active = 'Active',
    Locked = 'Locked',
    Compromised = 'Compromised',
    Released = 'Released',
}

// NEW: Add an interface for a single KYC document
export interface KycDocument {
  docType: string;
  docUrl: string;
}

export interface Customer {
  id: string;
  _id: string;
  name: string;
  phone: string;
  address: string;
  // UPDATED: Change kycDocs to be an array of the new KycDocument interface and make it optional
  kycDocs?: KycDocument[];
}

export interface Device {
  id: string;
  _id: string;
  imei: string;
  androidId: string;
  model: string;
  status: DeviceStatus;
}

export interface EmiPayment {
  id: string;
  _id: string;
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