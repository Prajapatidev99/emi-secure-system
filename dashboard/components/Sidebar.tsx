
import React from 'react';
import { Page } from '../App';
import { DashboardIcon, UsersIcon, ChartIcon, DevicePhoneMobileIcon } from './icons';

interface SidebarProps {
  currentPage: Page;
  setCurrentPage: (page: Page) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentPage, setCurrentPage }) => {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: <DashboardIcon /> },
    { id: 'customers', label: 'Customers', icon: <UsersIcon /> },
    { id: 'devices', label: 'Devices', icon: <DevicePhoneMobileIcon /> },
    { id: 'reports', label: 'Reports', icon: <ChartIcon /> },
  ];

  return (
    <div className="w-64 bg-slate-900 flex-shrink-0 border-r border-slate-800">
      <div className="flex items-center justify-center h-20">
        <h1 className="text-2xl font-bold text-white">EMI Secure</h1>
      </div>
      <nav className="mt-5 px-2">
        <ul>
          {navItems.map((item) => (
            <li key={item.id} className="mb-1">
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  setCurrentPage(item.id as Page);
                }}
                className={`flex items-center p-3 rounded-lg transition-colors duration-200 ${
                  currentPage === item.id
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                {item.icon}
                <span className="ml-4 font-medium">{item.label}</span>
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
};

export default Sidebar;
