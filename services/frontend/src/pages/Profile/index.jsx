// services/frontend/src/pages/Profile/index.jsx
/**
 * Page de profil utilisateur
 */

import React, { useState } from 'react';

import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';

const Profile = () => {
  const { user, updateUser } = useAuth();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  const [formData, setFormData] = useState({
    first_name: user?.first_name || '',
    last_name: user?.last_name || '',
    phone: user?.phone || ''
  });

  const handleChange = e => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const response = await api.put('/users/me', formData);
      if (updateUser) {
        updateUser(response.data);
      }
      setMessage({ type: 'success', text: 'Profil mis à jour avec succès' });
      setEditing(false);
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'Erreur lors de la mise à jour' });
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    try {
      await api.post('/auth/request-password-reset', { email: user.email });
      alert('Un email de réinitialisation a été envoyé à votre adresse');
    } catch (error) {
      alert("Erreur lors de l'envoi de l'email");
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* En-tête */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Mon profil</h1>
        <p className="text-gray-500">Gérez vos informations personnelles</p>
      </div>

      {/* Message */}
      {message && (
        <div
          className={`p-4 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-50 border border-green-200 text-green-700'
              : 'bg-red-50 border border-red-200 text-red-700'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Carte profil */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-start gap-6">
          {/* Avatar */}
          <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 text-3xl font-bold">
            {(user?.first_name?.[0] || user?.email?.[0] || '?').toUpperCase()}
          </div>

          {/* Infos */}
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-gray-900">
              {user?.first_name} {user?.last_name}
            </h2>
            <p className="text-gray-500">{user?.email}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                {user?.role === 'super_admin'
                  ? 'Super Admin'
                  : user?.role === 'domain_admin'
                    ? 'Admin Domaine'
                    : 'Utilisateur'}
              </span>
              {user?.rpps && (
                <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">
                  RPPS: {user.rpps}
                </span>
              )}
            </div>
          </div>

          {/* Actions */}
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              ✏️ Modifier
            </button>
          )}
        </div>
      </div>

      {/* Formulaire d'édition */}
      {editing && (
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-4">
          <h3 className="text-lg font-semibold mb-4">Modifier mes informations</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Prénom</label>
              <input
                type="text"
                name="first_name"
                value={formData.first_name}
                onChange={handleChange}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nom</label>
              <input
                type="text"
                name="last_name"
                value={formData.last_name}
                onChange={handleChange}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              className="w-full max-w-xs px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Enregistrement...' : 'Enregistrer'}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="px-4 py-2 border rounded-lg hover:bg-gray-50"
            >
              Annuler
            </button>
          </div>
        </form>
      )}

      {/* Informations du compte */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Informations du compte</h3>
        <dl className="space-y-3">
          <div className="flex justify-between py-2 border-b">
            <dt className="text-gray-500">Email</dt>
            <dd className="font-medium">{user?.email}</dd>
          </div>
          <div className="flex justify-between py-2 border-b">
            <dt className="text-gray-500">Domaine</dt>
            <dd className="font-medium">{user?.domain_name || '-'}</dd>
          </div>
          <div className="flex justify-between py-2 border-b">
            <dt className="text-gray-500">Dernière connexion</dt>
            <dd className="font-medium">
              {user?.last_login ? new Date(user.last_login).toLocaleString('fr-FR') : 'Jamais'}
            </dd>
          </div>
          <div className="flex justify-between py-2">
            <dt className="text-gray-500">Compte créé le</dt>
            <dd className="font-medium">
              {user?.created_at ? new Date(user.created_at).toLocaleDateString('fr-FR') : '-'}
            </dd>
          </div>
        </dl>
      </div>

      {/* Sécurité */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Sécurité</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <p className="font-medium">Mot de passe</p>
              <p className="text-sm text-gray-500">Modifier votre mot de passe</p>
            </div>
            <button
              onClick={handleChangePassword}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Changer
            </button>
          </div>
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <p className="font-medium">Authentification Pro Santé Connect</p>
              <p className="text-sm text-gray-500">
                {user?.psc_linked ? 'Compte lié' : 'Non configuré'}
              </p>
            </div>
            <span
              className={`px-3 py-1 rounded-full text-sm ${
                user?.psc_linked ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
              }`}
            >
              {user?.psc_linked ? '✓ Actif' : 'Non lié'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
