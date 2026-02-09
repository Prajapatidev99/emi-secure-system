
import { Customer, EmiPayment, Device, KycDocument, DeviceWithCustomer } from '../types';

const hostname = window.location.hostname;
const isLocal = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0';
const API_BASE_URL = isLocal ? 'http://localhost:3001/api' : 'https://emi-secure-system.onrender.com/api';

const getAuthHeaders = () => {
    const token = sessionStorage.getItem('authToken');

    return {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : '',
    };
};

// Fetch with timeout
const fetchWithTimeout = async (url: string, options: RequestInit = {}, timeout = 30000) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        clearTimeout(id);
        return response;
    } catch (error: any) {
        clearTimeout(id);
        if (error.name === 'AbortError') {
            throw new Error('Request timeout - please check your connection');
        }
        throw error;
    }
};

// Fetch with retry logic
const fetchWithRetry = async (url: string, options: RequestInit = {}, retries = 3) => {
    for (let i = 0; i < retries; i++) {
        try {
            return await fetchWithTimeout(url, options);
        } catch (error) {
            if (i === retries - 1) throw error;
            // Exponential backoff: wait 1s, 2s, 3s
            await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        }
    }
    throw new Error('Max retries reached');
};

// User-friendly error messages
const getUserFriendlyError = (error: Error): string => {
    const message = error.message.toLowerCase();

    if (message.includes('network') || message.includes('fetch')) {
        return 'Unable to connect to server. Please check your internet connection.';
    }
    if (message.includes('timeout')) {
        return 'Request timed out. The server is taking too long to respond.';
    }
    if (message.includes('already exists')) {
        return 'This record already exists. Please check your input.';
    }
    if (message.includes('not found')) {
        return 'The requested resource was not found.';
    }
    if (message.includes('unauthorized') || message.includes('401')) {
        return 'Your session has expired. Please log in again.';
    }
    if (message.includes('forbidden') || message.includes('403')) {
        return 'You do not have permission to perform this action.';
    }

    return error.message;
};

const handleResponse = async (response: Response) => {
    if (response.status === 401 && !response.url.endsWith('/login')) {
        sessionStorage.removeItem('authToken');
        window.location.reload();
        throw new Error('Your session has expired. Please log in again.');
    }

    if (response.status === 413) {
        throw new Error('Upload failed: The file(s) are too large. Please ensure each image is under 2MB.');
    }

    const responseBody = await response.text();

    if (!response.ok) {
        let errorMessage = `Server error: ${response.status}`;
        try {
            if (responseBody && responseBody.trim().length > 0) {
                const errorJson = JSON.parse(responseBody);
                if (errorJson.message) {
                    errorMessage = errorJson.message;
                }
                if (errorJson.error) {
                    errorMessage += ` (${errorJson.error})`;
                }
            }
        } catch (e) {
            console.error("Received non-JSON error response:", responseBody);
            errorMessage = `An unexpected network error occurred (Status: ${response.status}).`;
        }
        throw new Error(getUserFriendlyError(new Error(errorMessage)));
    }

    if (!responseBody) {
        return {};
    }

    try {
        return JSON.parse(responseBody);
    } catch (e) {
        console.error("Failed to parse successful response as JSON:", responseBody);
        throw new Error("Received a malformed response from the server.");
    }
};


// --- AUTH ---
export const login = async (email: string, password: string): Promise<{ token: string }> => {
    const response = await fetchWithRetry(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
    });
    return handleResponse(response);
};

export const register = async (email: string, password: string, shopName: string): Promise<{ token: string }> => {
    const response = await fetchWithRetry(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, shopName }),
    });
    return handleResponse(response);
};


// --- DASHBOARD ---
export const getDashboardStats = async () => {
    const response = await fetchWithRetry(`${API_BASE_URL}/stats`, { headers: getAuthHeaders() });
    return handleResponse(response);
};

export const getPendingPayments = async (): Promise<EmiPayment[]> => {
    const response = await fetchWithRetry(`${API_BASE_URL}/payments/pending`, { headers: getAuthHeaders() });
    return handleResponse(response);
};

