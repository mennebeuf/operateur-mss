// services/frontend/src/utils/formatters.js
// Utilitaires de formatage pour le frontend MSSanté

import { format, formatDistanceToNow, parseISO, isValid } from 'date-fns';
import { fr } from 'date-fns/locale';

// ============================================
// FORMATAGE DES DATES
// ============================================

/**
 * Formate une date en format français complet
 * @param {string|Date} date - Date à formater
 * @returns {string} Date formatée (ex: "15 janvier 2024")
 */
export const formatDate = (date) => {
  if (!date) return '';
  const parsedDate = typeof date === 'string' ? parseISO(date) : date;
  if (!isValid(parsedDate)) return '';
  return format(parsedDate, 'd MMMM yyyy', { locale: fr });
};

/**
 * Formate une date avec l'heure
 * @param {string|Date} date - Date à formater
 * @returns {string} Date formatée (ex: "15 janvier 2024 à 14:30")
 */
export const formatDateTime = (date) => {
  if (!date) return '';
  const parsedDate = typeof date === 'string' ? parseISO(date) : date;
  if (!isValid(parsedDate)) return '';
  return format(parsedDate, "d MMMM yyyy 'à' HH:mm", { locale: fr });
};

/**
 * Formate une date en format court
 * @param {string|Date} date - Date à formater
 * @returns {string} Date formatée (ex: "15/01/2024")
 */
export const formatDateShort = (date) => {
  if (!date) return '';
  const parsedDate = typeof date === 'string' ? parseISO(date) : date;
  if (!isValid(parsedDate)) return '';
  return format(parsedDate, 'dd/MM/yyyy', { locale: fr });
};

/**
 * Formate une date en relatif (il y a X minutes, etc.)
 * @param {string|Date} date - Date à formater
 * @returns {string} Date relative (ex: "il y a 5 minutes")
 */
export const formatRelativeDate = (date) => {
  if (!date) return '';
  const parsedDate = typeof date === 'string' ? parseISO(date) : date;
  if (!isValid(parsedDate)) return '';
  return formatDistanceToNow(parsedDate, { addSuffix: true, locale: fr });
};

/**
 * Formate une date pour l'affichage dans une liste d'emails
 * Affiche l'heure si aujourd'hui, sinon la date
 * @param {string|Date} date - Date à formater
 * @returns {string} Date formatée intelligemment
 */
export const formatEmailDate = (date) => {
  if (!date) return '';
  const parsedDate = typeof date === 'string' ? parseISO(date) : date;
  if (!isValid(parsedDate)) return '';
  
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dateOnly = new Date(parsedDate.getFullYear(), parsedDate.getMonth(), parsedDate.getDate());
  
  if (dateOnly.getTime() === today.getTime()) {
    return format(parsedDate, 'HH:mm', { locale: fr });
  }
  
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (dateOnly.getTime() === yesterday.getTime()) {
    return 'Hier';
  }
  
  const thisYear = now.getFullYear() === parsedDate.getFullYear();
  if (thisYear) {
    return format(parsedDate, 'd MMM', { locale: fr });
  }
  
  return format(parsedDate, 'dd/MM/yyyy', { locale: fr });
};

// ============================================
// FORMATAGE DES TAILLES
// ============================================

/**
 * Formate une taille en bytes de manière lisible
 * @param {number} bytes - Taille en bytes
 * @param {number} decimals - Nombre de décimales
 * @returns {string} Taille formatée (ex: "1.5 Mo")
 */
