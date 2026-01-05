/**
 * MSSanté - Services API pour le Dashboard
 * Fonctions d'appel spécifiques au dashboard et statistiques
 */

import api from './api';

// ============================================
// API Dashboard & Statistiques
// ============================================

/**
 * Récupérer les statistiques d'un domaine
 * @param {string} domainId - ID du domaine
 * @returns {Promise<Object>} Statistiques du domaine
 */
export const getDomainStats = async (domainId) => {
  const response = await api.get(`/domains/${domainId}/stats`);
  return response.data;
};

/**
 * Récupérer l'activité récente d'un domaine
 * @param {string} domainId - ID du domaine
 * @param {number} limit - Nombre d'activités à récupérer
 * @returns {Promise<Object>} Liste des activités
 */
export const getRecentActivity = async (domainId, limit = 10) => {
  const response = await api.get(`/domains/${domainId}/activity`, {
    params: { limit }
  });
  return response.data;
};

/**
 * Récupérer les statistiques de messages par période
 * @param {string} domainId - ID du domaine
 * @param {string} period - Période (7d, 30d, 90d)
 * @returns {Promise<Object>} Statistiques des messages
 */
export const getMessagesStats = async (domainId, period = '7d') => {
  const response = await api.get(`/domains/${domainId}/messages/stats`, {
    params: { period }
  });
  return response.data;
};

/**
 * Récupérer les alertes du domaine
 * @param {string} domainId - ID du domaine
 * @returns {Promise<Array>} Liste des alertes
 */
export const getDomainAlerts = async (domainId) => {
  const response = await api.get(`/domains/${domainId}/alerts`);
  return response.data;
};

// ============================================
// API Domaines
// ============================================

/**
 * Récupérer les domaines accessibles par l'utilisateur
 * @returns {Promise<Array>} Liste des domaines
 */
export const getUserDomains = async () => {
  const response = await api.get('/domains');
  return response.data;
};

/**
 * Récupérer un domaine par son ID
 * @param {string} domainId - ID du domaine
 * @returns {Promise<Object>} Données du domaine
 */
export const getDomain = async (domainId) => {
  const response = await api.get(`/domains/${domainId}`);
  return response.data;
};

/**
 * Récupérer les quotas d'un domaine
 * @param {string} domainId - ID du domaine
 * @returns {Promise<Object>} Quotas du domaine
 */
export const getDomainQuotas = async (domainId) => {
  const response = await api.get(`/domains/${domainId}/quotas`);
  return response.data;
};

// ============================================
// API Boîtes aux lettres
// ============================================

/**
 * Récupérer les BAL d'un domaine
 * @param {string} domainId - ID du domaine
 * @param {Object} params - Paramètres de filtrage/pagination
 * @returns {Promise<Object>} Liste des BAL
 */
export const getMailboxes = async (domainId, params = {}) => {
  const response = await api.get(`/domains/${domainId}/mailboxes`, { params });
  return response.data;
};

/**
 * Créer une nouvelle BAL
 * @param {string} domainId - ID du domaine
 * @param {Object} data - Données de la BAL
 * @returns {Promise<Object>} BAL créée
 */
export const createMailbox = async (domainId, data) => {
  const response = await api.post(`/domains/${domainId}/mailboxes`, data);
  return response.data;
};

/**
 * Mettre à jour une BAL
 * @param {string} domainId - ID du domaine
 * @param {string} mailboxId - ID de la BAL
 * @param {Object} data - Données à mettre à jour
 * @returns {Promise<Object>} BAL mise à jour
 */
export const updateMailbox = async (domainId, mailboxId, data) => {
  const response = await api.put(`/domains/${domainId}/mailboxes/${mailboxId}`, data);
  return response.data;
};

/**
 * Supprimer une BAL
 * @param {string} domainId - ID du domaine
 * @param {string} mailboxId - ID de la BAL
 * @returns {Promise<Object>} Confirmation
 */
export const deleteMailbox = async (domainId, mailboxId) => {
  const response = await api.delete(`/domains/${domainId}/mailboxes/${mailboxId}`);
  return response.data;
};

// ============================================
// API Utilisateurs
// ============================================

/**
 * Récupérer les utilisateurs d'un domaine
 * @param {string} domainId - ID du domaine
 * @param {Object} params - Paramètres de filtrage/pagination
 * @returns {Promise<Object>} Liste des utilisateurs
 */
export const getUsers = async (domainId, params = {}) => {
  const response = await api.get(`/domains/${domainId}/users`, { params });
  return response.data;
};

/**
 * Récupérer le profil de l'utilisateur connecté
 * @returns {Promise<Object>} Données utilisateur
 */
export const getCurrentUser = async () => {
  const response = await api.get('/auth/me');
  return response.data;
};

// ============================================
// API Audit
// ============================================

/**
 * Récupérer les logs d'audit
 * @param {Object} params - Paramètres de filtrage
 * @returns {Promise<Object>} Logs d'audit
 */
export const getAuditLogs = async (params = {}) => {
  const response = await api.get('/audit/logs', { params });
  return response.data;
};