// services/frontend/src/hooks/useLocalStorage.js
/**
 * Hook personnalisé pour la gestion du localStorage
 * Avec support de la synchronisation entre onglets
 */

import { useState, useEffect, useCallback } from 'react';

/**
 * Hook pour utiliser le localStorage comme état React
 * @param {string} key - Clé de stockage
 * @param {any} initialValue - Valeur initiale
 * @param {Object} options - Options de configuration
 */
export const useLocalStorage = (key, initialValue, options = {}) => {
  const {
    serialize = JSON.stringify,
    deserialize = JSON.parse,
    syncTabs = true  // Synchroniser entre les onglets
  } = options;

  // Fonction pour obtenir la valeur stockée
  const readValue = useCallback(() => {
    if (typeof window === 'undefined') {
      return initialValue;
    }

    try {
      const item = window.localStorage.getItem(key);
      return item ? deserialize(item) : initialValue;
    } catch (error) {
      console.warn(`Erreur lecture localStorage "${key}":`, error);
      return initialValue;
    }
  }, [key, initialValue, deserialize]);

  const [storedValue, setStoredValue] = useState(readValue);

  // Fonction pour mettre à jour la valeur
  const setValue = useCallback((value) => {
    if (typeof window === 'undefined') {
      console.warn('localStorage non disponible');
      return;
    }

    try {
      // Permettre la mise à jour fonctionnelle
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, serialize(valueToStore));
      
      // Dispatch un événement custom pour la synchronisation
      window.dispatchEvent(new CustomEvent('local-storage-change', {
        detail: { key, value: valueToStore }
      }));
    } catch (error) {
      console.warn(`Erreur écriture localStorage "${key}":`, error);
    }
  }, [key, serialize, storedValue]);

  // Fonction pour supprimer la valeur
  const removeValue = useCallback(() => {
    if (typeof window === 'undefined') return;

    try {
      window.localStorage.removeItem(key);
      setStoredValue(initialValue);
      
      window.dispatchEvent(new CustomEvent('local-storage-change', {
        detail: { key, value: null }
      }));
    } catch (error) {
      console.warn(`Erreur suppression localStorage "${key}":`, error);
    }
  }, [key, initialValue]);

  // Écouter les changements depuis d'autres onglets
  useEffect(() => {
    if (!syncTabs) return;

    const handleStorageChange = (e) => {
      if (e.key === key && e.newValue !== null) {
        try {
          setStoredValue(deserialize(e.newValue));
        } catch {
          setStoredValue(e.newValue);
        }
      } else if (e.key === key && e.newValue === null) {
        setStoredValue(initialValue);
      }
    };

    // Écouter les événements storage natifs (autres onglets)
    window.addEventListener('storage', handleStorageChange);
    
    // Écouter les événements custom (même onglet)
    const handleCustomChange = (e) => {
      if (e.detail.key === key) {
        setStoredValue(e.detail.value ?? initialValue);
      }
    };
    window.addEventListener('local-storage-change', handleCustomChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('local-storage-change', handleCustomChange);
    };
  }, [key, initialValue, deserialize, syncTabs]);

  return [storedValue, setValue, removeValue];
};

/**
 * Hook pour le sessionStorage
 */
export const useSessionStorage = (key, initialValue, options = {}) => {
  const {
    serialize = JSON.stringify,
    deserialize = JSON.parse
  } = options;

  const readValue = useCallback(() => {
    if (typeof window === 'undefined') {
      return initialValue;
    }

    try {
      const item = window.sessionStorage.getItem(key);
      return item ? deserialize(item) : initialValue;
    } catch (error) {
      console.warn(`Erreur lecture sessionStorage "${key}":`, error);
      return initialValue;
    }
  }, [key, initialValue, deserialize]);

  const [storedValue, setStoredValue] = useState(readValue);

  const setValue = useCallback((value) => {
    if (typeof window === 'undefined') return;

    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.sessionStorage.setItem(key, serialize(valueToStore));
    } catch (error) {
      console.warn(`Erreur écriture sessionStorage "${key}":`, error);
    }
  }, [key, serialize, storedValue]);

  const removeValue = useCallback(() => {
    if (typeof window === 'undefined') return;

    try {
      window.sessionStorage.removeItem(key);
      setStoredValue(initialValue);
    } catch (error) {
      console.warn(`Erreur suppression sessionStorage "${key}":`, error);
    }
  }, [key, initialValue]);

  return [storedValue, setValue, removeValue];
};

/**
 * Hook pour vérifier si localStorage est disponible
 */
export const useStorageAvailable = () => {
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    try {
      const test = '__storage_test__';
      window.localStorage.setItem(test, test);
      window.localStorage.removeItem(test);
      setAvailable(true);
    } catch (e) {
      setAvailable(false);
    }
  }, []);

  return available;
};

export default useLocalStorage;