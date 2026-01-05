// services/frontend/src/contexts/AuthContext.jsx
/**
 * Contexte d'authentification React
 * Gestion de l'état d'authentification, tokens JWT et utilisateur
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

const API_BASE = '/api/v1/auth';

// Configuration axios par défaut
const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json'
  }
});

/**
 * Provider d'authentification
 */
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [refreshToken, setRefreshToken] = useState(localStorage.getItem('refreshToken'));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  /**
   * Configurer le token dans les headers axios
   */
  const setAuthHeader = useCallback((accessToken) => {
    if (accessToken) {
      api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
      axios.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
    } else {
      delete api.defaults.headers.common['Authorization'];
      delete axios.defaults.headers.common['Authorization'];
    }
  }, []);

  /**
   * Sauvegarder les tokens dans le localStorage
   */
  const saveTokens = useCallback((accessToken, refresh) => {
    if (accessToken) {
      localStorage.setItem('token', accessToken);
      setToken(accessToken);
    }
    if (refresh) {
      localStorage.setItem('refreshToken', refresh);
      setRefreshToken(refresh);
    }
    setAuthHeader(accessToken);
  }, [setAuthHeader]);

  /**
   * Supprimer les tokens
   */
  const clearTokens = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    setToken(null);
    setRefreshToken(null);
    setAuthHeader(null);
  }, [setAuthHeader]);

  /**
   * Décoder le payload JWT (sans vérification)
   */
  const decodeToken = (accessToken) => {
    try {
      const payload = accessToken.split('.')[1];
      return JSON.parse(atob(payload));
    } catch {
      return null;
    }
  };

  /**
   * Vérifier si le token est expiré
   */
  const isTokenExpired = (accessToken) => {
    const decoded = decodeToken(accessToken);
    if (!decoded || !decoded.exp) return true;
    return decoded.exp * 1000 < Date.now();
  };

  /**
   * Rafraîchir le token d'accès
   */
  const refresh = useCallback(async () => {
    if (!refreshToken) {
      throw new Error('Pas de refresh token');
    }

    try {
      const response = await api.post('/refresh', { refreshToken });
      const { token: newToken, refreshToken: newRefresh, user: userData } = response.data.data;
      
      saveTokens(newToken, newRefresh);
      setUser(userData);
      
      return newToken;
    } catch (err) {
      clearTokens();
      setUser(null);
      throw err;
    }
  }, [refreshToken, saveTokens, clearTokens]);

  /**
   * Connexion avec email/mot de passe
   */
  const login = useCallback(async (email, password) => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.post('/login', { email, password });
      const { token: accessToken, refreshToken: refresh, user: userData } = response.data.data;

      saveTokens(accessToken, refresh);
      setUser(userData);

      return { success: true, user: userData };
    } catch (err) {
      const errorMessage = err.response?.data?.error || 'Erreur de connexion';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  }, [saveTokens]);

  /**
   * Déconnexion
   */
  const logout = useCallback(async () => {
    try {
      await api.post('/logout');
    } catch (err) {
      console.error('Erreur lors de la déconnexion:', err);
    } finally {
      clearTokens();
      setUser(null);
    }
  }, [clearTokens]);

  /**
   * Connexion via Pro Santé Connect (OAuth2)
   */
  const loginWithPSC = useCallback(() => {
    // Rediriger vers l'endpoint PSC de l'API
    window.location.href = `${API_BASE}/psc/authorize`;
  }, []);

  /**
   * Callback après authentification PSC
   */
  const handlePSCCallback = useCallback(async (code, state) => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.post('/psc/callback', { code, state });
      const { token: accessToken, refreshToken: refresh, user: userData } = response.data.data;

      saveTokens(accessToken, refresh);
      setUser(userData);

      return { success: true, user: userData };
    } catch (err) {
      const errorMessage = err.response?.data?.error || 'Erreur authentification PSC';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  }, [saveTokens]);

  /**
   * Changer le mot de passe
   */
  const changePassword = useCallback(async (currentPassword, newPassword) => {
    try {
      await api.post('/change-password', { currentPassword, newPassword });
      return { success: true };
    } catch (err) {
      const errorMessage = err.response?.data?.error || 'Erreur lors du changement de mot de passe';
      return { success: false, error: errorMessage };
    }
  }, []);

  /**
   * Récupérer le profil utilisateur
   */
  const getProfile = useCallback(async () => {
    try {
      const response = await api.get('/profile');
      setUser(response.data.data);
      return response.data.data;
    } catch (err) {
      console.error('Erreur récupération profil:', err);
      throw err;
    }
  }, []);

  /**
   * Vérifier les permissions de l'utilisateur
   */
  const hasPermission = useCallback((permission) => {
    if (!user) return false;
    if (user.is_super_admin) return true;
    return user.permissions?.includes(permission) || false;
  }, [user]);

  /**
   * Vérifier si l'utilisateur est super admin
   */
  const isSuperAdmin = useCallback(() => {
    return user?.is_super_admin === true;
  }, [user]);

  /**
   * Vérifier si l'utilisateur est admin de domaine
   */
  const isDomainAdmin = useCallback(() => {
    return user?.role === 'domain_admin' || user?.is_super_admin === true;
  }, [user]);

  /**
   * Initialisation : vérifier le token existant
   */
  useEffect(() => {
    const initAuth = async () => {
      if (!token) {
        setLoading(false);
        return;
      }

      // Vérifier si le token est expiré
      if (isTokenExpired(token)) {
        // Essayer de rafraîchir
        if (refreshToken) {
          try {
            await refresh();
          } catch {
            clearTokens();
          }
        } else {
          clearTokens();
        }
        setLoading(false);
        return;
      }

      // Token valide, récupérer le profil
      setAuthHeader(token);
      try {
        await getProfile();
      } catch {
        clearTokens();
      }
      setLoading(false);
    };

    initAuth();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Intercepteur axios pour rafraîchir automatiquement le token
   */
  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          try {
            const newToken = await refresh();
            originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
            return axios(originalRequest);
          } catch {
            logout();
            return Promise.reject(error);
          }
        }

        return Promise.reject(error);
      }
    );

    return () => {
      axios.interceptors.response.eject(interceptor);
    };
  }, [refresh, logout]);

  const value = {
    // État
    user,
    token,
    loading,
    error,
    isAuthenticated: !!user && !!token,

    // Actions
    login,
    logout,
    loginWithPSC,
    handlePSCCallback,
    changePassword,
    getProfile,
    refresh,

    // Permissions
    hasPermission,
    isSuperAdmin,
    isDomainAdmin
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

/**
 * Hook personnalisé pour utiliser le contexte d'authentification
 */
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth doit être utilisé dans un AuthProvider');
  }
  return context;
};

export default AuthContext;