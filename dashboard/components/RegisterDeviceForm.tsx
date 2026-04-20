import React, { useState, useMemo } from 'react';
import { registerDevice, addCustomer } from '../services/api';
import { Customer } from '../types';
import Button from './common/Button';

interface RegisterDeviceFormProps {
  customers: Customer[];
  onSuccess: () => void;
}

const RegisterDeviceForm: React.FC<RegisterDeviceFormProps> = ({ customers, onSuccess }) => {
  const [isSuccess, setIsSuccess] = useState(false);
  const [isNewCustomer, setIsNewCustomer] = useState(customers.length === 0);
  const [customerId, setCustomerId] = useState('');
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [newCustomerAddress, setNewCustomerAddress] = useState('');
  const [imei, setImei] = useState('');
  const [model, setModel] = useState('');
  const [totalPrice, setTotalPrice] = useState('');
  const [downPayment, setDownPayment] = useState('');
  const [numberOfEmis, setNumberOfEmis] = useState('12');
  const [emiStartDate, setEmiStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  
  const emiPlanOptions = [3, 4, 6, 8, 9, 10, 12];

  // Validation Logic
  const validation = useMemo(() => {
    const errors: Record<string, string> = {};
    
    // Customer Validation
    if (isNewCustomer) {
        if (newCustomerName.length > 0 && newCustomerName.length < 3) errors.cName = "Name too short";
        if (newCustomerPhone.length > 0 && !/^\d{10,12}$/.test(newCustomerPhone)) errors.cPhone = "Invalid phone";
    }

    // Device Validation
    if (imei.length > 0 && !/^\d{15}$/.test(imei)) {
        errors.imei = "IMEI must be exactly 15 digits";
    }

    const tPrice = parseFloat(totalPrice) || 0;
    const dPayment = parseFloat(downPayment) || 0;
    if (totalPrice && tPrice <= 0) errors.price = "Invalid price";
    if (downPayment && dPayment < 0) errors.payment = "Invalid payment";
    if (tPrice > 0 && dPayment >= tPrice) errors.payment = "Down payment must be less than total price";

    const isValid = (
        (isNewCustomer ? (newCustomerName.length >= 3 && /^\d{10,12}$/.test(newCustomerPhone)) : !!customerId) &&
        /^\d{15}$/.test(imei) &&
        model.length >= 2 &&
        tPrice > 0 &&
        dPayment < tPrice &&
        Object.keys(errors).length === 0
    );

    return { errors, isValid };
  }, [isNewCustomer, customerId, newCustomerName, newCustomerPhone, imei, model, totalPrice, downPayment]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validation.isValid) return;

    setLoading(true);
    setError(null);
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
        model,
        totalPrice: parseFloat(totalPrice),
        downPayment: parseFloat(downPayment),
        numberOfEmis: parseInt(numberOfEmis, 10),
        emiStartDate
      };
      
      await registerDevice(saleData);
      setIsSuccess(true);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred.');
    } finally {
      setLoading(false);
    }
  };

  if (isSuccess) {
      return (
          <div className="text-center py-8 animate-in zoom-in fade-in duration-300">
              <div className="mx-auto w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mb-6">
                <svg className="w-10 h-10 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-white mb-2 tracking-tight">Registration Complete</h3>
              <p className="text-slate-400 text-sm max-w-xs mx-auto mb-8">
                The device has been successfully linked. You can now proceed to the <strong>Provisioning</strong> center.
              </p>
              <Button type="button" onClick={onSuccess} className="w-full">Done</Button>
          </div>
      );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-xl text-sm flex items-start gap-3 animate-shake">
          <svg className="w-5 h-5 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          {error}
        </div>
      )}
      
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Customer Section */}
            <div className="space-y-4">
                <div className="flex items-center gap-2 mb-1">
                  <svg className="w-4 h-4 text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Customer Details</h4>
                </div>

                <div className="flex p-1 bg-slate-800 rounded-xl mb-4">
                  <button type="button" 
                    onClick={() => setIsNewCustomer(false)} 
                    disabled={customers.length === 0}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${!isNewCustomer ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                    Select Existing
                  </button>
                  <button type="button" 
                    onClick={() => setIsNewCustomer(true)} 
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${isNewCustomer ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                    New Customer
                  </button>
                </div>

                {isNewCustomer ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-slate-800/30 border border-slate-700 rounded-2xl animate-in fade-in duration-300">
                        <div className="col-span-1">
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Full Name</label>
                            <input type="text" value={newCustomerName} onChange={(e) => setNewCustomerName(e.target.value)} placeholder="Full Name" className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:ring-1 focus:ring-brand-500" />
                        </div>
                        <div className="col-span-1">
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Phone</label>
                            <input type="tel" value={newCustomerPhone} onChange={(e) => setNewCustomerPhone(e.target.value)} placeholder="10-12 digits" className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:ring-1 focus:ring-brand-500" />
                        </div>
                        <div className="col-span-1 md:col-span-2">
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Address</label>
                            <textarea value={newCustomerAddress} onChange={(e) => setNewCustomerAddress(e.target.value)} placeholder="Full Address" rows={1} className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:ring-1 focus:ring-brand-500" />
                        </div>
                    </div>
                ) : (
                    <div className="animate-in fade-in duration-300">
                        <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:ring-2 focus:ring-brand-500/20">
                            <option value="" disabled>-- Choose a Customer --</option>
                            {customers.map(c => (<option key={c.id} value={c.id}>{c.name} ({c.phone})</option>))}
                        </select>
                    </div>
                )}
            </div>

            <div className="my-8 h-px bg-gradient-to-r from-transparent via-slate-700 to-transparent" />
            
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <svg className="w-4 h-4 text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Device & EMI Plan</h4>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="col-span-1">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Device Model</label>
                    <input type="text" placeholder="e.g. Galaxy S24" value={model} onChange={(e) => setModel(e.target.value)} className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm" />
                  </div>
                  <div className="col-span-1">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">IMEI Number</label>
                    <input 
                      type="text" 
                      placeholder="15 digits" 
                      value={imei} 
                      onChange={(e) => setImei(e.target.value)} 
                      className={`w-full px-4 py-3 bg-slate-800 border ${validation.errors.imei ? 'border-rose-500/50' : 'border-slate-700'} rounded-xl text-white text-sm focus:ring-2 focus:ring-brand-500/20`} 
                    />
                    {validation.errors.imei && <p className="text-[10px] text-rose-400 mt-1">{validation.errors.imei}</p>}
                  </div>

                  <div className="col-span-1">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Total Price (₹)</label>
                    <input type="number" placeholder="0.00" value={totalPrice} onChange={(e) => setTotalPrice(e.target.value)} className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm font-mono" />
                  </div>
                  <div className="col-span-1">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Down Payment (₹)</label>
                    <input type="number" placeholder="0.00" value={downPayment} onChange={(e) => setDownPayment(e.target.value)} className={`w-full px-4 py-3 bg-slate-800 border ${validation.errors.payment ? 'border-rose-500/50' : 'border-slate-700'} rounded-xl text-white text-sm font-mono`} />
                    {validation.errors.payment && <p className="text-[10px] text-rose-400 mt-1">{validation.errors.payment}</p>}
                  </div>

                  <div className="col-span-1">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Tenure (Months)</label>
                    <select value={numberOfEmis} onChange={(e) => setNumberOfEmis(e.target.value)} className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm">
                      {emiPlanOptions.map(plan => (<option key={plan} value={plan}>{plan} Months Plan</option>))}
                    </select>
                  </div>
                  <div className="col-span-1">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Starting From</label>
                    <input type="date" value={emiStartDate} onChange={(e) => setEmiStartDate(e.target.value)} className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm" />
                  </div>
              </div>
            </div>

            <div className="pt-8">
              <Button 
                type="submit" 
                disabled={loading || !validation.isValid} 
                className="w-full py-4 text-md font-bold shadow-lg shadow-brand-500/10"
              >
                {loading ? 'Processing Registration...' : '⚡ Generate EMI Schedule'}
              </Button>
              {!validation.isValid && (
                <p className="text-[10px] text-slate-500 text-center mt-3 font-medium uppercase tracking-[0.2em]">
                  Incomplete Data
                </p>
              )}
            </div>
        </div>
    </form>
  );
};

export default RegisterDeviceForm;