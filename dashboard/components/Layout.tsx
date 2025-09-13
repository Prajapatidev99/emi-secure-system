
import React from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import { Page } from '../App';

interface LayoutProps {
  children: React.ReactNode;
  currentPage: Page;
  setCurrentPage: (page: Page) => void;
  onLogout: () => void;
}

const Layout: React.FC<LayoutProps> = ({ children, currentPage, setCurrentPage, onLogout }) => {
  return (
    <div className="flex h-screen bg-slate-100 dark:bg-slate-900 text-gray-800 dark:text-gray-200">
      <Sidebar currentPage={currentPage} setCurrentPage={setCurrentPage} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header onLogout={onLogout} />
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-slate-100 dark:bg-slate-900 p-6">
          {children}
        </main>
      </div>
    </div>
  );
};


export default Layout;