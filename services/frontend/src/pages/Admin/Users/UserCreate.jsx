// services/frontend/src/pages/Admin/Users/UserCreate.jsx
/**
 * Création d'un utilisateur - Administration
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';

import { useAuth } from '../../../contexts/AuthContext';
import { adminApi } from '../../../services/adminApi';

const UserCreate = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user: currentUser } = useAuth();
  const isSuperAdmin = currentUser?.is_super_admin || currentUser?.role === 'super_admin';

  const [domains, setDomains] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const [formData, setFormData] = useState({
    email: '',
    first_name: '',
    last_name: '',
    rpps: '',
    role: 'user',
    domain_id: searchParams.get('domain') || '',
    send_invitation: true
  });

  useEffect(() => {
    if (isSuperAdmin) {
      loadDomains();
    }
  }, [isSuperAdmin]);

  const loadDomains = async () => {
    try {
      const response = await adminApi.getDomains({ limit: 100 });
      setDomains(response.data || []);
    } catch (error) {
      console.error('Erreur chargement domaines:', error);
    }
  };

  const handleChange = e => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    // Effacer l'erreur du champ modifié
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  const validate = () => {
    const newErrors = {};

    if (!formData.email) {
      newErrors.email = "L'email est requis";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Email invalide';
    }

    if (!formData.first_name) {
      newErrors.first_name = 'Le prénom est requis';
    }

    if (!formData.last_name) {
      newErrors.last_name = 'Le nom est requis';
    }

    if (isSuperAdmin && !formData.domain_id) {
      newErrors.domain_id = 'Le domaine est requis';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async e => {
    e.preventDefault();

    if (!validate()) {return;}

    setLoading(true);
    try {
      await adminApi.createUser(formData);
      navigate('/admin/users', {
        state: { message: 'Utilisateur créé avec succès' }
      });
    } catch (error) {
      console.error('Erreur création utilisateur:', error);
      if (error.details) {
        setErrors(
          error.details.reduce((acc, err) => {
            acc[err.field] = err.message;
            return acc;
          }, {})
        );
      } else {
        setErrors({ general: error.message || 'Erreur lors de la création' });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      {/* En-tête */}
      <div className="mb-6">
        <Link to="/admin/users" className="text-blue-600 hover:underline text-sm">
          ← Retour à la liste
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">Nouvel utilisateur</h1>
      </div>

      {/* Formulaire */}
      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-6">
        {errors.general && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {errors.general}
          </div>
        )}

        {/* Domaine (Super Admin uniquement) */}
        {isSuperAdmin && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Domaine <span className="text-red-500">*</span>
            </label>
            <select
              name="domain_id"
              value={formData.domain_id}
              onChange={handleChange}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                errors.domain_id ? 'border-red-500' : 'border-gray-300'
              }`}
            >
              <option value="">Sélectionner un domaine</option>
              {domains.map(domain => (
                <option key={domain.id} value={domain.id}>
                  {domain.organization_name} ({domain.domain_name})
                </option>
              ))}
            </select>
            {errors.domain_id && <p className="mt-1 text-sm text-red-500">{errors.domain_id}</p>}
          </div>
        )}

        {/* Email */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
              errors.email ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="utilisateur@domaine.mssante.fr"
          />
          {errors.email && <p className="mt-1 text-sm text-red-500">{errors.email}</p>}
        </div>

        {/* Prénom / Nom */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Prénom <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="first_name"
              value={formData.first_name}
              onChange={handleChange}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                errors.first_name ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {errors.first_name && <p className="mt-1 text-sm text-red-500">{errors.first_name}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nom <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="last_name"
              value={formData.last_name}
              onChange={handleChange}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                errors.last_name ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {errors.last_name && <p className="mt-1 text-sm text-red-500">{errors.last_name}</p>}
          </div>
        </div>

        {/* RPPS */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Numéro RPPS</label>
          <input
            type="text"
            name="rpps"
            value={formData.rpps}
            onChange={handleChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            placeholder="11 chiffres"
            maxLength={11}
          />
          <p className="mt-1 text-xs text-gray-500">
            Optionnel - Requis pour les professionnels de santé
          </p>
        </div>

        {/* Rôle */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Rôle</label>
          <select
            name="role"
            value={formData.role}
            onChange={handleChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="user">Utilisateur</option>
            <option value="domain_admin">Administrateur du domaine</option>
            {isSuperAdmin && <option value="super_admin">Super Administrateur</option>}
          </select>
        </div>

        {/* Option d'invitation */}
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            name="send_invitation"
            id="send_invitation"
            checked={formData.send_invitation}
            onChange={handleChange}
            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          <label htmlFor="send_invitation" className="text-sm text-gray-700">
            Envoyer une invitation par email
          </label>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-4 pt-4 border-t">
          <Link
            to="/admin/users"
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Annuler
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Création...' : "Créer l'utilisateur"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default UserCreate;
