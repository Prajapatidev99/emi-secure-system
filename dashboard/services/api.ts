// FIX: Import the 'DeviceWithCustomer' type to resolve errors.
import { Customer, EmiPayment, Device, KycDocument, DeviceWithCustomer } from '../types';

// Detect if we are running locally to switch the API URL automatically.
const hostname = window.location.hostname;
const isLocal = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0';
const API_BASE_URL = isLocal ? 'http://localhost:3001/api' : 'https://emi-secure-system.onrender.com/api';

const getAuthHeaders = () => {
    // Retrieve token from sessionStorage to authorize API requests.
    const token = sessionStorage.getItem('authToken');
    
    return {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : '',
    };
};

const handleResponse = async (response: Response) => {
    // Handle auth failures first, as they might redirect or have non-JSON bodies.
    if (response.status === 401 && !response.url.endsWith('/login')) {
        sessionStorage.removeItem('authToken');
        window.location.reload();
        throw new Error('Your session has expired. Please log in again.');
    }
    
    if (response.status === 413) {
        throw new Error('Upload failed: The file(s) are too large. Please ensure each image is under 2MB.');
    }

    // Get the response body as text, as we don't know yet if it's JSON.
    const responseBody = await response.text();

    // If the response was not successful, throw an error.
    if (!response.ok) {
        let errorMessage = `Server error: ${response.status}`;
        try {
            // Try to parse JSON only if content exists
            if (responseBody && responseBody.trim().length > 0) {
                const errorJson = JSON.parse(responseBody);
                if (errorJson.message) {
                    errorMessage = errorJson.message;
                }
                // Append detailed error if available
                if (errorJson.error) {
                    errorMessage += ` (${errorJson.error})`;
                }
            }
        } catch (e) {
            // If parsing failed, it's not a JSON error from our API.
            console.error("Received non-JSON error response:", responseBody);
            errorMessage = `An unexpected network error occurred (Status: ${response.status}).`;
        }
        throw new Error(errorMessage);
    }

    // If the response was successful, parse the body (if it's not empty).
    if (!responseBody) {
        return {}; // An empty object is a safe default for successful but empty responses (e.g., 204 No Content).
    }
    
    // CRITICAL FIX: Wrap the final parse in a try-catch block.
    try {
        return JSON.parse(responseBody);
    } catch (e) {
        console.error("Failed to parse successful response as JSON:", responseBody);
        throw new Error("Received a malformed response from the server.");
    }
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
    const response = await fetch(`${API_BASE_URL}/devices/${deviceId}/lock`, {
        method: 'POST',
        headers: getAuthHeaders(),
    });
    return handleResponse(response);
};

export const unlockDevice = async (deviceId: string) => {
    const response = await fetch(`${API_BASE_URL}/devices/${deviceId}/unlock`, {
        method: 'POST',
        headers: getAuthHeaders(),
    });
    return handleResponse(response);
};

export const hardResetDevice = async (deviceId: string) => {
    const response = await fetch(`${API_BASE_URL}/devices/${deviceId}/reset`, {
        method: 'POST',
        headers: getAuthHeaders(),
    });
    return handleResponse(response);
};

export const getOfflineUnlockKey = async (deviceId: string): Promise<{ unlockKey: string }> => {
    const response = await fetch(`${API_BASE_URL}/devices/${deviceId}/unlock-key`, { headers: getAuthHeaders() });
    return handleResponse(response);
};

// --- NEW: Device Release Action ---
export const releaseDevice = async (deviceId: string) => {
    const response = await fetch(`${API_BASE_URL}/devices/${deviceId}/release`, {
        method: 'POST',
        headers: getAuthHeaders(),
    });
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

export const addCustomer = async (customerData: { name: string; phone: string; address: string, kycDocs?: KycDocument[] }): Promise<Customer> => {
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

// NEW: Link an Android ID to a device after provisioning
export const linkDevice = async (deviceId: string, androidId: string) => {
    const response = await fetch(`${API_BASE_URL}/devices/${deviceId}/link`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ androidId }),
    });
    return handleResponse(response);
};


export const getDevices = async (): Promise<DeviceWithCustomer[]> => {
    const response = await fetch(`${API_BASE_URL}/devices`, { headers: getAuthHeaders() });
    return handleResponse(response);
};

// --- QR CODE PROVISIONING ---
export const getQrCodeData = async (deviceId: string): Promise<{ qrCodeData: string }> => {
    const response = await fetch(`${API_BASE_URL}/devices/${deviceId}/provisioning-qr`, { headers: getAuthHeaders() });
    return handleResponse(response);
};