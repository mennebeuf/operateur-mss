// services/frontend/src/pages/Admin/Certificates/CertificateRenew.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';

const CertificateRenew = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const certInputRef = useRef(null);
  const keyInputRef = useRef(null);

  const [currentCert, setCurrentCert] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [certFile, setCertFile] = useState(null);
  const [keyFile, setKeyFile] = useState(null);
  const [passphrase, setPassphrase] = useState('');
  const [preview, setPreview] = useState(null);
  const [verifying, setVerifying] = useState(false);
  const [errors, setErrors] = useState({});
  const [renewalMethod, setRenewalMethod] = useState('upload'); // 'upload' ou 'request'

  useEffect(() => {
    loadCurrentCertificate();
  }, [id]);

  const loadCurrentCertificate = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/v1/certificates/${id}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await response.json();
      
      if (data.success) {
        setCurrentCert(data.data);
      } else {
        navigate('/admin/certificates');
      }
    } catch (error) {
      console.error('Erreur:', error);
      navigate('/admin/certificates');
    } finally {
      setLoading(false);
    }
  };

  const handleCertChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setCertFile(file);
    setPreview(null);
    setErrors({});

    setVerifying(true);
    try {
      const formData = new FormData();
      formData.append('certificate', file);

      const response = await fetch('/api/v1/certificates/verify', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: formData
      });

      const data = await response.json();
      
      if (data.success) {
        setPreview(data.data);
        
        // Vérifier la cohérence avec le certificat actuel
        if (currentCert && data.data.subject?.commonName !== currentCert.subject?.commonName) {
          setErrors({ cert: 'Le nouveau certificat doit avoir le même CN que l\'actuel' });
        }
      } else {
        setErrors({ cert: data.error || 'Certificat invalide' });
      }
    } catch (error) {
      setErrors({ cert: 'Erreur lors de la vérification' });
    } finally {
      setVerifying(false);
    }
  };

  const handleKeyChange = (e) => {
    const file = e.target.files[0];
    if (file) setKeyFile(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!certFile) {
      setErrors({ cert: 'Nouveau certificat requis' });
      return;
    }

    if (currentCert?.type === 'SERV_SSL' && !keyFile) {
      setErrors({ key: 'Clé privée requise pour un certificat serveur' });
      return;
    }

    setSubmitting(true);
    setErrors({});

    try {
      // D'abord, initier le renouvellement
      const initResponse = await fetch(`/api/v1/certificates/${id}/renew`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });

      if (!initResponse.ok) {
        const data = await initResponse.json();
        throw new Error(data.error || 'Erreur lors de l\'initialisation');
      }

      // Ensuite, uploader le nouveau certificat
      const uploadData = new FormData();
      uploadData.append('certificate', certFile);
      if (keyFile) {
        uploadData.append('privateKey', keyFile);
      }
      uploadData.append('type', currentCert.type);
      if (passphrase) {
        uploadData.append('passphrase', passphrase);
      }

      const uploadResponse = await fetch('/api/v1/certificates/upload', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: uploadData
      });

      const uploadData2 = await uploadResponse.json();

      if (uploadData2.success) {
        navigate(`/admin/certificates/${uploadData2.data.id}`);
      } else {
        setErrors({ submit: uploadData2.error || 'Erreur lors du renouvellement' });
      }
    } catch (error) {
      setErrors({ submit: error.message || 'Erreur lors du renouvellement' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRequestRenewal = async () => {
    setSubmitting(true);
    setErrors({});

    try {
      const response = await fetch(`/api/v1/certificates/${id}/renew`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ method: 'request' })
      });

      const data = await response.json();

      if (data.success) {
        alert('Demande de renouvellement envoyée. Vous recevrez un email avec les instructions.');
        navigate('/admin/certificates');
      } else {
        setErrors({ submit: data.error || 'Erreur lors de la demande' });
      }
    } catch (error) {
      setErrors({ submit: 'Erreur lors de la demande de renouvellement' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!currentCert) {
    return (
      <div className="text-center py-12">
        <span className="text-4xl mb-4 block">❌</span>
        <p className="text-gray-500">Certificat non trouvé</p>
      </div>
    );
  }

  const getTypeBadge = (type) => {
    const labels = {
      SERV_SSL: 'Serveur SSL',
      ORG_AUTH_CLI: 'Auth. Client Org.',
      ORG_SIGN: 'Signature Org.',
      ORG_CONF: 'Confidentialité Org.'
    };
    return labels[type] || type;
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <Link to={`/admin/certificates/${id}`} className="text-blue-600 hover:underline text-sm mb-2 inline-block">
          ← Retour au certificat
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Renouveler le certificat</h1>
      </div>

      {/* Certificat actuel */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <span className="text-yellow-500">🔄</span>
          Certificat à renouveler
        </h3>
        <dl className="grid grid-cols-2 gap-4">
          <div>
            <dt className="text-sm text-gray-500">Sujet (CN)</dt>
            <dd className="font-medium">{currentCert.subject?.commonName || currentCert.subject?.CN}</dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Type</dt>
            <dd className="font-medium">{getTypeBadge(currentCert.type)}</dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Expire le</dt>
            <dd className={`font-medium ${currentCert.daysRemaining <= 30 ? 'text-red-600' : ''}`}>
              {new Date(currentCert.validTo).toLocaleDateString('fr-FR')}
              {currentCert.daysRemaining <= 30 && (
                <span className="ml-2 text-sm">({currentCert.daysRemaining} jours restants)</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">N° série</dt>
            <dd className="font-mono text-sm">{currentCert.serialNumber?.substring(0, 20)}...</dd>
          </div>
        </dl>
      </div>

      {/* Erreur globale */}
      {errors.submit && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4">
          <div className="flex">
            <span className="text-xl mr-3">❌</span>
            <p className="text-red-700">{errors.submit}</p>
          </div>
        </div>
      )}

      {/* Méthode de renouvellement */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Méthode de renouvellement</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label
            className={`border rounded-lg p-4 cursor-pointer transition ${
              renewalMethod === 'upload' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <input
              type="radio"
              name="method"
              value="upload"
              checked={renewalMethod === 'upload'}
              onChange={() => setRenewalMethod('upload')}
              className="sr-only"
            />
            <div className="flex items-start gap-3">
              <span className="text-2xl">📤</span>
              <div>
                <p className="font-medium">Importer un nouveau certificat</p>
                <p className="text-sm text-gray-500">
                  J'ai déjà obtenu un nouveau certificat auprès de l'IGC Santé
                </p>
              </div>
            </div>
          </label>

          <label
            className={`border rounded-lg p-4 cursor-pointer transition ${
              renewalMethod === 'request' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <input
              type="radio"
              name="method"
              value="request"
              checked={renewalMethod === 'request'}
              onChange={() => setRenewalMethod('request')}
              className="sr-only"
            />
            <div className="flex items-start gap-3">
              <span className="text-2xl">📨</span>
              <div>
                <p className="font-medium">Demander un renouvellement</p>
                <p className="text-sm text-gray-500">
                  Générer une CSR et recevoir les instructions par email
                </p>
              </div>
            </div>
          </label>
        </div>
      </div>

      {/* Upload nouveau certificat */}
      {renewalMethod === 'upload' && (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">Nouveau certificat</h3>
            
            {/* Fichier certificat */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Certificat (.pem, .crt, .cer) *
              </label>
              <div
                onClick={() => certInputRef.current?.click()}
                className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition ${
                  certFile ? 'border-green-400 bg-green-50' : 'border-gray-300 hover:border-gray-400'
                } ${errors.cert ? 'border-red-400' : ''}`}
              >
                <input
                  ref={certInputRef}
                  type="file"
                  accept=".pem,.crt,.cer,.p12,.pfx"
                  onChange={handleCertChange}
                  className="hidden"
                />
                {certFile ? (
                  <div className="flex items-center justify-center gap-3">
                    <span className="text-2xl">✅</span>
                    <div>
                      <p className="font-medium">{certFile.name}</p>
                      <p className="text-sm text-gray-500">{(certFile.size / 1024).toFixed(2)} KB</p>
                    </div>
                  </div>
                ) : (
                  <div>
                    <span className="text-4xl block mb-2">📄</span>
                    <p className="text-gray-600">Sélectionner le nouveau certificat</p>
                  </div>
                )}
              </div>
              {errors.cert && <p className="mt-2 text-sm text-red-600">{errors.cert}</p>}
            </div>

            {/* Clé privée */}
            {currentCert.type === 'SERV_SSL' && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Clé privée (.key, .pem) *
                </label>
                <div
                  onClick={() => keyInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition ${
                    keyFile ? 'border-green-400 bg-green-50' : 'border-gray-300 hover:border-gray-400'
                  } ${errors.key ? 'border-red-400' : ''}`}
                >
                  <input
                    ref={keyInputRef}
                    type="file"
                    accept=".key,.pem"
                    onChange={handleKeyChange}
                    className="hidden"
                  />
                  {keyFile ? (
                    <div className="flex items-center justify-center gap-3">
                      <span className="text-2xl">🔑</span>
                      <p className="font-medium">{keyFile.name}</p>
                    </div>
                  ) : (
                    <div>
                      <span className="text-4xl block mb-2">🔑</span>
                      <p className="text-gray-600">Sélectionner la nouvelle clé privée</p>
                    </div>
                  )}
                </div>
                {errors.key && <p className="mt-2 text-sm text-red-600">{errors.key}</p>}
              </div>
            )}

            {/* Passphrase */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Passphrase (si clé protégée)
              </label>
              <input
                type="password"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                className="w-full border rounded-md px-3 py-2"
                placeholder="Laissez vide si non protégée"
              />
            </div>
          </div>

          {/* Aperçu */}
          {verifying && (
            <div className="bg-blue-50 rounded-lg p-4 flex items-center gap-3">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
              <span>Vérification du certificat...</span>
            </div>
          )}

          {preview && !errors.cert && (
            <div className="bg-green-50 rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <span className="text-green-500">✅</span>
                Nouveau certificat validé
              </h3>
              <dl className="grid grid-cols-2 gap-4">
                <div>
                  <dt className="text-sm text-gray-500">Nouvelle validité</dt>
                  <dd className="font-medium">
                    {new Date(preview.validFrom).toLocaleDateString('fr-FR')} → {new Date(preview.validTo).toLocaleDateString('fr-FR')}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500">Jours de validité</dt>
                  <dd className="font-medium text-green-600">{preview.daysUntilExpiry} jours</dd>
                </div>
              </dl>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-4">
            <Link to={`/admin/certificates/${id}`} className="px-6 py-2 border rounded-md hover:bg-gray-50">
              Annuler
            </Link>
            <button
              type="submit"
              disabled={submitting || verifying || !certFile || errors.cert}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Renouvellement...
                </>
              ) : (
                <>🔄 Renouveler le certificat</>
              )}
            </button>
          </div>
        </form>
      )}

      {/* Demande de renouvellement */}
      {renewalMethod === 'request' && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Demande de renouvellement</h3>
          <p className="text-gray-600 mb-4">
            Cette action va générer une CSR (Certificate Signing Request) et vous envoyer par email 
            les instructions pour obtenir un nouveau certificat auprès de l'IGC Santé.
          </p>
          
          <div className="bg-blue-50 rounded-lg p-4 mb-6">
            <h4 className="font-medium text-blue-800 mb-2">Informations qui seront incluses :</h4>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• CN: {currentCert.subject?.commonName || currentCert.subject?.CN}</li>
              <li>• Organisation: {currentCert.subject?.organizationName || currentCert.subject?.O}</li>
              <li>• Type: {getTypeBadge(currentCert.type)}</li>
            </ul>
          </div>

          <div className="flex justify-end gap-4">
            <Link to={`/admin/certificates/${id}`} className="px-6 py-2 border rounded-md hover:bg-gray-50">
              Annuler
            </Link>
            <button
              onClick={handleRequestRenewal}
              disabled={submitting}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Envoi...
                </>
              ) : (
                <>📨 Envoyer la demande</>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CertificateRenew;