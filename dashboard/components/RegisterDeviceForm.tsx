

import React, { useState, useEffect } from 'react';
import { registerDevice, addCustomer } from '../services/api';
import { Customer } from '../types';
import Button from './common/Button';

interface RegisterDeviceFormProps {
  customers: Customer[];
  onSuccess: () => void;
}

const RegisterDeviceForm: React.FC<RegisterDeviceFormProps> = ({ customers, onSuccess }) => {
  // Default to 'New Customer' if no customers exist
  const [isNewCustomer, setIsNewCustomer] = useState(customers.length === 0);

  // Existing customer state
  const [customerId, setCustomerId] = useState(customers.length > 0 ? customers[0].id : '');

  // New customer state
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [newCustomerAddress, setNewCustomerAddress] = useState('');

  // Device and EMI state
  const [imei, setImei] = useState('');
  const [androidId, setAndroidId] = useState('');
  const [model, setModel] = useState('');
  const [totalPrice, setTotalPrice] = useState('');
  const [downPayment, setDownPayment] = useState('');
  const [numberOfEmis, setNumberOfEmis] = useState('12');
  const [emiStartDate, setEmiStartDate] = useState(new Date().toISOString().split('T')[0]);
  
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [calculatedEmi, setCalculatedEmi] = useState<number | null>(null);

  useEffect(() => {
    const price = parseFloat(totalPrice);
    const down = parseFloat(downPayment);
    const emis = parseInt(numberOfEmis);
    if (!isNaN(price) && !isNaN(down) && !isNaN(emis) && price > down && emis > 0) {
      setCalculatedEmi((price - down) / emis);
    } else {
      setCalculatedEmi(null);
    }
  }, [totalPrice, downPayment, numberOfEmis]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    // --- Frontend Validation ---
    if (isNewCustomer && (!newCustomerName.trim() || !newCustomerPhone.trim() || !newCustomerAddress.trim())) {
        setError('Please fill in all new customer details.');
        setLoading(false);
        return;
    }
    if (!imei.trim() || !androidId.trim() || !model.trim()) {
        setError('Device Model, IMEI, and Android ID are required.');
        setLoading(false);
        return;
    }
    const numTotalPrice = parseFloat(totalPrice);
    const numDownPayment = parseFloat(downPayment);
    if (isNaN(numTotalPrice) || isNaN(numDownPayment) || numTotalPrice <= numDownPayment) {
      setError('Total Price must be a valid number and greater than the Down Payment.');
      setLoading(false);
      return;
    }
    
    let finalCustomerId = customerId;

    try {
        if (isNewCustomer) {
            const newCustomer = await addCustomer({
                name: newCustomerName,
                phone: newCustomerPhone,
                address: newCustomerAddress,
            });
            finalCustomerId = newCustomer.id;
        }

        if (!finalCustomerId) {
            setError("Could not determine customer. Please select or create one.");
            setLoading(false);
            return;
        }

        await registerDevice({
            customerId: finalCustomerId,
            imei,
            androidId,
            model,
            totalPrice: numTotalPrice,
            downPayment: numDownPayment,
            numberOfEmis: parseInt(numberOfEmis),
            emiStartDate,
        });
        
        setSuccessMessage('Device registered and EMI plan created successfully!');
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unknown error occurred during registration.');
      }
    } finally {
      setLoading(false);
    }
  };

  const emiOptions = [3, 4, 6, 8, 9, 10, 12];

  if (successMessage) {
    return (
        <div>
            <p className="bg-teal-900/50 text-teal-300 border border-teal-500/30 p-3 rounded-md mb-4 text-center">{successMessage}</p>
            <div className="flex justify-end mt-4">
                <Button type="button" onClick={onSuccess}>Done</Button>
            </div>
        </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <p className="bg-rose-900/50 text-rose-300 border border-rose-500/30 p-3 rounded-md text-center">{error}</p>}
      
      <div>
        <label className="block text-sm font-medium text-slate-300">Customer</label>
        <div className="flex items-center space-x-4 mt-2">
          <label className="flex items-center">
            <input type="radio" name="customerType" checked={!isNewCustomer} onChange={() => setIsNewCustomer(false)} disabled={customers.length === 0} className="h-4 w-4 text-brand-600 border-gray-300 focus:ring-brand-500" />
            <span className="ml-2 text-sm text-white">Existing</span>
          </label>
          <label className="flex items-center">
            <input type="radio" name="customerType" checked={isNewCustomer} onChange={() => setIsNewCustomer(true)} className="h-4 w-4 text-brand-600 border-gray-300 focus:ring-brand-500" />
            <span className="ml-2 text-sm text-white">New Customer</span>
          </label>
        </div>
      </div>

      {!isNewCustomer ? (
        <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-brand-500 focus:border-brand-500 bg-slate-700 text-white">
          {customers.map((c) => (
            <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>
          ))}
        </select>
      ) : (
        <div className="border border-slate-700 rounded-lg p-4 space-y-3 bg-slate-900/50">
           <input type="text" placeholder="Enter customer's full name" value={newCustomerName} onChange={(e) => setNewCustomerName(e.target.value)} required className="block w-full px-3 py-2 border border-slate-600 rounded-md bg-slate-700 text-white" />
           <input type="tel" placeholder="Enter customer's phone" value={newCustomerPhone} onChange={(e) => setNewCustomerPhone(e.target.value)} required className="block w-full px-3 py-2 border border-slate-600 rounded-md bg-slate-700 text-white" />
           <textarea placeholder="Enter customer's address" value={newCustomerAddress} onChange={(e) => setNewCustomerAddress(e.target.value)} required rows={2} className="block w-full px-3 py-2 border border-slate-600 rounded-md bg-slate-700 text-white" />
        </div>
      )}
      
      <hr className="border-slate-700" />
      <h4 className="text-lg font-medium text-slate-200">Device & EMI Details</h4>

      <div className="grid grid-cols-2 gap-4">
        <input type="text" placeholder="Device Model (e.g., iPhone 15 Pro)" value={model} onChange={(e) => setModel(e.target.value)} required className="block w-full px-3 py-2 border border-slate-600 rounded-md bg-slate-700 text-white" />
        <input type="text" placeholder="Device IMEI" value={imei} onChange={(e) => setImei(e.target.value)} required className="block w-full px-3 py-2 border border-slate-600 rounded-md bg-slate-700 text-white" />
        <input type="text" placeholder="Android ID (From customer's phone)" value={androidId} onChange={(e) => setAndroidId(e.target.value)} required className="block w-full px-3 py-2 border border-slate-600 rounded-md bg-slate-700 text-white" />
        <input type="number" placeholder="Total Price (₹)" value={totalPrice} onChange={(e) => setTotalPrice(e.target.value)} required className="block w-full px-3 py-2 border border-slate-600 rounded-md bg-slate-700 text-white" />
        <input type="number" placeholder="Down Payment (₹)" value={downPayment} onChange={(e) => setDownPayment(e.target.value)} required className="block w-full px-3 py-2 border border-slate-600 rounded-md bg-slate-700 text-white" />
        <select value={numberOfEmis} onChange={(e) => setNumberOfEmis(e.target.value)} className="block w-full px-3 py-2 border border-slate-600 rounded-md bg-slate-700 text-white">
          {emiOptions.map(opt => <option key={opt} value={opt}>{opt} Months</option>)}
        </select>
      </div>

      {calculatedEmi !== null && (
        <div className="bg-slate-900 p-3 rounded-md text-center">
            <span className="text-slate-400 text-sm">Calculated EMI Amount: </span>
            <span className="font-bold text-white">₹{calculatedEmi.toFixed(2)} / month</span>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-slate-300">First EMI Date</label>
        <input type="date" value={emiStartDate} onChange={(e) => setEmiStartDate(e.target.value)} required className="mt-1 block w-full px-3 py-2 border border-slate-600 rounded-md bg-slate-700 text-white" />
      </div>

      <div className="flex justify-end pt-2">
        <Button type="submit" disabled={loading}>
          {loading ? 'Creating Plan...' : 'Create EMI Plan'}
        </Button>
      </div>
    </form>
  );
};

export default RegisterDeviceForm;
