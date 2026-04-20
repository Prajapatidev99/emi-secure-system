
import { useState, useEffect, useCallback } from 'react';
import { getCustomers, deleteCustomer } from '../services/api';
import { Customer } from '../types';
import Card from './common/Card';
import Skeleton from './common/Skeleton';
import Button from './common/Button';
import Modal from './common/Modal';
import AddCustomerForm from './AddCustomerForm';
import RegisterDeviceForm from './RegisterDeviceForm';
import CustomerDetailView from './CustomerDetailView';
import ConfirmationModal from './common/ConfirmationModal';

const CustomersView = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddCustomerModalOpen, setAddCustomerModalOpen] = useState(false);
  const [isRegisterDeviceModalOpen, setRegisterDeviceModalOpen] = useState(false);
  
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

  // Deletion state
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);
  const [isDeleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchCustomers = useCallback(() => {
    setLoading(true);
    setError(null);
    getCustomers()
      .then(setCustomers)
      .catch(err => {
        if (err instanceof Error) {
            setError(err.message);
        } else {
            setError('Failed to fetch customers.');
        }
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedCustomerId) {
      fetchCustomers();
    }
  }, [fetchCustomers, selectedCustomerId]);

  const handleCustomerAdded = () => {
    setAddCustomerModalOpen(false);
    fetchCustomers();
  };

  const handleDeleteConfirm = async () => {
    if (!customerToDelete) return;
    setDeleteLoading(true);
    try {
        await deleteCustomer(customerToDelete.id);
        setDeleteModalOpen(false);
        setCustomerToDelete(null);
        fetchCustomers();
    } catch (err) {
        if (err instanceof Error) alert(err.message);
    } finally {
        setDeleteLoading(false);
    }
  };

  const openDeleteModal = (e: React.MouseEvent, customer: Customer) => {
    e.stopPropagation(); // Don't trigger the row click (detail view)
    setCustomerToDelete(customer);
    setDeleteModalOpen(true);
  };

  const filteredCustomers = customers.filter(customer =>
    customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.phone.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  if (selectedCustomerId) {
    return <CustomerDetailView customerId={selectedCustomerId} onBack={() => setSelectedCustomerId(null)} />;
  }


  const CustomerTableSkeleton = () => (
    [...Array(8)].map((_, index) => (
      <tr key={index}>
        <td className="px-6 py-4 whitespace-nowrap"><Skeleton className="h-4 w-32" /></td>
        <td className="px-6 py-4 whitespace-nowrap"><Skeleton className="h-4 w-24" /></td>
        <td className="px-6 py-4 whitespace-nowrap"><Skeleton className="h-4 w-48" /></td>
        <td className="px-6 py-4 whitespace-nowrap"><Skeleton className="h-8 w-16 ml-auto" /></td>
      </tr>
    ))
  );

  return (
    <>
      <Card>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-brand-500/10 rounded-lg">
                <svg className="w-6 h-6 text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-white tracking-tight">Customer Database</h2>
            </div>
            <div className="flex flex-wrap gap-2 w-full md:w-auto">
                <Button onClick={() => setAddCustomerModalOpen(true)} className="flex-1 md:flex-none py-3 text-xs">Add Customer</Button>
                <Button onClick={() => setRegisterDeviceModalOpen(true)} variant="secondary" className="flex-1 md:flex-none py-3 text-xs">Register Device</Button>
            </div>
        </div>
        
        <div className="mb-6 relative group">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="h-5 w-5 text-slate-500 group-focus-within:text-brand-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Search by name, phone or address..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all shadow-inner"
            aria-label="Search customers"
          />
        </div>
        
        {error && <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-xl text-sm mb-6">{error}</div>}
        
        {/* Desktop View */}
        <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-800">
          <table className="min-w-full divide-y divide-slate-800">
            <thead className="bg-slate-800/50">
              <tr>
                <th scope="col" className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Name</th>
                <th scope="col" className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Phone</th>
                <th scope="col" className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Address</th>
                <th scope="col" className="px-6 py-4 text-right text-[10px] font-bold text-slate-500 uppercase tracking-widest">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-slate-900/30 divide-y divide-slate-800">
              {loading ? (
                <CustomerTableSkeleton />
              ) : filteredCustomers.length > 0 ? filteredCustomers.map((customer) => (
                <tr 
                  key={customer.id} 
                  className="hover:bg-slate-800/30 cursor-pointer transition-colors group"
                  onClick={() => setSelectedCustomerId(customer.id)}
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-white group-hover:text-brand-400 transition-colors">{customer.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400 text-mono">{customer.phone}</td>
                  <td className="px-6 py-4 text-sm text-slate-500 truncate max-w-xs">{customer.address}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <Button 
                        variant="danger" 
                        size="sm" 
                        onClick={(e) => openDeleteModal(e, customer)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                        Delete
                    </Button>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={4} className="text-center py-10 text-slate-500 text-sm italic">
                    No customers found matching your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile View */}
        <div className="md:hidden space-y-4">
          {loading ? [...Array(3)].map((_, i) => <Skeleton key={i} className="h-40 w-full rounded-2xl opacity-10" />) : 
            filteredCustomers.length > 0 ? filteredCustomers.map((customer) => (
            <div 
              key={customer.id} 
              className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5 shadow-sm active:scale-[0.98] transition-all"
              onClick={() => setSelectedCustomerId(customer.id)}
            >
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-3">
                   <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-brand-400 font-bold border border-slate-600">
                     {customer.name.charAt(0).toUpperCase()}
                   </div>
                   <div>
                     <p className="text-white font-bold leading-tight">{customer.name}</p>
                     <p className="text-[10px] text-slate-500 font-mono tracking-tighter">{customer.phone}</p>
                   </div>
                </div>
                <button 
                  onClick={(e) => openDeleteModal(e, customer)}
                  className="p-2 text-slate-500 hover:text-rose-400"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
              <div className="bg-slate-900/40 rounded-xl p-3 border border-slate-700/30">
                <p className="text-[9px] font-bold text-slate-600 uppercase tracking-widest mb-1">Billing Address</p>
                <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">{customer.address}</p>
              </div>
              <div className="pt-2 flex justify-between items-center text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                <span>View Details</span>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          )) : (
            <div className="text-center py-10 bg-slate-900/20 border border-dashed border-slate-800 rounded-2xl">
              <p className="text-slate-500 text-sm">No customers found</p>
            </div>
          )}
        </div>
      </Card>

      <Modal isOpen={isAddCustomerModalOpen} onClose={() => setAddCustomerModalOpen(false)} title="New Customer Entry">
        <AddCustomerForm onSuccess={handleCustomerAdded} />
      </Modal>

      <Modal isOpen={isRegisterDeviceModalOpen} onClose={() => setRegisterDeviceModalOpen(false)} title="Device Sale & EMI Setup">
        <RegisterDeviceForm customers={customers} onSuccess={() => {
            setRegisterDeviceModalOpen(false);
            fetchCustomers();
        }} />
      </Modal>

      {customerToDelete && (
          <ConfirmationModal
            isOpen={isDeleteModalOpen}
            onClose={() => setDeleteModalOpen(false)}
            onConfirm={handleDeleteConfirm}
            title="Delete Profile"
            variant="danger"
            confirmText={deleteLoading ? "Deleting Data..." : "Confirm Final Deletion"}
          >
            Deleting <strong className="text-white">{customerToDelete.name}</strong> will permanently remove all linked devices and EMI history.
          </ConfirmationModal>
      )}
    </>
  );
};

export default CustomersView;
