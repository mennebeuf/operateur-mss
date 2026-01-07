// services/frontend/src/pages/Admin/Certificates/CertificateUpload.jsx
import React, { useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';

const CertificateUpload = () => {
  const navigate = useNavigate();
  const certInputRef = useRef(null);
  const keyInputRef = useRef(null);

  const [formData, setFormData] = useState({
    type: 'SERV_SSL',
    passphrase: '',
    mailboxId: ''
  });
  const [certFile, setCertFile] = useState(null);
  const [keyFile, setKeyFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [errors, setErrors] = useState({});

  const certTypes = [
    {
      value: 'SERV_SSL',
      label: 'Serveur SSL/TLS',
      description: 'Certificat pour sécuriser les connexions HTTPS, IMAPS, SMTPS'
    },
    {
      value: 'ORG_AUTH_CLI',
      label: 'Authentification Client Organisation',
      description: "Certificat pour authentifier l'organisation auprès de l'annuaire"
    },
    {
      value: 'ORG_SIGN',
      label: 'Signature Organisation',
      description: "Certificat pour signer les messages au nom de l'organisation"
    },
    {
      value: 'ORG_CONF',
      label: 'Confidentialité Organisation',
      description: 'Certificat pour le chiffrement des messages'
    }
  ];

  const handleCertChange = async e => {
    const file = e.target.files[0];
    if (!file) {return;}

    setCertFile(file);
    setPreview(null);
    setErrors({});

    // Vérification automatique
    setVerifying(true);
    try {
      const formDataUpload = new FormData();
      formDataUpload.append('certificate', file);

      const response = await fetch('/api/v1/certificates/verify', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: formDataUpload
      });

      const data = await response.json();

      if (data.success) {
        setPreview(data.data);
      } else {
        setErrors({ cert: data.error || 'Certificat invalide' });
      }
    } catch (error) {
      setErrors({ cert: 'Erreur lors de la vérification' });
    } finally {
      setVerifying(false);
    }
  };

  const handleKeyChange = e => {
    const file = e.target.files[0];
    if (file) {
      setKeyFile(file);
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!certFile) {
      newErrors.cert = 'Fichier certificat requis';
    }

    if (!keyFile && formData.type === 'SERV_SSL') {
      newErrors.key = 'Clé privée requise pour un certificat serveur';
    }

    if (!formData.type) {
      newErrors.type = 'Type de certificat requis';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async e => {
    e.preventDefault();

    if (!validateForm()) {return;}

    setLoading(true);
    setErrors({});

    try {
      const uploadData = new FormData();
      uploadData.append('certificate', certFile);
      if (keyFile) {
        uploadData.append('privateKey', keyFile);
      }
      uploadData.append('type', formData.type);
      if (formData.passphrase) {
        uploadData.append('passphrase', formData.passphrase);
      }
      if (formData.mailboxId) {
        uploadData.append('mailboxId', formData.mailboxId);
      }

      const response = await fetch('/api/v1/certificates/upload', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: uploadData
      });

      const data = await response.json();

      if (data.success) {
        navigate(`/admin/certificates/${data.data.id}`);
      } else {
        setErrors({ submit: data.error || "Erreur lors de l'import" });
      }
    } catch (error) {
      setErrors({ submit: "Erreur lors de l'import du certificat" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <Link
          to="/admin/certificates"
          className="text-blue-600 hover:underline text-sm mb-2 inline-block"
        >
          ← Retour aux certificats
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Importer un certificat IGC Santé</h1>
        <p className="text-gray-600 mt-1">
          Importez un certificat délivré par l'IGC Santé pour sécuriser vos communications MSSanté.
        </p>
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

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Type de certificat */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Type de certificat</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {certTypes.map(type => (
              <label
                key={type.value}
                className={`border rounded-lg p-4 cursor-pointer transition ${
                  formData.type === type.value
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <input
                  type="radio"
                  name="type"
                  value={type.value}
                  checked={formData.type === type.value}
                  onChange={e => setFormData({ ...formData, type: e.target.value })}
                  className="sr-only"
                />
                <div className="flex items-start gap-3">
                  <span className="text-2xl">
                    {type.value === 'SERV_SSL' && '🔒'}
                    {type.value === 'ORG_AUTH_CLI' && '🪪'}
                    {type.value === 'ORG_SIGN' && '✍️'}
                    {type.value === 'ORG_CONF' && '🔐'}
                  </span>
                  <div>
                    <p className="font-medium">{type.label}</p>
                    <p className="text-sm text-gray-500">{type.description}</p>
                  </div>
                </div>
              </label>
            ))}
          </div>
          {errors.type && <p className="mt-2 text-sm text-red-600">{errors.type}</p>}
        </div>

        {/* Upload fichiers */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Fichiers</h3>

          {/* Certificat */}
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
                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation();
                      setCertFile(null);
                      setPreview(null);
                    }}
                    className="text-red-600 hover:underline text-sm ml-4"
                  >
                    Supprimer
                  </button>
                </div>
              ) : (
                <div>
                  <span className="text-4xl block mb-2">📄</span>
                  <p className="text-gray-600">Cliquez pour sélectionner ou glissez-déposez</p>
                  <p className="text-sm text-gray-400">Formats acceptés: PEM, CRT, CER, P12, PFX</p>
                </div>
              )}
            </div>
            {errors.cert && <p className="mt-2 text-sm text-red-600">{errors.cert}</p>}
          </div>

          {/* Clé privée */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Clé privée (.key, .pem) {formData.type === 'SERV_SSL' ? '*' : '(optionnel)'}
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
                  <div>
                    <p className="font-medium">{keyFile.name}</p>
                    <p className="text-sm text-gray-500">{(keyFile.size / 1024).toFixed(2)} KB</p>
                  </div>
                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation();
                      setKeyFile(null);
                    }}
                    className="text-red-600 hover:underline text-sm ml-4"
                  >
                    Supprimer
                  </button>
                </div>
              ) : (
                <div>
                  <span className="text-4xl block mb-2">🔑</span>
                  <p className="text-gray-600">Cliquez pour sélectionner la clé privée</p>
                </div>
              )}
            </div>
            {errors.key && <p className="mt-2 text-sm text-red-600">{errors.key}</p>}
          </div>

          {/* Passphrase */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Passphrase (si clé protégée)
            </label>
            <input
              type="password"
              value={formData.passphrase}
              onChange={e => setFormData({ ...formData, passphrase: e.target.value })}
              className="w-full border rounded-md px-3 py-2"
              placeholder="Laissez vide si non protégée"
            />
          </div>
        </div>

        {/* Aperçu du certificat */}
        {verifying && (
          <div className="bg-blue-50 rounded-lg p-4 flex items-center gap-3">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
            <span>Vérification du certificat...</span>
          </div>
        )}

        {preview && (
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <span className="text-green-500">✅</span>
              Aperçu du certificat
            </h3>
            <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <dt className="text-sm text-gray-500">Sujet (CN)</dt>
                <dd className="font-medium">
                  {preview.subject?.commonName || preview.subject?.CN}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Organisation</dt>
                <dd className="font-medium">
                  {preview.subject?.organizationName || preview.subject?.O || 'N/A'}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Émetteur</dt>
                <dd className="font-medium">{preview.issuer?.commonName || preview.issuer?.CN}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Validité</dt>
                <dd className="font-medium">
                  {new Date(preview.validFrom).toLocaleDateString('fr-FR')} →{' '}
                  {new Date(preview.validTo).toLocaleDateString('fr-FR')}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Jours restants</dt>
                <dd
                  className={`font-bold ${
                    preview.daysUntilExpiry <= 30
                      ? 'text-red-600'
                      : preview.daysUntilExpiry <= 90
                        ? 'text-yellow-600'
                        : 'text-green-600'
                  }`}
                >
                  {preview.daysUntilExpiry} jours
                </dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">N° série</dt>
                <dd className="font-mono text-sm">{preview.serialNumber}</dd>
              </div>
            </dl>

            {preview.isExpired && (
              <div className="mt-4 bg-red-50 border-l-4 border-red-400 p-3">
                <p className="text-red-700 text-sm">
                  ⚠️ Ce certificat est expiré et ne peut pas être importé.
                </p>
              </div>
            )}

            {preview.isExpiringSoon && !preview.isExpired && (
              <div className="mt-4 bg-yellow-50 border-l-4 border-yellow-400 p-3">
                <p className="text-yellow-700 text-sm">
                  ⚠️ Ce certificat expire dans moins de 30 jours. Pensez à le renouveler rapidement.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-4">
          <Link to="/admin/certificates" className="px-6 py-2 border rounded-md hover:bg-gray-50">
            Annuler
          </Link>
          <button
            type="submit"
            disabled={loading || verifying || preview?.isExpired}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Import en cours...
              </>
            ) : (
              <>📤 Importer le certificat</>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CertificateUpload;
