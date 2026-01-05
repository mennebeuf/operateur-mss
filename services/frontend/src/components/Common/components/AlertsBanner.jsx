// services/frontend/src/pages/Dashboard/components/AlertsBanner.jsx

import React, { useState } from 'react';
import { Link } from 'react-router-dom';

const alertStyles = {
  critical: {
    bg: 'bg-red-50',
    border: 'border-red-400',
    text: 'text-red-800',
    icon: '🚨'
  },
  warning: {
    bg: 'bg-yellow-50',
    border: 'border-yellow-400',
    text: 'text-yellow-800',
    icon: '⚠️'
  },
  info: {
    bg: 'bg-blue-50',
    border: 'border-blue-400',
    text: 'text-blue-800',
    icon: 'ℹ️'
  }
};

const AlertsBanner = ({ alerts }) => {
  const [dismissed, setDismissed] = useState([]);

  const visibleAlerts = alerts.filter(a => !dismissed.includes(a.id));

  if (visibleAlerts.length === 0) return null;

  const handleDismiss = (alertId) => {
    setDismissed([...dismissed, alertId]);
  };

  // Regrouper par niveau de gravité
  const criticalAlerts = visibleAlerts.filter(a => a.level === 'critical');
  const warningAlerts = visibleAlerts.filter(a => a.level === 'warning');
  const infoAlerts = visibleAlerts.filter(a => a.level === 'info');

  const renderAlertGroup = (alertGroup, level) => {
    if (alertGroup.length === 0) return null;
    
    const style = alertStyles[level] || alertStyles.info;
    
    return (
      <div className={`${style.bg} border-l-4 ${style.border} p-4 rounded-r-lg`}>
        <div className="flex items-start">
          <span className="text-xl mr-3">{style.icon}</span>
          <div className="flex-1">
            <h3 className={`text-sm font-medium ${style.text}`}>
              {alertGroup.length} alerte{alertGroup.length > 1 ? 's' : ''} {
                level === 'critical' ? 'critique(s)' : 
                level === 'warning' ? 'à traiter' : 
                'informative(s)'
              }
            </h3>
            <div className={`mt-2 text-sm ${style.text}`}>
              <ul className="space-y-1">
                {alertGroup.map((alert) => (
                  <li key={alert.id} className="flex items-center justify-between">
                    <span>{alert.message}</span>
                    <div className="flex items-center gap-2 ml-4">
                      {alert.link && (
                        <Link 
                          to={alert.link}
                          className="text-xs underline hover:no-underline"
                        >
                          Voir
                        </Link>
                      )}
                      {alert.dismissible !== false && (
                        <button
                          onClick={() => handleDismiss(alert.id)}
                          className="text-xs opacity-60 hover:opacity-100"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {renderAlertGroup(criticalAlerts, 'critical')}
      {renderAlertGroup(warningAlerts, 'warning')}
      {renderAlertGroup(infoAlerts, 'info')}
    </div>
  );
};

export default AlertsBanner;