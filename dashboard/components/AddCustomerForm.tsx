import React, { useState } from 'react';
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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
        const file = e.target.files[0];
        // Add a size limit (e.g., 2MB) to prevent excessively large base64 strings
        if (file.size > 2 * 1024 * 1024) { 
          setError('File is too large. Please select an image under 2MB.');
          e.target.value = ''; // Clear the input
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
    if (!currentFile) {
      return;
    }
    setKycDocs([...kycDocs, { docType: currentDocType, docUrl: currentFile.dataUrl }]);
    setCurrentFile(null);
    setCurrentDocType('PAN Card');
    
    // Reset the file input visually if needed, though state handles the logic
    const fileInput = document.getElementById('docFile') as HTMLInputElement;
    if(fileInput) fileInput.value = "";
  };

  const handleRemoveKycDoc = (indexToRemove: number) => {
    setKycDocs(kycDocs.filter((_, index) => index !== indexToRemove));
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await addCustomer({ name, phone, address, kycDocs });
      setSuccessMessage('Customer added successfully!');
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
          <div className="mb-4">
            <label htmlFor="name" className="block text-sm font-medium text-slate-300">Full Name</label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="mt-1 block w-full px-3 py-2 border border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-brand-500 focus:border-brand-500 bg-slate-700 text-white"
            />
          </div>

          <div className="mb-4">
            <label htmlFor="phone" className="block text-sm font-medium text-slate-300">Phone Number</label>
            <input
              type="tel"
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              className="mt-1 block w-full px-3 py-2 border border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-brand-500 focus:border-brand-500 bg-slate-700 text-white"
            />
          </div>

          <div className="mb-6">
            <label htmlFor="address" className="block text-sm font-medium text-slate-300">Address</label>
            <textarea
              id="address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              required
              rows={3}
              className="mt-1 block w-full px-3 py-2 border border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-brand-500 focus:border-brand-500 bg-slate-700 text-white"
            />
          </div>
          
          <hr className="my-6 border-slate-700" />

          {/* KYC Section */}
          <div className="space-y-4">
            <h4 className="text-md font-semibold text-slate-200">KYC Documents (Optional)</h4>
            
            {kycDocs.length > 0 && (
              <div className="space-y-2">
                {kycDocs.map((doc, index) => (
                  <div key={index} className="flex items-center justify-between bg-slate-800 p-2 rounded-md animate-fade-in">
                    <div className="flex items-center gap-3">
                        <img src={doc.docUrl} alt={doc.docType} className="w-10 h-10 object-cover rounded flex-shrink-0" />
                        <span className="font-semibold text-white text-sm">{doc.docType}</span>
                    </div>
                    <button type="button" onClick={() => handleRemoveKycDoc(index)} className="ml-2 text-rose-400 hover:text-rose-600 text-xs font-bold flex-shrink-0">REMOVE</button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-end gap-2">
              <div className="flex-grow">
                <label htmlFor="docType" className="block text-xs font-medium text-slate-400">Document Type</label>
                <select id="docType" value={currentDocType} onChange={e => setCurrentDocType(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-slate-600 bg-slate-700 rounded-md shadow-sm focus:outline-none focus:ring-brand-500 focus:border-brand-500 text-white text-sm">
                  {kycDocOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              </div>
              <div className="flex-grow-[2]">
                <label htmlFor="docFile" className="block text-xs font-medium text-slate-400">Document Image</label>
                <input type="file" id="docFile" accept="image/png, image/jpeg, image/webp" onChange={handleFileSelect} className="mt-1 block w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-slate-600 file:text-slate-200 hover:file:bg-slate-500" />
                 {currentFile && <span className="text-xs text-slate-400 mt-1 block truncate">Selected: {currentFile.name}</span>}
              </div>
              <Button type="button" variant="secondary" size="md" onClick={handleAddKycDoc} disabled={!currentFile}>Add</Button>
            </div>
          </div>


          <div className="flex justify-end mt-8">
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : 'Save Customer'}
            </Button>
          </div>
        </>
      )}
    </form>
  );
};

export default AddCustomerForm;