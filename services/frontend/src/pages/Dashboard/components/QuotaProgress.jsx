// services/frontend/src/pages/Dashboard/components/QuotaProgress.jsx

import React from 'react';

const QuotaProgress = ({ label, current, max, unit }) => {
  const percentage = max > 0 ? Math.min((current / max) * 100, 100) : 0;

  const getColorClass = () => {
    if (percentage >= 90) {
      return 'bg-red-500';
    }
    if (percentage >= 75) {
      return 'bg-yellow-500';
    }
    return 'bg-blue-500';
  };

  const getTextColorClass = () => {
    if (percentage >= 90) {
      return 'text-red-600';
    }
    if (percentage >= 75) {
      return 'text-yellow-600';
    }
    return 'text-blue-600';
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-700">{label}</span>
        <span className={`text-sm font-semibold ${getTextColorClass()}`}>
          {percentage.toFixed(0)}%
        </span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-3">
        <div
          className={`h-3 rounded-full transition-all duration-300 ${getColorClass()}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div className="flex items-center justify-between mt-1">
        <span className="text-xs text-gray-500">
          {typeof current === 'number' ? current.toLocaleString('fr-FR') : current} {unit}
        </span>
        <span className="text-xs text-gray-500">
          Max: {typeof max === 'number' ? max.toLocaleString('fr-FR') : max} {unit}
        </span>
      </div>
      {percentage >= 90 && <p className="text-xs text-red-600 mt-1">⚠️ Quota presque atteint</p>}
    </div>
  );
};

export default QuotaProgress;
