import React from 'react';
import Button from './Button';
import { WarningIcon } from '../icons';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'primary' | 'success';
  children: React.ReactNode;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'primary',
  children,
}) => {
  if (!isOpen) return null;
  
  const variantClasses = {
      danger: {
          bg: 'bg-rose-100 dark:bg-rose-900/30',
          text: 'text-rose-600 dark:text-rose-400',
          button: 'danger' as const,
      },
      primary: {
          bg: 'bg-brand-100 dark:bg-brand-900/30',
          text: 'text-brand-600 dark:text-brand-400',
          button: 'primary' as const,
      },
      success: {
          bg: 'bg-teal-100 dark:bg-teal-900/30',
          text: 'text-teal-600 dark:text-teal-400',
          button: 'success' as const,
      }
  }
  const styles = variantClasses[variant];

  return (
    <div 
        className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center transition-opacity duration-300" 
        aria-labelledby="modal-title" 
        role="dialog" 
        aria-modal="true"
        onClick={onClose}
    >
        <div 
            className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-md m-4 transform transition-all"
            onClick={e => e.stopPropagation()}
        >
            <div className="p-6">
                <div className="sm:flex sm:items-start">
                    <div className={`mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full ${styles.bg} sm:mx-0 sm:h-10 sm:w-10`}>
                        <WarningIcon className={`h-6 w-6 ${styles.text}`} />
                    </div>
                    <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                        <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white" id="modal-title">
                            {title}
                        </h3>
                        <div className="mt-2">
                            <p className="text-sm text-gray-500 dark:text-slate-400">
                                {children}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse rounded-b-lg">
                <Button
                    onClick={onConfirm}
                    variant={styles.button}
                    className="w-full sm:ml-3 sm:w-auto"
                >
                    {confirmText}
                </Button>
                <Button
                    onClick={onClose}
                    variant="secondary"
                    className="mt-3 w-full sm:mt-0 sm:w-auto"
                >
                    {cancelText}
                </Button>
            </div>
        </div>
    </div>
  );
};

export default ConfirmationModal;