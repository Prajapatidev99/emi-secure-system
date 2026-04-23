import React, { useState } from 'react';
import { useTranslation } from '../i18n';

const AssistantChat: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState<{ role: 'user' | 'ai'; text: string }[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { lang, t } = useTranslation();

  const handleSend = async () => {
    if (!query.trim()) return;

    const userMsg = { role: 'user' as const, text: query };
    setMessages(prev => [...prev, userMsg]);
    setQuery('');
    setIsLoading(true);

    try {
      const token = sessionStorage.getItem('authToken');
      const response = await fetch('/api/assistant/ask', {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ query, lang })
      });
      const data = await response.json();
      setMessages(prev => [...prev, { role: 'ai', text: data.answer }]);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'ai', text: 'Error connecting to support. Please try again.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return React.createElement('div', { className: 'fixed bottom-6 right-6 z-50' }, [
    // Chat Window
    isOpen && React.createElement('div', { 
      key: 'chat-window',
      className: 'mb-4 w-80 h-[400px] bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-slide-up' 
    }, [
      // Header
      React.createElement('div', { 
        key: 'header',
        className: 'p-4 bg-brand-600 text-white flex justify-between items-center' 
      }, [
        React.createElement('span', { key: 'title', className: 'font-semibold' }, t('support')),
        React.createElement('button', { 
          key: 'close',
          onClick: () => setIsOpen(false),
          className: 'hover:text-slate-200' 
        }, '✕')
      ]),
      // Messages Area
      React.createElement('div', { 
        key: 'messages',
        className: 'flex-1 overflow-y-auto p-4 space-y-4' 
      }, [
        messages.map((m, i) => React.createElement('div', { 
          key: i,
          className: `flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}` 
        }, [
          React.createElement('div', { 
            className: `max-w-[80%] p-3 rounded-2xl text-sm ${m.role === 'user' ? 'bg-brand-500 text-white' : 'bg-slate-800 text-slate-200'}` 
          }, m.text)
        ])),
        isLoading && React.createElement('div', { key: 'loading', className: 'text-slate-500 text-xs italic' }, 'AI is thinking...')
      ]),
      // Input
      React.createElement('div', { key: 'input-area', className: 'p-4 border-t border-slate-800 flex gap-2' }, [
        React.createElement('input', {
          key: 'input',
          type: 'text',
          value: query,
          onChange: (e) => setQuery(e.target.value),
          onKeyPress: (e) => e.key === 'Enter' && handleSend(),
          placeholder: t('ask_ai'),
          className: 'flex-1 bg-slate-800 border-none rounded-lg px-3 py-2 text-xs text-white focus:ring-1 focus:ring-brand-500'
        }),
        React.createElement('button', {
          key: 'send-btn',
          onClick: handleSend,
          className: 'bg-brand-600 text-white p-2 rounded-lg hover:bg-brand-700 transition-colors'
        }, '➤')
      ])
    ]),
    // Floating Button
    React.createElement('button', {
      key: 'fab',
      onClick: () => setIsOpen(!isOpen),
      className: 'w-14 h-14 bg-brand-600 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-brand-700 transition-all transform hover:scale-110 active:scale-95'
    }, [
      React.createElement('svg', { key: 'icon', className: 'w-7 h-7', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' }, [
        React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: 2, d: 'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z' })
      ])
    ])
  ]);
};

export default AssistantChat;
