// services/frontend/src/services/adminApi.js
import api from './api';

const ADMIN_ENDPOINT = '/admin';

export const adminApi = {
  // ============================================
  // DASHBOARD
  // ============================================

  /**
   * Récupérer les statistiques globales du dashboard
   */
  async getDashboardStats() {
    const response = await api.get(`${ADMIN_ENDPOINT}/dashboard/stats`);
    return response.data;
  },

  /**
   * Récupérer les alertes actives
   */
  async getAlerts() {
    const response = await api.get(`${ADMIN_ENDPOINT}/dashboard/alerts`);
    return response.data;
  },

  /**
   * Récupérer l'activité récente
   */
  async getRecentActivity(limit = 10) {
    const response = await api.get(`${ADMIN_ENDPOINT}/dashboard/activity`, {
      params: { limit }
    });
    return response.data;
  },

  // ============================================
  // DOMAINES
  // ============================================

  /**
   * Lister les domaines
   */
  async getDomains(params = {}) {
    const response = await api.get(`${ADMIN_ENDPOINT}/domains`, { params });
    return response.data;
  },

  /**
   * Récupérer un domaine
   */
  async getDomain(id) {
    const response = await api.get(`${ADMIN_ENDPOINT}/domains/${id}`);
    return response.data;
  },

  /**
   * Créer un domaine
   */
  async createDomain(domainData) {
    const response = await api.post(`${ADMIN_ENDPOINT}/domains`, domainData);
    return response.data;
  },

  /**
   * Mettre à jour un domaine
   */
  async updateDomain(id, domainData) {
    const response = await api.put(`${ADMIN_ENDPOINT}/domains/${id}`, domainData);
    return response.data;
  },

  /**
   * Suspendre un domaine
   */
  async suspendDomain(id, reason) {
    const response = await api.post(`${ADMIN_ENDPOINT}/domains/${id}/suspend`, { reason });
    return response.data;
  },

  /**
   * Réactiver un domaine
   */
  async activateDomain(id) {
    const response = await api.post(`${ADMIN_ENDPOINT}/domains/${id}/activate`);
    return response.data;
  },

  /**
   * Supprimer un domaine
   */
  async deleteDomain(id) {
    const response = await api.delete(`${ADMIN_ENDPOINT}/domains/${id}`);
    return response.data;
  },

  /**
   * Récupérer les statistiques d'un domaine
   */
  async getDomainStats(id, period = '30d') {
    const response = await api.get(`${ADMIN_ENDPOINT}/domains/${id}/stats`, {
      params: { period }
    });
    return response.data;
  },

  // ============================================
  // UTILISATEURS
  // ============================================

  /**
   * Lister les utilisateurs
   */
  async getUsers(params = {}) {
    const response = await api.get(`${ADMIN_ENDPOINT}/users`, { params });
    return response.data;
  },

  /**
   * Récupérer un utilisateur
   */
  async getUser(id) {
    const response = await api.get(`${ADMIN_ENDPOINT}/users/${id}`);
    return response.data;
  },

  /**
   * Créer un utilisateur
   */
  async createUser(userData) {
    const response = await api.post(`${ADMIN_ENDPOINT}/users`, userData);
    return response.data;
  },

  /**
   * Mettre à jour un utilisateur
   */
  async updateUser(id, userData) {
    const response = await api.put(`${ADMIN_ENDPOINT}/users/${id}`, userData);
    return response.data;
  },

  /**
   * Supprimer un utilisateur
   */
  async deleteUser(id) {
    const response = await api.delete(`${ADMIN_ENDPOINT}/users/${id}`);
    return response.data;
  },

  /**
   * Réinitialiser le mot de passe d'un utilisateur
   */
  async resetUserPassword(id) {
    const response = await api.post(`${ADMIN_ENDPOINT}/users/${id}/reset-password`);
    return response.data;
  },

  /**
   * Modifier le rôle d'un utilisateur
   */
  async updateUserRole(id, roleId) {
    const response = await api.patch(`${ADMIN_ENDPOINT}/users/${id}/role`, { roleId });
    return response.data;
  },

  // ============================================
  // BOÎTES AUX LETTRES
  // ============================================

  /**
   * Lister les BAL
   */
  async getMailboxes(params = {}) {
    const response = await api.get(`${ADMIN_ENDPOINT}/mailboxes`, { params });
    return response.data;
  },

  /**
   * Récupérer une BAL
   */
  async getMailbox(id) {
    const response = await api.get(`${ADMIN_ENDPOINT}/mailboxes/${id}`);
    return response.data;
  },

  /**
   * Créer une BAL
   */
  async createMailbox(mailboxData) {
    const response = await api.post(`${ADMIN_ENDPOINT}/mailboxes`, mailboxData);
    return response.data;
  },

  /**
   * Mettre à jour une BAL
   */
  async updateMailbox(id, mailboxData) {
    const response = await api.put(`${ADMIN_ENDPOINT}/mailboxes/${id}`, mailboxData);
    return response.data;
  },

  /**
   * Supprimer une BAL
   */
  async deleteMailbox(id) {
    const response = await api.delete(`${ADMIN_ENDPOINT}/mailboxes/${id}`);
    return response.data;
  },

  /**
   * Modifier le quota d'une BAL
   */
  async updateMailboxQuota(id, quotaMb) {
    const response = await api.patch(`${ADMIN_ENDPOINT}/mailboxes/${id}/quota`, { quotaMb });
    return response.data;
  },

  // ============================================
  // CERTIFICATS
  // ============================================

  /**
   * Lister les certificats
   */
  async getCertificates(params = {}) {
    const response = await api.get(`${ADMIN_ENDPOINT}/certificates`, { params });
    return response.data;
  },

  /**
   * Récupérer un certificat
   */
  async getCertificate(id) {
    const response = await api.get(`${ADMIN_ENDPOINT}/certificates/${id}`);
    return response.data;
  },

  /**
   * Installer un certificat
   */
  async uploadCertificate(formData) {
    const response = await api.post(`${ADMIN_ENDPOINT}/certificates`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
  },

  /**
   * Révoquer un certificat
   */
  async revokeCertificate(id, reason) {
    const response = await api.post(`${ADMIN_ENDPOINT}/certificates/${id}/revoke`, { reason });
    return response.data;
  },

  /**
   * Récupérer les certificats expirant bientôt
   */
  async getExpiringCertificates(days = 30) {
    const response = await api.get(`${ADMIN_ENDPOINT}/certificates/expiring`, {
      params: { days }
    });
    return response.data;
  },

  /**
   * Configurer les alertes d'expiration
   */
  async configureCertificateAlerts(id, alertConfig) {
    const response = await api.post(`${ADMIN_ENDPOINT}/certificates/${id}/alerts`, alertConfig);
    return response.data;
  },

  // ============================================
  // ANNUAIRE & INDICATEURS ANS
  // ============================================

  /**
   * Récupérer le statut des publications annuaire
   */
  async getAnnuaireStatus() {
    const response = await api.get(`${ADMIN_ENDPOINT}/annuaire/status`);
    return response.data;
  },

  /**
   * Lister les publications en attente
   */
  async getPendingPublications(params = {}) {
    const response = await api.get(`${ADMIN_ENDPOINT}/annuaire/pending`, { params });
    return response.data;
  },

  /**
   * Publier une BAL dans l'annuaire
   */
  async publishToAnnuaire(mailboxId) {
    const response = await api.post(`${ADMIN_ENDPOINT}/annuaire/publish`, { mailboxId });
    return response.data;
  },

  /**
   * Retirer une BAL de l'annuaire
   */
  async unpublishFromAnnuaire(mailboxId) {
    const response = await api.post(`${ADMIN_ENDPOINT}/annuaire/unpublish`, { mailboxId });
    return response.data;
  },

  /**
   * Récupérer les indicateurs mensuels
   */
  async getMonthlyIndicators(year, month) {
    const response = await api.get(`${ADMIN_ENDPOINT}/indicators/monthly`, {
      params: { year, month }
    });
    return response.data;
  },

  /**
   * Générer les indicateurs mensuels
   */
  async generateIndicators(year, month) {
    const response = await api.post(`${ADMIN_ENDPOINT}/indicators/generate`, { year, month });
    return response.data;
  },

  /**
   * Soumettre les indicateurs à l'ANS
   */
  async submitIndicators(year, month) {
    const response = await api.post(`${ADMIN_ENDPOINT}/indicators/submit`, { year, month });
    return response.data;
  },

  // ============================================
  // STATISTIQUES GLOBALES
  // ============================================

  /**
   * Récupérer les statistiques globales
   */
  async getGlobalStats(period = '30d') {
    const response = await api.get(`${ADMIN_ENDPOINT}/statistics/global`, {
      params: { period }
    });
    return response.data;
  },

  /**
   * Récupérer les statistiques d'emails
   */
  async getEmailStats(params = {}) {
    const response = await api.get(`${ADMIN_ENDPOINT}/statistics/emails`, { params });
    return response.data;
  },

  /**
   * Exporter les statistiques
   */
  async exportStats(type, params = {}) {
    const response = await api.get(`${ADMIN_ENDPOINT}/statistics/export/${type}`, {
      params,
      responseType: 'blob'
    });
    return response.data;
  },

  // ============================================
  // MONITORING
  // ============================================

  /**
   * Récupérer l'état de santé des services
   */
  async getSystemHealth() {
    const response = await api.get(`${ADMIN_ENDPOINT}/monitoring/health`);
    return response.data;
  },

  /**
   * Récupérer les métriques des services
   */
  async getServiceMetrics() {
    const response = await api.get(`${ADMIN_ENDPOINT}/monitoring/metrics`);
    return response.data;
  },

  /**
   * Récupérer les logs récents
   */
  async getRecentLogs(params = {}) {
    const response = await api.get(`${ADMIN_ENDPOINT}/monitoring/logs`, { params });
    return response.data;
  },

  // ============================================
  // AUDIT
  // ============================================

  /**
   * Récupérer les logs d'audit
   */
  async getAuditLogs(params = {}) {
    const response = await api.get(`${ADMIN_ENDPOINT}/audit/logs`, { params });
    return response.data;
  },

  /**
   * Exporter les logs d'audit
   */
  async exportAuditLogs(params = {}) {
    const response = await api.get(`${ADMIN_ENDPOINT}/audit/export`, {
      params,
      responseType: 'blob'
    });
    return response.data;
  },

  // ============================================
  // PARAMÈTRES
  // ============================================

  /**
   * Récupérer les paramètres de la plateforme
   */
  async getSettings() {
    const response = await api.get(`${ADMIN_ENDPOINT}/settings`);
    return response.data;
  },

  /**
   * Mettre à jour les paramètres
   */
  async updateSettings(settings) {
    const response = await api.put(`${ADMIN_ENDPOINT}/settings`, settings);
    return response.data;
  },

  /**
   * Récupérer les rôles disponibles
   */
  async getRoles() {
    const response = await api.get(`${ADMIN_ENDPOINT}/roles`);
    return response.data;
  }
};

export default adminApi;
