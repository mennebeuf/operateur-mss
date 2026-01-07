// services/frontend/src/pages/Mailboxes/MailboxCreate.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import Loader from '../../components/Common/Loader';
import { useAuth } from '../../contexts/AuthContext';
import { mailboxApi } from '../../services/mailboxApi';

const MailboxCreate = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  // État du formulaire
  const [formData, setFormData] = useState({
    type: 'personal',
    localPart: '',
    firstName: '',
    lastName: '',
    rppsId: '',
    adeliId: '',
    finessJuridique: '',
    finessGeographique: '',
    serviceName: '',
    serviceType: '',
    applicationName: '',
    applicationDescription: '',
    quotaMb: 1000,
    hideFromDirectory: false,
    autoReply: false,
    autoReplyMessage: ''
  });

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [domainSuffix, setDomainSuffix] = useState('');
  const [availableQuotas, setAvailableQuotas] = useState([500, 1000, 2000, 5000]);

  // Charger les infos du domaine
  useEffect(() => {
    if (user?.domain?.name) {
      setDomainSuffix(`@${user.domain.name}`);
    }
  }, [user]);

  // Validation en temps réel
  const validateField = (name, value) => {
    const newErrors = { ...errors };

    switch (name) {
      case 'localPart':
        if (!value) {
          newErrors.localPart = "L'adresse est requise";
        } else if (!/^[a-z0-9._-]+$/i.test(value)) {
          newErrors.localPart = 'Caractères autorisés : lettres, chiffres, ., _, -';
        } else if (value.length < 3) {
          newErrors.localPart = 'Minimum 3 caractères';
        } else {
          delete newErrors.localPart;
        }
        break;

      case 'firstName':
        if (formData.type === 'personal' && !value) {
          newErrors.firstName = 'Le prénom est requis';
        } else {
          delete newErrors.firstName;
        }
        break;

      case 'lastName':
        if (formData.type === 'personal' && !value) {
          newErrors.lastName = 'Le nom est requis';
        } else {
          delete newErrors.lastName;
        }
        break;

      case 'rppsId':
        if (formData.type === 'personal' && value && !/^\d{11}$/.test(value)) {
          newErrors.rppsId = 'Le RPPS doit contenir 11 chiffres';
        } else {
          delete newErrors.rppsId;
        }
        break;

      case 'serviceName':
        if (formData.type === 'organizational' && !value) {
          newErrors.serviceName = 'Le nom du service est requis';
        } else {
          delete newErrors.serviceName;
        }
        break;

      case 'applicationName':
        if (formData.type === 'applicative' && !value) {
          newErrors.applicationName = "Le nom de l'application est requis";
        } else {
          delete newErrors.applicationName;
        }
        break;

      default:
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Gestionnaire de changement
  const handleChange = e => {
    const { name, value, type, checked } = e.target;
    const newValue = type === 'checkbox' ? checked : value;

    setFormData(prev => ({
      ...prev,
      [name]: newValue
    }));

    // Valider le champ modifié
    validateField(name, newValue);
  };

  // Changement de type de BAL
  const handleTypeChange = newType => {
    setFormData(prev => ({
      ...prev,
      type: newType,
      // Reset des champs spécifiques
      firstName: '',
      lastName: '',
      rppsId: '',
      adeliId: '',
      serviceName: '',
      serviceType: '',
      applicationName: '',
      applicationDescription: ''
    }));
    setErrors({});
  };

  // Génération automatique de l'adresse
  const generateLocalPart = () => {
    let suggested = '';

    if (formData.type === 'personal') {
      if (formData.firstName && formData.lastName) {
        suggested = `${formData.firstName.toLowerCase()}.${formData.lastName.toLowerCase()}`
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9.-]/g, '');
      }
    } else if (formData.type === 'organizational') {
      if (formData.serviceName) {
        suggested = formData.serviceName
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]/g, '-')
          .replace(/-+/g, '-');
      }
    } else if (formData.type === 'applicative') {
      if (formData.applicationName) {
        suggested = `app.${formData.applicationName.toLowerCase()}`
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9.]/g, '-')
          .replace(/-+/g, '-');
      }
    }

    if (suggested) {
      setFormData(prev => ({ ...prev, localPart: suggested }));
    }
  };

  // Validation complète du formulaire
  const validateForm = () => {
    const newErrors = {};

    // Champs communs
    if (!formData.localPart) {
      newErrors.localPart = "L'adresse est requise";
    } else if (!/^[a-z0-9._-]+$/i.test(formData.localPart)) {
      newErrors.localPart = 'Caractères autorisés : lettres, chiffres, ., _, -';
    }

    // Champs spécifiques par type
    if (formData.type === 'personal') {
      if (!formData.firstName) {
        newErrors.firstName = 'Le prénom est requis';
      }
      if (!formData.lastName) {
        newErrors.lastName = 'Le nom est requis';
      }
      if (formData.rppsId && !/^\d{11}$/.test(formData.rppsId)) {
        newErrors.rppsId = 'Le RPPS doit contenir 11 chiffres';
      }
    } else if (formData.type === 'organizational') {
      if (!formData.serviceName) {
        newErrors.serviceName = 'Le nom du service est requis';
      }
    } else if (formData.type === 'applicative') {
      if (!formData.applicationName) {
        newErrors.applicationName = "Le nom de l'application est requis";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Soumission du formulaire
  const handleSubmit = async e => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const email = `${formData.localPart}${domainSuffix}`;

      const payload = {
        email,
        type: formData.type,
        quotaMb: formData.quotaMb,
        hideFromDirectory: formData.hideFromDirectory
      };

      // Ajouter les champs spécifiques selon le type
      if (formData.type === 'personal') {
        payload.owner = {
          firstName: formData.firstName,
          lastName: formData.lastName,
          rppsId: formData.rppsId || undefined,
          adeliId: formData.adeliId || undefined
        };
      } else if (formData.type === 'organizational') {
        payload.service = {
          name: formData.serviceName,
          type: formData.serviceType || undefined
        };
        if (formData.finessJuridique) {
          payload.finess = {
            juridique: formData.finessJuridique,
            geographique: formData.finessGeographique || undefined
          };
        }
      } else if (formData.type === 'applicative') {
        payload.application = {
          name: formData.applicationName,
          description: formData.applicationDescription || undefined
        };
      }

      // Auto-réponse
      if (formData.autoReply && formData.autoReplyMessage) {
        payload.autoReply = {
          enabled: true,
          message: formData.autoReplyMessage
        };
      }

      await mailboxApi.create(payload);

      navigate('/mailboxes', {
        state: { success: `La BAL ${email} a été créée avec succès` }
      });
    } catch (err) {
      console.error('Erreur création BAL:', err);

      if (err.response?.data?.code === 'MAILBOX_EXISTS') {
        setErrors({ localPart: 'Cette adresse existe déjà' });
      } else if (err.response?.data?.code === 'QUOTA_EXCEEDED') {
        setErrors({ form: 'Quota de boîtes aux lettres atteint pour ce domaine' });
      } else {
        setErrors({ form: err.response?.data?.error || 'Erreur lors de la création' });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => navigate('/mailboxes')}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
        >
          <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Retour à la liste
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Créer une boîte aux lettres</h1>
        <p className="text-gray-600 mt-1">Configurez votre nouvelle BAL MSSanté</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Erreur générale */}
        {errors.form && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {errors.form}
          </div>
        )}

        {/* Sélection du type */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Type de boîte aux lettres</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                value: 'personal',
                label: 'Personnelle',
                icon: '👤',
                desc: 'BAL rattachée à un professionnel de santé'
              },
              {
                value: 'organizational',
                label: 'Organisationnelle',
                icon: '🏥',
                desc: 'BAL rattachée à un service ou une structure'
              },
              {
                value: 'applicative',
                label: 'Applicative',
                icon: '🤖',
                desc: 'BAL pour échanges automatisés (API)'
              }
            ].map(type => (
              <button
                key={type.value}
                type="button"
                onClick={() => handleTypeChange(type.value)}
                className={`p-4 border-2 rounded-lg text-left transition ${
                  formData.type === type.value
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="text-2xl mb-2">{type.icon}</div>
                <div className="font-medium">{type.label}</div>
                <div className="text-sm text-gray-500 mt-1">{type.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Adresse email */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Adresse email</h2>
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <div className="relative">
                <input
                  type="text"
                  name="localPart"
                  value={formData.localPart}
                  onChange={handleChange}
                  placeholder="prenom.nom"
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                    errors.localPart ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
              </div>
              {errors.localPart && <p className="text-red-500 text-sm mt-1">{errors.localPart}</p>}
            </div>
            <span className="text-gray-500 font-medium">{domainSuffix}</span>
          </div>
          <button
            type="button"
            onClick={generateLocalPart}
            className="mt-2 text-sm text-blue-600 hover:text-blue-800"
          >
            Générer automatiquement
          </button>
        </div>

        {/* Champs spécifiques au type */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">
            {formData.type === 'personal' && 'Informations du titulaire'}
            {formData.type === 'organizational' && 'Informations du service'}
            {formData.type === 'applicative' && "Informations de l'application"}
          </h2>

          {/* BAL Personnelle */}
          {formData.type === 'personal' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="fistname" className="block text-sm font-medium text-gray-700 mb-1">
                  Prénom <span className="text-red-500">*</span>
                </label>
                <input
                  id="firstname"
                  type="text"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                    errors.firstName ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.firstName && (
                  <p className="text-red-500 text-sm mt-1">{errors.firstName}</p>
                )}
              </div>
              <div>
                <label htmlFor="lastname" className="block text-sm font-medium text-gray-700 mb-1">
                  Nom <span className="text-red-500">*</span>
                </label>
                <input
                  id="lastname"
                  type="text"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                    errors.lastName ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.lastName && <p className="text-red-500 text-sm mt-1">{errors.lastName}</p>}
              </div>
              <div>
                <label htmlFor="rpps-id" className="block text-sm font-medium text-gray-700 mb-1">N° RPPS</label>
                <input
                  id="rpps-id"
                  type="text"
                  name="rppsId"
                  value={formData.rppsId}
                  onChange={handleChange}
                  placeholder="11 chiffres"
                  maxLength={11}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                    errors.rppsId ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.rppsId && <p className="text-red-500 text-sm mt-1">{errors.rppsId}</p>}
              </div>
              <div>
                <label htmlFor="adeli-id" className="block text-sm font-medium text-gray-700 mb-1">N° ADELI</label>
                <input
                  id="adeli-id"
                  type="text"
                  name="adeliId"
                  value={formData.adeliId}
                  onChange={handleChange}
                  placeholder="Optionnel"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}

          {/* BAL Organisationnelle */}
          {formData.type === 'organizational' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="service-name" className="block text-sm font-medium text-gray-700 mb-1">
                    Nom du service <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="service-name"
                    type="text"
                    name="serviceName"
                    value={formData.serviceName}
                    onChange={handleChange}
                    placeholder="Ex: Secrétariat Cardiologie"
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                      errors.serviceName ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {errors.serviceName && (
                    <p className="text-red-500 text-sm mt-1">{errors.serviceName}</p>
                  )}
                </div>
                <div>
                  <label htmlFor="service-type" className="block text-sm font-medium text-gray-700 mb-1">
                    Type de service
                  </label>
                  <select
                    id="service-type"
                    name="serviceType"
                    value={formData.serviceType}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Sélectionner...</option>
                    <option value="secretariat">Secrétariat</option>
                    <option value="accueil">Accueil</option>
                    <option value="direction">Direction</option>
                    <option value="service_medical">Service médical</option>
                    <option value="autre">Autre</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="finess-juridique" className="block text-sm font-medium text-gray-700 mb-1">
                    FINESS Juridique
                  </label>
                  <input
                    id="finess-juridique"
                    type="text"
                    name="finessJuridique"
                    value={formData.finessJuridique}
                    onChange={handleChange}
                    placeholder="9 chiffres"
                    maxLength={9}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label htmlFor="finess-geographique" className="block text-sm font-medium text-gray-700 mb-1">
                    FINESS Géographique
                  </label>
                  <input
                    id="finess-geographique"
                    type="text"
                    name="finessGeographique"
                    value={formData.finessGeographique}
                    onChange={handleChange}
                    placeholder="9 chiffres"
                    maxLength={9}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* BAL Applicative */}
          {formData.type === 'applicative' && (
            <div className="space-y-4">
              <div>
                <label htmlFor="app-name" className="block text-sm font-medium text-gray-700 mb-1">
                  Nom de l'application <span className="text-red-500">*</span>
                </label>
                <input
                  id="application-name"
                  type="text"
                  name="applicationName"
                  value={formData.applicationName}
                  onChange={handleChange}
                  placeholder="Ex: DPI-Integration"
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                    errors.applicationName ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.applicationName && (
                  <p className="text-red-500 text-sm mt-1">{errors.applicationName}</p>
                )}
              </div>
              <div>
                <label htmlFor="app-description" className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  id="application-description"
                  name="applicationDescription"
                  value={formData.applicationDescription}
                  onChange={handleChange}
                  rows={3}
                  placeholder="Décrivez l'usage de cette BAL applicative..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-800">
                  <strong>Note :</strong> Les BAL applicatives nécessitent un certificat IGC-Santé
                  pour l'authentification. Vous pourrez le configurer après la création.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Options */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Options</h2>
          <div className="space-y-4">
            <div>
              <label htmlFor="quota-gb" className="block text-sm font-medium text-gray-700 mb-1">
                Quota de stockage
              </label>
              <select
                id="quota-gb"
                name="quotaMb"
                value={formData.quotaMb}
                onChange={handleChange}
                className="w-full md:w-48 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                {availableQuotas.map(q => (
                  <option key={q} value={q}>
                    {q} Mo
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="hideFromDirectory"
                name="hideFromDirectory"
                checked={formData.hideFromDirectory}
                onChange={handleChange}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="hideFromDirectory" className="ml-2 block text-sm text-gray-700">
                Liste rouge (ne pas publier dans l'annuaire MSSanté)
              </label>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="autoReply"
                name="autoReply"
                checked={formData.autoReply}
                onChange={handleChange}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="autoReply" className="ml-2 block text-sm text-gray-700">
                Activer la réponse automatique
              </label>
            </div>

            {formData.autoReply && (
              <div className="ml-6">
                <label htmlFor="auto-reply-msg" className="block text-sm font-medium text-gray-700 mb-1">
                  Message de réponse automatique
                </label>
                <textarea
                  id="auto-reply-msg"
                  name="autoReplyMessage"
                  value={formData.autoReplyMessage}
                  onChange={handleChange}
                  rows={3}
                  placeholder="Je suis actuellement absent..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}
          </div>
        </div>

        {/* Boutons */}
        <div className="flex justify-end gap-4">
          <button
            type="button"
            onClick={() => navigate('/mailboxes')}
            className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader size="small" />
                Création en cours...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                Créer la BAL
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default MailboxCreate;
