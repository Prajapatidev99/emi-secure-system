// FIX: Import the 'Device' type to resolve 'Cannot find name' error in 'registerDevice' function.
import { Customer, EmiPayment, Device } from '../types';

const API_BASE_URL = 'http://localhost:3001/api';

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
        window.location.reload(); // Reload to force back to login page.
        throw new Error('Your session has expired. Please log in again.');
    }

    const isJson = response.headers.get('content-type')?.includes('application/json');
    const data = isJson ? await response.json() : null;

    if (!response.ok) {
        let errorMessage = 'An unknown error occurred.';
        if (data && data.message) {
            errorMessage = data.message;
        } else {
             switch (response.status) {
                case 400:
                    errorMessage = 'Bad Request. Please check your input.';
                    break;
                case 404:
                    errorMessage = 'Resource not found.';
                    break;
                case 500:
                    errorMessage = 'Server error. Please try again later.';
                    break;
                default:
                    errorMessage = `An error occurred: ${response.statusText}`;
            }
        }
        throw new Error(errorMessage);
    }
    
    return data || {};
};


// --- Auth Routes (Public) ---
export const login = async (email: string, password: string): Promise<{ token: string }> => {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
    });
    return handleResponse(response);
}

// --- Protected Routes ---
export const getDashboardStats = async () => {
    const response = await fetch(`${API_BASE_URL}/stats`, { headers: getAuthHeaders() });
    return handleResponse(response);
};

export const getPendingPayments = async (): Promise<EmiPayment[]> => {
    const response = await fetch(`${API_BASE_URL}/payments/pending`, { headers: getAuthHeaders() });
    const payments = await handleResponse(response);
    // FIX: Prevent white screen crash if API response is not an array
    if (!Array.isArray(payments)) {
        console.error("API Error: Expected payments to be an array, but received:", payments);
        return [];
    }
    return payments;
};

export const getCustomers = async (): Promise<Customer[]> => {
    const response = await fetch(`${API_BASE_URL}/customers`, { headers: getAuthHeaders() });
    const customers = await handleResponse(response);
    // FIX: Prevent white screen crash if API response is not an array
    if (!Array.isArray(customers)) {
        console.error("API Error: Expected customers to be an array, but received:", customers);
        return [];
    }
    return customers.map((c: any) => ({ ...c, id: c._id }));
};

export const addCustomer = async (customerData: { name: string; phone: string; address: string }): Promise<Customer> => {
    const response = await fetch(`${API_BASE_URL}/customers`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(customerData),
    });
    const customer = await handleResponse(response);
    return { ...customer, id: customer._id };
};

export const registerDevice = async (deviceData: { 
    customerId: string; 
    imei: string;
    androidId: string;
    model: string;
    totalPrice: number;
    downPayment: number;
    numberOfEmis: number;
    emiStartDate: string;
}): Promise<{ message: string, device: Device }> => {
    const response = await fetch(`${API_BASE_URL}/devices/register`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(deviceData),
    });
    // The API returns an object like { message: '...', device: {...} }
    const responseData = await handleResponse(response);
    return {
        ...responseData,
        device: { ...responseData.device, id: responseData.device._id }
    };
};

export const lockDevice = async (deviceId: string): Promise<{ success: boolean }> => {
    const response = await fetch(`${API_BASE_URL}/lock/${deviceId}`, {
        method: 'POST',
        headers: getAuthHeaders(),
    });
    await handleResponse(response);
    return { success: true };
};

export const unlockDevice = async (deviceId: string): Promise<{ success: boolean }> => {
    const response = await fetch(`${API_BASE_URL}/unlock/${deviceId}`, {
        method: 'POST',
        headers: getAuthHeaders(),
    });
    await handleResponse(response);
    return { success: true };
};

export const hardResetDevice = async (deviceId: string): Promise<{ success: boolean }> => {
    const response = await fetch(`${API_BASE_URL}/reset/${deviceId}`, {
        method: 'POST',
        headers: getAuthHeaders(),
    });
    await handleResponse(response);
    return { success: true };
};

export const markPaymentAsPaid = async (paymentId: string): Promise<{ success: boolean }> => {
     const response = await fetch(`${API_BASE_URL}/payments/${paymentId}/pay`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
    });
    await handleResponse(response);
    return { success: true };
};

export const getDevices = async (): Promise<(Device & { customerId: { name: string }, _id: string })[]> => {
    const response = await fetch(`${API_BASE_URL}/devices`, { headers: getAuthHeaders() });
    const devices = await handleResponse(response);
    // FIX: Prevent white screen crash if API response is not an array
    if (!Array.isArray(devices)) {
        console.error("API Error: Expected devices to be an array, but received:", devices);
        return [];
    }
    // Map _id to id for frontend consistency
    return devices.map((d: any) => ({ ...d, id: d._id }));
};

// --- NEW: API to get permanent offline unlock key ---
export const getOfflineUnlockKey = async (deviceId: string): Promise<{ unlockKey: string }> => {
    const response = await fetch(`${API_BASE_URL}/devices/${deviceId}/unlock-key`, { headers: getAuthHeaders() });
    return handleResponse(response);
};


// --- New APIs for Customer Detail View ---
export const getCustomerById = async (customerId: string): Promise<Customer> => {
    const response = await fetch(`${API_BASE_URL}/customers/${customerId}`, { headers: getAuthHeaders() });
    const customer = await handleResponse(response);
    return { ...customer, id: customer._id };
};

export const getDevicesForCustomer = async (customerId: string): Promise<Device[]> => {
    const response = await fetch(`${API_BASE_URL}/customers/${customerId}/devices`, { headers: getAuthHeaders() });
    const devices = await handleResponse(response);
     if (!Array.isArray(devices)) {
        console.error("API Error: Expected devices to be an array, but received:", devices);
        return [];
    }
    return devices.map((d: any) => ({ ...d, id: d._id }));
};

// FIX: Corrected typo in API_BASE_URL and completed the function body to fetch and return customer payments.
export const getPaymentsForCustomer = async (customerId: string): Promise<EmiPayment[]> => {
    const response = await fetch(`${API_BASE_URL}/customers/${customerId}/payments`, { headers: getAuthHeaders() });
    const payments = await handleResponse(response);
    if (!Array.isArray(payments)) {
        console.error("API Error: Expected payments for customer to be an array, but received:", payments);
        return [];
    }
    return payments;
};