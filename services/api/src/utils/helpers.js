// services/api/src/utils/helpers.js

/**
 * Utilitaires généraux pour l'API MSSanté
 */

/**
 * Formater une date en ISO ou format français
 * @param {Date|string} date - Date à formater
 * @param {string} format - 'iso', 'fr', 'datetime'
 * @returns {string}
 */
function formatDate(date, format = 'iso') {
  const d = date instanceof Date ? date : new Date(date);
  
  if (isNaN(d.getTime())) return null;
  
  switch (format) {
    case 'fr':
      return d.toLocaleDateString('fr-FR');
    case 'datetime':
      return d.toLocaleString('fr-FR');
    case 'iso':
    default:
      return d.toISOString();
  }
}

/**
 * Calculer la différence entre deux dates
 * @param {Date} date1 
 * @param {Date} date2 
 * @param {string} unit - 'days', 'hours', 'minutes', 'seconds'
 * @returns {number}
 */
function dateDiff(date1, date2, unit = 'days') {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const diffMs = Math.abs(d2 - d1);
  
  const units = {
    days: 1000 * 60 * 60 * 24,
    hours: 1000 * 60 * 60,
    minutes: 1000 * 60,
    seconds: 1000
  };
  
  return Math.floor(diffMs / (units[unit] || units.days));
}

/**
 * Formater une taille en bytes en format lisible
 * @param {number} bytes - Taille en bytes
 * @param {number} decimals - Nombre de décimales
 * @returns {string}
 */
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`;
}

/**
 * Convertir MB en bytes
 * @param {number} mb 
 * @returns {number}
 */
function mbToBytes(mb) {
  return mb * 1024 * 1024;
}

/**
 * Convertir bytes en MB
 * @param {number} bytes 
 * @returns {number}
 */
function bytesToMb(bytes) {
  return bytes / (1024 * 1024);
}

/**
 * Générer un slug à partir d'une chaîne
 * @param {string} text 
 * @returns {string}
 */
function slugify(text) {
  return text
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

/**
 * Tronquer une chaîne avec ellipsis
 * @param {string} str 
 * @param {number} maxLength 
 * @returns {string}
 */
function truncate(str, maxLength = 100) {
  if (!str || str.length <= maxLength) return str;
  return str.substring(0, maxLength - 3) + '...';
}

/**
 * Capitaliser la première lettre
 * @param {string} str 
 * @returns {string}
 */
function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/**
 * Formater un nom (prénom + nom)
 * @param {string} firstName 
 * @param {string} lastName 
 * @returns {string}
 */
function formatName(firstName, lastName) {
  const parts = [];
  if (firstName) parts.push(capitalize(firstName.trim()));
  if (lastName) parts.push(lastName.trim().toUpperCase());
  return parts.join(' ');
}

/**
 * Attendre un délai (promesse)
 * @param {number} ms - Millisecondes
 * @returns {Promise}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry une fonction asynchrone
 * @param {Function} fn - Fonction à exécuter
 * @param {number} retries - Nombre de tentatives
 * @param {number} delay - Délai entre les tentatives (ms)
 * @returns {Promise}
 */
async function retry(fn, retries = 3, delay = 1000) {
  let lastError;
  
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (i < retries - 1) {
        await sleep(delay * Math.pow(2, i)); // Backoff exponentiel
      }
    }
  }
  
  throw lastError;
}

/**
 * Parser un booléen depuis une chaîne
 * @param {string|boolean} value 
 * @returns {boolean}
 */
function parseBoolean(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    return ['true', '1', 'yes', 'oui'].includes(value.toLowerCase());
  }
  return Boolean(value);
}

/**
 * Supprimer les propriétés undefined/null d'un objet
 * @param {Object} obj 
 * @returns {Object}
 */
function cleanObject(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  
  return Object.fromEntries(
    Object.entries(obj).filter(([_, v]) => v !== undefined && v !== null)
  );
}

/**
 * Paginer un tableau
 * @param {Array} array 
 * @param {number} page 
 * @param {number} limit 
 * @returns {Object}
 */
function paginate(array, page = 1, limit = 20) {
  const total = array.length;
  const totalPages = Math.ceil(total / limit);
  const offset = (page - 1) * limit;
  const data = array.slice(offset, offset + limit);
  
  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1
    }
  };
}

/**
 * Créer une réponse API standardisée
 * @param {any} data 
 * @param {string} message 
 * @param {Object} meta 
 * @returns {Object}
 */
function apiResponse(data, message = null, meta = {}) {
  return {
    success: true,
    message,
    data,
    ...meta,
    timestamp: new Date().toISOString()
  };
}

/**
 * Créer une réponse d'erreur API standardisée
 * @param {string} message 
 * @param {string} code 
 * @param {Object} details 
 * @returns {Object}
 */
function apiError(message, code = 'ERROR', details = null) {
  return {
    success: false,
    error: {
      code,
      message,
      details
    },
    timestamp: new Date().toISOString()
  };
}

/**
 * Obtenir l'IP du client depuis une requête Express
 * @param {Object} req - Requête Express
 * @returns {string}
 */
function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
         req.headers['x-real-ip'] ||
         req.connection?.remoteAddress ||
         req.socket?.remoteAddress ||
         req.ip ||
         'unknown';
}

/**
 * Générer un identifiant court unique
 * @param {number} length 
 * @returns {string}
 */
function shortId(length = 8) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Vérifier si une valeur est vide (null, undefined, '', [], {})
 * @param {any} value 
 * @returns {boolean}
 */
function isEmpty(value) {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
}

/**
 * Grouper un tableau par une clé
 * @param {Array} array 
 * @param {string|Function} key 
 * @returns {Object}
 */
function groupBy(array, key) {
  return array.reduce((result, item) => {
    const groupKey = typeof key === 'function' ? key(item) : item[key];
    (result[groupKey] = result[groupKey] || []).push(item);
    return result;
  }, {});
}

/**
 * Obtenir le premier jour du mois
 * @param {Date} date 
 * @returns {Date}
 */
function getFirstDayOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

/**
 * Obtenir le dernier jour du mois
 * @param {Date} date 
 * @returns {Date}
 */
function getLastDayOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

module.exports = {
  formatDate,
  dateDiff,
  formatBytes,
  mbToBytes,
  bytesToMb,
  slugify,
  truncate,
  capitalize,
  formatName,
  sleep,
  retry,
  parseBoolean,
  cleanObject,
  paginate,
  apiResponse,
  apiError,
  getClientIp,
  shortId,
  isEmpty,
  groupBy,
  getFirstDayOfMonth,
  getLastDayOfMonth
};