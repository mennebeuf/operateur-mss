// services/frontend/src/pages/Admin/Certificates/CertificatesList.jsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const CertificatesList = () => {
  const [certificates, setCertificates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    type: '',
    status: '',
    expiringDays: ''
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  });

  useEffect(() => {
    loadCertificates();
  }, [filters, pagination.page]);

  const loadCertificates = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page,
        limit: pagination.limit,
        ...(filters.type && { type: filters.type }),
        ...(filters.status && { status: filters.status }),
        ...(filters.expiringDays && { expiringDays: filters.expiringDays })
      });

      const response = await fetch(`/api/v1/certificates?${params}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();

      if (data.success) {
        setCertificates(data.data.certificates);
        setPagination(prev => ({
          ...prev,
          total: data.data.pagination.total,
          totalPages: data.data.pagination.totalPages
        }));
      }
    } catch (error) {
      console.error('Erreur chargement certificats:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = status => {
    const styles = {
      active: 'bg-green-100 text-green-800',
      expired: 'bg-red-100 text-red-800',
      revoked: 'bg-gray-100 text-gray-800',
      pending: 'bg-yellow-100 text-yellow-800'
    };
    const labels = {
      active: 'Actif',
      expired: 'Expiré',
      revoked: 'Révoqué',
      pending: 'En attente'
    };
    return (
      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${styles[status]}`}>
        {labels[status]}
      </span>
    );
  };

  const getTypeBadge = type => {
    const labels = {
      SERV_SSL: 'Serveur SSL',
      ORG_AUTH_CLI: 'Auth. Client Org.',
      ORG_SIGN: 'Signature Org.',
      ORG_CONF: 'Confidentialité Org.'
    };
    return labels[type] || type;
  };

  const getExpirationStatus = daysRemaining => {
    if (daysRemaining < 0) {
      return <span className="text-red-600 font-semibold">Expiré</span>;
    }
    if (daysRemaining <= 30) {
      return <span className="text-red-600 font-semibold">{daysRemaining} jours</span>;
    }
    if (daysRemaining <= 90) {
      return <span className="text-yellow-600">{daysRemaining} jours</span>;
    }
    return <span className="text-green-600">{daysRemaining} jours</span>;
  };

  const handleRevoke = async certId => {
    if (
      !confirm('Êtes-vous sûr de vouloir révoquer ce certificat ? Cette action est irréversible.')
    ) {
      return;
    }

    try {
      const response = await fetch(`/api/v1/certificates/${certId}/revoke`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ reason: 'cessationOfOperation' })
      });

      if (response.ok) {
        loadCertificates();
      } else {
        const data = await response.json();
        alert('Erreur: ' + data.error);
      }
    } catch (error) {
      alert('Erreur lors de la révocation');
    }
  };

  if (loading && certificates.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Gestion des Certificats IGC Santé</h1>
        <Link
          to="/admin/certificates/upload"
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md flex items-center gap-2"
        >
          <span>📤</span> Importer un certificat
        </Link>
      </div>

      {/* Filtres */}
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label htmlFor="filter-cert-type" className="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <select
              id="filter-cert-type"
              value={filters.type}
              onChange={e => setFilters({ ...filters, type: e.target.value })}
              className="w-full border rounded-md px-3 py-2"
            >
              <option value="">Tous les types</option>
              <option value="SERV_SSL">Serveur SSL</option>
              <option value="ORG_AUTH_CLI">Auth. Client Organisation</option>
              <option value="ORG_SIGN">Signature Organisation</option>
              <option value="ORG_CONF">Confidentialité Organisation</option>
            </select>
          </div>
          <div>
            <label htmlFor="filter-cert-status" className="block text-sm font-medium text-gray-700 mb-1">Statut</label>
            <select
              id="filter-cert-status"
              value={filters.status}
              onChange={e => setFilters({ ...filters, status: e.target.value })}
              className="w-full border rounded-md px-3 py-2"
            >
              <option value="">Tous les statuts</option>
              <option value="active">Actif</option>
              <option value="expired">Expiré</option>
              <option value="revoked">Révoqué</option>
              <option value="pending">En attente</option>
            </select>
          </div>
          <div>
            <label htmlFor="filter-cert-expiring" className="block text-sm font-medium text-gray-700 mb-1">Expiration</label>
            <select
              id="filter-cert-expiring"
              value={filters.expiringDays}
              onChange={e => setFilters({ ...filters, expiringDays: e.target.value })}
              className="w-full border rounded-md px-3 py-2"
            >
              <option value="">Toutes les dates</option>
              <option value="30">Expire dans 30 jours</option>
              <option value="60">Expire dans 60 jours</option>
              <option value="90">Expire dans 90 jours</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => setFilters({ type: '', status: '', expiringDays: '' })}
              className="text-gray-600 hover:text-gray-900 px-4 py-2"
            >
              Réinitialiser
            </button>
          </div>
        </div>
      </div>

      {/* Alertes certificats expirant */}
      {certificates.some(c => c.daysRemaining <= 30 && c.status === 'active') && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
          <div className="flex">
            <span className="text-2xl mr-3">⚠️</span>
            <div>
              <h3 className="text-sm font-medium text-yellow-800">Certificats expirant bientôt</h3>
              <p className="text-sm text-yellow-700 mt-1">
                {certificates.filter(c => c.daysRemaining <= 30 && c.status === 'active').length}{' '}
                certificat(s) expire(nt) dans les 30 prochains jours. Pensez à les renouveler.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tableau des certificats */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Certificat
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Statut
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Validité
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Expiration
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {certificates.map(cert => (
              <tr key={cert.id} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  <div className="flex items-center">
                    <span className="text-2xl mr-3">🔐</span>
                    <div>
                      <div className="font-medium text-gray-900">
                        {cert.subject?.commonName || cert.subject?.CN || 'N/A'}
                      </div>
                      <div className="text-sm text-gray-500">
                        {cert.serialNumber?.substring(0, 16)}...
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm text-gray-900">{getTypeBadge(cert.type)}</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(cert.status)}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <div>{new Date(cert.validFrom).toLocaleDateString('fr-FR')}</div>
                  <div>→ {new Date(cert.validTo).toLocaleDateString('fr-FR')}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {getExpirationStatus(cert.daysRemaining)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                  <Link
                    to={`/admin/certificates/${cert.id}`}
                    className="text-blue-600 hover:text-blue-900"
                  >
                    Détails
                  </Link>
                  {cert.status === 'active' && (
                    <>
                      <Link
                        to={`/admin/certificates/${cert.id}/renew`}
                        className="text-green-600 hover:text-green-900"
                      >
                        Renouveler
                      </Link>
                      <button
                        onClick={() => handleRevoke(cert.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Révoquer
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {certificates.length === 0 && (
          <div className="text-center py-12">
            <span className="text-4xl mb-4 block">🔐</span>
            <p className="text-gray-500">Aucun certificat trouvé</p>
            <Link
              to="/admin/certificates/upload"
              className="text-blue-600 hover:underline mt-2 inline-block"
            >
              Importer un premier certificat
            </Link>
          </div>
        )}

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="bg-white px-4 py-3 border-t flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Page {pagination.page} sur {pagination.totalPages} ({pagination.total} certificats)
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
                disabled={pagination.page === 1}
                className="px-3 py-1 border rounded disabled:opacity-50"
              >
                Précédent
              </button>
              <button
                onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
                disabled={pagination.page === pagination.totalPages}
                className="px-3 py-1 border rounded disabled:opacity-50"
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

export default CertificatesList;
