// services/frontend/src/contexts/DomainContext.jsx
/**
 * Contexte de gestion des domaines React
 * Gestion du domaine courant, multi-tenant et changement de contexte
 */

import axios from 'axios';
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

import { useAuth } from './AuthContext';

const DomainContext = createContext(null);

const API_BASE = '/api/v1';

/**
 * Provider de contexte domaine
 */
export const DomainProvider = ({ children }) => {
  const { user, isAuthenticated, token } = useAuth();

  const [currentDomain, setCurrentDomain] = useState(null);
  const [availableDomains, setAvailableDomains] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Récupérer les en-têtes avec le domaine courant
   */
  const getHeaders = useCallback(() => {
    const headers = {
      'Content-Type': 'application/json'
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    if (currentDomain) {
      headers['X-Domain'] = currentDomain.domain_name;
    }

    return headers;
  }, [token, currentDomain]);

  /**
   * Récupérer la liste des domaines accessibles
   */
  const fetchDomains = useCallback(async () => {
    if (!isAuthenticated) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await axios.get(`${API_BASE}/domains`, {
        headers: getHeaders()
      });

      const domains = response.data.data || response.data;
      setAvailableDomains(domains);

      // Si pas de domaine courant, utiliser celui de l'utilisateur ou le premier
      if (!currentDomain && domains.length > 0) {
        const userDomain = domains.find(d => d.id === user?.domain?.id);
        setCurrentDomain(userDomain || domains[0]);
      }

      return domains;
    } catch (err) {
      const errorMessage =
        err.response?.data?.error || 'Erreur lors de la récupération des domaines';
      setError(errorMessage);
      console.error('Erreur fetchDomains:', err);
      return [];
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, getHeaders, currentDomain, user]);

  /**
   * Changer le domaine courant
   */
  const switchDomain = useCallback(
    async domainId => {
      const domain = availableDomains.find(d => d.id === domainId);

      if (!domain) {
        setError('Domaine non trouvé');
        return { success: false, error: 'Domaine non trouvé' };
      }

      // Vérifier que l'utilisateur a accès à ce domaine
      if (!user?.is_super_admin) {
        const hasAccess =
          user?.domain?.id === domainId || availableDomains.some(d => d.id === domainId);
        if (!hasAccess) {
          setError('Accès non autorisé à ce domaine');
          return { success: false, error: 'Accès non autorisé' };
        }
      }

      setCurrentDomain(domain);
      localStorage.setItem('currentDomainId', domainId);

      return { success: true, domain };
    },
    [availableDomains, user]
  );

  /**
   * Récupérer les détails d'un domaine
   */
  const getDomainDetails = useCallback(
    async (domainId = null) => {
      const id = domainId || currentDomain?.id;
      if (!id) {
        return null;
      }

      try {
        const response = await axios.get(`${API_BASE}/domains/${id}`, {
          headers: getHeaders()
        });
        return response.data.data || response.data;
      } catch (err) {
        console.error('Erreur getDomainDetails:', err);
        return null;
      }
    },
    [currentDomain, getHeaders]
  );

  /**
   * Récupérer les statistiques du domaine courant
   */
  const getDomainStats = useCallback(async () => {
    if (!currentDomain) {
      return null;
    }

    try {
      const response = await axios.get(`${API_BASE}/domains/${currentDomain.id}/statistics`, {
        headers: getHeaders()
      });
      return response.data.data || response.data;
    } catch (err) {
      console.error('Erreur getDomainStats:', err);
      return null;
    }
  }, [currentDomain, getHeaders]);

  /**
   * Récupérer les quotas du domaine courant
   */
  const getDomainQuotas = useCallback(async () => {
    if (!currentDomain) {
      return null;
    }

    try {
      const response = await axios.get(`${API_BASE}/domains/${currentDomain.id}/quotas`, {
        headers: getHeaders()
      });
      return response.data.data || response.data;
    } catch (err) {
      console.error('Erreur getDomainQuotas:', err);
      return null;
    }
  }, [currentDomain, getHeaders]);

  /**
   * Vérifier si le quota du domaine permet une action
   */
  const checkQuota = useCallback(
    async resourceType => {
      if (!currentDomain) {
        return { allowed: false, reason: 'Pas de domaine sélectionné' };
      }

      try {
        const response = await axios.get(`${API_BASE}/domains/${currentDomain.id}/quotas/check`, {
          headers: getHeaders(),
          params: { resource: resourceType }
        });
        return response.data;
      } catch (err) {
        return {
          allowed: false,
          reason: err.response?.data?.error || 'Erreur vérification quota'
        };
      }
    },
    [currentDomain, getHeaders]
  );

  /**
   * Créer un nouveau domaine (super admin uniquement)
   */
  const createDomain = useCallback(
    async domainData => {
      try {
        const response = await axios.post(`${API_BASE}/admin/domains`, domainData, {
          headers: getHeaders()
        });

        // Rafraîchir la liste des domaines
        await fetchDomains();

        return { success: true, domain: response.data.data };
      } catch (err) {
        const errorMessage = err.response?.data?.error || 'Erreur création domaine';
        return { success: false, error: errorMessage };
      }
    },
    [getHeaders, fetchDomains]
  );

  /**
   * Mettre à jour un domaine
   */
  const updateDomain = useCallback(
    async (domainId, updateData) => {
      try {
        const response = await axios.put(`${API_BASE}/admin/domains/${domainId}`, updateData, {
          headers: getHeaders()
        });

        // Rafraîchir la liste et le domaine courant si nécessaire
        await fetchDomains();

        if (currentDomain?.id === domainId) {
          setCurrentDomain(response.data.data);
        }

        return { success: true, domain: response.data.data };
      } catch (err) {
        const errorMessage = err.response?.data?.error || 'Erreur mise à jour domaine';
        return { success: false, error: errorMessage };
      }
    },
    [getHeaders, fetchDomains, currentDomain]
  );

  /**
   * Récupérer les utilisateurs du domaine courant
   */
  const getDomainUsers = useCallback(
    async (params = {}) => {
      if (!currentDomain) {
        return { users: [], total: 0 };
      }

      try {
        const response = await axios.get(`${API_BASE}/domains/${currentDomain.id}/users`, {
          headers: getHeaders(),
          params
        });
        return response.data.data || response.data;
      } catch (err) {
        console.error('Erreur getDomainUsers:', err);
        return { users: [], total: 0 };
      }
    },
    [currentDomain, getHeaders]
  );

  /**
   * Récupérer les BAL du domaine courant
   */
  const getDomainMailboxes = useCallback(
    async (params = {}) => {
      if (!currentDomain) {
        return { mailboxes: [], total: 0 };
      }

      try {
        const response = await axios.get(`${API_BASE}/mailboxes`, {
          headers: getHeaders(),
          params
        });
        return response.data.data || response.data;
      } catch (err) {
        console.error('Erreur getDomainMailboxes:', err);
        return { mailboxes: [], total: 0 };
      }
    },
    [currentDomain, getHeaders]
  );

  /**
   * Initialisation : charger les domaines et restaurer le domaine courant
   */
  useEffect(() => {
    if (isAuthenticated) {
      // Restaurer le domaine sauvegardé
      const savedDomainId = localStorage.getItem('currentDomainId');

      fetchDomains().then(domains => {
        if (savedDomainId && domains.length > 0) {
          const savedDomain = domains.find(d => d.id === savedDomainId);
          if (savedDomain) {
            setCurrentDomain(savedDomain);
          }
        }
      });
    } else {
      // Réinitialiser si déconnecté
      setCurrentDomain(null);
      setAvailableDomains([]);
    }
  }, [isAuthenticated]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Synchroniser le domaine avec celui de l'utilisateur au login
   */
  useEffect(() => {
    if (user?.domain && !currentDomain) {
      setCurrentDomain(user.domain);
    }
  }, [user, currentDomain]);

  const value = {
    // État
    currentDomain,
    availableDomains,
    loading,
    error,
    hasDomain: !!currentDomain,

    // Actions
    switchDomain,
    fetchDomains,
    getDomainDetails,
    getDomainStats,
    getDomainQuotas,
    checkQuota,
    createDomain,
    updateDomain,
    getDomainUsers,
    getDomainMailboxes,

    // Utilitaires
    getHeaders,

    // Raccourcis
    domainId: currentDomain?.id,
    domainName: currentDomain?.domain_name,
    isMultiDomain: availableDomains.length > 1
  };

  return <DomainContext.Provider value={value}>{children}</DomainContext.Provider>;
};

/**
 * Hook personnalisé pour utiliser le contexte domaine
 */
export const useDomain = () => {
  const context = useContext(DomainContext);
  if (!context) {
    throw new Error('useDomain doit être utilisé dans un DomainProvider');
  }
  return context;
};

export default DomainContext;
