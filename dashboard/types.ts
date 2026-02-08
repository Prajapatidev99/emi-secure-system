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
  androidId?: string; // CRITICAL: Made optional for new registration flow
  model: string;
  status: DeviceStatus;
  location?: {
    latitude: number;
    longitude: number;
    accuracy: number;
    lastUpdated: Date;
  };
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

// Type for the devices view, which includes populated customer data
// FIX: Refactored from a type alias using an intersection (&) to an interface 
// that uses 'extends'. This resolves a potential TypeScript module resolution error 
// while making the type definition clearer.
export interface DeviceWithCustomer extends Device {
  customerId: { _id: string; name: string } | null;
}
