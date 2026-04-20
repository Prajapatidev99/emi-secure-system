import React from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import { Page } from '../App';
import { UserProfile } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  currentPage: Page;
  setCurrentPage: (page: Page) => void;
  onLogout: () => void;
  isSidebarOpen: boolean;
  setSidebarOpen: (isOpen: boolean) => void;
  userProfile: UserProfile | null;
}

const Layout: React.FC<LayoutProps> = ({ children, currentPage, setCurrentPage, onLogout, isSidebarOpen, setSidebarOpen, userProfile }) => {
  return (
    <div className="flex h-screen bg-slate-950 text-gray-200 selection:bg-brand-500/30 font-sans">
      <Sidebar 
        currentPage={currentPage} 
        setCurrentPage={setCurrentPage} 
        isOpen={isSidebarOpen} 
        setIsOpen={setSidebarOpen}
        userRole={userProfile?.role ?? 'Shopkeeper'}
      />
      
      {/* Overlay for mobile when sidebar is open */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-20 md:hidden transition-opacity duration-300"
          onClick={() => setSidebarOpen(false)}
        ></div>
      )}

      <div className="flex-1 flex flex-col overflow-hidden relative">
        {/* Ambient background glow */}
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-brand-500/10 rounded-full blur-[120px] pointer-events-none"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[30%] h-[30%] bg-purple-500/5 rounded-full blur-[100px] pointer-events-none"></div>

        <Header onLogout={onLogout} onMenuClick={() => setSidebarOpen(true)} userProfile={userProfile} setCurrentPage={setCurrentPage} />
        
        <main className="flex-1 overflow-x-hidden overflow-y-auto relative z-10 px-4 py-6 sm:px-8 sm:py-8 lg:px-10">
          <div className="animate-fade-in">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;