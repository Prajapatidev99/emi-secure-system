import React from 'react';

const Skeleton: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <div className={`animate-pulse bg-slate-300 dark:bg-slate-700 rounded ${className}`} />
  );
};

export default Skeleton;