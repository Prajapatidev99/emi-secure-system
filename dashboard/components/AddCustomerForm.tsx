import React, { useState, useMemo } from 'react';
import { addCustomer } from '../services/api';
import Button from './common/Button';
import { KycDocument } from '../types';

interface AddCustomerFormProps {
  onSuccess: () => void;
}

const AddCustomerForm: React.FC<AddCustomerFormProps> = ({ onSuccess }) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [kycDocs, setKycDocs] = useState<KycDocument[]>([]);
  const [currentDocType, setCurrentDocType] = useState('PAN Card');
  const [currentFile, setCurrentFile] = useState<{ name: string, dataUrl: string } | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const kycDocOptions = ['PAN Card', 'Aadhaar Card', 'Passbook', 'Other'];

  // Validation Logic
  const validation = useMemo(() => {
    const errors: Record<string, string> = {};
    
    if (name.length > 0 && name.length < 3) errors.name = "Name must be at least 3 characters";
    if (name.length > 0 && !/^[a-zA-Z\s]*$/.test(name)) errors.name = "Name should only contain letters";
    
    if (phone.length > 0 && !/^\d{10,12}$/.test(phone)) errors.phone = "Enter a valid 10-12 digit phone number";
    
    if (address.length > 0 && address.length < 5) errors.address = "Please enter a more complete address";

    return {
      errors,
      isValid: name.length >= 3 && /^\d{10,12}$/.test(phone) && address.length >= 5 && Object.keys(errors).length === 0
    };
  }, [name, phone, address]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 2 * 1024 * 1024) { 
        setError('File is too large. Image must be under 2MB.');
        e.target.value = '';
        return;
      }
      setError(null);
      const reader = new FileReader();
      reader.onloadend = () => {
        setCurrentFile({ name: file.name, dataUrl: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddKycDoc = () => {
    if (!currentFile) return;
    setKycDocs([...kycDocs, { docType: currentDocType, docUrl: currentFile.dataUrl }]);
    setCurrentFile(null);
    setCurrentDocType('PAN Card');
    const fileInput = document.getElementById('docFile') as HTMLInputElement;
    if(fileInput) fileInput.value = "";
  };

  const handleRemoveKycDoc = (indexToRemove: number) => {
    setKycDocs(kycDocs.filter((_, index) => index !== indexToRemove));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validation.isValid) return;

    setLoading(true);
    setError(null);
    try {
      await addCustomer({ name, phone, address, kycDocs });
      setSuccessMessage('Customer added successfully!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-lg text-sm flex items-start gap-3 animate-shake">
          <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </div>
      )}
      
      {successMessage && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-4 rounded-lg text-sm flex items-start gap-3 animate-in fade-in zoom-in duration-300">
          <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {successMessage}
        </div>
      )}
      
      {successMessage ? (
        <div className="flex justify-center pt-4">
          <Button type="button" onClick={onSuccess} className="w-full">
            Great, Let's Continue
          </Button>
        </div>
      ) : (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="col-span-1">
              <label htmlFor="name" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Full Name</label>
              <input
                type="text"
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. John Doe"
                className={`w-full px-4 py-3 bg-slate-800 border ${validation.errors.name ? 'border-rose-500/50' : 'border-slate-700'} rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all`}
              />
              {validation.errors.name && <p className="text-rose-400 text-[10px] mt-1 font-medium">{validation.errors.name}</p>}
            </div>

            <div className="col-span-1">
              <label htmlFor="phone" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Phone Number</label>
              <input
                type="tel"
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="10-12 digits"
                className={`w-full px-4 py-3 bg-slate-800 border ${validation.errors.phone ? 'border-rose-500/50' : 'border-slate-700'} rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all`}
              />
              {validation.errors.phone && <p className="text-rose-400 text-[10px] mt-1 font-medium">{validation.errors.phone}</p>}
            </div>

            <div className="col-span-1 md:col-span-2">
              <label htmlFor="address" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Address</label>
              <textarea
                id="address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Flat, Street, Area..."
                rows={2}
                className={`w-full px-4 py-3 bg-slate-800 border ${validation.errors.address ? 'border-rose-500/50' : 'border-slate-700'} rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all`}
              />
              {validation.errors.address && <p className="text-rose-400 text-[10px] mt-1 font-medium">{validation.errors.address}</p>}
            </div>
          </div>
          
          <div className="my-8 h-px bg-gradient-to-r from-transparent via-slate-700 to-transparent" />

          {/* KYC Section */}
          <div className="space-y-5">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h4 className="text-sm font-bold text-white uppercase tracking-tight">KYC Documents</h4>
            </div>
            
            {kycDocs.length > 0 && (
              <div className="grid grid-cols-1 gap-3">
                {kycDocs.map((doc, index) => (
                  <div key={index} className="flex items-center justify-between bg-slate-800/50 border border-slate-700 p-3 rounded-xl group hover:border-slate-600 transition-all">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-lg bg-slate-700 overflow-hidden border border-slate-600">
                          <img src={doc.docUrl} alt={doc.docType} className="w-full h-full object-cover" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-white">{doc.docType}</p>
                          <p className="text-[10px] text-slate-500 uppercase">Attached</p>
                        </div>
                    </div>
                    <button 
                      type="button" 
                      onClick={() => handleRemoveKycDoc(index)} 
                      className="p-2 text-slate-500 hover:text-rose-400 transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="bg-slate-900/50 border border-dashed border-slate-700 rounded-xl p-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="docType" className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Type</label>
                  <select 
                    id="docType" 
                    value={currentDocType} 
                    onChange={e => setCurrentDocType(e.target.value)} 
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:ring-1 focus:ring-brand-500"
                  >
                    {kycDocOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="docFile" className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Upload</label>
                  <input 
                    type="file" 
                    id="docFile" 
                    accept="image/*" 
                    onChange={handleFileSelect} 
                    className="w-full text-xs text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:bg-brand-500/10 file:text-brand-400 file:font-bold hover:file:bg-brand-500/20 cursor-pointer" 
                  />
                </div>
              </div>
              <Button 
                type="button" 
                variant="secondary" 
                size="md" 
                onClick={handleAddKycDoc} 
                disabled={!currentFile} 
                className="w-full text-sm font-bold h-10"
              >
                Add Document
              </Button>
            </div>
          </div>

          <div className="pt-8">
            <Button 
              type="submit" 
              disabled={loading || !validation.isValid} 
              className="w-full py-4 text-md font-bold shadow-lg shadow-brand-500/20"
            >
              {loading ? (
                <span className="flex items-center gap-2 justify-center">
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processing...
                </span>
              ) : '⚡ Save Customer Profile'}
            </Button>
            {!validation.isValid && (
              <p className="text-[10px] text-slate-500 text-center mt-3 font-medium uppercase tracking-widest">
                Please complete all fields correctly to proceed
              </p>
            )}
          </div>
        </div>
      )}
    </form>
  );
};

export default AddCustomerForm;