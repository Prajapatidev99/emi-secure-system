// FIX: Import the 'Device' type to resolve 'Cannot find name' error in 'registerDevice' function.
import { Customer, EmiPayment, Device } from '../types';

const API_BASE_URL = 'https://emi-secure-system.onrender.com/api';

const getAuthHeaders = () => {
    // Retrieve token from sessionStorage to authorize API requests.
    const token = sessionStorage.getItem('authToken');
    
    return {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : '',
    };
};

const handleResponse = async (response: Response) => {
    // For login, a 401 is a specific "Invalid credentials" message.
    if (response.status === 401 && !response.url.endsWith('/login')) {
        // Any other 401 means the token is invalid/expired.
        sessionStorage.removeItem('authToken');
        // FIX: Complete the line to force a reload, which will redirect to the login page.
        window.location.reload();
        // We throw an error here to stop the promise chain.
        throw new Error('Your session has expired. Please log in again.');
    }
    
    const data = await response.json();

    if (!response.ok) {
        // Use the error message from the backend if available, otherwise use a default.
        const errorMessage = data.message || `An error occurred: ${response.statusText}`;
        throw new Error(errorMessage);
    }
    return data;
};


// --- AUTH ---
export const login = async (email: string, password: string): Promise<{ token: string }> => {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
    });
    return handleResponse(response);
};

// --- DASHBOARD ---
export const getDashboardStats = async () => {
    const response = await fetch(`${API_BASE_URL}/stats`, { headers: getAuthHeaders() });
    return handleResponse(response);
};

export const getPendingPayments = async (): Promise<EmiPayment[]> => {
    const response = await fetch(`${API_BASE_URL}/payments/pending`, { headers: getAuthHeaders() });
    return handleResponse(response);
};

// --- DEVICE ACTIONS ---
export const lockDevice = async (deviceId: string) => {
    const response = await fetch(`${API_BASE_URL}/lock/${deviceId}`, {
        method: 'POST',
        headers: getAuthHeaders(),
    });
    return handleResponse(response);
};

export const unlockDevice = async (deviceId: string) => {
    const response = await fetch(`${API_BASE_URL}/unlock/${deviceId}`, {
        method: 'POST',
        headers: getAuthHeaders(),
    });
    return handleResponse(response);
};

export const hardResetDevice = async (deviceId: string) => {
    const response = await fetch(`${API_BASE_URL}/reset/${deviceId}`, {
        method: 'POST',
        headers: getAuthHeaders(),
    });
    return handleResponse(response);
};

export const getOfflineUnlockKey = async (deviceId: string): Promise<{ unlockKey: string }> => {
    const response = await fetch(`${API_BASE_URL}/devices/${deviceId}/unlock-key`, { headers: getAuthHeaders() });
    return handleResponse(response);
};

// --- PAYMENT ACTIONS ---
export const markPaymentAsPaid = async (paymentId: string) => {
    const response = await fetch(`${API_BASE_URL}/payments/${paymentId}/pay`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
    });
    return handleResponse(response);
};

// --- CUSTOMER MANAGEMENT ---
export const getCustomers = async (): Promise<Customer[]> => {
    const response = await fetch(`${API_BASE_URL}/customers`, { headers: getAuthHeaders() });
    return handleResponse(response);
};

export const addCustomer = async (customerData: { name: string; phone: string; address: string }): Promise<Customer> => {
    const response = await fetch(`${API_BASE_URL}/customers`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(customerData),
    });
    return handleResponse(response);
};

export const getCustomerById = async (customerId: string): Promise<Customer> => {
    const response = await fetch(`${API_BASE_URL}/customers/${customerId}`, { headers: getAuthHeaders() });
    return handleResponse(response);
};

export const getDevicesForCustomer = async (customerId: string): Promise<Device[]> => {
    const response = await fetch(`${API_BASE_URL}/customers/${customerId}/devices`, { headers: getAuthHeaders() });
    return handleResponse(response);
};

export const getPaymentsForCustomer = async (customerId: string): Promise<EmiPayment[]> => {
    const response = await fetch(`${API_BASE_URL}/customers/${customerId}/payments`, { headers: getAuthHeaders() });
    return handleResponse(response);
};

// --- DEVICE MANAGEMENT ---
type RegisterDeviceData = {
  customerId: string;
  imei: string;
  androidId: string;
  model: string;
  totalPrice: number;
  downPayment: number;
  numberOfEmis: number;
  emiStartDate: string;
};

export const registerDevice = async (saleData: RegisterDeviceData) => {
    const response = await fetch(`${API_BASE_URL}/devices/register`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(saleData),
    });
    return handleResponse(response);
};

// FIX: Update the return type to match the shape of data returned by the API, which includes a populated customerId and a MongoDB _id. This resolves the type error in DevicesView.tsx.
export const getDevices = async (): Promise<(Device & { customerId: { name: string } | null; _id: string; })[]> => {
    const response = await fetch(`${API_BASE_URL}/devices`, { headers: getAuthHeaders() });
    return handleResponse(response);
};