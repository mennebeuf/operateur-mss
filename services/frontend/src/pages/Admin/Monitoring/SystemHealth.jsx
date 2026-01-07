// services/frontend/src/pages/Admin/Monitoring/SystemHealth.jsx
/**
 * Composant de vue d'ensemble de la santé système
 * Affiche les métriques principales et l'état global
 */

import React, { useState, useEffect } from 'react';

const SystemHealth = () => {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadHealthData();
  }, []);

  const loadHealthData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/v1/admin/monitoring/health', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Erreur chargement données');
      }

      const data = await response.json();
      setHealth(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <span className="text-4xl mb-4 block">⚠️</span>
        <p className="text-red-700">{error}</p>
        <button
          onClick={loadHealthData}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Réessayer
        </button>
      </div>
    );
  }

  const getStatusColor = status => {
    switch (status) {
      case 'healthy':
      case 'up':
      case 'ok':
        return 'green';
      case 'degraded':
      case 'warning':
        return 'yellow';
      case 'down':
      case 'error':
      case 'critical':
        return 'red';
      default:
        return 'gray';
    }
  };

  const getStatusIcon = status => {
    switch (status) {
      case 'healthy':
      case 'up':
      case 'ok':
        return '✅';
      case 'degraded':
      case 'warning':
        return '⚠️';
      case 'down':
      case 'error':
      case 'critical':
        return '❌';
      default:
        return '❓';
    }
  };

  const overallStatus = health?.status || 'unknown';

  return (
    <div className="space-y-6">
      {/* Status global */}
      <div
        className={`rounded-lg p-6 ${
          overallStatus === 'healthy'
            ? 'bg-green-50 border border-green-200'
            : overallStatus === 'degraded'
              ? 'bg-yellow-50 border border-yellow-200'
              : 'bg-red-50 border border-red-200'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-5xl">{getStatusIcon(overallStatus)}</span>
            <div>
              <h2 className="text-2xl font-bold">
                {overallStatus === 'healthy'
                  ? 'Système opérationnel'
                  : overallStatus === 'degraded'
                    ? 'Système dégradé'
                    : 'Système en erreur'}
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                {health?.timestamp && new Date(health.timestamp).toLocaleString('fr-FR')}
              </p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold">
              {health?.uptime ? `${Math.floor(health.uptime / 86400)}j` : '-'}
            </div>
            <div className="text-sm text-gray-500">Uptime</div>
          </div>
        </div>
      </div>

      {/* Métriques système */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="CPU"
          value={health?.metrics?.cpu?.usage || 0}
          unit="%"
          icon="🖥️"
          threshold={{ warning: 70, critical: 90 }}
        />
        <MetricCard
          title="Mémoire"
          value={health?.metrics?.memory?.usedPercent || 0}
          unit="%"
          icon="💾"
          threshold={{ warning: 80, critical: 95 }}
          subtitle={
            health?.metrics?.memory?.used && health?.metrics?.memory?.total
              ? `${formatBytes(health.metrics.memory.used)} / ${formatBytes(health.metrics.memory.total)}`
              : null
          }
        />
        <MetricCard
          title="Disque"
          value={health?.metrics?.disk?.usedPercent || 0}
          unit="%"
          icon="💿"
          threshold={{ warning: 80, critical: 90 }}
          subtitle={
            health?.metrics?.disk?.used && health?.metrics?.disk?.total
              ? `${formatBytes(health.metrics.disk.used)} / ${formatBytes(health.metrics.disk.total)}`
              : null
          }
        />
        <MetricCard
          title="Connexions DB"
          value={health?.metrics?.database?.activeConnections || 0}
          unit=""
          icon="🔗"
          threshold={{ warning: 80, critical: 95 }}
          subtitle={`Max: ${health?.metrics?.database?.maxConnections || '-'}`}
        />
      </div>

      {/* Services critiques */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b">
          <h3 className="text-lg font-semibold">Services critiques</h3>
        </div>
        <div className="divide-y">
          {health?.services &&
            Object.entries(health.services).map(([name, status]) => (
              <div key={name} className="p-4 flex items-center justify-between hover:bg-gray-50">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{getStatusIcon(status)}</span>
                  <div>
                    <div className="font-medium capitalize">{name}</div>
                    <div className="text-sm text-gray-500">{getServiceDescription(name)}</div>
                  </div>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-sm font-medium ${
                    status === 'ok' || status === 'up'
                      ? 'bg-green-100 text-green-800'
                      : status === 'degraded'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-red-100 text-red-800'
                  }`}
                >
                  {status}
                </span>
              </div>
            ))}
        </div>
      </div>

      {/* Alertes récentes */}
      {health?.recentAlerts && health.recentAlerts.length > 0 && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b flex justify-between items-center">
            <h3 className="text-lg font-semibold">Alertes récentes</h3>
            <span className="bg-red-100 text-red-800 px-2 py-1 rounded-full text-sm">
              {health.recentAlerts.length}
            </span>
          </div>
          <div className="divide-y max-h-64 overflow-y-auto">
            {health.recentAlerts.map((alert, index) => (
              <div key={index} className="p-4 flex items-start gap-3">
                <span className="text-xl">
                  {alert.severity === 'critical'
                    ? '🔴'
                    : alert.severity === 'warning'
                      ? '🟡'
                      : '🔵'}
                </span>
                <div className="flex-1">
                  <div className="font-medium">{alert.message}</div>
                  <div className="text-sm text-gray-500">
                    {new Date(alert.timestamp).toLocaleString('fr-FR')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// Composant carte métrique
const MetricCard = ({ title, value, unit, icon, threshold, subtitle }) => {
  const getColor = () => {
    if (!threshold) {
      return 'blue';
    }
    if (value >= threshold.critical) {
      return 'red';
    }
    if (value >= threshold.warning) {
      return 'yellow';
    }
    return 'green';
  };

  const color = getColor();
  const colorClasses = {
    green: 'bg-green-50 border-green-200 text-green-700',
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-700',
    red: 'bg-red-50 border-red-200 text-red-700',
    blue: 'bg-blue-50 border-blue-200 text-blue-700'
  };

  return (
    <div className={`rounded-lg border p-4 ${colorClasses[color]}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-2xl">{icon}</span>
        <span className="text-sm font-medium">{title}</span>
      </div>
      <div className="text-3xl font-bold">
        {typeof value === 'number' ? value.toFixed(1) : value}
        {unit}
      </div>
      {subtitle && <div className="text-sm mt-1 opacity-75">{subtitle}</div>}
      {threshold && (
        <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all ${
              color === 'green'
                ? 'bg-green-500'
                : color === 'yellow'
                  ? 'bg-yellow-500'
                  : 'bg-red-500'
            }`}
            style={{ width: `${Math.min(value, 100)}%` }}
          />
        </div>
      )}
    </div>
  );
};

// Helpers
const formatBytes = bytes => {
  if (bytes === 0) {
    return '0 B';
  }
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const getServiceDescription = name => {
  const descriptions = {
    database: 'PostgreSQL - Base de données principale',
    redis: 'Redis - Cache et sessions',
    smtp: 'Postfix - Envoi des emails',
    imap: 'Dovecot - Réception des emails',
    api: 'API Backend - Services REST',
    frontend: 'Frontend - Interface utilisateur'
  };
  return descriptions[name] || name;
};

export default SystemHealth;
