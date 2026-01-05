// services/frontend/src/services/emailApi.js
import api from './api';

const EMAIL_ENDPOINT = '/email';

export const emailApi = {
  // ============================================
  // DOSSIERS
  // ============================================

  /**
   * Récupérer la liste des dossiers
   */
  async getFolders() {
    const response = await api.get(`${EMAIL_ENDPOINT}/folders`);
    return response.data;
  },

  /**
   * Créer un dossier
   */
  async createFolder(name, parentPath = null) {
    const response = await api.post(`${EMAIL_ENDPOINT}/folders`, { name, parentPath });
    return response.data;
  },

  /**
   * Renommer un dossier
   */
  async renameFolder(path, newName) {
    const response = await api.patch(`${EMAIL_ENDPOINT}/folders`, { path, newName });
    return response.data;
  },

  /**
   * Supprimer un dossier
   */
  async deleteFolder(path) {
    const response = await api.delete(`${EMAIL_ENDPOINT}/folders`, { data: { path } });
    return response.data;
  },

  // ============================================
  // MESSAGES
  // ============================================

  /**
   * Récupérer la liste des messages
   */
  async getMessages(folder = 'INBOX', page = 1, limit = 50, search = null) {
    const response = await api.get(`${EMAIL_ENDPOINT}/messages`, {
      params: { folder, page, limit, search },
    });
    return response.data;
  },

  /**
   * Récupérer un message complet
   */
  async getMessage(uid, folder = 'INBOX') {
    const response = await api.get(`${EMAIL_ENDPOINT}/messages/${uid}`, {
      params: { folder },
    });
    return response.data;
  },

  /**
   * Envoyer un message
   */
  async sendMessage(messageData) {
    const response = await api.post(`${EMAIL_ENDPOINT}/send`, messageData);
    return response.data;
  },

  /**
   * Sauvegarder un brouillon
   */
  async saveDraft(messageData) {
    const response = await api.post(`${EMAIL_ENDPOINT}/draft`, messageData);
    return response.data;
  },

  /**
   * Mettre à jour un brouillon
   */
  async updateDraft(uid, messageData) {
    const response = await api.put(`${EMAIL_ENDPOINT}/draft/${uid}`, messageData);
    return response.data;
  },

  /**
   * Modifier les flags d'un message
   */
  async setFlags(uid, folder, flags) {
    const response = await api.patch(`${EMAIL_ENDPOINT}/messages/${uid}/flags`, { flags }, {
      params: { folder },
    });
    return response.data;
  },

  /**
   * Marquer comme lu/non lu
   */
  async markAsRead(uid, folder, read = true) {
    return this.setFlags(uid, folder, { seen: read });
  },

  /**
   * Marquer comme important/favori
   */
  async markAsFlagged(uid, folder, flagged = true) {
    return this.setFlags(uid, folder, { flagged });
  },

  /**
   * Déplacer des messages
   */
  async moveMessages(fromFolder, toFolder, uids) {
    const response = await api.post(`${EMAIL_ENDPOINT}/messages/move`, {
      fromFolder,
      toFolder,
      uids,
    });
    return response.data;
  },

  /**
   * Copier des messages
   */
  async copyMessages(fromFolder, toFolder, uids) {
    const response = await api.post(`${EMAIL_ENDPOINT}/messages/copy`, {
      fromFolder,
      toFolder,
      uids,
    });
    return response.data;
  },

  /**
   * Supprimer des messages (déplacer vers Corbeille)
   */
  async deleteMessages(folder, uids) {
    const response = await api.delete(`${EMAIL_ENDPOINT}/messages`, {
      data: { folder, uids },
    });
    return response.data;
  },

  /**
   * Supprimer définitivement des messages
   */
  async permanentlyDeleteMessages(folder, uids) {
    const response = await api.delete(`${EMAIL_ENDPOINT}/messages/permanent`, {
      data: { folder, uids },
    });
    return response.data;
  },

  /**
   * Vider la corbeille
   */
  async emptyTrash() {
    const response = await api.post(`${EMAIL_ENDPOINT}/trash/empty`);
    return response.data;
  },

  // ============================================
  // PIÈCES JOINTES
  // ============================================

  /**
   * Télécharger une pièce jointe
   */
  async downloadAttachment(uid, folder, attachmentId) {
    const response = await api.get(
      `${EMAIL_ENDPOINT}/messages/${uid}/attachments/${attachmentId}`,
      {
        params: { folder },
        responseType: 'blob',
      }
    );
    return response.data;
  },

  /**
   * Uploader des pièces jointes (pour composition)
   */
  async uploadAttachments(files) {
    const formData = new FormData();
    files.forEach((file) => formData.append('attachments', file));

    const response = await api.post(`${EMAIL_ENDPOINT}/attachments/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  // ============================================
  // RECHERCHE
  // ============================================

  /**
   * Recherche avancée
   */
  async searchMessages(query, options = {}) {
    const response = await api.post(`${EMAIL_ENDPOINT}/search`, {
      query,
      folder: options.folder || 'INBOX',
      from: options.from,
      to: options.to,
      subject: options.subject,
      dateFrom: options.dateFrom,
      dateTo: options.dateTo,
      hasAttachment: options.hasAttachment,
      page: options.page || 1,
      limit: options.limit || 50,
    });
    return response.data;
  },

  // ============================================
  // STATISTIQUES
  // ============================================

  /**
   * Récupérer les statistiques de la boîte
   */
  async getMailboxStats() {
    const response = await api.get(`${EMAIL_ENDPOINT}/stats`);
    return response.data;
  },

  /**
   * Récupérer le quota utilisé
   */
  async getQuota() {
    const response = await api.get(`${EMAIL_ENDPOINT}/quota`);
    return response.data;
  },
};

export default emailApi;