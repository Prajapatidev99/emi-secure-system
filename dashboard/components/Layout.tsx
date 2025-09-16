import React from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import { Page } from '../App';

interface LayoutProps {
  children: React.ReactNode;
  currentPage: Page;
  setCurrentPage: (page: Page) => void;
  onLogout: () => void;
  isSidebarOpen: boolean;
  setSidebarOpen: (isOpen: boolean) => void;
}

const Layout: React.FC<LayoutProps> = ({ children, currentPage, setCurrentPage, onLogout, isSidebarOpen, setSidebarOpen }) => {
  return (
    <div className="flex h-screen bg-slate-950 text-gray-800 dark:text-gray-200">
      <Sidebar 
        currentPage={currentPage} 
        setCurrentPage={setCurrentPage} 
        isOpen={isSidebarOpen} 
        setIsOpen={setSidebarOpen} 
      />
      
      {/* Overlay for mobile when sidebar is open */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black opacity-50 z-20 md:hidden"
          onClick={() => setSidebarOpen(false)}
        ></div>
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header onLogout={onLogout} onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-slate-950 p-4 sm:p-6">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;