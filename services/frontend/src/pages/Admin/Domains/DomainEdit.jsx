// services/frontend/src/pages/Admin/Domains/DomainEdit.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

const DomainEdit = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [formData, setFormData] = useState({
    organization_name: '',
    organization_type: '',
    contact_email: '',
    contact_phone: '',
    max_mailboxes: 100,
    max_storage_gb: 100,
    status: 'active'
  });
  const [originalData, setOriginalData] = useState(null);

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

  useEffect(() => {
    loadDomain();
  }, [id]);

  const loadDomain = async () => {
    try {
      const response = await fetch(`/api/v1/admin/domains/${id}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await response.json();
      
      if (data.success) {
        const domain = data.data;
        setOriginalData(domain);
        setFormData({
          organization_name: domain.organization_name || '',
          organization_type: domain.organization_type || 'hospital',
          contact_email: domain.contact_email || '',
          contact_phone: domain.contact_phone || '',
          max_mailboxes: domain.quotas?.max_mailboxes || 100,
          max_storage_gb: domain.quotas?.max_storage_gb || 100,
          status: domain.status || 'active'
        });
      }
    } catch (error) {
      console.error('Erreur chargement domaine:', error);
    } finally {
      setLoading(false);
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.organization_name || formData.organization_name.length < 2) {
      newErrors.organization_name = 'Minimum 2 caractères requis';
    }

    if (formData.contact_email && !/\S+@\S+\.\S+/.test(formData.contact_email)) {
      newErrors.contact_email = 'Email invalide';
    }

    if (formData.contact_phone && !/^(\+33|0)[1-9](\d{2}){4}$/.test(formData.contact_phone.replace(/\s/g, ''))) {
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

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/v1/admin/domains/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          organizationName: formData.organization_name,
          contactEmail: formData.contact_email || undefined,
          contactPhone: formData.contact_phone || undefined,
          quotas: {
            max_mailboxes: parseInt(formData.max_mailboxes),
            max_storage_gb: parseInt(formData.max_storage_gb)
          },
          status: formData.status,
          settings: {
            organization_type: formData.organization_type
          }
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erreur lors de la mise à jour');
      }

      navigate(`/admin/domains/${id}`, { state: { message: 'Domaine mis à jour avec succès' } });

    } catch (error) {
      setErrors({ submit: error.message });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!originalData) {
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
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <button
          onClick={() => navigate(`/admin/domains/${id}`)}
          className="text-gray-600 hover:text-gray-800 flex items-center gap-2"
        >
          ← Retour au détail
        </button>
      </div>

      <h1 className="text-2xl font-bold mb-2">Modifier le domaine</h1>
      <p className="text-gray-600 mb-6">{originalData.domain_name}</p>

      {errors.submit && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
          {errors.submit}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white shadow rounded-lg p-6 space-y-4">
          <h2 className="font-bold text-lg border-b pb-2">Informations de l'organisation</h2>

          <div className="bg-gray-50 p-4 rounded-md">
            <p className="text-sm text-gray-500 mb-1">Nom de domaine (non modifiable)</p>
            <p className="font-medium">{originalData.domain_name}</p>
          </div>

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
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Statut</label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              >
                <option value="active">Actif</option>
                <option value="suspended">Suspendu</option>
                <option value="pending">En attente</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Email de contact</label>
              <input
                type="email"
                name="contact_email"
                value={formData.contact_email}
                onChange={handleChange}
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
              <p className="text-sm text-gray-500 mt-1">
                Actuellement utilisé : {originalData.mailboxes_count || 0}
              </p>
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

        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="font-medium mb-2">Informations non modifiables</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">FINESS Juridique :</span>{' '}
              <span className="font-medium">{originalData.finess_juridique}</span>
            </div>
            <div>
              <span className="text-gray-500">FINESS Géographique :</span>{' '}
              <span className="font-medium">{originalData.finess_geographique || '-'}</span>
            </div>
            <div>
              <span className="text-gray-500">Créé le :</span>{' '}
              <span className="font-medium">{new Date(originalData.created_at).toLocaleDateString('fr-FR')}</span>
            </div>
            <div>
              <span className="text-gray-500">DNS vérifié :</span>{' '}
              <span className="font-medium">{originalData.dns_verified ? 'Oui' : 'Non'}</span>
            </div>
          </div>
        </div>

        <div className="flex gap-4 justify-end">
          <button
            type="button"
            onClick={() => navigate(`/admin/domains/${id}`)}
            className="px-6 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Enregistrement...' : 'Enregistrer les modifications'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default DomainEdit;