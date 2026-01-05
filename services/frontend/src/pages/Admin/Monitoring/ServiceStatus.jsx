// services/frontend/src/pages/Admin/Monitoring/ServiceStatus.jsx
/**
 * Composant de statut détaillé des services
 * Affiche l'état de chaque conteneur/service
 */

import React, { useState, useEffect } from 'react';

const ServiceStatus = () => {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedService, setSelectedService] = useState(null);

  useEffect(() => {
    loadServices();
  }, []);

  const loadServices = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/v1/admin/monitoring/services', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) throw new Error('Erreur chargement services');
      
      const data = await response.json();
      setServices(data.services || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRestart = async (serviceName) => {
    if (!confirm(`Redémarrer le service ${serviceName} ?`)) return;
    
    try {
      const response = await fetch(`/api/v1/admin/monitoring/services/${serviceName}/restart`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) throw new Error('Erreur redémarrage');
      
      alert(`Service ${serviceName} redémarré`);
      loadServices();
    } catch (err) {
      alert(`Erreur : ${err.message}`);
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
          onClick={loadServices}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Réessayer
        </button>
      </div>
    );
  }

  const getStatusBadge = (status) => {
    const badges = {
      running: 'bg-green-100 text-green-800',
      healthy: 'bg-green-100 text-green-800',
      starting: 'bg-yellow-100 text-yellow-800',
      restarting: 'bg-yellow-100 text-yellow-800',
      stopped: 'bg-gray-100 text-gray-800',
      exited: 'bg-red-100 text-red-800',
      unhealthy: 'bg-red-100 text-red-800',
      dead: 'bg-red-100 text-red-800',
    };
    return badges[status?.toLowerCase()] || 'bg-gray-100 text-gray-800';
  };

  const getServiceIcon = (name) => {
    const icons = {
      api: '🔌',
      frontend: '🌐',
      postgres: '🐘',
      postgresql: '🐘',
      database: '🐘',
      redis: '⚡',
      postfix: '📤',
      smtp: '📤',
      dovecot: '📥',
      imap: '📥',
      nginx: '🔀',
      prometheus: '📊',
      grafana: '📈',
      alertmanager: '🔔',
    };
    const key = Object.keys(icons).find(k => name.toLowerCase().includes(k));
    return icons[key] || '📦';
  };

  return (
    <div className="space-y-6">
      {/* Résumé */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <SummaryCard
          title="Total services"
          value={services.length}
          icon="📦"
          color="blue"
        />
        <SummaryCard
          title="En cours"
          value={services.filter(s => s.status === 'running' || s.status === 'healthy').length}
          icon="✅"
          color="green"
        />
        <SummaryCard
          title="En erreur"
          value={services.filter(s => ['exited', 'dead', 'unhealthy'].includes(s.status?.toLowerCase())).length}
          icon="❌"
          color="red"
        />
        <SummaryCard
          title="En transition"
          value={services.filter(s => ['starting', 'restarting'].includes(s.status?.toLowerCase())).length}
          icon="🔄"
          color="yellow"
        />
      </div>

      {/* Liste des services */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="p-4 border-b bg-gray-50">
          <h3 className="text-lg font-semibold">Services</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Service</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Uptime</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">CPU</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mémoire</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ports</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {services.map((service) => (
                <tr
                  key={service.name}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => setSelectedService(service)}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{getServiceIcon(service.name)}</span>
                      <div>
                        <div className="font-medium">{service.name}</div>
                        <div className="text-sm text-gray-500">{service.image || '-'}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(service.status)}`}>
                      {service.status || 'unknown'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatUptime(service.uptime)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${
                            (service.cpu || 0) > 80 ? 'bg-red-500' :
                            (service.cpu || 0) > 50 ? 'bg-yellow-500' :
                            'bg-green-500'
                          }`}
                          style={{ width: `${service.cpu || 0}%` }}
                        />
                      </div>
                      <span className="text-sm text-gray-500">{service.cpu?.toFixed(1) || 0}%</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {service.memory ? formatBytes(service.memory) : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {service.ports?.join(', ') || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRestart(service.name);
                        }}
                        className="px-2 py-1 text-xs bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200"
                        title="Redémarrer"
                      >
                        🔄
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedService(service);
                        }}
                        className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                        title="Détails"
                      >
                        🔍
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal détails service */}
      {selectedService && (
        <ServiceDetailModal
          service={selectedService}
          onClose={() => setSelectedService(null)}
          onRestart={() => handleRestart(selectedService.name)}
        />
      )}
    </div>
  );
};

// Composant carte résumé
const SummaryCard = ({ title, value, icon, color }) => {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-700',
    green: 'bg-green-50 text-green-700',
    red: 'bg-red-50 text-red-700',
    yellow: 'bg-yellow-50 text-yellow-700',
  };

  return (
    <div className={`rounded-lg p-4 ${colorClasses[color]}`}>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-medium">{title}</div>
          <div className="text-3xl font-bold mt-1">{value}</div>
        </div>
        <span className="text-3xl">{icon}</span>
      </div>
    </div>
  );
};

// Modal détails service
const ServiceDetailModal = ({ service, onClose, onRestart }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
        <div className="p-4 border-b flex justify-between items-center bg-gray-50">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <span className="text-2xl">{getServiceIcon(service.name)}</span>
            {service.name}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl"
          >
            ×
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          <div className="grid grid-cols-2 gap-4">
            <DetailRow label="Status" value={service.status} />
            <DetailRow label="Image" value={service.image} />
            <DetailRow label="Uptime" value={formatUptime(service.uptime)} />
            <DetailRow label="CPU" value={`${service.cpu?.toFixed(2) || 0}%`} />
            <DetailRow label="Mémoire" value={service.memory ? formatBytes(service.memory) : '-'} />
            <DetailRow label="Ports" value={service.ports?.join(', ') || '-'} />
            <DetailRow label="Réseau" value={service.network || '-'} />
            <DetailRow label="Créé le" value={service.created ? new Date(service.created).toLocaleString('fr-FR') : '-'} />
          </div>

          {service.healthCheck && (
            <div className="mt-6">
              <h4 className="font-medium mb-2">Health Check</h4>
              <div className="bg-gray-50 rounded p-3 text-sm font-mono">
                {service.healthCheck}
              </div>
            </div>
          )}

          {service.logs && service.logs.length > 0 && (
            <div className="mt-6">
              <h4 className="font-medium mb-2">Derniers logs</h4>
              <div className="bg-gray-900 text-green-400 rounded p-3 text-xs font-mono max-h-48 overflow-y-auto">
                {service.logs.map((log, i) => (
                  <div key={i}>{log}</div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t bg-gray-50 flex justify-end gap-2">
          <button
            onClick={onRestart}
            className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600"
          >
            🔄 Redémarrer
          </button>
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

const DetailRow = ({ label, value }) => (
  <div>
    <div className="text-sm text-gray-500">{label}</div>
    <div className="font-medium">{value || '-'}</div>
  </div>
);

// Helpers
const formatUptime = (seconds) => {
  if (!seconds) return '-';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (days > 0) return `${days}j ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};

const formatBytes = (bytes) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const getServiceIcon = (name) => {
  const icons = {
    api: '🔌', frontend: '🌐', postgres: '🐘', redis: '⚡',
    postfix: '📤', dovecot: '📥', nginx: '🔀', prometheus: '📊',
    grafana: '📈', alertmanager: '🔔',
  };
  const key = Object.keys(icons).find(k => name.toLowerCase().includes(k));
  return icons[key] || '📦';
};

export default ServiceStatus;