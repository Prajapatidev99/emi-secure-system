// FIX: Corrected an import statement by removing an unused 'a' alias, which could cause potential issues with linters or bundlers.
import React, { useState, useEffect } from 'react';
import Layout from './components/Layout';
import DashboardView from './components/DashboardView';
import CustomersView from './components/CustomersView';
import ReportsView from './components/ReportsView';
import DevicesView from './components/DevicesView';
import LoginView from './components/LoginView';
import RegisterView from './components/RegisterView';
import SettingsView from './components/SettingsView';
import LoginLayout from './components/LoginLayout';

export type Page = 'dashboard' | 'customers' | 'devices' | 'reports' | 'settings';
export type AuthView = 'login' | 'register';

const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [authView, setAuthView] = useState<AuthView>('login');
  const [token, setToken] = useState<string | null>(null);
  const [isSidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    // Check for token in session storage on initial load
    const storedToken = sessionStorage.getItem('authToken');
    if (storedToken) {
      setToken(storedToken);
    }
  }, []);

  const handleLoginSuccess = (newToken: string) => {
    sessionStorage.setItem('authToken', newToken);
    setToken(newToken);
  };

  const handleRegisterSuccess = (newToken: string) => {
    sessionStorage.setItem('authToken', newToken);
    setToken(newToken);
  };

  const handleLogout = () => {
    sessionStorage.removeItem('authToken');
    setToken(null);
    setCurrentPage('dashboard');
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <DashboardView />;
      case 'customers':
        return <CustomersView />;
      case 'devices':
        return <DevicesView />;
      case 'reports':
        return <ReportsView />;
      case 'settings':
        return <SettingsView onLogout={handleLogout} />;
      default:
        return <DashboardView />;
    }
  };

  if (!token) {
    return (
      <LoginLayout>
        {authView === 'login' ? (
          <LoginView
            onLoginSuccess={handleLoginSuccess}
            onSwitchToRegister={() => setAuthView('register')}
          />
        ) : (
          <RegisterView
            onRegisterSuccess={handleRegisterSuccess}
            onSwitchToLogin={() => setAuthView('login')}
          />
        )}
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