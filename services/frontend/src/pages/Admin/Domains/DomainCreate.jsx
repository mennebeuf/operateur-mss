// services/frontend/src/pages/Admin/Domains/DomainCreate.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const DomainCreate = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [formData, setFormData] = useState({
    domain_name: '',
    finess_juridique: '',
    finess_geographique: '',
    organization_name: '',
    organization_type: 'hospital',
    contact_email: '',
    contact_phone: '',
    max_mailboxes: 100,
    max_storage_gb: 100
  });

  const organizationTypes = [
    { value: 'hospital', label: 'Hôpital' },
    { value: 'clinic', label: 'Clinique' },
    { value: 'lab', label: 'Laboratoire' },
    { value: 'private_practice', label: 'Cabinet privé' },
    { value: 'health_center', label: 'Centre de santé' },
    { value: 'pharmacy', label: 'Pharmacie' },
    { value: 'nursing_home', label: 'EHPAD' },
    { value: 'medical_imaging', label: 'Imagerie médicale' },
    { value: 'other', label: 'Autre' }
  ];

  const validateForm = () => {
    const newErrors = {};

    if (!formData.domain_name) {
      newErrors.domain_name = 'Nom de domaine requis';
    } else if (!formData.domain_name.endsWith('.mssante.fr')) {
      newErrors.domain_name = 'Le domaine doit se terminer par .mssante.fr';
    } else if (!/^[a-z0-9-]+\.mssante\.fr$/.test(formData.domain_name)) {
      newErrors.domain_name = 'Format invalide (lettres minuscules, chiffres et tirets uniquement)';
    }

    if (!formData.finess_juridique) {
      newErrors.finess_juridique = 'FINESS Juridique requis';
    } else if (!/^\d{9}$/.test(formData.finess_juridique)) {
      newErrors.finess_juridique = 'Format invalide (9 chiffres)';
    }

    if (formData.finess_geographique && !/^\d{9}$/.test(formData.finess_geographique)) {
      newErrors.finess_geographique = 'Format invalide (9 chiffres)';
    }

    if (!formData.organization_name) {
      newErrors.organization_name = "Nom de l'organisation requis";
    } else if (formData.organization_name.length < 2) {
      newErrors.organization_name = 'Minimum 2 caractères';
    }

    if (formData.contact_email && !/\S+@\S+\.\S+/.test(formData.contact_email)) {
      newErrors.contact_email = 'Email invalide';
    }

    if (
      formData.contact_phone &&
      !/^(\+33|0)[1-9](\d{2}){4}$/.test(formData.contact_phone.replace(/\s/g, ''))
    ) {
      newErrors.contact_phone = 'Téléphone invalide';
    }

    if (formData.max_mailboxes < 1 || formData.max_mailboxes > 10000) {
      newErrors.max_mailboxes = 'Entre 1 et 10 000 BAL';
    }

    if (formData.max_storage_gb < 1 || formData.max_storage_gb > 1000) {
      newErrors.max_storage_gb = 'Entre 1 et 1000 GB';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = e => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'domain_name' ? value.toLowerCase() : value
    }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  const handleSubmit = async e => {
    e.preventDefault();
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/v1/admin/domains', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          domain_name: formData.domain_name,
          finess_juridique: formData.finess_juridique,
          finess_geographique: formData.finess_geographique || undefined,
          organization_name: formData.organization_name,
          organization_type: formData.organization_type,
          contact_email: formData.contact_email || undefined,
          contact_phone: formData.contact_phone || undefined,
          quotas: {
            max_mailboxes: parseInt(formData.max_mailboxes),
            max_storage_gb: parseInt(formData.max_storage_gb)
          }
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erreur lors de la création');
      }

      navigate(`/admin/domains/${data.data.id}`, {
        state: { message: 'Domaine créé avec succès', dnsRecords: data.data.requiredDnsRecords }
      });
    } catch (error) {
      setErrors({ submit: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <button
          onClick={() => navigate('/admin/domains')}
          className="text-gray-600 hover:text-gray-800 flex items-center gap-2"
        >
          ← Retour à la liste
        </button>
      </div>

      <h1 className="text-2xl font-bold mb-6">Créer un nouveau domaine</h1>

      {errors.submit && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
          {errors.submit}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white shadow rounded-lg p-6 space-y-4">
          <h2 className="font-bold text-lg border-b pb-2">Informations du domaine</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">
                Nom de domaine <span className="text-red-500">*</span>
                <span className="text-gray-500 font-normal ml-1">(.mssante.fr)</span>
              </label>
              <input
                type="text"
                name="domain_name"
                value={formData.domain_name}
                onChange={handleChange}
                placeholder="hopital-exemple.mssante.fr"
                className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 ${
                  errors.domain_name ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {errors.domain_name && (
                <p className="text-red-500 text-sm mt-1">{errors.domain_name}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                FINESS Juridique <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="finess_juridique"
                value={formData.finess_juridique}
                onChange={handleChange}
                placeholder="750000001"
                maxLength={9}
                className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 ${
                  errors.finess_juridique ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {errors.finess_juridique && (
                <p className="text-red-500 text-sm mt-1">{errors.finess_juridique}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                FINESS Géographique <span className="text-gray-400">(optionnel)</span>
              </label>
              <input
                type="text"
                name="finess_geographique"
                value={formData.finess_geographique}
                onChange={handleChange}
                placeholder="750000002"
                maxLength={9}
                className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 ${
                  errors.finess_geographique ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {errors.finess_geographique && (
                <p className="text-red-500 text-sm mt-1">{errors.finess_geographique}</p>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white shadow rounded-lg p-6 space-y-4">
          <h2 className="font-bold text-lg border-b pb-2">Organisation</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">
                Nom de l'organisation <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="organization_name"
                value={formData.organization_name}
                onChange={handleChange}
                placeholder="Hôpital Exemple"
                className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 ${
                  errors.organization_name ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {errors.organization_name && (
                <p className="text-red-500 text-sm mt-1">{errors.organization_name}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Type d'organisation</label>
              <select
                name="organization_type"
                value={formData.organization_type}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              >
                {organizationTypes.map(type => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Email de contact</label>
              <input
                type="email"
                name="contact_email"
                value={formData.contact_email}
                onChange={handleChange}
                placeholder="admin@hopital-exemple.fr"
                className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 ${
                  errors.contact_email ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {errors.contact_email && (
                <p className="text-red-500 text-sm mt-1">{errors.contact_email}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Téléphone de contact</label>
              <input
                type="tel"
                name="contact_phone"
                value={formData.contact_phone}
                onChange={handleChange}
                placeholder="01 23 45 67 89"
                className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 ${
                  errors.contact_phone ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {errors.contact_phone && (
                <p className="text-red-500 text-sm mt-1">{errors.contact_phone}</p>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white shadow rounded-lg p-6 space-y-4">
          <h2 className="font-bold text-lg border-b pb-2">Quotas</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Nombre maximum de BAL</label>
              <input
                type="number"
                name="max_mailboxes"
                value={formData.max_mailboxes}
                onChange={handleChange}
                min={1}
                max={10000}
                className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 ${
                  errors.max_mailboxes ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {errors.max_mailboxes && (
                <p className="text-red-500 text-sm mt-1">{errors.max_mailboxes}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Stockage maximum (GB)</label>
              <input
                type="number"
                name="max_storage_gb"
                value={formData.max_storage_gb}
                onChange={handleChange}
                min={1}
                max={1000}
                className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 ${
                  errors.max_storage_gb ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {errors.max_storage_gb && (
                <p className="text-red-500 text-sm mt-1">{errors.max_storage_gb}</p>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-4 justify-end">
          <button
            type="button"
            onClick={() => navigate('/admin/domains')}
            className="px-6 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Création...' : 'Créer le domaine'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default DomainCreate;
