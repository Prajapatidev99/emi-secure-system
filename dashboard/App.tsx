

import React, { useState, useEffect } from 'react';
import Layout from './components/Layout';
import DashboardView from './components/DashboardView';
import CustomersView from './components/CustomersView';
import ReportsView from './components/ReportsView';
import DevicesView from './components/DevicesView'; // Import the new component
import LoginView from './components/LoginView';
import LoginLayout from './components/LoginLayout';

export type Page = 'dashboard' | 'customers' | 'devices' | 'reports';

const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [token, setToken] = useState<string | null>(null);
  const [isSidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    // Check for token in session storage on initial load for better security and session management.
    const storedToken = sessionStorage.getItem('authToken');
    if (storedToken) {
      setToken(storedToken);
    }
  }, []);

  const handleLoginSuccess = (newToken: string) => {
    // Store token in sessionStorage. It will be cleared when the tab is closed.
    sessionStorage.setItem('authToken', newToken);
    setToken(newToken);
  };

  const handleLogout = () => {
    sessionStorage.removeItem('authToken');
    setToken(null);
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <DashboardView />;
      case 'customers':
        return <CustomersView />;
      case 'devices':
        return <DevicesView />; // Render the new component
      case 'reports':
        return <ReportsView />;
      default:
        return <DashboardView />;
    }
  };
  
  if (!token) {
    return (
        <LoginLayout>
            <LoginView onLoginSuccess={handleLoginSuccess} />
        </LoginLayout>
    );
  }

  return (
    <Layout 
      currentPage={currentPage} 
      setCurrentPage={setCurrentPage} 
      onLogout={handleLogout}
      isSidebarOpen={isSidebarOpen}
      setSidebarOpen={setSidebarOpen}
    >
      {renderPage()}
    </Layout>
  );
};

export default App;