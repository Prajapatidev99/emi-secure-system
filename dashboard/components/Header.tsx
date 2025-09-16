
import React from 'react';
import Button from './common/Button';

interface HeaderProps {
  onLogout: () => void;
  onMenuClick: () => void;
}

const Header: React.FC<HeaderProps> = ({ onLogout, onMenuClick }) => {
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
        <h2 className="text-xl font-semibold text-white">Shopkeeper Dashboard</h2>
      </div>
      <div className="flex items-center space-x-4">
        <div className="hidden sm:flex items-center">
            <span className="text-gray-400 mr-4">Welcome, Admin</span>
            <img
            className="h-10 w-10 rounded-full object-cover"
            src="https://picsum.photos/100"
            alt="Admin"
            />
        </div>
        <Button onClick={onLogout} variant="secondary" size="sm">
          Logout
        </Button>
      </div>
    </header>
  );
};

export default Header;