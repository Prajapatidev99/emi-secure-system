
import React from 'react';
import Card from './common/Card';
import Button from './common/Button';

const ReportsView: React.FC = () => {
  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Reports</h2>
      <Card>
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold">Generate Reports</h3>
          <div className="space-x-2">
            <Button onClick={() => alert('Generating PDF report... (mock)')}>Export to PDF</Button>
            <Button onClick={() => alert('Generating Excel report... (mock)')}>Export to Excel</Button>
          </div>
        </div>
        <div className="mt-6">
          <p className="text-gray-600 dark:text-gray-400">
            Select date ranges and report types to generate detailed insights into your sales, payments, and customer data.
          </p>
          {/* Placeholder for report generation form */}
          <div className="mt-4 p-8 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-center">
            <p className="text-gray-400 dark:text-gray-500">Report generation options will be available here.</p>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default ReportsView;
