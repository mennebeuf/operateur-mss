// services/frontend/src/services/mailboxApi.js
import axios from 'axios';

const API_BASE = '/api/v1/mailboxes';

const getAuthHeaders = () => ({
  'Authorization': `Bearer ${localStorage.getItem('token')}`
});

export const mailboxApi = {
  /**
   * Liste des boîtes aux lettres avec pagination et filtres
   */
  async list({ page = 1, limit = 20, type, status, search } = {}) {
    const response = await axios.get(API_BASE, {
      headers: getAuthHeaders(),
      params: { page, limit, type, status, search }
    });
    return response.data;
  },

  /**
   * Récupérer une boîte aux lettres par ID
   */
  async get(id) {
    const response = await axios.get(`${API_BASE}/${id}`, {
      headers: getAuthHeaders()
    });
    return response.data;
  },

  /**
   * Créer une nouvelle boîte aux lettres
   */
  async create(data) {
    const response = await axios.post(API_BASE, data, {
      headers: getAuthHeaders()
    });
    return response.data;
  },

  /**
   * Mettre à jour une boîte aux lettres
   */
  async update(id, data) {
    const response = await axios.patch(`${API_BASE}/${id}`, data, {
      headers: getAuthHeaders()
    });
    return response.data;
  },

  /**
   * Supprimer une boîte aux lettres
   */
  async delete(id) {
    const response = await axios.delete(`${API_BASE}/${id}`, {
      headers: getAuthHeaders()
    });
    return response.data;
  },

  /**
   * Configurer la réponse automatique
   */
  async updateAutoReply(id, autoReplyData) {
    const response = await axios.put(`${API_BASE}/${id}/auto-reply`, autoReplyData, {
      headers: getAuthHeaders()
    });
    return response.data;
  },

  /**
   * Ajouter une délégation
   */
  async addDelegation(id, delegationData) {
    const response = await axios.post(`${API_BASE}/${id}/delegations`, delegationData, {
      headers: getAuthHeaders()
    });
    return response.data;
  },

  /**
   * Supprimer une délégation
   */
  async removeDelegation(mailboxId, delegationId) {
    const response = await axios.delete(`${API_BASE}/${mailboxId}/delegations/${delegationId}`, {
      headers: getAuthHeaders()
    });
    return response.data;
  },

  /**
   * Ajouter un alias
   */
  async addAlias(id, alias) {
    const response = await axios.post(`${API_BASE}/${id}/aliases`, { alias }, {
      headers: getAuthHeaders()
    });
    return response.data;
  },

  /**
   * Supprimer un alias
   */
  async removeAlias(id, alias) {
    const response = await axios.delete(`${API_BASE}/${id}/aliases/${encodeURIComponent(alias)}`, {
      headers: getAuthHeaders()
    });
    return response.data;
  },

  /**
   * Changer le mot de passe
   */
  async changePassword(id, newPassword) {
    const response = await axios.post(`${API_BASE}/${id}/password`, { password: newPassword }, {
      headers: getAuthHeaders()
    });
    return response.data;
  },

  /**
   * Vérifier la disponibilité d'une adresse email
   */
  async checkAvailability(email) {
    const response = await axios.get(`${API_BASE}/check-availability`, {
      headers: getAuthHeaders(),
      params: { email }
    });
    return response.data;
  },

  /**
   * Forcer la publication dans l'annuaire MSSanté
   */
  async publishToAnnuaire(id) {
    const response = await axios.post(`${API_BASE}/${id}/publish-annuaire`, {}, {
      headers: getAuthHeaders()
    });
    return response.data;
  },

  /**
   * Récupérer les statistiques d'une BAL
   */
  async getStats(id) {
    const response = await axios.get(`${API_BASE}/${id}/stats`, {
      headers: getAuthHeaders()
    });
    return response.data;
  },

  /**
   * Exporter les paramètres d'une BAL
   */
  async exportConfig(id) {
    const response = await axios.get(`${API_BASE}/${id}/export`, {
      headers: getAuthHeaders(),
      responseType: 'blob'
    });
    return response.data;
  }
};

export default mailboxApi;