const Skeleton = ({ className }: { className?: string }) => {
  return (
    <div className={`animate-pulse bg-slate-300 dark:bg-slate-700 rounded ${className}`} />
  );
};

export default Skeleton;