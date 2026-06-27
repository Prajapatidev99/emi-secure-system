import React, { useState, createContext, useContext } from 'react';

type Language = 'en' | 'hi' | 'gu';

const translations = {
  en: {
    dashboard: 'Dashboard',
    customers: 'Customers',
    devices: 'Devices',
    wallet: 'Wallet',
    settings: 'Settings',
    logout: 'Logout',
    add_customer: 'Add Customer',
    register_device: 'Register Device',
    lock_device: 'Lock Device',
    unlock_device: 'Unlock Device',
    total_balance: 'Total Balance',
    active_devices: 'Active Devices',
    overdue_payments: 'Overdue Payments',
    support: 'AI Support',
    ask_ai: 'Ask AI Assistant...',
    send: 'Send',
  },
  hi: {
    dashboard: 'डैशबोर्ड',
    customers: 'ग्राहक',
    devices: 'डिवाइस',
    wallet: 'वॉलेट',
    settings: 'सेटिंग्स',
    logout: 'लॉगआउट',
    add_customer: 'ग्राहक जोड़ें',
    register_device: 'डिवाइस रजिस्टर करें',
    lock_device: 'डिवाइस लॉक करें',
    unlock_device: 'डिवाइस अनलॉक करें',
    total_balance: 'कुल शेष',
    active_devices: 'सक्रिय डिवाइस',
    overdue_payments: 'बकाया भुगतान',
    support: 'AI सहायता',
    ask_ai: 'AI सहायक से पूछें...',
    send: 'भेजें',
  },
  gu: {
    dashboard: 'ડેશબોર્ડ',
    customers: 'ગ્રાહકો',
    devices: 'ઉપકરણો',
    wallet: 'વોલેટ',
    settings: 'સેટિંગ્સ',
    logout: 'લોગઆઉટ',
    add_customer: 'ગ્રાહક ઉમેરો',
    register_device: 'ડિવાઇસ રજીસ્ટર કરો',
    lock_device: 'ડિવાઇસ લોક કરો',
    unlock_device: 'ડિવાઇસ અનલોક કરો',
    total_balance: 'કુલ બેલેન્સ',
    active_devices: 'સક્રિય ઉપકરણો',
    overdue_payments: 'બાકી ચૂકવણી',
    support: 'AI સહાય',
    ask_ai: 'AI સહાયકને પૂછો...',
    send: 'મોકલો',
  }
};

interface I18nContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: keyof typeof translations.en) => string;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<Language>(() => {
    return (localStorage.getItem('appLang') as Language) || 'en';
  });

  const setLang = (newLang: Language) => {
    localStorage.setItem('appLang', newLang);
    setLangState(newLang);
  };

  const t = (key: keyof typeof translations.en) => {
    return translations[lang][key] || translations.en[key] || key;
  };

  return React.createElement(I18nContext.Provider, { value: { lang, setLang, t } }, children);
};

export const useTranslation = () => {
  const context = useContext(I18nContext);
  if (!context) throw new Error('useTranslation must be used within I18nProvider');
  return context;
};
