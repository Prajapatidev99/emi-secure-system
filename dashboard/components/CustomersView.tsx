
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
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4">
            <h2 className="text-2xl font-bold mb-4 md:mb-0 text-white">Customer Management</h2>
            <div className="space-x-2">
                <Button onClick={() => setAddCustomerModalOpen(true)}>Add Customer</Button>
                <Button onClick={() => setRegisterDeviceModalOpen(true)} variant="secondary">Register New Device</Button>
            </div>
        </div>
        
        <div className="mb-4">
          <input
            type="text"
            placeholder="Search by name or phone number..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full md:w-1/2 px-3 py-2 border border-slate-700 rounded-md shadow-sm focus:outline-none focus:ring-brand-500 focus:border-brand-500 bg-slate-800 placeholder-slate-400"
            aria-label="Search customers"
          />
        </div>
        
        {error && <p className="text-rose-400 text-center py-4">Error: {error}. Is the backend server running?</p>}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-700">
            <thead className="bg-slate-800">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Name</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Phone</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Address</th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-slate-900 divide-y divide-slate-800">
              {loading ? (
                <CustomerTableSkeleton />
              ) : filteredCustomers.length > 0 ? filteredCustomers.map((customer) => (
                <tr 
                  key={customer.id} 
                  className="hover:bg-slate-800 cursor-pointer"
                  onClick={() => setSelectedCustomerId(customer.id)}
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">{customer.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400">{customer.phone}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400">{customer.address}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <Button 
                        variant="danger" 
                        size="sm" 
                        onClick={(e) => openDeleteModal(e, customer)}
                    >
                        Delete
                    </Button>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={4} className="text-center py-4 text-slate-400">
                    No customers found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal isOpen={isAddCustomerModalOpen} onClose={() => setAddCustomerModalOpen(false)} title="Add New Customer">
        <AddCustomerForm onSuccess={handleCustomerAdded} />
      </Modal>

      <Modal isOpen={isRegisterDeviceModalOpen} onClose={() => setRegisterDeviceModalOpen(false)} title="Register New Device">
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
            title="Delete Customer"
            variant="danger"
            confirmText={deleteLoading ? "Deleting..." : "Delete Permanently"}
          >
            Are you sure you want to delete <strong className="text-white">{customerToDelete.name}</strong>? 
            <br/><br/>
            <span className="text-rose-400 font-bold">WARNING:</span> This will also delete all registered devices and payment records associated with this customer. This action cannot be undone.
          </ConfirmationModal>
      )}
    </>
  );
};

export default CustomersView;
