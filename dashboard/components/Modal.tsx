

import React from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;

  return (
    // This outer div is the backdrop, now scrollable and using flex for alignment
    <div 
      className="fixed inset-0 bg-black bg-opacity-60 z-50 overflow-y-auto p-4 flex justify-center items-start"
      onClick={onClose}
    >
      {/* This is the actual modal content, it will grow with its content */}
      <div 
        className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-md my-8" // Margin top/bottom for spacing
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b dark:border-slate-700">
          <h3 className="text-xl font-semibold">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {/* Content - No longer needs to be scrollable itself */}
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>
  );
};

export default Modal;
