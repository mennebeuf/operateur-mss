// services/frontend/src/pages/Admin/Audit/AuditLogs.jsx
/**
 * Logs d'audit - Administration
 */

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

import Loader from '../../../components/Common/Loader';
import { adminApi } from '../../../services/adminApi';

const AuditLogs = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, total: 0, pages: 1 });

  const [filters, setFilters] = useState({
    action: searchParams.get('action') || '',
    user: searchParams.get('user') || '',
    dateFrom: searchParams.get('from') || '',
    dateTo: searchParams.get('to') || ''
  });

  useEffect(() => {
    loadLogs();
  }, [searchParams]);

  const loadLogs = async () => {
    try {
      setLoading(true);
      const params = {
        page: searchParams.get('page') || 1,
        action: searchParams.get('action') || '',
        user: searchParams.get('user') || '',
        from: searchParams.get('from') || '',
        to: searchParams.get('to') || ''
      };
      const response = await adminApi.getAuditLogs(params);
      setLogs(response.data || []);
      setPagination(response.pagination || { page: 1, total: 0, pages: 1 });
    } catch (error) {
      console.error('Erreur chargement logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (name, value) => {
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const applyFilters = () => {
    const params = new URLSearchParams();
    if (filters.action) {
      params.set('action', filters.action);
    }
    if (filters.user) {
      params.set('user', filters.user);
    }
    if (filters.dateFrom) {
      params.set('from', filters.dateFrom);
    }
    if (filters.dateTo) {
      params.set('to', filters.dateTo);
    }
    params.set('page', '1');
    setSearchParams(params);
  };

  const clearFilters = () => {
    setFilters({ action: '', user: '', dateFrom: '', dateTo: '' });
    setSearchParams(new URLSearchParams());
  };

  const handleExport = async () => {
    try {
      const blob = await adminApi.exportAuditLogs(Object.fromEntries(searchParams));
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Erreur export:', error);
      alert("Erreur lors de l'export");
    }
  };

  const actionLabels = {
    login: { label: 'Connexion', icon: '🔑', color: 'bg-green-100 text-green-800' },
    logout: { label: 'Déconnexion', icon: '🚪', color: 'bg-gray-100 text-gray-800' },
    user_created: { label: 'Utilisateur créé', icon: '👤', color: 'bg-blue-100 text-blue-800' },
    user_updated: {
      label: 'Utilisateur modifié',
      icon: '✏️',
      color: 'bg-yellow-100 text-yellow-800'
    },
    user_deleted: { label: 'Utilisateur supprimé', icon: '🗑️', color: 'bg-red-100 text-red-800' },
    mailbox_created: { label: 'BAL créée', icon: '📬', color: 'bg-blue-100 text-blue-800' },
    mailbox_deleted: { label: 'BAL supprimée', icon: '🗑️', color: 'bg-red-100 text-red-800' },
    domain_created: { label: 'Domaine créé', icon: '🌐', color: 'bg-blue-100 text-blue-800' },
    domain_updated: {
      label: 'Domaine modifié',
      icon: '✏️',
      color: 'bg-yellow-100 text-yellow-800'
    },
    certificate_uploaded: {
      label: 'Certificat importé',
      icon: '🔐',
      color: 'bg-purple-100 text-purple-800'
    },
    certificate_renewed: {
      label: 'Certificat renouvelé',
      icon: '🔄',
      color: 'bg-green-100 text-green-800'
    },
    settings_changed: {
      label: 'Paramètres modifiés',
      icon: '⚙️',
      color: 'bg-gray-100 text-gray-800'
    }
  };

  const getActionInfo = action =>
    actionLabels[action] || {
      label: action,
      icon: '📌',
      color: 'bg-gray-100 text-gray-800'
    };

  return (
    <div className="p-6 space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Logs d'audit</h1>
          <p className="text-gray-500">Historique des actions et événements</p>
        </div>
        <button
          onClick={handleExport}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          📥 Exporter
        </button>
      </div>

      {/* Filtres */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Action</label>
            <select
              value={filters.action}
              onChange={e => handleFilterChange('action', e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Toutes les actions</option>
              {Object.entries(actionLabels).map(([key, { label }]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Utilisateur</label>
            <input
              type="text"
              value={filters.user}
              onChange={e => handleFilterChange('user', e.target.value)}
              placeholder="Email ou nom"
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date début</label>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={e => handleFilterChange('dateFrom', e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date fin</label>
            <input
              type="date"
              value={filters.dateTo}
              onChange={e => handleFilterChange('dateTo', e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-end gap-2">
            <button
              onClick={applyFilters}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Filtrer
            </button>
            <button onClick={clearFilters} className="px-4 py-2 border rounded-lg hover:bg-gray-50">
              ✕
            </button>
          </div>
        </div>
      </div>

      {/* Liste des logs */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-8">
            <Loader message="Chargement des logs..." />
          </div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center text-gray-500">Aucun log trouvé pour ces critères</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Action
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Utilisateur
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Détails
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    IP
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {logs.map(log => {
                  const actionInfo = getActionInfo(log.action);
                  return (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(log.created_at).toLocaleString('fr-FR')}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${actionInfo.color}`}
                        >
                          <span>{actionInfo.icon}</span>
                          {actionInfo.label}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-medium text-gray-900">{log.user_name || '-'}</p>
                        <p className="text-xs text-gray-500">{log.user_email}</p>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                        {log.details || '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 font-mono">
                        {log.ip_address || '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="px-6 py-4 border-t flex items-center justify-between">
            <p className="text-sm text-gray-500">{pagination.total} entrée(s) au total</p>
            <div className="flex gap-2">
              {Array.from({ length: Math.min(pagination.pages, 5) }, (_, i) => i + 1).map(page => (
                <button
                  key={page}
                  onClick={() => {
                    const params = new URLSearchParams(searchParams);
                    params.set('page', page.toString());
                    setSearchParams(params);
                  }}
                  className={`px-3 py-1 rounded ${
                    pagination.page === page
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 hover:bg-gray-200'
                  }`}
                >
                  {page}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AuditLogs;
