// services/frontend/src/pages/Mailboxes/MailboxSettings.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';

import Loader from '../../components/Common/Loader';
import Modal from '../../components/Common/Modal';
import { useAuth } from '../../contexts/AuthContext';
import { mailboxApi } from '../../services/mailboxApi';

const MailboxSettings = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  // État
  const [mailbox, setMailbox] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [activeTab, setActiveTab] = useState('general');

  // Formulaire général
  const [generalForm, setGeneralForm] = useState({
    quotaMb: 1000,
    hideFromDirectory: false,
    status: 'active'
  });

  // Formulaire auto-réponse
  const [autoReplyForm, setAutoReplyForm] = useState({
    enabled: false,
    subject: 'Réponse automatique',
    message: '',
    startDate: '',
    endDate: ''
  });

  // Délégations
  const [delegations, setDelegations] = useState([]);
  const [showDelegationModal, setShowDelegationModal] = useState(false);
  const [newDelegation, setNewDelegation] = useState({ email: '', permissions: ['read'] });

  // Alias
  const [aliases, setAliases] = useState([]);
  const [newAlias, setNewAlias] = useState('');

  // Modals
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');

  // Chargement des données
  const fetchMailbox = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await mailboxApi.get(id);
      const data = response.data;

      setMailbox(data);
      setGeneralForm({
        quotaMb: data.quotaMb || 1000,
        hideFromDirectory: data.hideFromDirectory || false,
        status: data.status || 'active'
      });
      setAutoReplyForm({
        enabled: data.autoReply?.enabled || false,
        subject: data.autoReply?.subject || 'Réponse automatique',
        message: data.autoReply?.message || '',
        startDate: data.autoReply?.startDate || '',
        endDate: data.autoReply?.endDate || ''
      });
      setDelegations(data.delegations || []);
      setAliases(data.aliases || []);
    } catch (err) {
      console.error('Erreur chargement BAL:', err);
      setError('Impossible de charger les paramètres');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchMailbox();
  }, [fetchMailbox]);

  // Sauvegarde des paramètres généraux
  const handleSaveGeneral = async e => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      await mailboxApi.update(id, generalForm);
      setSuccess('Paramètres enregistrés');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError('Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  // Sauvegarde de l'auto-réponse
  const handleSaveAutoReply = async e => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      await mailboxApi.updateAutoReply(id, autoReplyForm);
      setSuccess('Réponse automatique mise à jour');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError('Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  // Gestion des délégations
  const handleAddDelegation = async () => {
    if (!newDelegation.email) {
      return;
    }

    try {
      await mailboxApi.addDelegation(id, newDelegation);
      setShowDelegationModal(false);
      setNewDelegation({ email: '', permissions: ['read'] });
      fetchMailbox();
      setSuccess('Délégation ajoutée');
    } catch (err) {
      setError(err.response?.data?.error || "Erreur lors de l'ajout");
    }
  };

  const handleRemoveDelegation = async delegationId => {
    if (!window.confirm('Supprimer cette délégation ?')) {
      return;
    }
    try {
      await mailboxApi.removeDelegation(id, delegationId);
      fetchMailbox();
      setSuccess('Délégation supprimée');
    } catch (err) {
      setError('Erreur lors de la suppression');
    }
  };

  // Gestion des alias
  const handleAddAlias = async () => {
    if (!newAlias) {
      return;
    }

    try {
      await mailboxApi.addAlias(id, newAlias);
      setNewAlias('');
      fetchMailbox();
      setSuccess('Alias ajouté');
    } catch (err) {
      setError(err.response?.data?.error || "Erreur lors de l'ajout");
    }
  };

  const handleRemoveAlias = async alias => {
    if (!window.confirm(`Supprimer l'alias ${alias} ?`)) {
      return;
    }

    try {
      await mailboxApi.removeAlias(id, alias);
      fetchMailbox();
      setSuccess('Alias supprimé');
    } catch (err) {
      setError('Erreur lors de la suppression');
    }
  };

  // Changement de mot de passe
  const handleChangePassword = async () => {
    if (!newPassword || newPassword.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères');
      return;
    }

    try {
      await mailboxApi.changePassword(id, newPassword);
      setShowPasswordModal(false);
      setNewPassword('');
      setSuccess('Mot de passe modifié');
    } catch (err) {
      setError('Erreur lors du changement de mot de passe');
    }
  };

  // Suppression de la BAL
  const handleDelete = async () => {
    try {
      await mailboxApi.delete(id);
      navigate('/mailboxes', { state: { success: 'BAL supprimée' } });
    } catch (err) {
      setError('Erreur lors de la suppression');
      setShowDeleteModal(false);
    }
  };

  // Helpers
  const getTypeLabel = type => {
    const types = {
      personal: 'Personnelle',
      organizational: 'Organisationnelle',
      applicative: 'Applicative'
    };
    return types[type] || type;
  };

  const formatDate = date => {
    if (!date) {
      return '—';
    }
    return new Date(date).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader />
      </div>
    );
  }

  if (!mailbox) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-500">Boîte aux lettres introuvable</p>
        <Link to="/mailboxes" className="text-blue-600 hover:underline mt-2 inline-block">
          Retour à la liste
        </Link>
      </div>
    );
  }

  const tabs = [
    { id: 'general', label: 'Général', icon: '⚙️' },
    { id: 'autoreply', label: 'Réponse auto', icon: '✉️' },
    { id: 'delegations', label: 'Délégations', icon: '👥' },
    { id: 'aliases', label: 'Alias', icon: '🔗' },
    { id: 'security', label: 'Sécurité', icon: '🔒' },
    { id: 'danger', label: 'Zone danger', icon: '⚠️' }
  ];

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
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
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 bg-blue-100 rounded-full flex items-center justify-center">
            <span className="text-2xl text-blue-600 font-bold">
              {mailbox.email.charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{mailbox.email}</h1>
            <p className="text-gray-600">
              {getTypeLabel(mailbox.type)} • Créée le {formatDate(mailbox.createdAt)}
            </p>
          </div>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
          {error}
          <button onClick={() => setError(null)} className="float-right">
            ×
          </button>
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-6">
          {success}
        </div>
      )}

      {/* Statistiques rapides */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Messages</div>
          <div className="text-2xl font-bold">{mailbox.messageCount || 0}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Stockage utilisé</div>
          <div className="text-2xl font-bold">{mailbox.usedMb || 0} Mo</div>
          <div className="text-xs text-gray-400">sur {mailbox.quotaMb} Mo</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Annuaire MSSanté</div>
          <div
            className={`text-lg font-semibold ${mailbox.publishedToAnnuaire ? 'text-green-600' : 'text-gray-400'}`}
          >
            {mailbox.publishedToAnnuaire ? 'Publié' : 'Non publié'}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Statut</div>
          <div
            className={`text-lg font-semibold ${mailbox.status === 'active' ? 'text-green-600' : 'text-red-600'}`}
          >
            {mailbox.status === 'active' ? 'Active' : 'Inactive'}
          </div>
        </div>
      </div>

      {/* Onglets */}
      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px overflow-x-auto">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-6 py-4 text-sm font-medium whitespace-nowrap border-b-2 transition ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {/* Onglet Général */}
          {activeTab === 'general' && (
            <form onSubmit={handleSaveGeneral} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Quota de stockage
                  </label>
                  <select
                    value={generalForm.quotaMb}
                    onChange={e =>
                      setGeneralForm(f => ({ ...f, quotaMb: parseInt(e.target.value) }))
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value={500}>500 Mo</option>
                    <option value={1000}>1 Go</option>
                    <option value={2000}>2 Go</option>
                    <option value={5000}>5 Go</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Statut</label>
                  <select
                    value={generalForm.status}
                    onChange={e => setGeneralForm(f => ({ ...f, status: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="suspended">Suspendue</option>
                  </select>
                </div>
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="hideFromDirectory"
                  checked={generalForm.hideFromDirectory}
                  onChange={e =>
                    setGeneralForm(f => ({ ...f, hideFromDirectory: e.target.checked }))
                  }
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="hideFromDirectory" className="ml-2 text-sm text-gray-700">
                  Liste rouge (ne pas publier dans l'annuaire MSSanté)
                </label>
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50"
                >
                  {saving ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>
            </form>
          )}

          {/* Onglet Auto-réponse */}
          {activeTab === 'autoreply' && (
            <form onSubmit={handleSaveAutoReply} className="space-y-6">
              <div className="flex items-center mb-4">
                <input
                  type="checkbox"
                  id="autoReplyEnabled"
                  checked={autoReplyForm.enabled}
                  onChange={e => setAutoReplyForm(f => ({ ...f, enabled: e.target.checked }))}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label
                  htmlFor="autoReplyEnabled"
                  className="ml-2 text-sm font-medium text-gray-700"
                >
                  Activer la réponse automatique
                </label>
              </div>
              {autoReplyForm.enabled && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Objet</label>
                    <input
                      type="text"
                      value={autoReplyForm.subject}
                      onChange={e => setAutoReplyForm(f => ({ ...f, subject: e.target.value }))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                    <textarea
                      value={autoReplyForm.message}
                      onChange={e => setAutoReplyForm(f => ({ ...f, message: e.target.value }))}
                      rows={5}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="Je suis actuellement absent..."
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Date de début
                      </label>
                      <input
                        type="datetime-local"
                        value={autoReplyForm.startDate}
                        onChange={e => setAutoReplyForm(f => ({ ...f, startDate: e.target.value }))}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Date de fin
                      </label>
                      <input
                        type="datetime-local"
                        value={autoReplyForm.endDate}
                        onChange={e => setAutoReplyForm(f => ({ ...f, endDate: e.target.value }))}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </>
              )}
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50"
                >
                  {saving ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>
            </form>
          )}

          {/* Onglet Délégations */}
          {activeTab === 'delegations' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <p className="text-sm text-gray-600">
                  Permettez à d'autres utilisateurs d'accéder à cette BAL
                </p>
                <button
                  onClick={() => setShowDelegationModal(true)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm"
                >
                  Ajouter une délégation
                </button>
              </div>
              {delegations.length === 0 ? (
                <div className="text-center py-8 text-gray-500">Aucune délégation configurée</div>
              ) : (
                <div className="space-y-2">
                  {delegations.map(d => (
                    <div
                      key={d.id}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                    >
                      <div>
                        <div className="font-medium">
                          {d.firstName} {d.lastName}
                        </div>
                        <div className="text-sm text-gray-500">{d.email}</div>
                        <div className="text-xs text-gray-400 mt-1">
                          Permissions: {d.permissions?.join(', ') || 'lecture'}
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveDelegation(d.id)}
                        className="text-red-600 hover:text-red-800"
                      >
                        Supprimer
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Onglet Alias */}
          {activeTab === 'aliases' && (
            <div>
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={newAlias}
                  onChange={e => setNewAlias(e.target.value)}
                  placeholder="alias@domaine.mssante.fr"
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={handleAddAlias}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                >
                  Ajouter
                </button>
              </div>
              {aliases.length === 0 ? (
                <div className="text-center py-8 text-gray-500">Aucun alias configuré</div>
              ) : (
                <div className="space-y-2">
                  {aliases.map(alias => (
                    <div
                      key={alias}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <span>{alias}</span>
                      <button
                        onClick={() => handleRemoveAlias(alias)}
                        className="text-red-600 hover:text-red-800 text-sm"
                      >
                        Supprimer
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Onglet Sécurité */}
          {activeTab === 'security' && (
            <div className="space-y-6">
              <div className="p-4 bg-gray-50 rounded-lg">
                <h3 className="font-medium mb-2">Mot de passe</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Modifiez le mot de passe de connexion à la BAL
                </p>
                <button
                  onClick={() => setShowPasswordModal(true)}
                  className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg text-sm"
                >
                  Changer le mot de passe
                </button>
              </div>
              {mailbox.certificate && (
                <div className="p-4 bg-gray-50 rounded-lg">
                  <h3 className="font-medium mb-2">Certificat IGC-Santé</h3>
                  <div className="text-sm text-gray-600">
                    <p>Sujet: {mailbox.certificate.subject}</p>
                    <p>Expire le: {formatDate(mailbox.certificate.expiresAt)}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Onglet Zone Danger */}
          {activeTab === 'danger' && (
            <div className="border-2 border-red-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-red-600 mb-2">
                Supprimer cette boîte aux lettres
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Cette action est irréversible. Tous les messages et données associés seront
                définitivement supprimés.
              </p>
              <button
                onClick={() => setShowDeleteModal(true)}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg"
              >
                Supprimer la BAL
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Modal Délégation */}
      {showDelegationModal && (
        <Modal onClose={() => setShowDelegationModal(false)} title="Ajouter une délégation">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email du délégué
              </label>
              <input
                type="email"
                value={newDelegation.email}
                onChange={e => setNewDelegation(d => ({ ...d, email: e.target.value }))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                placeholder="utilisateur@domaine.mssante.fr"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Permissions</label>
              <div className="space-y-2">
                {['read', 'send', 'delete', 'manage'].map(perm => (
                  <label key={perm} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={newDelegation.permissions.includes(perm)}
                      onChange={e => {
                        const perms = e.target.checked
                          ? [...newDelegation.permissions, perm]
                          : newDelegation.permissions.filter(p => p !== perm);
                        setNewDelegation(d => ({ ...d, permissions: perms }));
                      }}
                      className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                    />
                    <span className="ml-2 text-sm capitalize">
                      {perm === 'read'
                        ? 'Lecture'
                        : perm === 'send'
                          ? 'Envoi'
                          : perm === 'delete'
                            ? 'Suppression'
                            : 'Gestion'}
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowDelegationModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg"
              >
                Annuler
              </button>
              <button
                onClick={handleAddDelegation}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg"
              >
                Ajouter
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal Mot de passe */}
      {showPasswordModal && (
        <Modal onClose={() => setShowPasswordModal(false)} title="Changer le mot de passe">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nouveau mot de passe
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                placeholder="Minimum 8 caractères"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowPasswordModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg"
              >
                Annuler
              </button>
              <button
                onClick={handleChangePassword}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg"
              >
                Enregistrer
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal Suppression */}
      {showDeleteModal && (
        <Modal onClose={() => setShowDeleteModal(false)} title="Confirmer la suppression">
          <div className="space-y-4">
            <p className="text-gray-600">
              Êtes-vous sûr de vouloir supprimer la BAL <strong>{mailbox.email}</strong> ?
            </p>
            <p className="text-red-600 text-sm">Cette action est irréversible.</p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg"
              >
                Annuler
              </button>
              <button onClick={handleDelete} className="px-4 py-2 bg-red-600 text-white rounded-lg">
                Supprimer
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default MailboxSettings;
