// services/frontend/src/pages/Admin/Annuaire/Publications.jsx
import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

const Publications = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [publications, setPublications] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, total: 0, limit: 20 });
  const [loading, setLoading] = useState(true);
  const [selectedPub, setSelectedPub] = useState(null);
  const [retrying, setRetrying] = useState(null);

  const statusFilter = searchParams.get('status') || 'all';

  useEffect(() => {
    loadPublications();
  }, [statusFilter, pagination.page]);

  const loadPublications = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page,
        limit: pagination.limit,
        ...(statusFilter !== 'all' && { status: statusFilter })
      });

      const response = await fetch(`/api/v1/annuaire/publications?${params}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await response.json();

      setPublications(data.publications || []);
      setPagination(prev => ({ ...prev, total: data.total || 0 }));
    } catch (error) {
      console.error('Erreur chargement publications:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = async (pubId) => {
    setRetrying(pubId);
    try {
      await fetch(`/api/v1/annuaire/publications/${pubId}/retry`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      loadPublications();
    } catch (error) {
      console.error('Erreur retry:', error);
    } finally {
      setRetrying(null);
    }
  };

  const handlePublish = async (mailboxId) => {
    try {
      await fetch('/api/v1/annuaire/publish', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ mailboxId })
      });
      loadPublications();
    } catch (error) {
      console.error('Erreur publication:', error);
    }
  };

  const handleUnpublish = async (mailboxId) => {
    if (!confirm('Êtes-vous sûr de vouloir dépublier cette BAL de l\'annuaire ?')) return;
    
    try {
      await fetch(`/api/v1/annuaire/unpublish/${mailboxId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      loadPublications();
    } catch (error) {
      console.error('Erreur dépublication:', error);
    }
  };

  const statusOptions = [
    { value: 'all', label: 'Tous les statuts' },
    { value: 'pending', label: 'En attente' },
    { value: 'success', label: 'Succès' },
    { value: 'error', label: 'Erreur' },
    { value: 'retry', label: 'En retry' },
  ];

  return (
    <div className="space-y-6">
      {/* Filtres */}
      <div className="bg-white shadow rounded-lg p-4">
        <div className="flex flex-wrap gap-4 items-center">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Statut</label>
            <select
              value={statusFilter}
              onChange={(e) => setSearchParams({ status: e.target.value })}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              {statusOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          
          <div className="ml-auto">
            <button
              onClick={loadPublications}
              className="bg-gray-100 text-gray-700 px-4 py-2 rounded-md text-sm hover:bg-gray-200"
            >
              🔄 Actualiser
            </button>
          </div>
        </div>
      </div>

      {/* Tableau des publications */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : publications.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            Aucune publication trouvée
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">BAL</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Opération</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Retries</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {publications.map((pub) => (
                <tr key={pub.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900">{pub.email}</div>
                    <div className="text-sm text-gray-500">{pub.mailbox_type}</div>
                  </td>
                  <td className="px-6 py-4">
                    <OperationBadge operation={pub.operation} />
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={pub.status} />
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {new Date(pub.attempted_at).toLocaleString('fr-FR')}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {pub.retry_count || 0}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      <button
                        onClick={() => setSelectedPub(pub)}
                        className="text-blue-600 hover:underline text-sm"
                      >
                        Détails
                      </button>
                      {pub.status === 'error' && (
                        <button
                          onClick={() => handleRetry(pub.id)}
                          disabled={retrying === pub.id}
                          className="text-orange-600 hover:underline text-sm disabled:opacity-50"
                        >
                          {retrying === pub.id ? 'Retry...' : 'Retry'}
                        </button>
                      )}
                      {pub.status === 'success' && pub.operation !== 'DELETE' && (
                        <button
                          onClick={() => handleUnpublish(pub.mailbox_id)}
                          className="text-red-600 hover:underline text-sm"
                        >
                          Dépublier
                        </button>
                      )}
                    </div>
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
              {Math.min((pagination.page - 1) * pagination.limit + 1, pagination.total)} - {' '}
              {Math.min(pagination.page * pagination.limit, pagination.total)} sur {pagination.total}
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

      {/* Modal détails */}
      {selectedPub && (
        <PublicationDetailModal
          publication={selectedPub}
          onClose={() => setSelectedPub(null)}
        />
      )}
    </div>
  );
};

const StatusBadge = ({ status }) => {
  const config = {
    success: { bg: 'bg-green-100', text: 'text-green-800', label: 'Succès' },
    pending: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'En attente' },
    error: { bg: 'bg-red-100', text: 'text-red-800', label: 'Erreur' },
    retry: { bg: 'bg-orange-100', text: 'text-orange-800', label: 'Retry' },
  }[status] || { bg: 'bg-gray-100', text: 'text-gray-800', label: status };

  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
      {config.label}
    </span>
  );
};

const OperationBadge = ({ operation }) => {
  const config = {
    CREATE: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Création' },
    UPDATE: { bg: 'bg-purple-100', text: 'text-purple-800', label: 'Mise à jour' },
    DELETE: { bg: 'bg-red-100', text: 'text-red-800', label: 'Suppression' },
  }[operation] || { bg: 'bg-gray-100', text: 'text-gray-800', label: operation };

  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
      {config.label}
    </span>
  );
};

const PublicationDetailModal = ({ publication, onClose }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden">
        <div className="p-6 border-b">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Détails de la publication</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
          </div>
        </div>
        
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          <dl className="grid grid-cols-2 gap-4">
            <div>
              <dt className="text-sm font-medium text-gray-500">Email</dt>
              <dd className="mt-1 text-gray-900">{publication.email}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Opération</dt>
              <dd className="mt-1"><OperationBadge operation={publication.operation} /></dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Statut</dt>
              <dd className="mt-1"><StatusBadge status={publication.status} /></dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Date tentative</dt>
              <dd className="mt-1">{new Date(publication.attempted_at).toLocaleString('fr-FR')}</dd>
            </div>
            {publication.success_at && (
              <div>
                <dt className="text-sm font-medium text-gray-500">Date succès</dt>
                <dd className="mt-1">{new Date(publication.success_at).toLocaleString('fr-FR')}</dd>
              </div>
            )}
            <div>
              <dt className="text-sm font-medium text-gray-500">Tentatives</dt>
              <dd className="mt-1">{publication.retry_count || 0}</dd>
            </div>
          </dl>

          {publication.error_message && (
            <div className="mt-6">
              <h3 className="text-sm font-medium text-gray-500 mb-2">Message d'erreur</h3>
              <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-800">
                {publication.error_message}
                {publication.error_code && (
                  <span className="block mt-1 text-red-600">Code: {publication.error_code}</span>
                )}
              </div>
            </div>
          )}

          {publication.request_payload && (
            <div className="mt-6">
              <h3 className="text-sm font-medium text-gray-500 mb-2">Requête envoyée</h3>
              <pre className="bg-gray-100 rounded p-3 text-xs overflow-x-auto">
                {JSON.stringify(publication.request_payload, null, 2)}
              </pre>
            </div>
          )}

          {publication.response_data && (
            <div className="mt-6">
              <h3 className="text-sm font-medium text-gray-500 mb-2">Réponse reçue</h3>
              <pre className="bg-gray-100 rounded p-3 text-xs overflow-x-auto">
                {JSON.stringify(publication.response_data, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Publications;