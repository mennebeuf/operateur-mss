// services/frontend/src/pages/Admin/Domains/DomainView.jsx
/**
 * Vue détaillée d'un domaine
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';

import Loader from '../../../components/Common/Loader';
import { adminApi } from '../../../services/adminApi';

const DomainView = () => {
  const { domainId } = useParams();
  const navigate = useNavigate();
  const [domain, setDomain] = useState(null);
  const [stats, setStats] = useState(null);
  const [dnsRecords, setDnsRecords] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [verifyingDns, setVerifyingDns] = useState(false);

  useEffect(() => {
    loadDomainData();
  }, [domainId]);

  const loadDomainData = async () => {
    try {
      setLoading(true);
      const [domainData, statsData] = await Promise.all([
        adminApi.getDomain(domainId),
        adminApi.getDomainStats(domainId).catch(() => null)
      ]);
      setDomain(domainData.data || domainData);
      setStats(statsData?.data || statsData);
    } catch (error) {
      console.error('Erreur chargement domaine:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyDns = async () => {
    setVerifyingDns(true);
    try {
      const result = await adminApi.verifyDomainDns(domainId);
      setDnsRecords(result.data?.records || []);
      alert(result.data?.allValid ? 'DNS validé ✓' : 'Certains enregistrements DNS sont manquants');
    } catch (error) {
      console.error('Erreur vérification DNS:', error);
    } finally {
      setVerifyingDns(false);
    }
  };

  const handleSuspend = async () => {
    if (!window.confirm('Voulez-vous vraiment suspendre ce domaine ?')) {
      return;
    }
    try {
      await adminApi.suspendDomain(domainId, 'Suspension manuelle');
      loadDomainData();
    } catch (error) {
      console.error('Erreur suspension:', error);
    }
  };

  const handleActivate = async () => {
    try {
      await adminApi.activateDomain(domainId);
      loadDomainData();
    } catch (error) {
      console.error('Erreur activation:', error);
    }
  };

  if (loading) {
    return <Loader message="Chargement du domaine..." />;
  }

  if (!domain) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-500">Domaine non trouvé</p>
        <Link to="/admin/domains" className="text-blue-600 hover:underline">
          Retour à la liste
        </Link>
      </div>
    );
  }

  const statusColors = {
    active: 'bg-green-100 text-green-800',
    pending: 'bg-yellow-100 text-yellow-800',
    suspended: 'bg-red-100 text-red-800'
  };

  return (
    <div className="p-6 space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{domain.domain_name}</h1>
            <span
              className={`px-3 py-1 rounded-full text-sm font-medium ${statusColors[domain.status] || 'bg-gray-100'}`}
            >
              {domain.status}
            </span>
          </div>
          <p className="text-gray-500">{domain.organization_name}</p>
        </div>
        <div className="flex gap-3">
          <Link
            to={`/admin/domains/${domainId}/edit`}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            ✏️ Modifier
          </Link>
          {domain.status === 'active' ? (
            <button
              onClick={handleSuspend}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              ⏸️ Suspendre
            </button>
          ) : (
            <button
              onClick={handleActivate}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              ▶️ Activer
            </button>
          )}
        </div>
      </div>

      {/* Onglets */}
      <div className="border-b">
        <nav className="flex gap-4">
          {['overview', 'users', 'dns', 'certificates'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 border-b-2 transition ${
                activeTab === tab
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab === 'overview' && "📊 Vue d'ensemble"}
              {tab === 'users' && '👥 Utilisateurs'}
              {tab === 'dns' && '🌐 DNS'}
              {tab === 'certificates' && '🔐 Certificats'}
            </button>
          ))}
        </nav>
      </div>

      {/* Contenu des onglets */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Informations */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Informations</h2>
            <dl className="space-y-3">
              <div className="flex justify-between">
                <dt className="text-gray-500">FINESS juridique</dt>
                <dd className="font-medium">{domain.finess_juridique || '-'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Type</dt>
                <dd className="font-medium">{domain.type || 'standard'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Créé le</dt>
                <dd className="font-medium">
                  {new Date(domain.created_at).toLocaleDateString('fr-FR')}
                </dd>
              </div>
            </dl>
          </div>

          {/* Statistiques */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Statistiques</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <p className="text-3xl font-bold text-blue-600">{stats?.mailboxes_count || 0}</p>
                <p className="text-sm text-gray-500">Boîtes aux lettres</p>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <p className="text-3xl font-bold text-green-600">{stats?.users_count || 0}</p>
                <p className="text-sm text-gray-500">Utilisateurs</p>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <p className="text-3xl font-bold text-purple-600">
                  {stats?.storage_used_gb || 0} GB
                </p>
                <p className="text-sm text-gray-500">Stockage utilisé</p>
              </div>
              <div className="text-center p-4 bg-orange-50 rounded-lg">
                <p className="text-3xl font-bold text-orange-600">{stats?.messages_count || 0}</p>
                <p className="text-sm text-gray-500">Messages (30j)</p>
              </div>
            </div>
          </div>

          {/* Quotas */}
          <div className="bg-white rounded-lg shadow p-6 lg:col-span-2">
            <h2 className="text-lg font-semibold mb-4">Quotas</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                {
                  label: 'Boîtes aux lettres',
                  current: stats?.mailboxes_count || 0,
                  max: domain.quotas?.max_mailboxes || 100
                },
                {
                  label: 'Stockage (GB)',
                  current: stats?.storage_used_gb || 0,
                  max: domain.quotas?.max_storage_gb || 100
                },
                {
                  label: 'Utilisateurs',
                  current: stats?.users_count || 0,
                  max: domain.quotas?.max_users || 200
                }
              ].map((quota, index) => (
                <div key={index}>
                  <div className="flex justify-between text-sm mb-1">
                    <span>{quota.label}</span>
                    <span>
                      {quota.current} / {quota.max}
                    </span>
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        quota.current / quota.max > 0.9
                          ? 'bg-red-500'
                          : quota.current / quota.max > 0.7
                            ? 'bg-yellow-500'
                            : 'bg-green-500'
                      }`}
                      style={{ width: `${Math.min((quota.current / quota.max) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'dns' && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Configuration DNS</h2>
            <button
              onClick={handleVerifyDns}
              disabled={verifyingDns}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {verifyingDns ? 'Vérification...' : '🔍 Vérifier DNS'}
            </button>
          </div>
          <p className="text-gray-500 mb-4">
            Configurez les enregistrements DNS suivants pour votre domaine :
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left">Type</th>
                  <th className="px-4 py-2 text-left">Nom</th>
                  <th className="px-4 py-2 text-left">Valeur</th>
                  <th className="px-4 py-2 text-left">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                <tr>
                  <td className="px-4 py-2 font-mono">MX</td>
                  <td className="px-4 py-2 font-mono">{domain.domain_name}</td>
                  <td className="px-4 py-2 font-mono">10 mail.{domain.domain_name}</td>
                  <td className="px-4 py-2">
                    <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs">
                      À vérifier
                    </span>
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-2 font-mono">TXT</td>
                  <td className="px-4 py-2 font-mono">{domain.domain_name}</td>
                  <td className="px-4 py-2 font-mono text-xs">
                    v=spf1 include:_spf.{domain.domain_name} ~all
                  </td>
                  <td className="px-4 py-2">
                    <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs">
                      À vérifier
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'users' && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Utilisateurs du domaine</h2>
            <Link
              to={`/admin/users/new?domain=${domainId}`}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              ➕ Ajouter
            </Link>
          </div>
          <p className="text-gray-500">
            <Link to={`/admin/users?domain=${domainId}`} className="text-blue-600 hover:underline">
              Voir tous les utilisateurs de ce domaine →
            </Link>
          </p>
        </div>
      )}

      {activeTab === 'certificates' && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Certificats</h2>
            <Link
              to={`/admin/certificates/upload?domain=${domainId}`}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              📤 Importer
            </Link>
          </div>
          <p className="text-gray-500">
            <Link
              to={`/admin/certificates?domain=${domainId}`}
              className="text-blue-600 hover:underline"
            >
              Gérer les certificats de ce domaine →
            </Link>
          </p>
        </div>
      )}
    </div>
  );
};

export default DomainView;