// --- DEVICE ACTIONS ---
export const lockDevice = async (deviceId: string) => {
    const response = await fetchWithRetry(`${API_BASE_URL}/devices/${deviceId}/lock`, {
        method: 'POST',
        headers: getAuthHeaders(),
    });
    return handleResponse(response);
};

export const unlockDevice = async (deviceId: string) => {
    const response = await fetchWithRetry(`${API_BASE_URL}/devices/${deviceId}/unlock`, {
        method: 'POST',
        headers: getAuthHeaders(),
    });
    return handleResponse(response);
};

export const hardResetDevice = async (deviceId: string) => {
    const response = await fetchWithRetry(`${API_BASE_URL}/devices/${deviceId}/reset`, {
        method: 'POST',
        headers: getAuthHeaders(),
    });
    return handleResponse(response);
};

export const getOfflineUnlockKey = async (deviceId: string): Promise<{ unlockKey: string }> => {
    const response = await fetchWithRetry(`${API_BASE_URL}/devices/${deviceId}/unlock-key`, { headers: getAuthHeaders() });
    return handleResponse(response);
};

export const releaseDevice = async (deviceId: string) => {
    const response = await fetchWithRetry(`${API_BASE_URL}/devices/${deviceId}/release`, {
        method: 'POST',
        headers: getAuthHeaders(),
    });
    return handleResponse(response);
};

export const deleteDevice = async (deviceId: string) => {
    const response = await fetchWithRetry(`${API_BASE_URL}/devices/${deviceId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
    });
    return handleResponse(response);
};


// --- PAYMENT ACTIONS ---
export const markPaymentAsPaid = async (paymentId: string) => {
    const response = await fetchWithRetry(`${API_BASE_URL}/payments/${paymentId}/pay`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
    });
    return handleResponse(response);
};

// --- CUSTOMER MANAGEMENT ---
export const getCustomers = async (): Promise<Customer[]> => {
    const response = await fetchWithRetry(`${API_BASE_URL}/customers`, { headers: getAuthHeaders() });
    const data = await handleResponse(response);
    // Handle pagination response
    return data.customers || data;
};

export const addCustomer = async (customerData: { name: string; phone: string; address: string, kycDocs?: KycDocument[] }): Promise<Customer> => {
    const response = await fetchWithRetry(`${API_BASE_URL}/customers`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(customerData),
    });
    return handleResponse(response);
};

export const getCustomerById = async (customerId: string): Promise<Customer> => {
    const response = await fetchWithRetry(`${API_BASE_URL}/customers/${customerId}`, { headers: getAuthHeaders() });
    return handleResponse(response);
};

export const deleteCustomer = async (customerId: string) => {
    const response = await fetchWithRetry(`${API_BASE_URL}/customers/${customerId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
    });
    return handleResponse(response);
};

export const getDevicesForCustomer = async (customerId: string): Promise<Device[]> => {
    const response = await fetchWithRetry(`${API_BASE_URL}/customers/${customerId}/devices`, { headers: getAuthHeaders() });
    return handleResponse(response);
};

export const getPaymentsForCustomer = async (customerId: string): Promise<EmiPayment[]> => {
    const response = await fetchWithRetry(`${API_BASE_URL}/customers/${customerId}/payments`, { headers: getAuthHeaders() });
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
    const response = await fetchWithRetry(`${API_BASE_URL}/devices/register`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(saleData),
    });
    return handleResponse(response);
};

export const linkDevice = async (deviceId: string, androidId: string) => {
    const response = await fetchWithRetry(`${API_BASE_URL}/devices/${deviceId}/link`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ androidId }),
    });
    return handleResponse(response);
};


export const getDevices = async (): Promise<DeviceWithCustomer[]> => {
    const response = await fetchWithRetry(`${API_BASE_URL}/devices`, { headers: getAuthHeaders() });
    return handleResponse(response);
};

// --- QR CODE PROVISIONING ---

