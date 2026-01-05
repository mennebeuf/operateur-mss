// services/frontend/src/hooks/index.js
/**
 * Point d'entrée pour les hooks personnalisés
 * Permet d'importer tous les hooks depuis un seul fichier
 * 
 * Usage:
 * import { useAuth, usePermissions, useWebmail } from './hooks';
 * 
 * ou:
 * import useAuth from './hooks/useAuth';
 */

// Hooks d'authentification
export { 
  useAuth, 
  useRequireAuth, 
  usePublicOnly 
} from './useAuth';

// Hooks de permissions
export { 
  usePermissions, 
  usePermissionGuard, 
  withPermission 
} from './usePermissions';

// Hook webmail
export { useWebmail } from './useWebmail';

// Hooks API génériques
export { 
  useApi, 
  useFetch, 
  useMutation, 
  usePaginatedApi 
} from './useApi';

// Hooks utilitaires debounce/throttle
export { 
  useDebounce, 
  useDebouncedCallback, 
  useThrottle, 
  useDebouncedSearch 
} from './useDebounce';

// Hooks de stockage local
export { 
  useLocalStorage, 
  useSessionStorage, 
  useStorageAvailable 
} from './useLocalStorage';

// Exports par défaut des hooks principaux
export { default as useAuth } from './useAuth';
export { default as usePermissions } from './usePermissions';
export { default as useWebmail } from './useWebmail';
export { default as useApi } from './useApi';
export { default as useDebounce } from './useDebounce';
export { default as useLocalStorage } from './useLocalStorage';