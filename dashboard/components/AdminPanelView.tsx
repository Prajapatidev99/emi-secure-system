import React, { useState, useEffect, useCallback } from 'react';
import { getShopkeepers, rechargeShopkeeperWallet, getAllRechargeRequests, handleRechargeRequest } from '../services/api';
import { UserProfile, RechargeRequestWithUser } from '../types';

const AdminPanelView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'shopkeepers' | 'requests'>('shopkeepers');
  const [shopkeepers, setShopkeepers] = useState<UserProfile[]>([]);
  const [rechargeRequests, setRechargeRequests] = useState<RechargeRequestWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Recharge modal state (Manual)
  const [rechargeTarget, setRechargeTarget] = useState<UserProfile | null>(null);
  const [rechargeAmount, setRechargeAmount] = useState('');
  const [rechargeNote, setRechargeNote] = useState('');
  const [recharging, setRecharging] = useState(false);
  const [rechargeSuccess, setRechargeSuccess] = useState<string | null>(null);
  const [rechargeError, setRechargeError] = useState<string | null>(null);

  // Approval modal state (UTR Requests)
  const [approvalTarget, setApprovalTarget] = useState<RechargeRequestWithUser | null>(null);
  const [adminNote, setAdminNote] = useState('');
  const [handling, setHandling] = useState(false);

  const fetchShopkeepers = useCallback(() => {
    setLoading(true);
    setError(null);
    getShopkeepers()
      .then(setShopkeepers)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const fetchRequests = useCallback(() => {
    setLoading(true);
    setError(null);
    getAllRechargeRequests('Pending')
      .then(setRechargeRequests)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (activeTab === 'shopkeepers') {
      fetchShopkeepers();
    } else {
      fetchRequests();
    }
  }, [activeTab, fetchShopkeepers, fetchRequests]);

  const openRechargeModal = (sk: UserProfile) => {
    setRechargeTarget(sk);
    setRechargeAmount('');
    setRechargeNote('');
    setRechargeSuccess(null);
    setRechargeError(null);
  };

  const handleManualRecharge = async () => {
    if (!rechargeTarget) return;
    const amount = parseFloat(rechargeAmount);
    if (!amount || amount <= 0) {
      setRechargeError('Please enter a valid amount.');
      return;
    }
    setRecharging(true);
    setRechargeError(null);
    try {
      const result = await rechargeShopkeeperWallet(
        rechargeTarget._id,
        amount,
        rechargeNote || undefined
      );
      setRechargeSuccess(result.message);
      // Update local state
      setShopkeepers(prev =>
        prev.map(sk =>
          sk._id === rechargeTarget._id
            ? { ...sk, walletBalance: result.shopkeeper.walletBalance }
            : sk
        )
      );
    } catch (err: any) {
      setRechargeError(err.message);
    } finally {
      setRecharging(false);
    }
  };

  const handleRequestApproval = async (requestId: string, status: 'Approved' | 'Rejected') => {
    setHandling(true);
    try {
      await handleRechargeRequest(requestId, status, adminNote || undefined);
      setApprovalTarget(null);
      setAdminNote('');
      // Refresh data
      fetchRequests();
      if (status === 'Approved') fetchShopkeepers();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setHandling(false);
    }
  };

  const quickAmounts = [200, 500, 1000, 2000, 5000];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Admin Control Center</h1>
          <p className="text-slate-400 mt-1">Monitor revenue requests and manage shopkeeper balances.</p>
        </div>
        <div className="flex bg-slate-800/50 p-1 rounded-xl border border-slate-700/50 w-fit">
          <button
            onClick={() => setActiveTab('shopkeepers')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
              activeTab === 'shopkeepers'
                ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Shopkeepers
          </button>
          <button
            onClick={() => setActiveTab('requests')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all flex items-center gap-2 ${
              activeTab === 'requests'
                ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Recharge Requests
            {rechargeRequests.length > 0 && (
              <span className="flex h-2 w-2 rounded-full bg-red-500 animate-pulse"></span>
            )}
          </button>
        </div>
      </div>

      {activeTab === 'shopkeepers' ? (
        <>
          {/* Stats summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm">
              <p className="text-sm font-medium text-slate-400 mb-1">Total Shopkeepers</p>
              <p className="text-3xl font-bold text-white">{shopkeepers.length}</p>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm border-l-emerald-500/50">
              <p className="text-sm font-medium text-slate-400 mb-1">Active Accounts</p>
              <p className="text-3xl font-bold text-emerald-400">
                {shopkeepers.filter(sk => sk.walletBalance >= 200).length}
              </p>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm border-l-rose-500/50">
              <p className="text-sm font-medium text-slate-400 mb-1">Low Balance Alerts</p>
              <p className="text-3xl font-bold text-rose-400">
                {shopkeepers.filter(sk => sk.walletBalance < 200).length}
              </p>
            </div>
          </div>

          {/* Shopkeeper Table */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden shadow-xl">
             <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center">
                <h2 className="text-lg font-semibold text-white">Registered Shopkeepers</h2>
                <button onClick={fetchShopkeepers} className="text-slate-400 hover:text-white transition-colors">
                  <svg className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
             </div>
             
             {loading && !shopkeepers.length ? (
                <div className="py-20 flex justify-center"><div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin"></div></div>
             ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-800/50 text-slate-400 text-xs font-bold uppercase tracking-wider">
                      <tr>
                        <th className="px-6 py-4">Shop Details</th>
                        <th className="px-6 py-4">Balance</th>
                        <th className="px-6 py-4">Status</th>
                        <th className="px-6 py-4 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {shopkeepers.map(sk => (
                        <tr key={sk._id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="px-6 py-4">
                            <div className="font-bold text-slate-100">{sk.shopName}</div>
                            <div className="text-xs text-slate-500">{sk.email}</div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`text-lg font-mono font-bold ${sk.walletBalance < 200 ? 'text-rose-400' : 'text-emerald-400'}`}>
                              ₹{sk.walletBalance.toLocaleString('en-IN')}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex px-2 py-1 rounded text-xs font-bold uppercase tracking-tight ${sk.walletBalance < 200 ? 'bg-rose-500/10 text-rose-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                              {sk.walletBalance < 200 ? 'Insufficient' : 'Ready'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <button
                              onClick={() => openRechargeModal(sk)}
                              className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border border-amber-500/30 px-4 py-1.5 rounded-lg text-xs font-bold transition-all"
                            >
                              Direct Recharge
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
             )}
          </div>
        </>
      ) : (
        /* RECHARGE REQUESTS TAB */
        <div className="space-y-6">
           <div className="rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden shadow-xl">
             <div className="px-6 py-4 border-b border-slate-800 bg-slate-800/30">
                <h2 className="text-lg font-semibold text-white">Pending UTR Verifications</h2>
             </div>

             {loading && !rechargeRequests.length ? (
                <div className="py-20 flex justify-center"><div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin"></div></div>
             ) : rechargeRequests.length === 0 ? (
                <div className="py-20 text-center text-slate-500">
                   <svg className="w-12 h-12 mx-auto mb-4 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                   </svg>
                   No pending recharge requests.
                </div>
             ) : (
                <div className="overflow-x-auto">
                   <table className="w-full text-sm text-left">
                      <thead className="bg-slate-800/50 text-slate-400 text-xs font-bold uppercase tracking-wider">
                         <tr>
                            <th className="px-6 py-4">Shopkeeper</th>
                            <th className="px-6 py-4">UTR / Transaction ID</th>
                            <th className="px-6 py-4">Amount</th>
                            <th className="px-6 py-4">Submitted At</th>
                            <th className="px-6 py-4 text-center">Verification</th>
                         </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                         {rechargeRequests.map(req => (
                            <tr key={req._id} className="hover:bg-slate-800/30 transition-colors">
                               <td className="px-6 py-4">
                                  <div className="font-bold text-slate-100">{req.shopkeeperId.shopName}</div>
                                  <div className="text-xs text-slate-500">{req.shopkeeperId.email}</div>
                               </td>
                               <td className="px-6 py-4">
                                  <span className="font-mono text-amber-500 bg-amber-500/5 px-2 py-1 rounded border border-amber-500/20 select-all font-bold">
                                     {req.transactionId}
                                  </span>
                               </td>
                               <td className="px-6 py-4 font-bold text-white text-lg">
                                  ₹{req.amount}
                               </td>
                               <td className="px-6 py-4 text-slate-500 text-xs">
                                  {new Date(req.createdAt).toLocaleString()}
                               </td>
                               <td className="px-6 py-4 text-center">
                                  <button
                                     onClick={() => setApprovalTarget(req)}
                                     className="bg-brand-500 hover:bg-brand-600 text-white px-4 py-1.5 rounded-lg text-xs font-bold transition-all shadow-lg shadow-brand-500/20"
                                  >
                                     Review & Approve
                                  </button>
                               </td>
                            </tr>
                         ))}
                      </tbody>
                   </table>
                </div>
             )}
          </div>
        </div>
      )}

      {/* Manual Recharge Modal */}
      {rechargeTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="px-8 py-6 border-b border-slate-800">
              <h3 className="text-xl font-bold text-white">Manual Wallet Recharge</h3>
              <p className="text-sm text-slate-400 mt-1">Increasing balance for {rechargeTarget.shopName}</p>
            </div>
            <div className="p-8 space-y-6">
              <div className="flex flex-wrap gap-2">
                {quickAmounts.map(amt => (
                  <button
                    key={amt}
                    onClick={() => setRechargeAmount(String(amt))}
                    className={`px-4 py-2 rounded-xl text-sm font-bold border transition-all ${
                      rechargeAmount === String(amt)
                        ? 'bg-amber-500 border-amber-500 text-slate-950 shadow-lg shadow-amber-500/30'
                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'
                    }`}
                  >
                    ₹{amt}
                  </button>
                ))}
              </div>
              <div className="space-y-4">
                <input
                  type="number"
                  placeholder="Enter amount manually"
                  value={rechargeAmount}
                  onChange={e => setRechargeAmount(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                />
                <input
                  type="text"
                  placeholder="Note (e.g. Offline payment)"
                  value={rechargeNote}
                  onChange={e => setRechargeNote(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                />
              </div>

              {rechargeSuccess && <p className="text-emerald-400 bg-emerald-400/10 p-3 rounded-lg text-sm text-center">✅ {rechargeSuccess}</p>}
              {rechargeError && <p className="text-rose-400 bg-rose-400/10 p-3 rounded-lg text-sm text-center">❌ {rechargeError}</p>}
            </div>
            <div className="flex gap-4 p-8 pt-0">
               <button onClick={() => setRechargeTarget(null)} className="flex-1 px-4 py-3 text-sm font-bold text-slate-400 bg-slate-800 hover:bg-slate-750 rounded-xl transition-all">Close</button>
               {!rechargeSuccess && (
                 <button onClick={handleManualRecharge} disabled={recharging} className="flex-1 px-4 py-3 text-sm font-bold text-white bg-brand-500 hover:bg-brand-600 rounded-xl shadow-lg shadow-brand-500/20 transition-all">
                    {recharging ? 'Processing...' : 'Confirm'}
                 </button>
               )}
            </div>
          </div>
        </div>
      )}

      {/* UTR Verification Modal */}
      {approvalTarget && (
         <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden">
               <div className="px-8 py-6 border-b border-slate-800 bg-slate-800/30">
                  <h3 className="text-xl font-bold text-white">Verify Payment Request</h3>
                  <p className="text-sm text-slate-400 mt-1">From {approvalTarget.shopkeeperId.shopName}</p>
               </div>
               <div className="p-8 space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                     <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700/50">
                        <p className="text-xs text-slate-500 uppercase tracking-widest font-bold mb-1">Reported Amount</p>
                        <p className="text-2xl font-bold text-white">₹{approvalTarget.amount}</p>
                     </div>
                     <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700/50">
                        <p className="text-xs text-slate-500 uppercase tracking-widest font-bold mb-1">Reported UTR</p>
                        <p className="text-lg font-mono text-amber-400 font-bold">{approvalTarget.transactionId}</p>
                     </div>
                  </div>

                  <div className="bg-blue-500/5 border border-blue-500/20 p-4 rounded-2xl">
                     <p className="text-xs text-blue-400 font-bold mb-2">VERIFICATION STEP:</p>
                     <p className="text-sm text-slate-300 leading-relaxed">
                        Open your bank or UPI app (e.g. HDFC/GPay) and search for a payment of <strong className="text-white">₹{approvalTarget.amount}</strong> with reference/UTR <strong className="text-white">{approvalTarget.transactionId}</strong>. Only approve if it matches exactly.
                     </p>
                  </div>

                  <div>
                     <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Admin Note (Visible to shopkeeper)</label>
                     <textarea
                        value={adminNote}
                        onChange={e => setAdminNote(e.target.value)}
                        placeholder="Optional: reason for rejection or welcome note"
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white min-h-[100px] focus:outline-none focus:border-brand-500"
                     />
                  </div>
               </div>
               <div className="flex gap-4 p-8 pt-0">
                  <button onClick={() => setApprovalTarget(null)} className="flex-1 px-4 py-3 text-sm font-bold text-slate-400 bg-slate-800 hover:bg-slate-750 rounded-xl transition-all">Cancel</button>
                  <div className="flex-[2] flex gap-3">
                     <button
                        onClick={() => handleRequestApproval(approvalTarget._id, 'Rejected')}
                        disabled={handling}
                        className="flex-1 px-4 py-3 text-sm font-bold text-rose-400 bg-rose-500/10 border border-rose-500/30 hover:bg-rose-500/20 rounded-xl transition-all"
                     >
                        Reject
                     </button>
                     <button
                        onClick={() => handleRequestApproval(approvalTarget._id, 'Approved')}
                        disabled={handling}
                        className="flex-1 px-4 py-3 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl shadow-lg shadow-emerald-500/20 transition-all font-bold"
                     >
                        Confirm & Approve
                     </button>
                  </div>
               </div>
            </div>
         </div>
      )}
    </div>
  );
};

export default AdminPanelView;
