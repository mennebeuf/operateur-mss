// services/frontend/src/services/annuaireApi.js
import axios from 'axios';

const API_BASE = '/api/v1/annuaire';

const getAuthHeaders = () => ({
  'Authorization': `Bearer ${localStorage.getItem('token')}`
});

export const annuaireApi = {
  // ============================================
  // PUBLICATIONS
  // ============================================
  
  async publish(mailboxId, data = {}) {
    const response = await axios.post(`${API_BASE}/publish`, 
      { mailboxId, ...data },
      { headers: getAuthHeaders() }
    );
    return response.data;
  },

  async unpublish(mailboxId) {
    const response = await axios.delete(`${API_BASE}/unpublish/${mailboxId}`, {
      headers: getAuthHeaders()
    });
    return response.data;
  },

  async getPublications(params = {}) {
    const response = await axios.get(`${API_BASE}/publications`, {
      headers: getAuthHeaders(),
      params: {
        page: params.page || 1,
        limit: params.limit || 20,
        status: params.status
      }
    });
    return response.data;
  },

  async retryPublication(publicationId) {
    const response = await axios.post(`${API_BASE}/publications/${publicationId}/retry`, null, {
      headers: getAuthHeaders()
    });
    return response.data;
  },

  // ============================================
  // SYNCHRONISATION
  // ============================================

  async sync(force = false) {
    const response = await axios.post(`${API_BASE}/sync`, 
      { force },
      { headers: getAuthHeaders() }
    );
    return response.data;
  },

  async getSyncStatus() {
    const response = await axios.get(`${API_BASE}/sync/status`, {
      headers: getAuthHeaders()
    });
    return response.data;
  },

  async getSyncHistory(params = {}) {
    const response = await axios.get(`${API_BASE}/sync/history`, {
      headers: getAuthHeaders(),
      params: {
        page: params.page || 1,
        limit: params.limit || 10
      }
    });
    return response.data;
  },

  // ============================================
  // INDICATEURS
  // ============================================

  async getIndicators(period = 'month') {
    const response = await axios.get(`${API_BASE}/indicators`, {
      headers: getAuthHeaders(),
      params: { period }
    });
    return response.data;
  },

  async submitIndicators(period) {
    const response = await axios.post(`${API_BASE}/indicators/submit`, 
      { period },
      { headers: getAuthHeaders() }
    );
    return response.data;
  },

  async getIndicatorReports(params = {}) {
    const response = await axios.get(`${API_BASE}/indicators/reports`, {
      headers: getAuthHeaders(),
      params: {
        page: params.page || 1,
        limit: params.limit || 20
      }
    });
    return response.data;
  },

  async getIndicatorReport(reportId) {
    const response = await axios.get(`${API_BASE}/indicators/reports/${reportId}`, {
      headers: getAuthHeaders()
    });
    return response.data;
  },

  async exportIndicators(year, month, format = 'csv') {
    const response = await axios.get(`${API_BASE}/indicators/export`, {
      headers: getAuthHeaders(),
      params: { year, month, format },
      responseType: format === 'csv' ? 'blob' : 'json'
    });
    return response.data;
  },

  // ============================================
  // STATISTIQUES
  // ============================================

  async getStatistics() {
    const response = await axios.get(`${API_BASE}/statistics`, {
      headers: getAuthHeaders()
    });
    return response.data;
  },

  // ============================================
  // RECHERCHE ANNUAIRE (consultation)
  // ============================================

  async search(query, params = {}) {
    const response = await axios.get(`${API_BASE}/search`, {
      headers: getAuthHeaders(),
      params: {
        q: query,
        type: params.type,
        domain: params.domain,
        page: params.page || 1,
        limit: params.limit || 20
      }
    });
    return response.data;
  },

  // ============================================
  // SUPER ADMIN (gestion globale)
  // ============================================

  async getGlobalStatistics() {
    const response = await axios.get(`${API_BASE}/global/statistics`, {
      headers: getAuthHeaders()
    });
    return response.data;
  },

  async globalSync() {
    const response = await axios.post(`${API_BASE}/global/sync`, null, {
      headers: getAuthHeaders()
    });
    return response.data;
  }
};

export default annuaireApi;