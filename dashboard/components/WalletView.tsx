import React, { useState, useEffect } from 'react';
import { getWalletTransactions, submitRechargeRequest, getMyRechargeRequests } from '../services/api';
import { WalletTransaction, RechargeRequest } from '../types';
import { QRCodeSVG } from 'qrcode.react';

interface WalletViewProps {
  walletBalance: number;
}

const WalletView: React.FC<WalletViewProps> = ({ walletBalance }) => {
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [rechargeRequests, setRechargeRequests] = useState<RechargeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Recharge form state
  const [amount, setAmount] = useState('');
  const [utr, setUtr] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [txs, requests] = await Promise.all([
        getWalletTransactions(),
        getMyRechargeRequests()
      ]);
      setTransactions(txs);
      setRechargeRequests(requests);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !utr) return;

    setSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(null);

    try {
      const result = await submitRechargeRequest(Number(amount), utr);
      setSubmitSuccess(result.message);
      setAmount('');
      setUtr('');
      // Refresh requests list
      const updatedRequests = await getMyRechargeRequests();
      setRechargeRequests(updatedRequests);
    } catch (err: any) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const isLow = walletBalance < 200;
  const upiId = 'dev358438@okhdfcbank';
  const upiUrl = `upi://pay?pa=${upiId}&pn=EMI%20Secure&cu=INR`;

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Wallet &amp; Billing</h1>
        <p className="text-slate-400 mt-1">Track your credit balance and add funds via UPI.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT COLUMN: Balance and Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Balance card */}
          <div className={`relative overflow-hidden rounded-2xl border p-6 flex items-center justify-between
            ${isLow
              ? 'bg-red-500/10 border-red-500/30 shadow-[0_0_20px_rgba(239,68,68,0.1)]'
              : 'bg-emerald-500/10 border-emerald-500/30'
            }`}
          >
            <div>
              <p className="text-sm font-medium text-slate-400 mb-1">Current Wallet Balance</p>
              <p className={`text-5xl font-bold ${isLow ? 'text-red-400' : 'text-emerald-400'}`}>
                ₹{walletBalance.toLocaleString('en-IN')}
              </p>
              {isLow && (
                <div className="mt-3 flex items-center gap-2 text-sm text-red-400 animate-pulse">
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  </svg>
                  <span>Low balance! Top up to continue registering devices.</span>
                </div>
              )}
            </div>
            <div className={`w-20 h-20 rounded-full flex items-center justify-center ${isLow ? 'bg-red-500/20' : 'bg-emerald-500/20'}`}>
              <svg className={`w-10 h-10 ${isLow ? 'text-red-400' : 'text-emerald-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3" />
              </svg>
            </div>
          </div>

          {/* Recharge Section */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-800 bg-slate-800/30">
              <h2 className="text-lg font-semibold text-white">Online Top-up</h2>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* UPI Info & QR */}
              <div className="flex flex-col items-center justify-center p-4 bg-white/[0.03] rounded-xl border border-slate-700/50">
                <div className="bg-white p-3 rounded-xl mb-4">
                  <QRCodeSVG value={upiUrl} size={160} />
                </div>
                <p className="text-sm text-slate-400 mb-1">Scan QR or pay to UPI ID:</p>
                <p className="text-lg font-mono text-amber-400 font-bold select-all cursor-pointer" title="Click to select">
                  {upiId}
                </p>
                <div className="mt-4 text-xs text-slate-500 text-center">
                  <p>1. Open any UPI app (GPay, PhonePe, etc.)</p>
                  <p>2. Complete the payment</p>
                  <p>3. Submit the UTR / Transaction ID here</p>
                </div>
              </div>

              {/* Submission Form */}
              <form onSubmit={handleSubmitRequest} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Amount Paid (₹)</label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="e.g. 500"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Transaction ID / UTR Number</label>
                  <input
                    type="text"
                    required
                    placeholder="Enter 12-digit UTR"
                    value={utr}
                    onChange={(e) => setUtr(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white font-bold py-3 px-4 rounded-xl shadow-lg shadow-brand-500/20 transition-all duration-200 transform active:scale-[0.98]"
                >
                  {submitting ? 'Submitting...' : 'Submit Payment Details'}
                </button>

                {submitSuccess && (
                  <p className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm rounded-lg text-center">
                    ✅ {submitSuccess}
                  </p>
                )}
                {submitError && (
                  <p className="p-3 bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg text-center">
                    ❌ {submitError}
                  </p>
                )}
              </form>
            </div>
          </div>

          {/* Pending / Recent Requests Table */}
          {rechargeRequests.length > 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-800">
                <h2 className="text-lg font-semibold text-white">Recharge Requests</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead>
                    <tr className="bg-slate-800/50 text-slate-400 uppercase text-xs font-bold tracking-wider">
                      <th className="px-6 py-3">Date</th>
                      <th className="px-6 py-3">UTR</th>
                      <th className="px-6 py-3">Amount</th>
                      <th className="px-6 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {rechargeRequests.map(req => (
                      <tr key={req._id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-6 py-4 text-slate-400">
                          {new Date(req.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 font-mono text-slate-300">{req.transactionId}</td>
                        <td className="px-6 py-4 font-bold text-white">₹{req.amount}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border
                            ${req.status === 'Pending' ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' :
                              req.status === 'Approved' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' :
                              'bg-red-500/10 text-red-400 border-red-500/30'}`}>
                            {req.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: History */}
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden flex flex-col h-full max-h-[800px]">
            <div className="px-6 py-4 border-b border-slate-800 bg-slate-800/30">
              <h2 className="text-lg font-semibold text-white">Transaction History</h2>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-slate-800">
              {loading && (
                <div className="flex items-center justify-center py-12">
                  <div className="w-8 h-8 border-2 border-slate-600 border-t-brand-500 rounded-full animate-spin"></div>
                </div>
              )}

              {!loading && transactions.length === 0 && (
                <div className="px-6 py-12 text-center text-slate-600">
                  No billing history available.
                </div>
              )}

              {transactions.map(tx => (
                <div key={tx._id} className="p-4 hover:bg-slate-800/30 transition-colors">
                  <div className="flex justify-between items-start mb-1">
                    <span className={`text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded
                      ${tx.type === 'Recharge' ? 'text-emerald-400 bg-emerald-400/10' : 'text-red-400 bg-red-400/10'}`}>
                      {tx.type}
                    </span>
                    <span className={`font-bold ${tx.type === 'Recharge' ? 'text-emerald-400' : 'text-red-400'}`}>
                      {tx.type === 'Recharge' ? '+' : '-'}₹{tx.amount}
                    </span>
                  </div>
                  <p className="text-sm text-slate-200 leading-tight mb-1">{tx.description}</p>
                  <p className="text-[10px] text-slate-500">
                    {new Date(tx.createdAt).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4 text-xs text-slate-400 space-y-2">
            <h4 className="font-bold text-blue-400 uppercase tracking-widest">Billing Info</h4>
            <p>• Device registration fee: ₹200 (Automatic)</p>
            <p>• Minimum recharge: ₹1</p>
            <p>• Note: Payments are verified manually by admin. Please allow up to 1-2 hours for approval.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WalletView;
