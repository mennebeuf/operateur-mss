// services/frontend/src/pages/Admin/Monitoring/AlertsList.jsx
/**
 * Composant de gestion des alertes système
 * Affiche et gère les alertes actives et historiques
 */

import React, { useState, useEffect } from 'react';

const AlertsList = () => {
  const [alerts, setAlerts] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedAlert, setSelectedAlert] = useState(null);

  useEffect(() => {
    loadAlerts();
  }, [filter]);

  const loadAlerts = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filter !== 'all') params.append('status', filter);
      
      const response = await fetch(`/api/v1/admin/monitoring/alerts?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) throw new Error('Erreur chargement alertes');
      
      const data = await response.json();
      setAlerts(data.alerts || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAcknowledge = async (alertId) => {
    try {
      const response = await fetch(`/api/v1/admin/monitoring/alerts/${alertId}/acknowledge`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) throw new Error('Erreur acquittement');
      
      loadAlerts();
    } catch (err) {
      alert(`Erreur : ${err.message}`);
    }
  };

  const handleResolve = async (alertId) => {
    try {
      const response = await fetch(`/api/v1/admin/monitoring/alerts/${alertId}/resolve`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) throw new Error('Erreur résolution');
      
      loadAlerts();
    } catch (err) {
      alert(`Erreur : ${err.message}`);
    }
  };

  const getSeverityConfig = (severity) => {
    const configs = {
      critical: {
        icon: '🔴',
        bg: 'bg-red-50',
        border: 'border-red-200',
        text: 'text-red-800',
        badge: 'bg-red-100 text-red-800',
      },
      warning: {
        icon: '🟡',
        bg: 'bg-yellow-50',
        border: 'border-yellow-200',
        text: 'text-yellow-800',
        badge: 'bg-yellow-100 text-yellow-800',
      },
      info: {
        icon: '🔵',
        bg: 'bg-blue-50',
        border: 'border-blue-200',
        text: 'text-blue-800',
        badge: 'bg-blue-100 text-blue-800',
      },
    };
    return configs[severity] || configs.info;
  };

  const getStatusConfig = (status) => {
    const configs = {
      firing: { label: 'Actif', class: 'bg-red-100 text-red-800' },
      acknowledged: { label: 'Acquitté', class: 'bg-yellow-100 text-yellow-800' },
      resolved: { label: 'Résolu', class: 'bg-green-100 text-green-800' },
    };
    return configs[status] || { label: status, class: 'bg-gray-100 text-gray-800' };
  };

  const filters = [
    { value: 'all', label: 'Toutes', count: alerts.length },
    { value: 'firing', label: 'Actives', count: alerts.filter(a => a.status === 'firing').length },
    { value: 'acknowledged', label: 'Acquittées', count: alerts.filter(a => a.status === 'acknowledged').length },
    { value: 'resolved', label: 'Résolues', count: alerts.filter(a => a.status === 'resolved').length },
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
          onClick={loadAlerts}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Réessayer
        </button>
      </div>
    );
  }

  const activeAlerts = alerts.filter(a => a.status === 'firing');
  const criticalCount = activeAlerts.filter(a => a.severity === 'critical').length;

  return (
    <div className="space-y-6">
      {/* Résumé */}
      {activeAlerts.length > 0 && (
        <div className={`rounded-lg p-4 ${
          criticalCount > 0 ? 'bg-red-50 border border-red-200' : 'bg-yellow-50 border border-yellow-200'
        }`}>
          <div className="flex items-center gap-3">
            <span className="text-3xl">{criticalCount > 0 ? '🚨' : '⚠️'}</span>
            <div>
              <div className="font-semibold">
                {activeAlerts.length} alerte(s) active(s)
              </div>
              {criticalCount > 0 && (
                <div className="text-sm text-red-700">
                  dont {criticalCount} critique(s) nécessitant une attention immédiate
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Filtres */}
      <div className="flex gap-2">
        {filters.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`px-4 py-2 rounded-lg transition flex items-center gap-2 ${
              filter === f.value
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {f.label}
            <span className={`px-2 py-0.5 rounded-full text-xs ${
              filter === f.value ? 'bg-blue-500' : 'bg-gray-200'
            }`}>
              {f.count}
            </span>
          </button>
        ))}
      </div>

      {/* Liste des alertes */}
      {alerts.length === 0 ? (
        <div className="bg-green-50 border border-green-200 rounded-lg p-8 text-center">
          <span className="text-5xl mb-4 block">✅</span>
          <div className="text-green-800 font-medium">Aucune alerte</div>
          <div className="text-sm text-green-600 mt-1">Tous les systèmes fonctionnent normalement</div>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => {
            const severityConfig = getSeverityConfig(alert.severity);
            const statusConfig = getStatusConfig(alert.status);
            
            return (
              <div
                key={alert.id}
                className={`rounded-lg border p-4 ${severityConfig.bg} ${severityConfig.border} cursor-pointer hover:shadow-md transition`}
                onClick={() => setSelectedAlert(alert)}
              >
                <div className="flex items-start gap-4">
                  <span className="text-2xl">{severityConfig.icon}</span>
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${severityConfig.badge}`}>
                        {alert.severity?.toUpperCase()}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusConfig.class}`}>
                        {statusConfig.label}
                      </span>
                      <span className="text-xs text-gray-500">
                        {alert.source}
                      </span>
                    </div>
                    
                    <div className="font-medium">{alert.name}</div>
                    <div className="text-sm text-gray-600 mt-1">{alert.message}</div>
                    
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                      <span>Déclenchée : {new Date(alert.startedAt).toLocaleString('fr-FR')}</span>
                      {alert.acknowledgedAt && (
                        <span>Acquittée : {new Date(alert.acknowledgedAt).toLocaleString('fr-FR')}</span>
                      )}
                      {alert.resolvedAt && (
                        <span>Résolue : {new Date(alert.resolvedAt).toLocaleString('fr-FR')}</span>
                      )}
                    </div>
                  </div>
                  
                  {/* Actions */}
                  {alert.status === 'firing' && (
                    <div className="flex gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAcknowledge(alert.id);
                        }}
                        className="px-3 py-1 bg-yellow-500 text-white rounded text-sm hover:bg-yellow-600"
                      >
                        Acquitter
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleResolve(alert.id);
                        }}
                        className="px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600"
                      >
                        Résoudre
                      </button>
                    </div>
                  )}
                  {alert.status === 'acknowledged' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleResolve(alert.id);
                      }}
                      className="px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600"
                    >
                      Résoudre
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal détails alerte */}
      {selectedAlert && (
        <AlertDetailModal
          alert={selectedAlert}
          onClose={() => setSelectedAlert(null)}
          onAcknowledge={() => {
            handleAcknowledge(selectedAlert.id);
            setSelectedAlert(null);
          }}
          onResolve={() => {
            handleResolve(selectedAlert.id);
            setSelectedAlert(null);
          }}
        />
      )}
    </div>
  );
};

