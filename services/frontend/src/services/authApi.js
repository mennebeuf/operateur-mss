// services/frontend/src/services/authApi.js
import api, { setTokens, clearTokens } from './api';

const AUTH_ENDPOINT = '/auth';

export const authApi = {
  /**
   * Connexion avec email/mot de passe (administrateurs)
   */
  async login(email, password) {
    const response = await api.post(`${AUTH_ENDPOINT}/login`, { email, password });
    const { token, refreshToken, user } = response.data;
    setTokens(token, refreshToken);
    return { user, token };
  },

  /**
   * Déconnexion
   */
  async logout() {
    try {
      await api.post(`${AUTH_ENDPOINT}/logout`);
    } finally {
      clearTokens();
    }
  },

  /**
   * Rafraîchir le token
   */
  async refreshToken() {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) {
      throw new Error('No refresh token');
    }

    const response = await api.post(`${AUTH_ENDPOINT}/refresh`, { refreshToken });
    const { token, refreshToken: newRefreshToken } = response.data;
    setTokens(token, newRefreshToken);
    return { token };
  },

  /**
   * Récupérer l'utilisateur actuel
   */
  async getCurrentUser() {
    const response = await api.get(`${AUTH_ENDPOINT}/me`);
    return response.data;
  },

  /**
   * Initier la connexion Pro Santé Connect
   */
  async initPSCLogin() {
    const response = await api.get(`${AUTH_ENDPOINT}/psc/authorize`);
    return response.data;
  },

  /**
   * Callback Pro Santé Connect
   */
  async handlePSCCallback(code, state) {
    const response = await api.post(`${AUTH_ENDPOINT}/psc/callback`, { code, state });
    const { token, refreshToken, user } = response.data;
    setTokens(token, refreshToken);
    return { user, token };
  },

  /**
   * Initier l'authentification par certificat
   */
  async initCertificateAuth() {
    const response = await api.get(`${AUTH_ENDPOINT}/certificate/init`);
    return response.data;
  },

  /**
   * Authentification par certificat
   */
  async authenticateWithCertificate(certificateData) {
    const response = await api.post(`${AUTH_ENDPOINT}/certificate/verify`, certificateData);
    const { token, refreshToken, user } = response.data;
    setTokens(token, refreshToken);
    return { user, token };
  },

  /**
   * Changer le mot de passe
   */
  async changePassword(currentPassword, newPassword) {
    const response = await api.post(`${AUTH_ENDPOINT}/change-password`, {
      currentPassword,
      newPassword,
    });
    return response.data;
  },

  /**
   * Demander la réinitialisation du mot de passe
   */
  async requestPasswordReset(email) {
    const response = await api.post(`${AUTH_ENDPOINT}/forgot-password`, { email });
    return response.data;
  },

  /**
   * Réinitialiser le mot de passe
   */
  async resetPassword(token, newPassword) {
    const response = await api.post(`${AUTH_ENDPOINT}/reset-password`, {
      token,
      newPassword,
    });
    return response.data;
  },

  /**
   * Vérifier la validité d'un token
   */
  async verifyToken() {
    const response = await api.get(`${AUTH_ENDPOINT}/verify`);
    return response.data;
  },

  /**
   * Récupérer les sessions actives
   */
  async getActiveSessions() {
    const response = await api.get(`${AUTH_ENDPOINT}/sessions`);
    return response.data;
  },

  /**
   * Révoquer une session
   */
  async revokeSession(sessionId) {
    const response = await api.delete(`${AUTH_ENDPOINT}/sessions/${sessionId}`);
    return response.data;
  },

  /**
   * Révoquer toutes les autres sessions
   */
  async revokeAllOtherSessions() {
    const response = await api.post(`${AUTH_ENDPOINT}/sessions/revoke-all`);
    return response.data;
  },
};

export default authApi;