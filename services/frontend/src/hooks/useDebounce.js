// services/frontend/src/hooks/useDebounce.js
/**
 * Hooks utilitaires pour le debounce et throttle
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

/**
 * Hook pour debouncer une valeur
 * @param {any} value - Valeur à debouncer
 * @param {number} delay - Délai en ms
 * @returns {any} Valeur debouncée
 */
export const useDebounce = (value, delay = 300) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
};

/**
 * Hook pour debouncer une fonction callback
 * @param {Function} callback - Fonction à debouncer
 * @param {number} delay - Délai en ms
 * @param {Array} dependencies - Dépendances du callback
 * @returns {Function} Fonction debouncée
 */
export const useDebouncedCallback = (callback, delay = 300, dependencies = []) => {
  const timeoutRef = useRef(null);
  const callbackRef = useRef(callback);

  // Mettre à jour la référence du callback
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  const debouncedCallback = useCallback((...args) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      callbackRef.current(...args);
    }, delay);
  }, [delay, ...dependencies]);

  // Cleanup au démontage
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Méthode pour annuler le debounce
  const cancel = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  // Méthode pour exécuter immédiatement
  const flush = useCallback((...args) => {
    cancel();
    callbackRef.current(...args);
  }, [cancel]);

  return useMemo(() => {
    const fn = debouncedCallback;
    fn.cancel = cancel;
    fn.flush = flush;
    return fn;
  }, [debouncedCallback, cancel, flush]);
};

/**
 * Hook pour throttle une fonction callback
 * @param {Function} callback - Fonction à throttle
 * @param {number} limit - Limite en ms
 * @returns {Function} Fonction throttlée
 */
export const useThrottle = (callback, limit = 300) => {
  const lastRunRef = useRef(0);
  const timeoutRef = useRef(null);
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  const throttledCallback = useCallback((...args) => {
    const now = Date.now();

    if (now - lastRunRef.current >= limit) {
      lastRunRef.current = now;
      callbackRef.current(...args);
    } else {
      // Programmer une exécution à la fin du délai
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        lastRunRef.current = Date.now();
        callbackRef.current(...args);
      }, limit - (now - lastRunRef.current));
    }
  }, [limit]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return throttledCallback;
};

/**
 * Hook pour la recherche avec debounce
 * @param {Function} searchFunction - Fonction de recherche
 * @param {number} delay - Délai en ms
 */
export const useDebouncedSearch = (searchFunction, delay = 300) => {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const debouncedQuery = useDebounce(query, delay);

  useEffect(() => {
    if (debouncedQuery) {
      setIsSearching(true);
      searchFunction(debouncedQuery).finally(() => {
        setIsSearching(false);
      });
    }
  }, [debouncedQuery, searchFunction]);

  const handleChange = useCallback((e) => {
    const value = e.target?.value ?? e;
    setQuery(value);
  }, []);

  const clear = useCallback(() => {
    setQuery('');
  }, []);

  return {
    query,
    debouncedQuery,
    isSearching,
    setQuery: handleChange,
    clear
  };
};

export default useDebounce;