// Modal détails alerte
const AlertDetailModal = ({ alert, onClose, onAcknowledge, onResolve }) => {
  const getSeverityConfig = (severity) => {
    const configs = {
      critical: { icon: '🔴', color: 'red' },
      warning: { icon: '🟡', color: 'yellow' },
      info: { icon: '🔵', color: 'blue' },
    };
    return configs[severity] || configs.info;
  };

  const severityConfig = getSeverityConfig(alert.severity);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
        <div className={`p-4 border-b bg-${severityConfig.color}-50`}>
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <span className="text-3xl">{severityConfig.icon}</span>
              <div>
                <div className="font-semibold text-lg">{alert.name}</div>
                <div className="text-sm text-gray-500">{alert.source}</div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-2xl"
            >
              ×
            </button>
          </div>
        </div>
        
        <div className="p-6 overflow-y-auto max-h-[50vh]">
          <div className="space-y-4">
            <div>
              <div className="text-sm text-gray-500">Message</div>
              <div className="mt-1">{alert.message}</div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-gray-500">Sévérité</div>
                <div className="mt-1 font-medium capitalize">{alert.severity}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Status</div>
                <div className="mt-1 font-medium capitalize">{alert.status}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Déclenchée</div>
                <div className="mt-1">{new Date(alert.startedAt).toLocaleString('fr-FR')}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Durée</div>
                <div className="mt-1">{formatDuration(new Date() - new Date(alert.startedAt))}</div>
              </div>
            </div>

            {alert.labels && Object.keys(alert.labels).length > 0 && (
              <div>
                <div className="text-sm text-gray-500 mb-2">Labels</div>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(alert.labels).map(([key, value]) => (
                    <span key={key} className="px-2 py-1 bg-gray-100 rounded text-sm">
                      <span className="text-gray-500">{key}:</span> {value}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {alert.annotations && (
              <div>
                <div className="text-sm text-gray-500 mb-2">Annotations</div>
                <div className="bg-gray-50 rounded p-3 text-sm">
                  {Object.entries(alert.annotations).map(([key, value]) => (
                    <div key={key} className="mb-1">
                      <span className="font-medium">{key}:</span> {value}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {alert.runbook && (
              <div>
                <div className="text-sm text-gray-500 mb-2">Runbook</div>
                <a
                  href={alert.runbook}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  Voir les instructions de résolution
                </a>
              </div>
            )}
          </div>
        </div>

        <div className="p-4 border-t bg-gray-50 flex justify-end gap-2">
          {alert.status === 'firing' && (
            <>
              <button
                onClick={onAcknowledge}
                className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600"
              >
                Acquitter
              </button>
              <button
                onClick={onResolve}
                className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
              >
                Résoudre
              </button>
            </>
          )}
          {alert.status === 'acknowledged' && (
            <button
              onClick={onResolve}
              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
            >
              Résoudre
            </button>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};

// Helper
const formatDuration = (ms) => {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}j ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${seconds}s`;
};

export default AlertsList;