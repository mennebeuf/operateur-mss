// services/frontend/src/pages/Admin/Certificates/CertificateDetail.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';

const CertificateDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [certificate, setCertificate] = useState(null);
  const [chain, setChain] = useState(null);
  const [validation, setValidation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('details');

  useEffect(() => {
    loadCertificate();
  }, [id]);

  const loadCertificate = async () => {
    setLoading(true);
    try {
      const [certRes, chainRes, validRes] = await Promise.all([
        fetch(`/api/v1/certificates/${id}`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        }),
        fetch(`/api/v1/certificates/${id}/chain`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        }),
        fetch(`/api/v1/certificates/${id}/validate`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        })
      ]);

      const certData = await certRes.json();
      const chainData = await chainRes.json();
      const validData = await validRes.json();

      if (certData.success) setCertificate(certData.data);
      if (chainData.success) setChain(chainData.data);
      if (validData.success) setValidation(validData.data);
    } catch (error) {
      console.error('Erreur chargement certificat:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (format = 'pem') => {
    try {
      const response = await fetch(`/api/v1/certificates/${id}/download?format=${format}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `certificate_${id}.${format}`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      alert('Erreur lors du téléchargement');
    }
  };

  const handleRevoke = async () => {
    const reason = prompt('Raison de la révocation:\n- keyCompromise\n- cessationOfOperation\n- superseded\n- affiliationChanged');
    
    if (!reason) return;
    if (!['keyCompromise', 'cessationOfOperation', 'superseded', 'affiliationChanged'].includes(reason)) {
      alert('Raison invalide');
      return;
    }

    if (!confirm('Êtes-vous sûr de vouloir révoquer ce certificat ? Cette action est irréversible.')) {
      return;
    }

    try {
      const response = await fetch(`/api/v1/certificates/${id}/revoke`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ reason })
      });

      if (response.ok) {
        loadCertificate();
      } else {
        const data = await response.json();
        alert('Erreur: ' + data.error);
      }
    } catch (error) {
      alert('Erreur lors de la révocation');
    }
  };

  const handleDelete = async () => {
    if (!confirm('Supprimer définitivement ce certificat ? Cette action est irréversible.')) {
      return;
    }

    try {
      const response = await fetch(`/api/v1/certificates/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });

      if (response.ok) {
        navigate('/admin/certificates');
      } else {
        const data = await response.json();
        alert('Erreur: ' + data.error);
      }
    } catch (error) {
      alert('Erreur lors de la suppression');
    }
  };

  const getStatusBadge = (status) => {
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
      <span className={`px-3 py-1 text-sm font-semibold rounded-full ${styles[status]}`}>
        {labels[status]}
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

  if (!certificate) {
    return (
      <div className="text-center py-12">
        <span className="text-4xl mb-4 block">❌</span>
        <p className="text-gray-500">Certificat non trouvé</p>
        <Link to="/admin/certificates" className="text-blue-600 hover:underline mt-2 inline-block">
          Retour à la liste
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <Link to="/admin/certificates" className="text-blue-600 hover:underline text-sm mb-2 inline-block">
            ← Retour aux certificats
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <span className="text-3xl">🔐</span>
            {certificate.subject?.commonName || certificate.subject?.CN || 'Certificat'}
          </h1>
          <p className="text-gray-500 mt-1">
            N° série: {certificate.serialNumber}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {getStatusBadge(certificate.status)}
          <div className="flex gap-2">
            <button
              onClick={() => handleDownload('pem')}
              className="bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded text-sm"
            >
              📥 Télécharger
            </button>
            {certificate.status === 'active' && (
              <>
                <Link
                  to={`/admin/certificates/${id}/renew`}
                  className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded text-sm"
                >
                  🔄 Renouveler
                </Link>
                <button
                  onClick={handleRevoke}
                  className="bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-2 rounded text-sm"
                >
                  ⚠️ Révoquer
                </button>
              </>
            )}
            {certificate.status !== 'active' && (
              <button
                onClick={handleDelete}
                className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded text-sm"
              >
                🗑️ Supprimer
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Alerte expiration */}
      {certificate.status === 'active' && certificate.daysRemaining <= 30 && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4">
          <div className="flex">
            <span className="text-2xl mr-3">⚠️</span>
            <div>
              <h3 className="text-sm font-medium text-red-800">
                Ce certificat expire dans {certificate.daysRemaining} jours
              </h3>
              <p className="text-sm text-red-700 mt-1">
                Pensez à le renouveler avant le {new Date(certificate.validTo).toLocaleDateString('fr-FR')}.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Onglets */}
      <div className="border-b">
        <nav className="flex gap-4">
          {['details', 'validation', 'chain'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-2 px-4 border-b-2 font-medium text-sm ${
                activeTab === tab
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab === 'details' && '📋 Détails'}
              {tab === 'validation' && '✅ Validation'}
              {tab === 'chain' && '🔗 Chaîne'}
            </button>
          ))}
        </nav>
      </div>

      {/* Contenu des onglets */}
      {activeTab === 'details' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Informations générales */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">Informations générales</h3>
            <dl className="space-y-3">
              <div className="flex justify-between">
                <dt className="text-gray-500">Type</dt>
                <dd className="font-medium">{certificate.type}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Numéro de série</dt>
                <dd className="font-mono text-sm">{certificate.serialNumber}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Empreinte (SHA-256)</dt>
                <dd className="font-mono text-xs break-all">{certificate.fingerprint}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Algorithme</dt>
                <dd className="font-medium">{certificate.signatureAlgorithm || 'RSA-SHA256'}</dd>
              </div>
            </dl>
          </div>

          {/* Sujet */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">Sujet (Subject)</h3>
            <dl className="space-y-3">
              {certificate.subject && Object.entries(certificate.subject).map(([key, value]) => (
                <div key={key} className="flex justify-between">
                  <dt className="text-gray-500">{key}</dt>
                  <dd className="font-medium">{value}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Émetteur */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">Émetteur (Issuer)</h3>
            <dl className="space-y-3">
              {certificate.issuer && Object.entries(certificate.issuer).map(([key, value]) => (
                <div key={key} className="flex justify-between">
                  <dt className="text-gray-500">{key}</dt>
                  <dd className="font-medium">{value}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Validité */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">Période de validité</h3>
            <dl className="space-y-3">
              <div className="flex justify-between">
                <dt className="text-gray-500">Valide à partir du</dt>
                <dd className="font-medium">
                  {new Date(certificate.validFrom).toLocaleString('fr-FR')}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Expire le</dt>
                <dd className="font-medium">
                  {new Date(certificate.validTo).toLocaleString('fr-FR')}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Jours restants</dt>
                <dd className={`font-bold ${
                  certificate.daysRemaining < 0 ? 'text-red-600' :
                  certificate.daysRemaining <= 30 ? 'text-red-600' :
                  certificate.daysRemaining <= 90 ? 'text-yellow-600' : 'text-green-600'
                }`}>
                  {certificate.daysRemaining < 0 ? 'Expiré' : `${certificate.daysRemaining} jours`}
                </dd>
              </div>
            </dl>
          </div>

          {/* Noms alternatifs */}
          {certificate.altNames && certificate.altNames.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6 lg:col-span-2">
              <h3 className="text-lg font-semibold mb-4">Noms alternatifs (SAN)</h3>
              <div className="flex flex-wrap gap-2">
                {certificate.altNames.map((name, idx) => (
                  <span key={idx} className="bg-gray-100 px-3 py-1 rounded-full text-sm">
                    {name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'validation' && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Résultat de la validation IGC Santé</h3>
          {validation ? (
            <div className="space-y-4">
              <div className={`p-4 rounded-lg ${
                validation.isValid ? 'bg-green-50' : 'bg-red-50'
              }`}>
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{validation.isValid ? '✅' : '❌'}</span>
                  <div>
                    <p className="font-semibold">
                      {validation.isValid ? 'Certificat valide' : 'Certificat invalide'}
                    </p>
                    {validation.message && (
                      <p className="text-sm text-gray-600">{validation.message}</p>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="space-y-2">
                <h4 className="font-medium">Vérifications effectuées :</h4>
                <ul className="space-y-1">
                  {validation.checks && validation.checks.map((check, idx) => (
                    <li key={idx} className="flex items-center gap-2">
                      <span>{check.passed ? '✅' : '❌'}</span>
                      <span>{check.name}</span>
                      {check.message && (
                        <span className="text-gray-500 text-sm">- {check.message}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <p className="text-gray-500">Validation non disponible</p>
          )}
        </div>
      )}

      {activeTab === 'chain' && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Chaîne de certification</h3>
          {chain && chain.certificates ? (
            <div className="space-y-4">
              {chain.certificates.map((cert, idx) => (
                <div key={idx} className="border-l-4 border-blue-500 pl-4 py-2">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl">
                      {idx === 0 ? '🔐' : idx === chain.certificates.length - 1 ? '🏛️' : '🔗'}
                    </span>
                    <span className="font-medium">
                      {idx === 0 ? 'Certificat' : idx === chain.certificates.length - 1 ? 'AC Racine' : 'AC Intermédiaire'}
                    </span>
                  </div>
                  <p className="text-sm font-mono">{cert.subject?.commonName || cert.subject?.CN}</p>
                  <p className="text-xs text-gray-500">
                    Expire le {new Date(cert.validTo).toLocaleDateString('fr-FR')}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">Chaîne non disponible</p>
          )}
        </div>
      )}
    </div>
  );
};

export default CertificateDetail;