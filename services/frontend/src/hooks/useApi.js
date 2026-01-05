// services/frontend/src/hooks/useApi.js
/**
 * Hook personnalisé pour les appels API génériques
 * Gère le loading, les erreurs et le cache
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import api from '../services/api';

/**
 * Hook générique pour les appels API
 * @param {Function} apiFunction - Fonction API à appeler
 * @param {Object} options - Options de configuration
 */
export const useApi = (apiFunction, options = {}) => {
  const {
    immediate = false,      // Exécuter immédiatement au montage
    initialData = null,     // Données initiales
    onSuccess = null,       // Callback succès
    onError = null,         // Callback erreur
    cache = false,          // Activer le cache
    cacheKey = null,        // Clé de cache personnalisée
    cacheDuration = 5 * 60 * 1000  // Durée du cache (5 min par défaut)
  } = options;

  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(immediate);
  const [error, setError] = useState(null);
  const mountedRef = useRef(true);
  const cacheRef = useRef(new Map());

  /**
   * Exécute l'appel API
   */
  const execute = useCallback(async (...args) => {
    // Vérifier le cache
    if (cache && cacheKey) {
      const cached = cacheRef.current.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < cacheDuration) {
        setData(cached.data);
        return { success: true, data: cached.data };
      }
    }

    setLoading(true);
    setError(null);

    try {
      const result = await apiFunction(...args);
      
      if (!mountedRef.current) return { success: false };

      const responseData = result.data || result;
      setData(responseData);

      // Mettre en cache
      if (cache && cacheKey) {
        cacheRef.current.set(cacheKey, {
          data: responseData,
          timestamp: Date.now()
        });
      }

      if (onSuccess) {
        onSuccess(responseData);
      }

      return { success: true, data: responseData };
    } catch (err) {
      if (!mountedRef.current) return { success: false };

      const errorMessage = err.response?.data?.error || err.message || 'Erreur inconnue';
      setError(errorMessage);

      if (onError) {
        onError(err);
      }

      return { success: false, error: errorMessage };
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [apiFunction, cache, cacheKey, cacheDuration, onSuccess, onError]);

  /**
   * Réinitialise l'état
   */
  const reset = useCallback(() => {
    setData(initialData);
    setError(null);
    setLoading(false);
  }, [initialData]);

  /**
   * Invalide le cache
   */
  const invalidateCache = useCallback(() => {
    if (cacheKey) {
      cacheRef.current.delete(cacheKey);
    } else {
      cacheRef.current.clear();
    }
  }, [cacheKey]);

  // Exécution immédiate si demandée
  useEffect(() => {
    if (immediate) {
      execute();
    }
  }, []);

  // Cleanup au démontage
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  return {
    data,
    loading,
    error,
    execute,
    reset,
    invalidateCache,
    setData
  };
};

/**
 * Hook pour les requêtes GET avec rechargement automatique
 */
export const useFetch = (url, options = {}) => {
  const {
    params = {},
    dependencies = [],
    ...restOptions
  } = options;

  const fetchFn = useCallback(async () => {
    const response = await api.get(url, { params });
    return response.data;
  }, [url, JSON.stringify(params)]);

  const result = useApi(fetchFn, {
    immediate: true,
    ...restOptions
  });

  // Recharger quand les dépendances changent
  useEffect(() => {
    if (dependencies.length > 0) {
      result.execute();
    }
  }, dependencies);

  return result;
};

/**
 * Hook pour les mutations (POST, PUT, DELETE)
 */
export const useMutation = (mutationFn, options = {}) => {
  const {
    onSuccess,
    onError,
    invalidateQueries = []
  } = options;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const mutate = useCallback(async (...args) => {
    setLoading(true);
    setError(null);

    try {
      const result = await mutationFn(...args);
      
      if (onSuccess) {
        onSuccess(result);
      }

      return { success: true, data: result };
    } catch (err) {
      const errorMessage = err.response?.data?.error || err.message;
      setError(errorMessage);

      if (onError) {
        onError(err);
      }

      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  }, [mutationFn, onSuccess, onError]);

  return {
    mutate,
    loading,
    error,
    reset: () => setError(null)
  };
};

/**
 * Hook pour la pagination
 */
export const usePaginatedApi = (apiFunction, options = {}) => {
  const {
    initialPage = 1,
    initialLimit = 20,
    ...restOptions
  } = options;

  const [page, setPage] = useState(initialPage);
  const [limit, setLimit] = useState(initialLimit);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const fetchFn = useCallback(async () => {
    const result = await apiFunction(page, limit);
    setTotal(result.total || 0);
    setTotalPages(result.totalPages || Math.ceil((result.total || 0) / limit));
    return result.data || result.items || result;
  }, [apiFunction, page, limit]);

  const { data, loading, error, execute } = useApi(fetchFn, {
    immediate: true,
    ...restOptions
  });

  const goToPage = useCallback((newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage);
    }
  }, [totalPages]);

  const nextPage = useCallback(() => {
    goToPage(page + 1);
  }, [page, goToPage]);

  const prevPage = useCallback(() => {
    goToPage(page - 1);
  }, [page, goToPage]);

  const changeLimit = useCallback((newLimit) => {
    setLimit(newLimit);
    setPage(1);
  }, []);

  // Recharger quand la page ou la limite change
  useEffect(() => {
    execute();
  }, [page, limit]);

  return {
    data,
    loading,
    error,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1
    },
    goToPage,
    nextPage,
    prevPage,
    changeLimit,
    refresh: execute
  };
};

export default useApi;