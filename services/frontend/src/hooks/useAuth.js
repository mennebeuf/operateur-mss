// services/frontend/src/hooks/useAuth.js
/**
 * Hook personnalisé pour l'authentification
 * Fournit l'accès au contexte d'authentification et des helpers
 */

import { useContext, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../contexts/AuthContext';

/**
 * Hook principal d'authentification
 * @returns {Object} État et méthodes d'authentification
 */
export const useAuth = () => {
  const context = useContext(AuthContext);
  const navigate = useNavigate();

  if (!context) {
    throw new Error('useAuth doit être utilisé dans un AuthProvider');
  }

  const {
    user,
    token,
    loading,
    error,
    login: contextLogin,
    logout: contextLogout,
    refreshToken,
    updateUser,
    clearError
  } = context;

  /**
   * Connexion avec redirection
   */
  const login = useCallback(async (email, password, redirectTo = '/') => {
    try {
      const result = await contextLogin(email, password);
      if (result.success) {
        navigate(redirectTo);
      }
      return result;
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, [contextLogin, navigate]);

  /**
   * Déconnexion avec redirection
   */
  const logout = useCallback(async (redirectTo = '/login') => {
    try {
      await contextLogout();
      navigate(redirectTo);
    } catch (err) {
      console.error('Erreur lors de la déconnexion:', err);
      navigate(redirectTo);
    }
  }, [contextLogout, navigate]);

  /**
   * Vérifie si l'utilisateur est authentifié
   */
  const isAuthenticated = useMemo(() => {
    return !!token && !!user;
  }, [token, user]);

  /**
   * Vérifie si l'utilisateur a un rôle spécifique
   */
  const hasRole = useCallback((role) => {
    if (!user) return false;
    if (Array.isArray(role)) {
      return role.includes(user.role);
    }
    return user.role === role;
  }, [user]);

  /**
   * Vérifie si l'utilisateur est super admin
   */
  const isSuperAdmin = useMemo(() => {
    return user?.is_super_admin === true || user?.role === 'super_admin';
  }, [user]);

  /**
   * Vérifie si l'utilisateur est admin de domaine
   */
  const isDomainAdmin = useMemo(() => {
    return user?.role === 'domain_admin' || isSuperAdmin;
  }, [user, isSuperAdmin]);

  /**
   * Vérifie si l'utilisateur appartient à un domaine
   */
  const belongsToDomain = useCallback((domainId) => {
    if (!user) return false;
    if (isSuperAdmin) return true;
    return user.domain?.id === domainId || user.domains?.includes(domainId);
  }, [user, isSuperAdmin]);

  /**
   * Obtient le domaine actuel de l'utilisateur
   */
  const currentDomain = useMemo(() => {
    return user?.domain || null;
  }, [user]);

  /**
   * Obtient le nom complet de l'utilisateur
   */
  const fullName = useMemo(() => {
    if (!user) return '';
    return `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email;
  }, [user]);

  /**
   * Obtient les initiales de l'utilisateur
   */
  const initials = useMemo(() => {
    if (!user) return '';
    const first = user.firstName?.[0] || user.email?.[0] || '';
    const last = user.lastName?.[0] || '';
    return (first + last).toUpperCase();
  }, [user]);

  return {
    // État
    user,
    token,
    loading,
    error,
    isAuthenticated,
    isSuperAdmin,
    isDomainAdmin,
    currentDomain,
    fullName,
    initials,
    
    // Méthodes
    login,
    logout,
    refreshToken,
    updateUser,
    clearError,
    hasRole,
    belongsToDomain
  };
};

/**
 * Hook pour protéger les routes authentifiées
 * Redirige automatiquement si non authentifié
 */
export const useRequireAuth = (redirectTo = '/login') => {
  const { isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();

  useMemo(() => {
    if (!loading && !isAuthenticated) {
      navigate(redirectTo, { replace: true });
    }
  }, [isAuthenticated, loading, navigate, redirectTo]);

  return { isAuthenticated, loading };
};

/**
 * Hook pour les pages publiques uniquement (login, register)
 * Redirige si déjà authentifié
 */
export const usePublicOnly = (redirectTo = '/') => {
  const { isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();

  useMemo(() => {
    if (!loading && isAuthenticated) {
      navigate(redirectTo, { replace: true });
    }
  }, [isAuthenticated, loading, navigate, redirectTo]);

  return { isAuthenticated, loading };
};

export default useAuth;