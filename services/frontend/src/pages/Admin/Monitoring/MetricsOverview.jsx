// services/frontend/src/pages/Admin/Monitoring/MetricsOverview.jsx
/**
 * Composant d'affichage des métriques système
 * Graphiques et statistiques de performance
 */

import React, { useState, useEffect } from 'react';

const MetricsOverview = () => {
  const [metrics, setMetrics] = useState(null);
  const [period, setPeriod] = useState('1h');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadMetrics();
  }, [period]);

  const loadMetrics = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/v1/admin/monitoring/metrics?period=${period}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) throw new Error('Erreur chargement métriques');
      
      const data = await response.json();
      setMetrics(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const periods = [
    { value: '15m', label: '15 min' },
    { value: '1h', label: '1 heure' },
    { value: '6h', label: '6 heures' },
    { value: '24h', label: '24 heures' },
    { value: '7d', label: '7 jours' },
    { value: '30d', label: '30 jours' },
  ];

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
          onClick={loadMetrics}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Réessayer
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Sélecteur de période */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Métriques de performance</h3>
        <div className="flex gap-2">
          {periods.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`px-3 py-1 rounded text-sm transition ${
                period === p.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Métriques API */}
      <div className="bg-white rounded-lg shadow p-6">
        <h4 className="font-semibold mb-4 flex items-center gap-2">
          <span>🔌</span> API Backend
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <MetricBox
            label="Requêtes/s"
            value={metrics?.api?.requestsPerSecond?.toFixed(2) || 0}
            trend={metrics?.api?.requestsTrend}
          />
          <MetricBox
            label="Temps moyen"
            value={`${metrics?.api?.avgResponseTime?.toFixed(0) || 0}ms`}
            trend={metrics?.api?.responseTimeTrend}
            invertTrend
          />
          <MetricBox
            label="Taux d'erreur"
            value={`${metrics?.api?.errorRate?.toFixed(2) || 0}%`}
            trend={metrics?.api?.errorTrend}
            invertTrend
          />
          <MetricBox
            label="Requêtes totales"
            value={formatNumber(metrics?.api?.totalRequests || 0)}
          />
        </div>

        {/* Graphique temps de réponse */}
        <div className="mt-6">
          <div className="text-sm text-gray-500 mb-2">Temps de réponse (ms)</div>
          <SimpleChart data={metrics?.api?.responseTimeHistory || []} color="blue" />
        </div>
      </div>

      {/* Métriques Base de données */}
      <div className="bg-white rounded-lg shadow p-6">
        <h4 className="font-semibold mb-4 flex items-center gap-2">
          <span>🐘</span> Base de données
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <MetricBox
            label="Requêtes/s"
            value={metrics?.database?.queriesPerSecond?.toFixed(2) || 0}
          />
          <MetricBox
            label="Connexions actives"
            value={metrics?.database?.activeConnections || 0}
            max={metrics?.database?.maxConnections}
          />
          <MetricBox
            label="Temps moyen"
            value={`${metrics?.database?.avgQueryTime?.toFixed(1) || 0}ms`}
          />
          <MetricBox
            label="Cache hit ratio"
            value={`${metrics?.database?.cacheHitRatio?.toFixed(1) || 0}%`}
          />
        </div>
      </div>

      {/* Métriques Redis */}
      <div className="bg-white rounded-lg shadow p-6">
        <h4 className="font-semibold mb-4 flex items-center gap-2">
          <span>⚡</span> Redis
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <MetricBox
            label="Opérations/s"
            value={formatNumber(metrics?.redis?.opsPerSecond || 0)}
          />
          <MetricBox
            label="Clés"
            value={formatNumber(metrics?.redis?.keys || 0)}
          />
          <MetricBox
            label="Mémoire utilisée"
            value={formatBytes(metrics?.redis?.memoryUsed || 0)}
          />
          <MetricBox
            label="Hit rate"
            value={`${metrics?.redis?.hitRate?.toFixed(1) || 0}%`}
          />
        </div>
      </div>

      {/* Métriques Mail */}
      <div className="bg-white rounded-lg shadow p-6">
        <h4 className="font-semibold mb-4 flex items-center gap-2">
          <span>📧</span> Services Mail
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* SMTP */}
          <div>
            <div className="text-sm font-medium text-gray-600 mb-2">SMTP (Envoi)</div>
            <div className="grid grid-cols-2 gap-4">
              <MetricBox
                label="Messages envoyés"
                value={formatNumber(metrics?.smtp?.sent || 0)}
                small
              />
              <MetricBox
                label="En file"
                value={metrics?.smtp?.queued || 0}
                small
              />
              <MetricBox
                label="Rejetés"
                value={metrics?.smtp?.rejected || 0}
                small
              />
              <MetricBox
                label="Taux delivery"
                value={`${metrics?.smtp?.deliveryRate?.toFixed(1) || 0}%`}
                small
              />
            </div>
          </div>

          {/* IMAP */}
          <div>
            <div className="text-sm font-medium text-gray-600 mb-2">IMAP (Réception)</div>
            <div className="grid grid-cols-2 gap-4">
              <MetricBox
                label="Connexions actives"
                value={metrics?.imap?.connections || 0}
                small
              />
              <MetricBox
                label="Messages reçus"
                value={formatNumber(metrics?.imap?.received || 0)}
                small
              />
              <MetricBox
                label="Stockage utilisé"
                value={formatBytes(metrics?.imap?.storageUsed || 0)}
                small
              />
              <MetricBox
                label="BAL actives"
                value={metrics?.imap?.activeMailboxes || 0}
                small
              />
            </div>
          </div>
        </div>
      </div>

      {/* Top endpoints */}
      {metrics?.api?.topEndpoints && (
        <div className="bg-white rounded-lg shadow p-6">
          <h4 className="font-semibold mb-4">Top Endpoints (par temps de réponse)</h4>
          <div className="space-y-2">
            {metrics.api.topEndpoints.map((endpoint, index) => (
              <div key={index} className="flex items-center gap-4">
                <div className="w-8 text-center text-gray-500">{index + 1}</div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-mono ${
                      endpoint.method === 'GET' ? 'bg-green-100 text-green-700' :
                      endpoint.method === 'POST' ? 'bg-blue-100 text-blue-700' :
                      endpoint.method === 'PUT' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {endpoint.method}
                    </span>
                    <span className="font-mono text-sm">{endpoint.path}</span>
                  </div>
                  <div className="mt-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500"
                      style={{ width: `${Math.min((endpoint.avgTime / 1000) * 100, 100)}%` }}
                    />
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-medium">{endpoint.avgTime?.toFixed(0)}ms</div>
                  <div className="text-xs text-gray-500">{endpoint.count} appels</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// Composant box métrique
const MetricBox = ({ label, value, trend, invertTrend, max, small }) => {
  const getTrendColor = () => {
    if (trend === undefined || trend === null) return null;
    const positive = invertTrend ? trend < 0 : trend > 0;
    return positive ? 'text-green-600' : trend === 0 ? 'text-gray-500' : 'text-red-600';
  };

  const getTrendIcon = () => {
    if (trend === undefined || trend === null) return null;
    return trend > 0 ? '↑' : trend < 0 ? '↓' : '→';
  };

  return (
    <div className={`bg-gray-50 rounded-lg ${small ? 'p-3' : 'p-4'}`}>
      <div className={`text-gray-500 ${small ? 'text-xs' : 'text-sm'}`}>{label}</div>
      <div className="flex items-end gap-2 mt-1">
        <span className={`font-bold ${small ? 'text-lg' : 'text-2xl'}`}>{value}</span>
        {max && (
          <span className="text-sm text-gray-400">/ {max}</span>
        )}
        {trend !== undefined && trend !== null && (
          <span className={`text-sm ${getTrendColor()}`}>
            {getTrendIcon()} {Math.abs(trend).toFixed(1)}%
          </span>
        )}
      </div>
    </div>
  );
};

// Graphique simple en barres
const SimpleChart = ({ data, color }) => {
  if (!data || data.length === 0) {
    return (
      <div className="h-32 bg-gray-50 rounded flex items-center justify-center text-gray-400">
        Pas de données
      </div>
    );
  }

  const max = Math.max(...data.map(d => d.value), 1);
  const colorClass = color === 'blue' ? 'bg-blue-500' : 'bg-green-500';

  return (
    <div className="h-32 flex items-end gap-1">
      {data.map((point, index) => (
        <div
          key={index}
          className="flex-1 flex flex-col items-center"
          title={`${point.label}: ${point.value}`}
        >
          <div
            className={`w-full ${colorClass} rounded-t transition-all hover:opacity-75`}
            style={{ height: `${(point.value / max) * 100}%`, minHeight: '2px' }}
          />
        </div>
      ))}
    </div>
  );
};

// Helpers
const formatNumber = (num) => {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
};

const formatBytes = (bytes) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

export default MetricsOverview;