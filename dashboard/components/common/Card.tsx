
import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

const Card: React.FC<CardProps> = ({ children, className }) => {
  return (
    <div className={`bg-slate-900 p-6 rounded-lg border border-slate-800 ${className}`}>
      {children}
    </div>
  );
};

export default Card;