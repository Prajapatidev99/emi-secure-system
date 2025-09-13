import React from 'react';
import Card from './common/Card';

const ReportsView: React.FC = () => {
  return (
    <div>
      <h2 className="text-2xl font-bold mb-4 text-white">Reports</h2>
      <Card>
        <div className="text-center p-8">
          <h3 className="text-xl font-semibold text-slate-300">Feature Coming Soon</h3>
          <p className="text-slate-400 mt-2">
            The reporting section is currently under development.
          </p>
        </div>
      </Card>
    </div>
  );
};

export default ReportsView;