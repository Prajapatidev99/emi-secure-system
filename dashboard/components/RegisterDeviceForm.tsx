import React, { useState } from 'react';
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
  const [customerId, setCustomerId] = useState('');

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
  const [numberOfEmis, setNumberOfEmis] = useState('12'); // Default to a common plan
  const [emiStartDate, setEmiStartDate] = useState(new Date().toISOString().split('T')[0]);
  
  // Form status state
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  
  const emiPlanOptions = [3, 4, 6, 8, 9, 10, 12];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isNewCustomer && !customerId) {
      setError('Please select an existing customer.');
      return;
    }
    if (isNewCustomer && (!newCustomerName || !newCustomerPhone || !newCustomerAddress)) {
        setError('Please fill in all details for the new customer.');
        return;
    }

    setLoading(true);
    setError(null);
    setSuccessMessage(null);
    try {
      let finalCustomerId = customerId;

      if (isNewCustomer) {
        const newCustomer = await addCustomer({ 
            name: newCustomerName, 
            phone: newCustomerPhone, 
            address: newCustomerAddress 
        });
        finalCustomerId = newCustomer.id;
      }
      
      const saleData = {
        customerId: finalCustomerId,
        imei,
        androidId,
        model,
        totalPrice: parseFloat(totalPrice),
        downPayment: parseFloat(downPayment),
        numberOfEmis: parseInt(numberOfEmis, 10),
        emiStartDate
      };
      await registerDevice(saleData);
      setSuccessMessage('Device registered and EMI plan created successfully!');
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unknown error occurred.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {error && <p className="bg-rose-900/50 text-rose-300 border border-rose-500/30 p-3 rounded-md mb-4 text-center">{error}</p>}
      {successMessage && <p className="bg-teal-900/50 text-teal-300 border border-teal-500/30 p-3 rounded-md mb-4 text-center">{successMessage}</p>}
      
      {successMessage ? (
        <div className="flex justify-end mt-4">
            <Button type="button" onClick={onSuccess}>
                Done
            </Button>
        </div>
      ) : (
        <>
            {/* Customer Selection */}
            <div className="mb-4">
                <label className="block text-sm font-medium text-slate-300 mb-2">Customer</label>
                <div className="flex items-center space-x-4 mb-3">
                <label className="flex items-center">
                    <input type="radio" name="customerType" checked={!isNewCustomer} onChange={() => setIsNewCustomer(false)} className="h-4 w-4 text-brand-600 border-gray-300 focus:ring-brand-500" disabled={customers.length === 0} />
                    <span className="ml-2 text-sm text-slate-300">Existing</span>
                </label>
                <label className="flex items-center">
                    <input type="radio" name="customerType" checked={isNewCustomer} onChange={() => setIsNewCustomer(true)} className="h-4 w-4 text-brand-600 border-gray-300 focus:ring-brand-500" />
                    <span className="ml-2 text-sm text-slate-300">New Customer</span>
                </label>
                </div>

                {isNewCustomer ? (
                    <div className="space-y-3 p-4 border border-slate-600 rounded-md">
                        <div>
                            <label htmlFor="newCustomerName" className="block text-sm font-medium text-slate-300">Full Name</label>
                            <input type="text" id="newCustomerName" placeholder="Enter customer's full name" value={newCustomerName} onChange={(e) => setNewCustomerName(e.target.value)} required className="mt-1 block w-full px-3 py-2 border border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-brand-500 focus:border-brand-500 bg-slate-700 text-white" />
                        </div>
                        <div>
                            <label htmlFor="newCustomerPhone" className="block text-sm font-medium text-slate-300">Phone Number</label>
                            <input type="tel" id="newCustomerPhone" placeholder="Enter customer's phone" value={newCustomerPhone} onChange={(e) => setNewCustomerPhone(e.target.value)} required className="mt-1 block w-full px-3 py-2 border border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-brand-500 focus:border-brand-500 bg-slate-700 text-white" />
                        </div>
                        <div>
                            <label htmlFor="newCustomerAddress" className="block text-sm font-medium text-slate-300">Address</label>
                            <textarea id="newCustomerAddress" placeholder="Enter customer's address" value={newCustomerAddress} onChange={(e) => setNewCustomerAddress(e.target.value)} required rows={2} className="mt-1 block w-full px-3 py-2 border border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-brand-500 focus:border-brand-500 bg-slate-700 text-white" />
                        </div>
                    </div>
                ) : (
                    <div>
                        <select id="customer" value={customerId} onChange={(e) => setCustomerId(e.target.value)} required className="block w-full px-3 py-2 border border-slate-600 bg-slate-700 rounded-md shadow-sm focus:outline-none focus:ring-brand-500 focus:border-brand-500 text-white">
                            <option value="" disabled>-- Select a customer --</option>
                            {customers.map(c => (<option key={c.id} value={c.id}>{c.name} ({c.phone})</option>))}
                        </select>
                    </div>
                )}
            </div>

            <hr className="my-6 border-slate-600" />
            <h4 className="text-md font-semibold mb-4 text-gray-200">Device &amp; EMI Details</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                <label htmlFor="model" className="block text-sm font-medium text-slate-300">Device Model</label>
                <input type="text" id="model" placeholder="e.g., iPhone 15 Pro" value={model} onChange={(e) => setModel(e.target.value)} required className="mt-1 block w-full px-3 py-2 border border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-brand-500 focus:border-brand-500 bg-slate-700 text-white" />
                </div>
                <div>
                <label htmlFor="imei" className="block text-sm font-medium text-slate-300">Device IMEI</label>
                <input type="text" id="imei" value={imei} onChange={(e) => setImei(e.target.value)} required className="mt-1 block w-full px-3 py-2 border border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-brand-500 focus:border-brand-500 bg-slate-700 text-white" />
                </div>
                <div>
                <label htmlFor="androidId" className="block text-sm font-medium text-slate-300">Android ID</label>
                <input type="text" id="androidId" placeholder="Unique ID from customer's phone" value={androidId} onChange={(e) => setAndroidId(e.target.value)} required className="mt-1 block w-full px-3 py-2 border border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-brand-500 focus:border-brand-500 bg-slate-700 text-white" />
                </div>
                <div>
                <label htmlFor="totalPrice" className="block text-sm font-medium text-slate-300">Total Price (₹)</label>
                <input type="number" id="totalPrice" value={totalPrice} onChange={(e) => setTotalPrice(e.target.value)} required className="mt-1 block w-full px-3 py-2 border border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-brand-500 focus:border-brand-500 bg-slate-700 text-white" />
                </div>
                <div>
                <label htmlFor="downPayment" className="block text-sm font-medium text-slate-300">Down Payment (₹)</label>
                <input type="number" id="downPayment" value={downPayment} onChange={(e) => setDownPayment(e.target.value)} required className="mt-1 block w-full px-3 py-2 border border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-brand-500 focus:border-brand-500 bg-slate-700 text-white" />
                </div>
                <div>
                <label htmlFor="numberOfEmis" className="block text-sm font-medium text-slate-300">Number of EMIs</label>
                 <select
                    id="numberOfEmis"
                    value={numberOfEmis}
                    onChange={(e) => setNumberOfEmis(e.target.value)}
                    required
                    className="mt-1 block w-full px-3 py-2 border border-slate-600 bg-slate-700 rounded-md shadow-sm focus:outline-none focus:ring-brand-500 focus:border-brand-500 text-white"
                  >
                    {emiPlanOptions.map(plan => (
                      <option key={plan} value={plan}>{plan} Months</option>
                    ))}
                  </select>
                </div>
            </div>
            <div className="mb-6">
                <label htmlFor="emiStartDate" className="block text-sm font-medium text-slate-300">First EMI Date</label>
                <input type="date" id="emiStartDate" value={emiStartDate} onChange={(e) => setEmiStartDate(e.target.value)} required className="mt-1 block w-full px-3 py-2 border border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-brand-500 focus:border-brand-500 bg-slate-700 text-white" />
            </div>


            <div className="flex justify-end">
                <Button type="submit" disabled={loading}>
                {loading ? 'Saving...' : 'Create EMI Plan'}
                </Button>
            </div>
        </>
      )}
    </form>
  );
};

export default RegisterDeviceForm;