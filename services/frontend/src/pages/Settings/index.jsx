// services/frontend/src/pages/Settings/index.jsx
/**
 * Page des paramètres utilisateur
 */

import React, { useState, useEffect } from 'react';

import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';

const Settings = () => {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [activeTab, setActiveTab] = useState('notifications');

  const [settings, setSettings] = useState({
    notifications: {
      email_notifications: true,
      new_message_alert: true,
      weekly_digest: false,
      security_alerts: true
    },
    display: {
      language: 'fr',
      timezone: 'Europe/Paris',
      date_format: 'DD/MM/YYYY',
      messages_per_page: 50
    },
    email: {
      signature: '',
      auto_reply_enabled: false,
      auto_reply_message: '',
      default_folder: 'INBOX'
    }
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await api.get('/users/me/settings');
      if (response.data) {
        setSettings(prev => ({ ...prev, ...response.data }));
      }
    } catch (error) {
      console.error('Erreur chargement paramètres:', error);
    }
  };

  const handleChange = (section, key, value) => {
    setSettings(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [key]: value
      }
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await api.put('/users/me/settings', settings);
      setMessage({ type: 'success', text: 'Paramètres enregistrés' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Erreur lors de la sauvegarde' });
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    { id: 'notifications', label: '🔔 Notifications' },
    { id: 'display', label: '🎨 Affichage' },
    { id: 'email', label: '✉️ Email' }
  ];

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Paramètres</h1>
          <p className="text-gray-500">Personnalisez votre expérience</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Enregistrement...' : '💾 Enregistrer'}
        </button>
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

      {/* Onglets */}
      <div className="bg-white rounded-lg shadow">
        <div className="border-b">
          <nav className="flex">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-6 py-3 text-sm font-medium border-b-2 transition ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {/* Notifications */}
          {activeTab === 'notifications' && (
            <div className="space-y-4">
              <h3 className="font-medium text-gray-900 mb-4">Préférences de notification</h3>

              {[
                {
                  key: 'email_notifications',
                  label: 'Notifications par email',
                  desc: 'Recevoir les notifications par email'
                },
                {
                  key: 'new_message_alert',
                  label: 'Alerte nouveau message',
                  desc: 'Être alerté à chaque nouveau message'
                },
                {
                  key: 'weekly_digest',
                  label: 'Résumé hebdomadaire',
                  desc: 'Recevoir un résumé chaque semaine'
                },
                {
                  key: 'security_alerts',
                  label: 'Alertes de sécurité',
                  desc: 'Connexions suspectes et changements importants'
                }
              ].map(item => (
                <div
                  key={item.key}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div>
                    <p className="font-medium">{item.label}</p>
                    <p className="text-sm text-gray-500">{item.desc}</p>
                  </div>
                  <label
                    htmlFor={`notif-${item.key}`}
                    aria-label={item.label}
                    className="relative inline-flex items-center cursor-pointer"
                  >
                    <input
                      id={`notif-${item.key}`}
                      type="checkbox"
                      checked={settings.notifications[item.key] || false}
                      onChange={e => handleChange('notifications', item.key, e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
              ))}
            </div>
          )}

          {/* Affichage */}
          {activeTab === 'display' && (
            <div className="space-y-6">
              <h3 className="font-medium text-gray-900 mb-4">Préférences d'affichage</h3>

              <div>
                <label
                  htmlFor="display-language"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Langue
                </label>
                <select
                  id="display-language"
                  value={settings.display.language}
                  onChange={e => handleChange('display', 'language', e.target.value)}
                  className="w-full max-w-xs px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="fr">Français</option>
                  <option value="en">English</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="fuseau-horaire"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Fuseau horaire
                </label>
                <select
                  id="fuseau-horaire"
                  value={settings.display.timezone}
                  onChange={e => handleChange('display', 'timezone', e.target.value)}
                  className="w-full max-w-xs px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Europe/Paris">Europe/Paris</option>
                  <option value="Europe/London">Europe/London</option>
                  <option value="America/New_York">America/New_York</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="msg-par-page"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Messages par page
                </label>
                <select
                  id="msg-par-page"
                  value={settings.display.messages_per_page}
                  onChange={e =>
                    handleChange('display', 'messages_per_page', parseInt(e.target.value))
                  }
                  className="w-full max-w-xs px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>
          )}

          {/* Email */}
          {activeTab === 'email' && (
            <div className="space-y-6">
              <h3 className="font-medium text-gray-900 mb-4">Paramètres email</h3>

              <div>
                <label htmlFor="signature" className="block text-sm font-medium text-gray-700 mb-1">
                  Signature
                </label>
                <textarea
                  id="signature"
                  value={settings.email.signature}
                  onChange={e => handleChange('email', 'signature', e.target.value)}
                  rows={4}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Votre signature email..."
                />
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium">Réponse automatique</p>
                  <p className="text-sm text-gray-500">Activer le répondeur automatique</p>
                </div>
                <label
                  htmlFor="toggle-auto-reply"
                  aria-label="Activation de la réponse automatique"
                  className="relative inline-flex items-center cursor-pointer"
                >
                  <input
                    id="toggle-auto-reply"
                    type="checkbox"
                    checked={settings.email.auto_reply_enabled || false}
                    onChange={e => handleChange('email', 'auto_reply_enabled', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              {settings.email.auto_reply_enabled && (
                <div>
                  <label
                    htmlFor="auto-reply-msg"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Message de réponse automatique
                  </label>
                  <textarea
                    id="auto-reply-msg"
                    value={settings.email.auto_reply_message}
                    onChange={e => handleChange('email', 'auto_reply_message', e.target.value)}
                    rows={4}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Bonjour, je suis actuellement absent..."
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Settings;
