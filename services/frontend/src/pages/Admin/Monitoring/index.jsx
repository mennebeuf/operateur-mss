// services/frontend/src/pages/Admin/Monitoring/index.jsx
/**
 * Page principale de monitoring système
 * Vue d'ensemble de la santé des services
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import SystemHealth from './SystemHealth';
import ServiceStatus from './ServiceStatus';
import MetricsOverview from './MetricsOverview';
import AlertsList from './AlertsList';
import LogsViewer from './LogsViewer';

const Monitoring = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [refreshInterval, setRefreshInterval] = useState(30);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);

  const handleRefresh = useCallback(() => {
    setLastRefresh(new Date());
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    
    const interval = setInterval(() => {
      handleRefresh();
    }, refreshInterval * 1000);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, handleRefresh]);

  const tabs = [
    { id: 'overview', label: 'Vue d\'ensemble', icon: '📊' },
    { id: 'services', label: 'Services', icon: '🔧' },
    { id: 'metrics', label: 'Métriques', icon: '📈' },
    { id: 'alerts', label: 'Alertes', icon: '🔔' },
    { id: 'logs', label: 'Logs', icon: '📋' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Monitoring Système</h1>
          <p className="text-sm text-gray-500 mt-1">
            Dernière mise à jour : {lastRefresh.toLocaleTimeString('fr-FR')}
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          {/* Auto-refresh toggle */}
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Auto-refresh</label>
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                autoRefresh ? 'bg-green-600' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  autoRefresh ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Refresh interval */}
          {autoRefresh && (
            <select
              value={refreshInterval}
              onChange={(e) => setRefreshInterval(Number(e.target.value))}
              className="border rounded px-2 py-1 text-sm"
            >
              <option value={10}>10s</option>
              <option value={30}>30s</option>
              <option value={60}>1min</option>
              <option value={300}>5min</option>
            </select>
          )}

          {/* Manual refresh */}
          <button
            onClick={handleRefresh}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition flex items-center gap-2"
          >
            <span>🔄</span>
            Rafraîchir
          </button>

          {/* Link to Grafana */}
          <a
            href="/grafana"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 transition flex items-center gap-2"
          >
            <span>📊</span>
            Grafana
          </a>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 transition ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      <div className="min-h-[600px]">
        {activeTab === 'overview' && <SystemHealth key={lastRefresh.getTime()} />}
        {activeTab === 'services' && <ServiceStatus key={lastRefresh.getTime()} />}
        {activeTab === 'metrics' && <MetricsOverview key={lastRefresh.getTime()} />}
        {activeTab === 'alerts' && <AlertsList key={lastRefresh.getTime()} />}
        {activeTab === 'logs' && <LogsViewer key={lastRefresh.getTime()} />}
      </div>
    </div>
  );
};

export default Monitoring;