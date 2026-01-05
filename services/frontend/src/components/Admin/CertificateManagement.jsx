// services/frontend/src/components/Admin/CertificateManagement.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';

/**
 * Composant de gestion des certificats
 * Permet la gestion des certificats S/MIME, TLS et d'authentification
 */
const CertificateManagement = () => {
  const { user } = useAuth();
  const [certificates, setCertificates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedCert, setSelectedCert] = useState(null);
  const [expiringCount, setExpiringCount] = useState(0);

  // Types de certificats
  const CERT_TYPES = {
    'smime': 'S/MIME (Signature)',
    'tls': 'TLS (Serveur)',
    'auth': 'Authentification',
    'org': 'Organisation'
  };

  // Charger les certificats
  const loadCertificates = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        ...(typeFilter !== 'all' && { type: typeFilter }),
        ...(statusFilter !== 'all' && { status: statusFilter })
      });

      const response = await fetch(`/api/v1/certificates?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) throw new Error('Erreur lors du chargement');

      const data = await response.json();
      setCertificates(data.certificates || []);
      
      // Compter les certificats expirant bientôt
      const expiring = (data.certificates || []).filter(c => {
        const days = getDaysRemaining(c.not_after);
        return days <= 30 && days > 0;
      });
      setExpiringCount(expiring.length);
    } catch (err) {
      console.error('Erreur:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [typeFilter, statusFilter]);

  useEffect(() => {
    loadCertificates();
  }, [loadCertificates]);

  // Calculer les jours restants
  const getDaysRemaining = (expiryDate) => {
    const now = new Date();
    const expiry = new Date(expiryDate);
    return Math.floor((expiry - now) / (1000 * 60 * 60 * 24));
  };

  // Déterminer le statut d'expiration
  const getExpirationStatus = (expiryDate) => {
    const days = getDaysRemaining(expiryDate);
    if (days <= 0) return { status: 'expired', label: 'Expiré', color: 'red' };
    if (days <= 30) return { status: 'critical', label: `${days}j`, color: 'red' };
    if (days <= 90) return { status: 'warning', label: `${days}j`, color: 'yellow' };
    return { status: 'ok', label: `${days}j`, color: 'green' };
  };

  // Révoquer un certificat
  const handleRevoke = async (certId, reason) => {
    if (!window.confirm('Révoquer ce certificat ? Cette action est irréversible.')) return;

    try {
      const response = await fetch(`/api/v1/certificates/${certId}/revoke`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ reason: reason || 'cessationOfOperation' })
      });

      if (!response.ok) throw new Error('Erreur lors de la révocation');
      
      loadCertificates();
    } catch (err) {
      alert('Erreur: ' + err.message);
    }
  };

  // Télécharger un certificat
  const handleDownload = async (certId, format = 'pem') => {
    try {
      const response = await fetch(`/api/v1/certificates/${certId}/download?format=${format}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) throw new Error('Erreur lors du téléchargement');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `certificate_${certId}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } catch (err) {
      alert('Erreur: ' + err.message);
    }
  };

  // Initier le renouvellement
  const handleRenew = async (certId) => {
    try {
      const response = await fetch(`/api/v1/certificates/${certId}/renew`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) throw new Error('Erreur lors de l\'initiation du renouvellement');
      
      const data = await response.json();
      alert(`Renouvellement initié. ${data.message || ''}`);
      loadCertificates();
    } catch (err) {
      alert('Erreur: ' + err.message);
    }
  };

  // Badge de statut
  const StatusBadge = ({ status, revoked }) => {
    if (revoked) {
      return (
        <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">
          Révoqué
        </span>
      );
    }

    const colors = {
      expired: 'bg-red-100 text-red-800',
      critical: 'bg-red-100 text-red-800',
      warning: 'bg-yellow-100 text-yellow-800',
      ok: 'bg-green-100 text-green-800'
    };

    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${colors[status.status]}`}>
        {status.label}
      </span>
    );
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
      {/* En-tête */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestion des certificats</h1>
          <p className="text-gray-600 mt-1">
            Gérez les certificats S/MIME, TLS et d'authentification
          </p>
        </div>
        <button
          onClick={() => setShowUploadModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
        >
          <span>📤</span>
          Importer un certificat
        </button>
      </div>

      {/* Alertes d'expiration */}
      {expiringCount > 0 && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
          <div className="flex items-center">
            <span className="text-2xl mr-3">⚠️</span>
            <div>
              <h3 className="text-sm font-medium text-yellow-800">
                {expiringCount} certificat(s) expire(nt) dans moins de 30 jours
              </h3>
              <p className="text-sm text-yellow-700 mt-1">
                Pensez à les renouveler pour éviter toute interruption de service.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Statistiques rapides */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-2xl font-bold text-blue-600">{certificates.length}</div>
          <div className="text-sm text-gray-600">Certificats totaux</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-2xl font-bold text-green-600">
            {certificates.filter(c => getDaysRemaining(c.not_after) > 90 && !c.revoked).length}
          </div>
          <div className="text-sm text-gray-600">Valides (&gt;90j)</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-2xl font-bold text-yellow-600">
            {certificates.filter(c => {
              const days = getDaysRemaining(c.not_after);
              return days > 0 && days <= 90 && !c.revoked;
            }).length}
          </div>
          <div className="text-sm text-gray-600">À renouveler</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-2xl font-bold text-red-600">
            {certificates.filter(c => getDaysRemaining(c.not_after) <= 0 || c.revoked).length}
          </div>
          <div className="text-sm text-gray-600">Expirés/Révoqués</div>
        </div>
      </div>

      {/* Filtres */}
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="flex flex-wrap gap-4">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Tous les types</option>
            {Object.entries(CERT_TYPES).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Tous les statuts</option>
            <option value="valid">Valides</option>
            <option value="expiring">Expire bientôt</option>
            <option value="expired">Expirés</option>
            <option value="revoked">Révoqués</option>
          </select>
        </div>
      </div>

      {/* Erreur */}
      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Liste des certificats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {certificates.map((cert) => {
          const expStatus = getExpirationStatus(cert.not_after);
          
          return (
            <div
              key={cert.id}
              className={`bg-white rounded-lg shadow-md overflow-hidden border-l-4 ${
                cert.revoked ? 'border-gray-400' :
                expStatus.status === 'expired' ? 'border-red-500' :
                expStatus.status === 'critical' ? 'border-red-500' :
                expStatus.status === 'warning' ? 'border-yellow-500' :
                'border-green-500'
              }`}
            >
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-gray-900">{CERT_TYPES[cert.type] || cert.type}</h3>
                    <p className="text-sm text-gray-500 truncate" title={cert.subject}>
                      {cert.subject_cn || cert.subject}
                    </p>
                  </div>
                  <StatusBadge status={expStatus} revoked={cert.revoked} />
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Émetteur:</span>
                    <span className="text-gray-900 truncate ml-2" title={cert.issuer}>
                      {cert.issuer_cn || cert.issuer?.substring(0, 20)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Valide du:</span>
                    <span className="text-gray-900">
                      {new Date(cert.not_before).toLocaleDateString('fr-FR')}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Expire le:</span>
                    <span className={`font-medium ${
                      expStatus.status === 'expired' || expStatus.status === 'critical' 
                        ? 'text-red-600' 
                        : expStatus.status === 'warning' 
                          ? 'text-yellow-600' 
                          : 'text-gray-900'
                    }`}>
                      {new Date(cert.not_after).toLocaleDateString('fr-FR')}
                    </span>
                  </div>
                  {cert.serial_number && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Série:</span>
                      <span className="text-gray-900 font-mono text-xs">
                        {cert.serial_number.substring(0, 16)}...
                      </span>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="mt-4 pt-4 border-t flex flex-wrap gap-2">
                  <button
                    onClick={() => {
                      setSelectedCert(cert);
                      setShowDetailsModal(true);
                    }}
                    className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                  >
                    Détails
                  </button>
                  <button
                    onClick={() => handleDownload(cert.id)}
                    className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                  >
                    Télécharger
                  </button>
                  {!cert.revoked && getDaysRemaining(cert.not_after) > 0 && (
                    <>
                      {getDaysRemaining(cert.not_after) <= 90 && (
                        <button
                          onClick={() => handleRenew(cert.id)}
                          className="px-3 py-1 text-sm bg-green-100 text-green-700 rounded hover:bg-green-200"
                        >
                          Renouveler
                        </button>
                      )}
                      <button
                        onClick={() => handleRevoke(cert.id)}
                        className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200"
                      >
                        Révoquer
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {certificates.length === 0 && !loading && (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <span className="text-6xl">🔐</span>
          <p className="mt-4 text-gray-500">Aucun certificat trouvé</p>
          <button
            onClick={() => setShowUploadModal(true)}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Importer votre premier certificat
          </button>
        </div>
      )}

      {/* Modal Upload */}
      {showUploadModal && (
        <CertificateUploadModal
          onClose={() => setShowUploadModal(false)}
          onSuccess={() => {
            setShowUploadModal(false);
            loadCertificates();
          }}
        />
      )}

      {/* Modal Détails */}
      {showDetailsModal && selectedCert && (
        <CertificateDetailsModal
          certificate={selectedCert}
          onClose={() => {
            setShowDetailsModal(false);
            setSelectedCert(null);
          }}
          onDownload={handleDownload}
          onRevoke={handleRevoke}
          onRenew={handleRenew}
        />
      )}
    </div>
  );
};

/**
 * Modal d'upload de certificat
 */
const CertificateUploadModal = ({ onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    type: 'smime',
    certificate: null,
    privateKey: null,
    passphrase: '',
    description: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e, field) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFormData(prev => ({ ...prev, [field]: e.dataTransfer.files[0] }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.certificate) {
      setError('Veuillez sélectionner un fichier certificat');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = new FormData();
      data.append('type', formData.type);
      data.append('certificate', formData.certificate);
      if (formData.privateKey) {
        data.append('privateKey', formData.privateKey);
      }
      if (formData.passphrase) {
        data.append('passphrase', formData.passphrase);
      }
      if (formData.description) {
        data.append('description', formData.description);
      }

      const response = await fetch('/api/v1/certificates/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: data
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Erreur lors de l\'import');
      }

      onSuccess();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4">
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-xl font-semibold">Importer un certificat</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Type de certificat *
            </label>
            <select
              value={formData.type}
              onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="smime">S/MIME (Signature email)</option>
              <option value="tls">TLS (Serveur)</option>
              <option value="auth">Authentification</option>
              <option value="org">Organisation</option>
            </select>
          </div>

          {/* Zone de drop pour le certificat */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fichier certificat * (.pem, .crt, .cer)
            </label>
            <div
              className={`border-2 border-dashed rounded-lg p-6 text-center transition ${
                dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={(e) => handleDrop(e, 'certificate')}
            >
              {formData.certificate ? (
                <div className="flex items-center justify-center gap-2">
                  <span>📄</span>
                  <span className="text-sm text-gray-700">{formData.certificate.name}</span>
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, certificate: null }))}
                    className="text-red-500 hover:text-red-700"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <>
                  <span className="text-4xl">📤</span>
                  <p className="mt-2 text-sm text-gray-600">
                    Glissez-déposez ou{' '}
                    <label className="text-blue-600 hover:underline cursor-pointer">
                      parcourez
                      <input
                        type="file"
                        accept=".pem,.crt,.cer,.p12,.pfx"
                        onChange={(e) => setFormData(prev => ({ ...prev, certificate: e.target.files[0] }))}
                        className="hidden"
                      />
                    </label>
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Clé privée (optionnelle) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Clé privée (optionnel)
            </label>
            <input
              type="file"
              accept=".pem,.key"
              onChange={(e) => setFormData(prev => ({ ...prev, privateKey: e.target.files[0] }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>

          {/* Passphrase */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Mot de passe de la clé (si protégée)
            </label>
            <input
              type="password"
              value={formData.passphrase}
              onChange={(e) => setFormData(prev => ({ ...prev, passphrase: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="••••••••"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Ex: Certificat principal domaine"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Import en cours...' : 'Importer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/**
 * Modal de détails d'un certificat
 */
const CertificateDetailsModal = ({ certificate, onClose, onDownload, onRevoke, onRenew }) => {
  const getDaysRemaining = (date) => {
    return Math.floor((new Date(date) - new Date()) / (1000 * 60 * 60 * 24));
  };

  const daysRemaining = getDaysRemaining(certificate.not_after);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b sticky top-0 bg-white">
          <h2 className="text-xl font-semibold">Détails du certificat</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>

        <div className="p-6 space-y-6">
          {/* Informations principales */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h3 className="text-sm font-medium text-gray-500">Type</h3>
              <p className="mt-1 text-gray-900">{certificate.type}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500">Statut</h3>
              <p className="mt-1">
                {certificate.revoked ? (
                  <span className="text-gray-600">Révoqué</span>
                ) : daysRemaining <= 0 ? (
                  <span className="text-red-600">Expiré</span>
                ) : daysRemaining <= 30 ? (
                  <span className="text-red-600">Expire dans {daysRemaining} jour(s)</span>
                ) : daysRemaining <= 90 ? (
                  <span className="text-yellow-600">Expire dans {daysRemaining} jours</span>
                ) : (
                  <span className="text-green-600">Valide ({daysRemaining} jours)</span>
                )}
              </p>
            </div>
          </div>

          {/* Sujet */}
          <div>
            <h3 className="text-sm font-medium text-gray-500">Sujet (Subject)</h3>
            <p className="mt-1 text-gray-900 font-mono text-sm break-all">
              {certificate.subject}
            </p>
          </div>

          {/* Émetteur */}
          <div>
            <h3 className="text-sm font-medium text-gray-500">Émetteur (Issuer)</h3>
            <p className="mt-1 text-gray-900 font-mono text-sm break-all">
              {certificate.issuer}
            </p>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h3 className="text-sm font-medium text-gray-500">Valide à partir du</h3>
              <p className="mt-1 text-gray-900">
                {new Date(certificate.not_before).toLocaleString('fr-FR')}
              </p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500">Expire le</h3>
              <p className={`mt-1 ${daysRemaining <= 30 ? 'text-red-600 font-medium' : 'text-gray-900'}`}>
                {new Date(certificate.not_after).toLocaleString('fr-FR')}
              </p>
            </div>
          </div>

          {/* Numéro de série */}
          <div>
            <h3 className="text-sm font-medium text-gray-500">Numéro de série</h3>
            <p className="mt-1 text-gray-900 font-mono text-sm break-all">
              {certificate.serial_number}
            </p>
          </div>

          {/* Fingerprints */}
          {certificate.fingerprint_sha256 && (
            <div>
              <h3 className="text-sm font-medium text-gray-500">Empreinte SHA-256</h3>
              <p className="mt-1 text-gray-900 font-mono text-xs break-all">
                {certificate.fingerprint_sha256}
              </p>
            </div>
          )}

          {/* Extensions */}
          {certificate.key_usage && (
            <div>
              <h3 className="text-sm font-medium text-gray-500">Utilisation de la clé</h3>
              <p className="mt-1 text-gray-900">{certificate.key_usage}</p>
            </div>
          )}

          {certificate.san && (
            <div>
              <h3 className="text-sm font-medium text-gray-500">Noms alternatifs (SAN)</h3>
              <p className="mt-1 text-gray-900 font-mono text-sm">{certificate.san}</p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="p-6 border-t bg-gray-50 flex flex-wrap gap-3">
          <button
            onClick={() => onDownload(certificate.id, 'pem')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            📥 Télécharger (PEM)
          </button>
          <button
            onClick={() => onDownload(certificate.id, 'der')}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
          >
            📥 Télécharger (DER)
          </button>
          {!certificate.revoked && daysRemaining > 0 && (
            <>
              {daysRemaining <= 90 && (
                <button
                  onClick={() => {
                    onRenew(certificate.id);
                    onClose();
                  }}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  🔄 Renouveler
                </button>
              )}
              <button
                onClick={() => {
                  onRevoke(certificate.id);
                  onClose();
                }}
                className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200"
              >
                ⛔ Révoquer
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default CertificateManagement;