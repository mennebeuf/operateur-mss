// services/frontend/src/pages/Admin/Annuaire/Synchronisation.jsx
import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';

const Synchronisation = () => {
  const { refreshSyncStatus } = useOutletContext();
  const [syncHistory, setSyncHistory] = useState([]);
  const [syncStatus, setSyncStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, total: 0, limit: 10 });

  useEffect(() => {
    loadData();
  }, [pagination.page]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [statusRes, historyRes] = await Promise.all([
        fetch('/api/v1/annuaire/sync/status', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        }),
        fetch(`/api/v1/annuaire/sync/history?page=${pagination.page}&limit=${pagination.limit}`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        })
      ]);

      const [statusData, historyData] = await Promise.all([
        statusRes.json(),
        historyRes.json()
      ]);

      setSyncStatus(statusData);
      setSyncHistory(historyData.history || []);
      setPagination(prev => ({ ...prev, total: historyData.total || 0 }));
    } catch (error) {
      console.error('Erreur chargement données:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async (force = false) => {
    if (syncing) return;
    
    if (force && !confirm('Forcer la synchronisation va re-publier toutes les BAL. Continuer ?')) {
      return;
    }

    setSyncing(true);
    try {
      const response = await fetch('/api/v1/annuaire/sync', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ force })
      });

      const data = await response.json();
      
      if (response.ok) {
        alert(`Synchronisation ${force ? 'forcée ' : ''}lancée avec succès`);
        loadData();
        refreshSyncStatus();
      } else {
        alert(`Erreur: ${data.error || 'Échec de la synchronisation'}`);
      }
    } catch (error) {
      console.error('Erreur sync:', error);
      alert('Erreur lors de la synchronisation');
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Statut actuel */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Statut de synchronisation</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-600">Dernière synchronisation</p>
            <p className="text-lg font-semibold mt-1">
              {syncStatus?.last_sync 
                ? new Date(syncStatus.last_sync).toLocaleString('fr-FR')
                : 'Jamais'}
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-600">Statut</p>
            <p className="mt-1">
              <StatusBadge status={syncStatus?.status || 'unknown'} />
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-600">BAL synchronisées</p>
            <p className="text-lg font-semibold mt-1">{syncStatus?.synced_count || 0}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-600">Erreurs</p>
            <p className="text-lg font-semibold mt-1 text-red-600">{syncStatus?.error_count || 0}</p>
          </div>
        </div>

        <div className="mt-6 flex gap-4">
          <button
            onClick={() => handleSync(false)}
            disabled={syncing}
            className="bg-blue-600 text-white px-6 py-2 rounded-md font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            {syncing && <span className="animate-spin">⟳</span>}
            Synchroniser maintenant
          </button>
          <button
            onClick={() => handleSync(true)}
            disabled={syncing}
            className="bg-orange-600 text-white px-6 py-2 rounded-md font-medium hover:bg-orange-700 disabled:opacity-50"
          >
            Forcer la synchronisation
          </button>
        </div>
      </div>

      {/* Configuration */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Configuration</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Synchronisation automatique
            </label>
            <p className="text-sm text-gray-500 mb-2">
              La synchronisation automatique s'exécute quotidiennement à 02:00
            </p>
            <div className="flex items-center">
              <input
                type="checkbox"
                checked={syncStatus?.auto_sync_enabled ?? true}
                className="h-4 w-4 text-blue-600 rounded"
                readOnly
              />
              <span className="ml-2 text-sm">Activée</span>
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Prochaine exécution planifiée
            </label>
            <p className="text-lg font-medium">
              {syncStatus?.next_sync 
                ? new Date(syncStatus.next_sync).toLocaleString('fr-FR')
                : 'Demain à 02:00'}
            </p>
          </div>
        </div>
      </div>

      {/* Historique */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="p-6 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Historique des synchronisations</h2>
        </div>

        {syncHistory.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            Aucun historique de synchronisation
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Créations</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mises à jour</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Suppressions</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Erreurs</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Durée</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {syncHistory.map((sync) => (
                <tr key={sync.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm">
                    {new Date(sync.started_at).toLocaleString('fr-FR')}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded text-xs ${
                      sync.type === 'auto' ? 'bg-gray-100' : 
                      sync.type === 'force' ? 'bg-orange-100 text-orange-800' : 
                      'bg-blue-100 text-blue-800'
                    }`}>
                      {sync.type === 'auto' ? 'Automatique' : 
                       sync.type === 'force' ? 'Forcée' : 'Manuelle'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={sync.status} />
                  </td>
                  <td className="px-6 py-4 text-sm text-green-600">
                    +{sync.created_count || 0}
                  </td>
                  <td className="px-6 py-4 text-sm text-blue-600">
                    ~{sync.updated_count || 0}
                  </td>
                  <td className="px-6 py-4 text-sm text-red-600">
                    -{sync.deleted_count || 0}
                  </td>
                  <td className="px-6 py-4 text-sm text-red-600">
                    {sync.error_count || 0}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {sync.duration ? `${Math.round(sync.duration / 1000)}s` : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {pagination.total > pagination.limit && (
          <div className="px-6 py-4 border-t bg-gray-50 flex items-center justify-between">
            <div className="text-sm text-gray-600">
              Page {pagination.page} sur {Math.ceil(pagination.total / pagination.limit)}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
                disabled={pagination.page === 1}
                className="px-3 py-1 border rounded text-sm disabled:opacity-50"
              >
                Précédent
              </button>
              <button
                onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
                disabled={pagination.page * pagination.limit >= pagination.total}
                className="px-3 py-1 border rounded text-sm disabled:opacity-50"
              >
                Suivant
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const StatusBadge = ({ status }) => {
  const config = {
    success: { bg: 'bg-green-100', text: 'text-green-800', label: 'Succès' },
    running: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'En cours' },
    error: { bg: 'bg-red-100', text: 'text-red-800', label: 'Erreur' },
    partial: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Partiel' },
    unknown: { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Inconnu' },
  }[status] || { bg: 'bg-gray-100', text: 'text-gray-800', label: status };

  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
      {config.label}
    </span>
  );
};

export default Synchronisation;