// services/frontend/src/pages/Admin/Domains/DomainDetail.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';

const DomainDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [domain, setDomain] = useState(null);
  const [stats, setStats] = useState(null);
  const [dnsRecords, setDnsRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [verifyingDns, setVerifyingDns] = useState(false);

  useEffect(() => {
    loadDomain();
    loadStats();
    loadDnsRecords();
  }, [id]);

  const loadDomain = async () => {
    try {
      const response = await fetch(`/api/v1/admin/domains/${id}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await response.json();
      if (data.success) {
        setDomain(data.data);
      }
    } catch (error) {
      console.error('Erreur chargement domaine:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await fetch(`/api/v1/admin/domains/${id}/statistics`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await response.json();
      if (data.success) {
        setStats(data.data);
      }
    } catch (error) {
      console.error('Erreur chargement stats:', error);
    }
  };

  const loadDnsRecords = async () => {
    try {
      const response = await fetch(`/api/v1/admin/domains/${id}/dns-records`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await response.json();
      if (data.success) {
        setDnsRecords(data.data.records || []);
      }
    } catch (error) {
      console.error('Erreur chargement DNS:', error);
    }
  };

  const handleVerifyDns = async () => {
    setVerifyingDns(true);
    try {
      const response = await fetch(`/api/v1/admin/domains/${id}/verify-dns`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await response.json();
      if (data.success) {
        loadDomain();
        loadDnsRecords();
      }
    } catch (error) {
      console.error('Erreur vérification DNS:', error);
    } finally {
      setVerifyingDns(false);
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      active: 'bg-green-100 text-green-800',
      suspended: 'bg-red-100 text-red-800',
      pending: 'bg-yellow-100 text-yellow-800'
    };
    const labels = { active: 'Actif', suspended: 'Suspendu', pending: 'En attente' };
    return (
      <span className={`px-3 py-1 text-sm font-semibold rounded-full ${styles[status]}`}>
        {labels[status] || status}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!domain) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-gray-700">Domaine non trouvé</h2>
        <button onClick={() => navigate('/admin/domains')} className="mt-4 text-blue-600 hover:underline">
          Retour à la liste
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {location.state?.message && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
          {location.state.message}
        </div>
      )}

      <div className="flex justify-between items-start">
        <div>
          <button onClick={() => navigate('/admin/domains')} className="text-gray-600 hover:text-gray-800 mb-2">
            ← Retour à la liste
          </button>
          <h1 className="text-2xl font-bold">{domain.domain_name}</h1>
          <p className="text-gray-600">{domain.organization_name}</p>
        </div>
        <div className="flex items-center gap-4">
          {getStatusBadge(domain.status)}
          <Link
            to={`/admin/domains/${id}/edit`}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Modifier
          </Link>
        </div>
      </div>

      <div className="border-b">
        <nav className="flex gap-8">
          {['overview', 'dns', 'mailboxes', 'users', 'logs'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-3 border-b-2 font-medium ${
                activeTab === tab
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab === 'overview' && 'Vue d\'ensemble'}
              {tab === 'dns' && 'Configuration DNS'}
              {tab === 'mailboxes' && 'Boîtes aux lettres'}
              {tab === 'users' && 'Utilisateurs'}
              {tab === 'logs' && 'Logs d\'audit'}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="font-bold text-lg mb-4">Informations générales</h2>
              <dl className="grid grid-cols-2 gap-4">
                <div>
                  <dt className="text-sm text-gray-500">FINESS Juridique</dt>
                  <dd className="font-medium">{domain.finess_juridique}</dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500">FINESS Géographique</dt>
                  <dd className="font-medium">{domain.finess_geographique || '-'}</dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500">Type d'organisation</dt>
                  <dd className="font-medium capitalize">{domain.organization_type}</dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500">Date de création</dt>
                  <dd className="font-medium">{new Date(domain.created_at).toLocaleDateString('fr-FR')}</dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500">Email de contact</dt>
                  <dd className="font-medium">{domain.contact_email || '-'}</dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500">Téléphone de contact</dt>
                  <dd className="font-medium">{domain.contact_phone || '-'}</dd>
                </div>
              </dl>
            </div>

            {stats && (
              <div className="bg-white shadow rounded-lg p-6">
                <h2 className="font-bold text-lg mb-4">Statistiques (30 derniers jours)</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">{stats.messagesSent || 0}</div>
                    <div className="text-sm text-gray-600">Messages envoyés</div>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">{stats.messagesReceived || 0}</div>
                    <div className="text-sm text-gray-600">Messages reçus</div>
                  </div>
                  <div className="text-center p-4 bg-purple-50 rounded-lg">
                    <div className="text-2xl font-bold text-purple-600">{stats.activeUsers || 0}</div>
                    <div className="text-sm text-gray-600">Utilisateurs actifs</div>
                  </div>
                  <div className="text-center p-4 bg-orange-50 rounded-lg">
                    <div className="text-2xl font-bold text-orange-600">
                      {((stats.quotaUsage?.usedMb || 0) / 1024).toFixed(1)} GB
                    </div>
                    <div className="text-sm text-gray-600">Stockage utilisé</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="font-bold text-lg mb-4">Quotas</h2>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Boîtes aux lettres</span>
                    <span>{domain.mailboxes_count || 0} / {domain.quotas?.max_mailboxes || '∞'}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full"
                      style={{ width: `${Math.min((domain.mailboxes_count / (domain.quotas?.max_mailboxes || 100)) * 100, 100)}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Stockage</span>
                    <span>
                      {((stats?.quotaUsage?.usedMb || 0) / 1024).toFixed(1)} / {domain.quotas?.max_storage_gb || '∞'} GB
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-green-600 h-2 rounded-full"
                      style={{ width: `${Math.min(((stats?.quotaUsage?.usedMb || 0) / 1024 / (domain.quotas?.max_storage_gb || 100)) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="font-bold text-lg mb-4">État DNS</h2>
              <div className="flex items-center gap-2 mb-4">
                {domain.dns_verified ? (
                  <span className="text-green-600 flex items-center gap-1">
                    ✓ Vérifié le {new Date(domain.dns_verified_at).toLocaleDateString('fr-FR')}
                  </span>
                ) : (
                  <span className="text-yellow-600">⚠ Non vérifié</span>
                )}
              </div>
              <button
                onClick={handleVerifyDns}
                disabled={verifyingDns}
                className="w-full px-4 py-2 border border-blue-600 text-blue-600 rounded-md hover:bg-blue-50 disabled:opacity-50"
              >
                {verifyingDns ? 'Vérification...' : 'Vérifier la configuration DNS'}
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'dns' && (
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-bold text-lg">Enregistrements DNS requis</h2>
            <button
              onClick={handleVerifyDns}
              disabled={verifyingDns}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {verifyingDns ? 'Vérification...' : 'Vérifier'}
            </button>
          </div>
          <p className="text-gray-600 mb-4">
            Configurez ces enregistrements DNS chez votre registrar pour activer le domaine.
          </p>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nom</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Valeur</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {dnsRecords.map((record, index) => (
                  <tr key={index}>
                    <td className="px-4 py-3 font-mono text-sm">{record.type}</td>
                    <td className="px-4 py-3 font-mono text-sm">{record.name}</td>
                    <td className="px-4 py-3 font-mono text-sm break-all max-w-xs">{record.value}</td>
                    <td className="px-4 py-3">
                      {record.verified ? (
                        <span className="text-green-600">✓ OK</span>
                      ) : (
                        <span className="text-yellow-600">⚠ En attente</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'mailboxes' && (
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-bold text-lg">Boîtes aux lettres du domaine</h2>
            <Link
              to={`/admin/mailboxes/create?domain=${id}`}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              + Nouvelle BAL
            </Link>
          </div>
          <p className="text-gray-500">
            Gérez les boîtes aux lettres depuis la section dédiée.
          </p>
          <Link to={`/admin/mailboxes?domain=${id}`} className="text-blue-600 hover:underline">
            Voir toutes les BAL de ce domaine →
          </Link>
        </div>
      )}

      {activeTab === 'users' && (
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-bold text-lg">Utilisateurs du domaine</h2>
            <Link
              to={`/admin/users/create?domain=${id}`}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              + Nouvel utilisateur
            </Link>
          </div>
          <p className="text-gray-500">
            Gérez les utilisateurs depuis la section dédiée.
          </p>
          <Link to={`/admin/users?domain=${id}`} className="text-blue-600 hover:underline">
            Voir tous les utilisateurs de ce domaine →
          </Link>
        </div>
      )}

      {activeTab === 'logs' && (
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="font-bold text-lg mb-4">Logs d'audit</h2>
          <p className="text-gray-500">
            Consultez l'historique des actions effectuées sur ce domaine.
          </p>
          <Link to={`/admin/audit?resource_type=domain&resource_id=${id}`} className="text-blue-600 hover:underline">
            Voir les logs d'audit →
          </Link>
        </div>
      )}
    </div>
  );
};

export default DomainDetail;