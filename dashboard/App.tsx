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
import SetupGuideView from './components/SetupGuideView';
import GuideView from './components/GuideView';
import ProvisioningView from './components/ProvisioningView';
import WalletView from './components/WalletView';
import AdminPanelView from './components/AdminPanelView';
import { getMyProfile } from './services/api';
import { UserProfile } from './types';

export type Page = 'dashboard' | 'customers' | 'devices' | 'reports' | 'settings' | 'guide' | 'provisioning' | 'wallet' | 'admin';
export type AuthView = 'login' | 'register' | 'setup';

import { I18nProvider } from './i18n';

const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [authView, setAuthView] = useState<AuthView>('login');
  const [token, setToken] = useState<string | null>(null);
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    // BUG-13 FIX: Use localStorage (persists across tab close) instead of sessionStorage
    // The backend issues 1-day JWTs; sessionStorage was clearing them on every tab close
    const storedToken = localStorage.getItem('authToken');
    if (storedToken) {
      setToken(storedToken);
    }
  }, []);

  // Fetch profile when logged in
  useEffect(() => {
    if (token) {
      getMyProfile()
        .then(setUserProfile)
        .catch(() => {
          // If profile fetch fails (expired token), log out
          handleLogout();
        });
    }
  }, [token]);

  const handleLoginSuccess = (newToken: string, profile?: UserProfile) => {
    localStorage.setItem('authToken', newToken);  // BUG-13 FIX: localStorage
    setToken(newToken);
    if (profile) setUserProfile(profile);
  };

  const handleRegisterSuccess = (newToken: string, profile?: UserProfile) => {
    localStorage.setItem('authToken', newToken);  // BUG-13 FIX: localStorage
    setToken(newToken);
    if (profile) setUserProfile(profile);
  };

  const handleLogout = () => {
    localStorage.removeItem('authToken');  // BUG-13 FIX: localStorage
    setToken(null);
    setUserProfile(null);
    setCurrentPage('dashboard');
  };

  const refreshWalletBalance = async () => {
    if (token) {
      const profile = await getMyProfile();
      setUserProfile(profile);
    }
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <DashboardView />;
      case 'customers':
        return <CustomersView />;
      case 'devices':
        return <DevicesView walletBalance={userProfile?.walletBalance ?? null} onDeviceRegistered={refreshWalletBalance} />;
      case 'reports':
        return <ReportsView />;
      case 'settings':
        return <SettingsView onLogout={handleLogout} />;
      case 'guide':
        return <GuideView />;
      case 'provisioning':
        return <ProvisioningView />;
      case 'wallet':
        return <WalletView walletBalance={userProfile?.walletBalance ?? 0} />;
      case 'admin':
        return <AdminPanelView />;
      default:
        return <DashboardView />;
    }
  };

  // BUG-10 FIX: I18nProvider now wraps the ENTIRE app tree (including login/register)
  // Previously it only wrapped authenticated views, so useTranslation() would throw
  // if called from LoginView, RegisterView, or SetupGuideView.
  return (
    <I18nProvider>
      {!token ? (
        authView === 'setup' ? (
          <SetupGuideView onBack={() => setAuthView('login')} />
        ) : (
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
        )
      ) : (
        <Layout
          currentPage={currentPage}
          setCurrentPage={setCurrentPage}
          onLogout={handleLogout}
          isSidebarOpen={isSidebarOpen}
          setSidebarOpen={setSidebarOpen}
          userProfile={userProfile}
        >
          {renderPage()}
        </Layout>
      )}
    </I18nProvider>
  );
};

export default App;