export const formatBytes = (bytes, decimals = 2) => {
  if (!bytes || bytes === 0) return '0 o';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['o', 'Ko', 'Mo', 'Go', 'To', 'Po'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
};

/**
 * Convertit des Mo en bytes
 * @param {number} mb - Taille en Mo
 * @returns {number} Taille en bytes
 */
export const mbToBytes = (mb) => {
  return mb * 1024 * 1024;
};

/**
 * Convertit des bytes en Mo
 * @param {number} bytes - Taille en bytes
 * @returns {number} Taille en Mo
 */
export const bytesToMb = (bytes) => {
  return bytes / (1024 * 1024);
};

/**
 * Formate un quota (utilisé/total)
 * @param {number} used - Espace utilisé en bytes
 * @param {number} total - Espace total en bytes
 * @returns {object} { text: string, percentage: number }
 */
export const formatQuota = (used, total) => {
  const percentage = total > 0 ? Math.round((used / total) * 100) : 0;
  return {
    text: `${formatBytes(used)} / ${formatBytes(total)}`,
    percentage,
    usedText: formatBytes(used),
    totalText: formatBytes(total)
  };
};

// ============================================
// FORMATAGE DES NOMS ET TEXTES
// ============================================

/**
 * Capitalise la première lettre d'une chaîne
 * @param {string} str - Chaîne à capitaliser
 * @returns {string} Chaîne capitalisée
 */
export const capitalize = (str) => {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

/**
 * Formate un nom complet (prénom + nom)
 * @param {string} firstName - Prénom
 * @param {string} lastName - Nom
 * @returns {string} Nom formaté
 */
export const formatName = (firstName, lastName) => {
  const parts = [];
  if (firstName) parts.push(capitalize(firstName.trim()));
  if (lastName) parts.push(lastName.trim().toUpperCase());
  return parts.join(' ');
};

/**
 * Génère les initiales à partir d'un nom
 * @param {string} firstName - Prénom
 * @param {string} lastName - Nom
 * @returns {string} Initiales (ex: "JD")
 */
export const getInitials = (firstName, lastName) => {
  const first = firstName?.charAt(0)?.toUpperCase() || '';
  const last = lastName?.charAt(0)?.toUpperCase() || '';
  return `${first}${last}` || '?';
};

/**
 * Tronque un texte avec ellipsis
 * @param {string} str - Texte à tronquer
 * @param {number} maxLength - Longueur maximale
 * @returns {string} Texte tronqué
 */
export const truncate = (str, maxLength = 100) => {
  if (!str || str.length <= maxLength) return str || '';
  return str.substring(0, maxLength - 3) + '...';
};

/**
 * Transforme un texte en slug
 * @param {string} text - Texte à transformer
 * @returns {string} Slug
 */
export const slugify = (text) => {
  if (!text) return '';
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
};

// ============================================
// FORMATAGE DES EMAILS
// ============================================

/**
 * Extrait le nom d'affichage d'un expéditeur email
 * @param {object} from - Objet expéditeur { name, address }
 * @returns {string} Nom d'affichage
 */
export const formatEmailSender = (from) => {
  if (!from) return '(inconnu)';
  if (Array.isArray(from)) {
    from = from[0];
  }
  if (!from) return '(inconnu)';
  return from.name || from.address || '(inconnu)';
};

/**
 * Formate une adresse email avec nom
 * @param {object} recipient - { name, address }
 * @returns {string} Adresse formatée
 */
export const formatEmailAddress = (recipient) => {
  if (!recipient) return '';
  if (recipient.name) {
    return `${recipient.name} <${recipient.address}>`;
  }
  return recipient.address;
};

/**
 * Formate une liste de destinataires
 * @param {array} recipients - Liste de destinataires
 * @param {number} maxShow - Nombre max à afficher
 * @returns {string} Liste formatée
 */
export const formatRecipientsList = (recipients, maxShow = 3) => {
  if (!recipients || recipients.length === 0) return '';
  
  const visible = recipients.slice(0, maxShow);
  const remaining = recipients.length - maxShow;
  
  const formatted = visible
    .map(r => r.name || r.address)
    .join(', ');
  
  if (remaining > 0) {
    return `${formatted} (+${remaining})`;
  }
  
  return formatted;
};

// ============================================
// FORMATAGE DES NOMBRES
// ============================================

/**
 * Formate un nombre avec séparateur de milliers
 * @param {number} num - Nombre à formater
 * @returns {string} Nombre formaté
 */
export const formatNumber = (num) => {
  if (num === null || num === undefined) return '0';
  return new Intl.NumberFormat('fr-FR').format(num);
};

/**
 * Formate un pourcentage
 * @param {number} value - Valeur (0-100 ou 0-1)
 * @param {number} decimals - Nombre de décimales
 * @returns {string} Pourcentage formaté
 */
export const formatPercentage = (value, decimals = 0) => {
  if (value === null || value === undefined) return '0%';
  const percentage = value > 1 ? value : value * 100;
  return `${percentage.toFixed(decimals)}%`;
};

// ============================================
// FORMATAGE SPÉCIFIQUE MSSANTÉ
// ============================================

/**
 * Formate un numéro RPPS (groupes de 3)
 * @param {string} rpps - Numéro RPPS (11 chiffres)
 * @returns {string} RPPS formaté
 */
export const formatRPPS = (rpps) => {
  if (!rpps) return '';
  const clean = rpps.replace(/\s/g, '');
  if (clean.length !== 11) return clean;
  return `${clean.slice(0, 3)} ${clean.slice(3, 6)} ${clean.slice(6, 9)} ${clean.slice(9)}`;
};

/**
 * Formate un numéro FINESS
 * @param {string} finess - Numéro FINESS (9 chiffres)
 * @returns {string} FINESS formaté
 */
export const formatFINESS = (finess) => {
  if (!finess) return '';
  const clean = finess.replace(/\s/g, '');
  if (clean.length !== 9) return clean;
  return `${clean.slice(0, 3)} ${clean.slice(3, 6)} ${clean.slice(6)}`;
};

/**
 * Formate un type de BAL pour affichage
 * @param {string} type - Type de BAL (personal, organizational, application)
 * @returns {string} Type formaté en français
 */
export const formatMailboxType = (type) => {
  const types = {
    personal: 'Personnelle',
    organizational: 'Organisationnelle',
    application: 'Applicative'
  };
  return types[type] || type;
};

/**
 * Formate un statut utilisateur
 * @param {string} status - Statut (active, suspended, pending, deleted)
 * @returns {object} { text: string, color: string }
 */
export const formatUserStatus = (status) => {
  const statuses = {
    active: { text: 'Actif', color: 'green' },
    suspended: { text: 'Suspendu', color: 'red' },
    pending: { text: 'En attente', color: 'yellow' },
    deleted: { text: 'Supprimé', color: 'gray' }
  };
  return statuses[status] || { text: status, color: 'gray' };
};

/**
 * Formate un rôle utilisateur
 * @param {string} role - Rôle
 * @returns {string} Rôle formaté
 */
export const formatRole = (role) => {
  const roles = {
    super_admin: 'Super Administrateur',
    domain_admin: 'Administrateur Domaine',
    manager: 'Gestionnaire',
    user: 'Utilisateur',
    mailbox_owner: 'Propriétaire BAL'
  };
  return roles[role] || role;
};

/**
 * Formate l'état d'un certificat
 * @param {string} expiryDate - Date d'expiration
 * @returns {object} { status: string, text: string, color: string, daysRemaining: number }
 */
export const formatCertificateStatus = (expiryDate) => {
  if (!expiryDate) {
    return { status: 'unknown', text: 'Inconnu', color: 'gray', daysRemaining: null };
  }
  
  const expiry = typeof expiryDate === 'string' ? parseISO(expiryDate) : expiryDate;
  const now = new Date();
  const diffTime = expiry.getTime() - now.getTime();
  const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (daysRemaining < 0) {
    return { status: 'expired', text: 'Expiré', color: 'red', daysRemaining };
  }
  if (daysRemaining < 30) {
    return { status: 'critical', text: 'Critique', color: 'red', daysRemaining };
  }
  if (daysRemaining < 90) {
    return { status: 'warning', text: 'Attention', color: 'yellow', daysRemaining };
  }
  return { status: 'valid', text: 'Valide', color: 'green', daysRemaining };
};

// ============================================
// UTILITAIRES DIVERS
// ============================================

/**
 * Masque une adresse email pour la confidentialité
 * @param {string} email - Email à masquer
 * @returns {string} Email masqué
 */
export const maskEmail = (email) => {
  if (!email) return '';
  const [local, domain] = email.split('@');
  if (!domain) return email;
  
  const maskedLocal = local.length > 2 
    ? local.charAt(0) + '*'.repeat(local.length - 2) + local.charAt(local.length - 1)
    : local.charAt(0) + '*';
  
  return `${maskedLocal}@${domain}`;
};

/**
 * Génère une couleur de badge basée sur une chaîne
 * @param {string} str - Chaîne de base
 * @returns {string} Classe CSS de couleur Tailwind
 */
export const getColorFromString = (str) => {
  if (!str) return 'bg-gray-100 text-gray-800';
  
  const colors = [
    'bg-blue-100 text-blue-800',
    'bg-green-100 text-green-800',
    'bg-yellow-100 text-yellow-800',
    'bg-red-100 text-red-800',
    'bg-purple-100 text-purple-800',
    'bg-pink-100 text-pink-800',
    'bg-indigo-100 text-indigo-800',
    'bg-cyan-100 text-cyan-800'
  ];
  
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  return colors[Math.abs(hash) % colors.length];
};

// Export par défaut de toutes les fonctions
export default {
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
};