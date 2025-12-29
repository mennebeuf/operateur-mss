// services/frontend/src/utils/index.js
/**
 * Point d'entrée pour les utilitaires frontend
 * Permet d'importer tous les utils depuis un seul fichier
 * 
 * Usage:
 * import { formatDate, isValidEmail, PATTERNS } from './utils';
 * 
 * ou:
 * import formatters from './utils/formatters';
 * import validators from './utils/validators';
 */

// Import des modules
import formatters, * as formattersNamed from './formatters';
import validators, * as validatorsNamed from './validators';

// ============================================
// RE-EXPORT DES FORMATTERS
// ============================================

export const {
  // Dates
  formatDate,
  formatDateTime,
  formatDateShort,
  formatRelativeDate,
  formatEmailDate,
  // Tailles
  formatBytes,
  mbToBytes,
  bytesToMb,
  formatQuota,
  // Noms et textes
  capitalize,
  formatName,
  getInitials,
  truncate,
  slugify,
  // Emails
  formatEmailSender,
  formatEmailAddress,
  formatRecipientsList,
  // Nombres
  formatNumber,
  formatPercentage,
  // MSSanté
  formatRPPS,
  formatFINESS,
  formatMailboxType,
  formatUserStatus,
  formatRole,
  formatCertificateStatus,
  // Divers
  maskEmail,
  getColorFromString
} = formattersNamed;

// ============================================
// RE-EXPORT DES VALIDATORS
// ============================================

export const {
  // Patterns
  PATTERNS,
  // Validation de base
  isEmpty,
  isRequired,
  minLength,
  maxLength,
  matchesPattern,
  // Validateurs spécifiques
  isValidEmail,
  isValidMSSanteEmail,
  isValidMSSanteDomain,
  isValidRPPS,
  isValidADELI,
  isValidFINESS,
  isValidSIRET,
  isValidPhoneNumber,
  validatePassword,
  isValidURL,
  isValidUUID,
  isValidName,
  // Création de formulaire
  createFormValidator,
  // Règles
  required,
  min,
  max,
  email,
  mssanteEmail,
  rpps,
  strongPassword,
  matches,
  pattern,
  // Validateurs prédéfinis
  loginValidator,
  userCreateValidator,
  mailboxCreateValidator,
  passwordChangeValidator,
  // Utilitaires
  cleanPhoneNumber,
  cleanRPPS,
  formatValidationErrors
} = validatorsNamed;

// ============================================
// CONSTANTES UTILES
// ============================================

/**
 * Statuts utilisateur possibles
 */
export const USER_STATUSES = {
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
  PENDING: 'pending',
  DELETED: 'deleted'
};

/**
 * Types de BAL
 */
export const MAILBOX_TYPES = {
  PERSONAL: 'personal',
  ORGANIZATIONAL: 'organizational',
  APPLICATION: 'application'
};

/**
 * Rôles utilisateur
 */
export const USER_ROLES = {
  SUPER_ADMIN: 'super_admin',
  DOMAIN_ADMIN: 'domain_admin',
  MANAGER: 'manager',
  USER: 'user',
  MAILBOX_OWNER: 'mailbox_owner'
};

/**
 * Tailles de quota par défaut (en bytes)
 */
export const DEFAULT_QUOTAS = {
  PERSONAL: 1024 * 1024 * 1024, // 1 Go
  ORGANIZATIONAL: 5 * 1024 * 1024 * 1024, // 5 Go
  APPLICATION: 10 * 1024 * 1024 * 1024 // 10 Go
};

/**
 * Limites de pièces jointes
 */
export const ATTACHMENT_LIMITS = {
  MAX_SIZE: 10 * 1024 * 1024, // 10 Mo par pièce jointe
  MAX_TOTAL_SIZE: 25 * 1024 * 1024, // 25 Mo total
  MAX_COUNT: 10 // Nombre max de pièces jointes
};

// ============================================
// FONCTIONS UTILITAIRES SUPPLÉMENTAIRES
// ============================================

/**
 * Génère un identifiant unique court
 * @param {number} length - Longueur de l'identifiant
 * @returns {string}
 */
export const generateId = (length = 8) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

