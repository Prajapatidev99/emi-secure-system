
import React from 'react';
import Button from './common/Button';

interface HeaderProps {
  onLogout: () => void;
}

const Header: React.FC<HeaderProps> = ({ onLogout }) => {
  return (
    <header className="flex justify-between items-center p-4 bg-slate-900 border-b border-slate-800">
      <h2 className="text-xl font-semibold text-white">Shopkeeper Dashboard</h2>
      <div className="flex items-center space-x-4">
        <div className="flex items-center">
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
