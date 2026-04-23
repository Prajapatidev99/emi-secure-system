import React from 'react';
import { Page } from '../App';
import { DashboardIcon, UsersIcon, ChartIcon, DevicePhoneMobileIcon, QrCodeIcon } from './icons';
import Logo from './Logo';
import { UserRole } from '../types';
import { useTranslation } from '../i18n';

interface SidebarProps {
  currentPage: Page;
  setCurrentPage: (page: Page) => void;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  userRole: UserRole;
}

const Sidebar: React.FC<SidebarProps> = ({ currentPage, setCurrentPage, isOpen, userRole }) => {
  const { t } = useTranslation();
  const navItems = [
    { id: 'dashboard', label: t('dashboard'), icon: <DashboardIcon /> },
    { id: 'customers', label: t('customers'), icon: <UsersIcon /> },
    { id: 'devices', label: t('devices'), icon: <DevicePhoneMobileIcon /> },
    { id: 'provisioning', label: 'Provisioning', icon: <QrCodeIcon /> },
    { id: 'reports', label: 'Reports', icon: <ChartIcon /> },
    {
      id: 'wallet',
      label: t('wallet'),
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3" />
        </svg>
      )
    },
    {
      id: 'guide',
      label: 'Guide',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
        </svg>
      )
    },
    {
      id: 'settings',
      label: t('settings'),
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      )
    },
  ];

  // SuperAdmin-only nav item
  const adminNavItem = {
    id: 'admin',
    label: 'Admin Panel',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
      </svg>
    )
  };

  const visibleItems = userRole === 'SuperAdmin'
    ? [adminNavItem, ...navItems]
    : navItems;

  return (
    <div className={`fixed inset-y-0 left-0 transform ${isOpen ? 'translate-x-0' : '-translate-x-full'} 
                   md:relative md:translate-x-0 md:flex-shrink-0 
                   w-64 bg-slate-900 border-r border-slate-800 
                   transition-transform duration-200 ease-in-out z-30`}>
      <div className="flex items-center justify-center h-20">
        <Logo />
      </div>

      {/* Role badge */}
      {userRole === 'SuperAdmin' && (
        <div className="mx-3 mb-2 px-3 py-1 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold text-center tracking-wide">
          ⚡ Super Admin
        </div>
      )}

      <nav className="mt-2 px-2">
        <ul>
          {visibleItems.map((item) => (
            <li key={item.id} className="mb-1">
              <a
                href="#"
                id={`nav-${item.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  setCurrentPage(item.id as Page);
                }}
                className={`flex items-center p-3 rounded-lg transition-colors duration-200 ${currentPage === item.id
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