/**
 * Debounce une fonction
 * @param {function} func - Fonction à debouncer
 * @param {number} wait - Délai en millisecondes
 * @returns {function}
 */
export const debounce = (func, wait = 300) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

/**
 * Throttle une fonction
 * @param {function} func - Fonction à throttler
 * @param {number} limit - Délai minimum entre les appels
 * @returns {function}
 */
export const throttle = (func, limit = 300) => {
  let inThrottle;
  return function executedFunction(...args) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
};

/**
 * Clone profond d'un objet
 * @param {any} obj - Objet à cloner
 * @returns {any}
 */
export const deepClone = (obj) => {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj.getTime());
  if (Array.isArray(obj)) return obj.map(item => deepClone(item));
  
  const cloned = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      cloned[key] = deepClone(obj[key]);
    }
  }
  return cloned;
};

/**
 * Fusionne plusieurs objets (deep merge)
 * @param  {...object} objects - Objets à fusionner
 * @returns {object}
 */
export const deepMerge = (...objects) => {
  const result = {};
  
  for (const obj of objects) {
    if (!obj) continue;
    
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
          result[key] = deepMerge(result[key], obj[key]);
        } else {
          result[key] = obj[key];
        }
      }
    }
  }
  
  return result;
};

/**
 * Groupe un tableau par une clé
 * @param {array} array - Tableau à grouper
 * @param {string|function} key - Clé ou fonction de groupage
 * @returns {object}
 */
export const groupBy = (array, key) => {
  if (!Array.isArray(array)) return {};
  
  return array.reduce((result, item) => {
    const groupKey = typeof key === 'function' ? key(item) : item[key];
    (result[groupKey] = result[groupKey] || []).push(item);
    return result;
  }, {});
};

/**
 * Trie un tableau d'objets par une propriété
 * @param {array} array - Tableau à trier
 * @param {string} key - Propriété de tri
 * @param {string} order - 'asc' ou 'desc'
 * @returns {array}
 */
export const sortBy = (array, key, order = 'asc') => {
  if (!Array.isArray(array)) return [];
  
  return [...array].sort((a, b) => {
    const aVal = a[key];
    const bVal = b[key];
    
    if (aVal === bVal) return 0;
    if (aVal === null || aVal === undefined) return 1;
    if (bVal === null || bVal === undefined) return -1;
    
    const comparison = aVal < bVal ? -1 : 1;
    return order === 'asc' ? comparison : -comparison;
  });
};

/**
 * Supprime les doublons d'un tableau
 * @param {array} array - Tableau source
 * @param {string} key - Propriété pour identifier les doublons (optionnel)
 * @returns {array}
 */
export const unique = (array, key = null) => {
  if (!Array.isArray(array)) return [];
  
  if (key) {
    const seen = new Set();
    return array.filter(item => {
      const val = item[key];
      if (seen.has(val)) return false;
      seen.add(val);
      return true;
    });
  }
  
  return [...new Set(array)];
};

/**
 * Attend un délai (promesse)
 * @param {number} ms - Millisecondes
 * @returns {Promise}
 */
export const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Copie un texte dans le presse-papier
 * @param {string} text - Texte à copier
 * @returns {Promise<boolean>}
 */
export const copyToClipboard = async (text) => {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    
    // Fallback pour navigateurs plus anciens
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
    return true;
  } catch {
    return false;
  }
};

/**
 * Télécharge un fichier depuis une URL blob ou data
 * @param {Blob|string} data - Données ou URL
 * @param {string} filename - Nom du fichier
 */
export const downloadFile = (data, filename) => {
  const url = data instanceof Blob ? URL.createObjectURL(data) : data;
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  if (data instanceof Blob) {
    URL.revokeObjectURL(url);
  }
};

// ============================================
// EXPORT PAR DÉFAUT
// ============================================

export default {
  // Modules complets
  formatters,
  validators,
  
  // Constantes
  USER_STATUSES,
  MAILBOX_TYPES,
  USER_ROLES,
  DEFAULT_QUOTAS,
  ATTACHMENT_LIMITS,
  
  // Utilitaires
  generateId,
  debounce,
  throttle,
  deepClone,
  deepMerge,
  groupBy,
  sortBy,
  unique,
  sleep,
  copyToClipboard,
  downloadFile
};