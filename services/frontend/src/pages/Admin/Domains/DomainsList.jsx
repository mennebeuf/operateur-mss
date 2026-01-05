// services/frontend/src/pages/Admin/Domains/DomainsList.jsx
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';

const DomainsList = () => {
  const navigate = useNavigate();
  const [domains, setDomains] = useState([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 });

  useEffect(() => {
    loadDomains();
  }, [filter, pagination.page]);

  const loadDomains = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page,
        limit: 20,
        ...(filter !== 'all' && { status: filter }),
        ...(search && { search })
      });
      
      const response = await fetch(`/api/v1/admin/domains?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      
      if (data.success) {
        setDomains(data.data.domains);
        setPagination(prev => ({
          ...prev,
          total: data.data.pagination.total,
          totalPages: data.data.pagination.totalPages
        }));
      }
    } catch (error) {
      console.error('Erreur chargement domaines:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setPagination(prev => ({ ...prev, page: 1 }));
    loadDomains();
  };

  const handleSuspend = async (domainId) => {
    if (!window.confirm('Êtes-vous sûr de vouloir suspendre ce domaine ? Tous les utilisateurs perdront l\'accès.')) {
      return;
    }
    
    try {
      const response = await fetch(`/api/v1/admin/domains/${domainId}/suspend`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        loadDomains();
      }
    } catch (error) {
      console.error('Erreur suspension:', error);
    }
  };

  const handleActivate = async (domainId) => {
    try {
      const response = await fetch(`/api/v1/admin/domains/${domainId}/activate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        loadDomains();
      }
    } catch (error) {
      console.error('Erreur activation:', error);
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      active: 'bg-green-100 text-green-800',
      suspended: 'bg-red-100 text-red-800',
      pending: 'bg-yellow-100 text-yellow-800'
    };
    const labels = {
      active: 'Actif',
      suspended: 'Suspendu',
      pending: 'En attente'
    };
    return (
      <span className={`px-2 py-1 text-xs font-semibold rounded ${styles[status] || 'bg-gray-100'}`}>
        {labels[status] || status}
      </span>
    );
  };

  const filteredDomains = domains.filter(domain =>
    domain.domain_name.toLowerCase().includes(search.toLowerCase()) ||
    domain.organization_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Gestion des Domaines</h1>
        <button
          onClick={() => navigate('/admin/domains/create')}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition"
        >
          + Nouveau domaine
        </button>
      </div>

      <div className="bg-white shadow rounded-lg p-4">
        <div className="flex flex-col md:flex-row gap-4 mb-4">
          <form onSubmit={handleSearch} className="flex-1">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher par nom ou organisation..."
              className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </form>
          
          <select
            value={filter}
            onChange={(e) => { setFilter(e.target.value); setPagination(p => ({ ...p, page: 1 })); }}
            className="px-4 py-2 border rounded-md"
          >
            <option value="all">Tous les statuts</option>
            <option value="active">Actifs</option>
            <option value="pending">En attente</option>
            <option value="suspended">Suspendus</option>
          </select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Domaine</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">FINESS</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">BAL</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Utilisateurs</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Statut</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredDomains.map(domain => (
                  <tr key={domain.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{domain.domain_name}</div>
                      <div className="text-sm text-gray-500">{domain.organization_name}</div>
                      <div className="text-xs text-gray-400">
                        Créé le {new Date(domain.created_at).toLocaleDateString('fr-FR')}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {domain.finess_juridique}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm">
                        {domain.mailboxes_count} / {domain.quotas?.max_mailboxes || '∞'}
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                        <div
                          className="bg-blue-600 h-2 rounded-full"
                          style={{
                            width: `${Math.min((domain.mailboxes_count / (domain.quotas?.max_mailboxes || 100)) * 100, 100)}%`
                          }}
                        />
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {domain.users_count || 0}
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(domain.status)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <Link
                          to={`/admin/domains/${domain.id}`}
                          className="text-blue-600 hover:underline text-sm"
                        >
                          Voir
                        </Link>
                        <Link
                          to={`/admin/domains/${domain.id}/edit`}
                          className="text-gray-600 hover:underline text-sm"
                        >
                          Éditer
                        </Link>
                        {domain.status === 'active' ? (
                          <button
                            onClick={() => handleSuspend(domain.id)}
                            className="text-red-600 hover:underline text-sm"
                          >
                            Suspendre
                          </button>
                        ) : domain.status === 'suspended' ? (
                          <button
                            onClick={() => handleActivate(domain.id)}
                            className="text-green-600 hover:underline text-sm"
                          >
                            Activer
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pagination.totalPages > 1 && (
          <div className="flex justify-center gap-2 mt-4">
            <button
              onClick={() => setPagination(p => ({ ...p, page: Math.max(1, p.page - 1) }))}
              disabled={pagination.page === 1}
              className="px-3 py-1 border rounded disabled:opacity-50"
            >
              Précédent
            </button>
            <span className="px-3 py-1">
              Page {pagination.page} / {pagination.totalPages}
            </span>
            <button
              onClick={() => setPagination(p => ({ ...p, page: Math.min(p.totalPages, p.page + 1) }))}
              disabled={pagination.page === pagination.totalPages}
              className="px-3 py-1 border rounded disabled:opacity-50"
            >
              Suivant
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default DomainsList;