// services/frontend/src/pages/Admin/Users/UserEdit.jsx
/**
 * Édition d'un utilisateur - Administration
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';

import Loader from '../../../components/Common/Loader';
import { useAuth } from '../../../contexts/AuthContext';
import { adminApi } from '../../../services/adminApi';

const UserEdit = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const isSuperAdmin = currentUser?.is_super_admin || currentUser?.role === 'super_admin';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  const [formData, setFormData] = useState({
    email: '',
    first_name: '',
    last_name: '',
    rpps: '',
    role: 'user',
    status: 'active'
  });

  useEffect(() => {
    loadUser();
  }, [userId]);

  const loadUser = async () => {
    try {
      setLoading(true);
      const response = await adminApi.getUser(userId);
      const user = response.data || response;
      setFormData({
        email: user.email || '',
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        rpps: user.rpps || '',
        role: user.role || 'user',
        status: user.status || 'active'
      });
    } catch (error) {
      console.error('Erreur chargement utilisateur:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = e => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.first_name) {
      newErrors.first_name = 'Le prénom est requis';
    }
    if (!formData.last_name) {
      newErrors.last_name = 'Le nom est requis';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async e => {
    e.preventDefault();
    if (!validate()) {
      return;
    }

    setSaving(true);
    try {
      await adminApi.updateUser(userId, formData);
      navigate('/admin/users', {
        state: { message: 'Utilisateur modifié avec succès' }
      });
    } catch (error) {
      console.error('Erreur mise à jour:', error);
      setErrors({ general: error.message || 'Erreur lors de la mise à jour' });
    } finally {
      setSaving(false);
    }
  };

  const handleResetPassword = async () => {
    if (!window.confirm('Envoyer un email de réinitialisation du mot de passe ?')) {
      return;
    }
    try {
      await adminApi.resetUserPassword(userId);
      alert('Email de réinitialisation envoyé');
    } catch (error) {
      alert("Erreur lors de l'envoi");
    }
  };

  if (loading) {
    return <Loader message="Chargement de l'utilisateur..." />;
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      {/* En-tête */}
      <div className="mb-6">
        <Link to="/admin/users" className="text-blue-600 hover:underline text-sm">
          ← Retour à la liste
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">Modifier l'utilisateur</h1>
        <p className="text-gray-500">{formData.email}</p>
      </div>

      {/* Formulaire */}
      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-6">
        {errors.general && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {errors.general}
          </div>
        )}

        {/* Email (lecture seule) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input
            type="email"
            value={formData.email}
            disabled
            className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500"
          />
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
            maxLength={11}
          />
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

        {/* Statut */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Statut</label>
          <select
            name="status"
            value={formData.status}
            onChange={handleChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="active">Actif</option>
            <option value="inactive">Inactif</option>
            <option value="suspended">Suspendu</option>
          </select>
        </div>

        {/* Actions secondaires */}
        <div className="pt-4 border-t">
          <button
            type="button"
            onClick={handleResetPassword}
            className="text-blue-600 hover:underline text-sm"
          >
            🔑 Envoyer un email de réinitialisation du mot de passe
          </button>
        </div>

        {/* Actions principales */}
        <div className="flex justify-end gap-4 pt-4 border-t">
          <Link
            to="/admin/users"
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Annuler
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default UserEdit;
