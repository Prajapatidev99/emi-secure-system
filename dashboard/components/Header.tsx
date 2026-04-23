
import React from 'react';
import Button from './common/Button';
import { UserProfile } from '../types';
import { Page } from '../App';
import { useTranslation } from '../i18n';

interface HeaderProps {
  onLogout: () => void;
  onMenuClick: () => void;
  userProfile: UserProfile | null;
  setCurrentPage: (page: Page) => void;
}

const Header: React.FC<HeaderProps> = ({ onLogout, onMenuClick, userProfile, setCurrentPage }) => {
  const { lang, setLang, t } = useTranslation();
  const isLowBalance = userProfile && userProfile.role === 'Shopkeeper' && userProfile.walletBalance < 200;

  return (
    <header className="flex justify-between items-center p-4 bg-slate-900 border-b border-slate-800">
      <div className="flex items-center">
         {/* Hamburger Menu Button for mobile */}
        <button 
          onClick={onMenuClick} 
          className="text-slate-400 hover:text-white focus:outline-none md:hidden mr-4"
          aria-label="Open sidebar"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path>
          </svg>
        </button>
        <h2 className="text-xl font-semibold text-white">
          {userProfile?.role === 'SuperAdmin' ? 'Admin Dashboard' : t('dashboard')}
        </h2>
      </div>
      <div className="flex items-center space-x-3">
        
        {/* Language Selector */}
        <select 
          value={lang} 
          onChange={(e) => setLang(e.target.value as any)}
          className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg px-2 py-1 outline-none focus:ring-1 focus:ring-brand-500 transition-all cursor-pointer"
        >
          <option value="en">EN</option>
          <option value="hi">HI</option>
          <option value="gu">GU</option>
        </select>

        {/* Wallet Balance Badge */}
        {userProfile && userProfile.role === 'Shopkeeper' && (
          <button
            id="wallet-balance-btn"
            onClick={() => setCurrentPage('wallet')}
            title={isLowBalance ? 'Low balance! Click to view.' : t('total_balance')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-semibold transition-all duration-200 cursor-pointer
              ${isLowBalance
                ? 'bg-red-500/10 border-red-500/40 text-red-400 animate-pulse'
                : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
              }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3" />
            </svg>
            ₹{userProfile.walletBalance.toLocaleString('en-IN')}
            {isLowBalance && <span className="text-xs">Low!</span>}
          </button>
        )}

        <div className="hidden sm:flex items-center">
            <span className="text-gray-400 mr-3 text-sm truncate max-w-[120px]">
              {userProfile?.shopName || 'Welcome'}
            </span>
        </div>
        <Button onClick={onLogout} variant="secondary" size="sm">
          {t('logout')}
        </Button>
      </div>
    </header>
  );
};

export default Header;