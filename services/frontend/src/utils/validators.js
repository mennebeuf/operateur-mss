// services/frontend/src/utils/validators.js
// Utilitaires de validation pour le frontend MSSanté

// ============================================
// EXPRESSIONS RÉGULIÈRES
// ============================================

export const PATTERNS = {
  // Email MSSanté: xxx@domaine.mssante.fr
  mssanteEmail: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.mssante\.fr$/i,
  
  // Email standard
  email: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/i,
  
  // Domaine MSSanté: xxx.mssante.fr
  mssanteDomain: /^[a-zA-Z0-9][a-zA-Z0-9.-]*\.mssante\.fr$/i,
  
  // RPPS (11 chiffres)
  rpps: /^\d{11}$/,
  
  // ADELI (9 chiffres)
  adeli: /^\d{9}$/,
  
  // FINESS (9 chiffres)
  finess: /^\d{9}$/,
  
  // SIRET (14 chiffres)
  siret: /^\d{14}$/,
  
  // SIREN (9 chiffres)
  siren: /^\d{9}$/,
  
  // Numéro de téléphone français
  phoneNumber: /^(?:(?:\+|00)33|0)\s*[1-9](?:[\s.-]*\d{2}){4}$/,
  
  // Mot de passe fort (min 12 car, maj, min, chiffre, spécial)
  strongPassword: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^()_+=-])[A-Za-z\d@$!%*?&#^()_+=-]{12,}$/,
  
  // UUID v4
  uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  
  // Nom (lettres, espaces, tirets, apostrophes)
  name: /^[a-zA-ZÀ-ÿ\s\-']+$/,
  
  // Alphanumérique avec tirets et underscores
  alphanumericDash: /^[a-zA-Z0-9_-]+$/,
  
  // URL
  url: /^https?:\/\/[^\s/$.?#].[^\s]*$/i
};

// ============================================
// FONCTIONS DE VALIDATION DE BASE
// ============================================

/**
 * Vérifie si une valeur est vide
 * @param {any} value - Valeur à vérifier
 * @returns {boolean}
 */
export const isEmpty = (value) => {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
};

/**
 * Vérifie si une valeur est requise (non vide)
 * @param {any} value - Valeur à vérifier
 * @returns {boolean}
 */
export const isRequired = (value) => !isEmpty(value);

/**
 * Vérifie la longueur minimale d'une chaîne
 * @param {string} value - Valeur à vérifier
 * @param {number} min - Longueur minimale
 * @returns {boolean}
 */
export const minLength = (value, min) => {
  if (isEmpty(value)) return false;
  return String(value).length >= min;
};

/**
 * Vérifie la longueur maximale d'une chaîne
 * @param {string} value - Valeur à vérifier
 * @param {number} max - Longueur maximale
 * @returns {boolean}
 */
export const maxLength = (value, max) => {
  if (isEmpty(value)) return true;
  return String(value).length <= max;
};

/**
 * Vérifie si une valeur correspond à un pattern
 * @param {string} value - Valeur à vérifier
 * @param {RegExp} pattern - Expression régulière
 * @returns {boolean}
 */
export const matchesPattern = (value, pattern) => {
  if (isEmpty(value)) return false;
  return pattern.test(value);
};

// ============================================
// VALIDATEURS SPÉCIFIQUES
// ============================================

/**
 * Valide une adresse email standard
 * @param {string} email - Email à valider
 * @returns {boolean}
 */
export const isValidEmail = (email) => {
  if (isEmpty(email)) return false;
  return PATTERNS.email.test(email);
};

/**
 * Valide une adresse email MSSanté
 * @param {string} email - Email à valider
 * @returns {boolean}
 */
export const isValidMSSanteEmail = (email) => {
  if (isEmpty(email)) return false;
  return PATTERNS.mssanteEmail.test(email);
};

/**
 * Valide un domaine MSSanté
 * @param {string} domain - Domaine à valider
 * @returns {boolean}
 */
export const isValidMSSanteDomain = (domain) => {
  if (isEmpty(domain)) return false;
  return PATTERNS.mssanteDomain.test(domain);
};

/**
 * Valide un numéro RPPS
 * @param {string} rpps - Numéro RPPS à valider
 * @returns {boolean}
 */
export const isValidRPPS = (rpps) => {
  if (isEmpty(rpps)) return false;
  const clean = String(rpps).replace(/\s/g, '');
  return PATTERNS.rpps.test(clean);
};

/**
 * Valide un numéro ADELI
 * @param {string} adeli - Numéro ADELI à valider
 * @returns {boolean}
 */
export const isValidADELI = (adeli) => {
  if (isEmpty(adeli)) return false;
  const clean = String(adeli).replace(/\s/g, '');
  return PATTERNS.adeli.test(clean);
};

/**
 * Valide un numéro FINESS
 * @param {string} finess - Numéro FINESS à valider
 * @returns {boolean}
 */
export const isValidFINESS = (finess) => {
  if (isEmpty(finess)) return false;
  const clean = String(finess).replace(/\s/g, '');
  return PATTERNS.finess.test(clean);
};

/**
 * Valide un numéro SIRET
 * @param {string} siret - Numéro SIRET à valider
 * @returns {boolean}
 */
export const isValidSIRET = (siret) => {
  if (isEmpty(siret)) return false;
  const clean = String(siret).replace(/\s/g, '');
  if (!PATTERNS.siret.test(clean)) return false;
  
  // Algorithme de Luhn
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    let digit = parseInt(clean[i], 10);
    if (i % 2 === 0) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return sum % 10 === 0;
};

/**
 * Valide un numéro de téléphone français
 * @param {string} phone - Numéro à valider
 * @returns {boolean}
 */
export const isValidPhoneNumber = (phone) => {
  if (isEmpty(phone)) return false;
  return PATTERNS.phoneNumber.test(phone);
};

/**
 * Valide la force d'un mot de passe
 * @param {string} password - Mot de passe à valider
 * @returns {object} { isValid: boolean, errors: string[], strength: 'weak'|'medium'|'strong' }
 */
export const validatePassword = (password) => {
  const errors = [];
  let score = 0;
  
  if (isEmpty(password)) {
    return { isValid: false, errors: ['Le mot de passe est requis'], strength: 'weak' };
  }
  
  if (password.length < 12) {
    errors.push('Au moins 12 caractères requis');
  } else {
    score += 1;
    if (password.length >= 16) score += 1;
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('Au moins une minuscule requise');
  } else {
    score += 1;
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('Au moins une majuscule requise');
  } else {
    score += 1;
  }
  
  if (!/\d/.test(password)) {
    errors.push('Au moins un chiffre requis');
  } else {
    score += 1;
  }
  
  if (!/[@$!%*?&#^()_+=-]/.test(password)) {
    errors.push('Au moins un caractère spécial requis (@$!%*?&#^()_+=-)');
  } else {
    score += 1;
  }
  
  let strength = 'weak';
  if (score >= 5) strength = 'medium';
  if (score >= 6) strength = 'strong';
  
  return {
    isValid: errors.length === 0,
    errors,
    strength,
    score
  };
};

/**
 * Valide une URL
 * @param {string} url - URL à valider
 * @returns {boolean}
 */
export const isValidURL = (url) => {
  if (isEmpty(url)) return false;
  return PATTERNS.url.test(url);
};

/**
 * Valide un UUID v4
 * @param {string} uuid - UUID à valider
 * @returns {boolean}
 */
export const isValidUUID = (uuid) => {
  if (isEmpty(uuid)) return false;
  return PATTERNS.uuid.test(uuid);
};

/**
 * Valide un nom (prénom ou nom de famille)
 * @param {string} name - Nom à valider
 * @returns {boolean}
 */
export const isValidName = (name) => {
  if (isEmpty(name)) return false;
  if (name.length < 1 || name.length > 100) return false;
  return PATTERNS.name.test(name);
};

// ============================================
// VALIDATION DE FORMULAIRES
// ============================================

/**
 * Crée un validateur de formulaire
 * @param {object} rules - Règles de validation par champ
 * @returns {function} Fonction de validation
 */
export const createFormValidator = (rules) => {
  return (values) => {
    const errors = {};
    
    Object.keys(rules).forEach(field => {
      const fieldRules = rules[field];
      const value = values[field];
      
      for (const rule of fieldRules) {
        const error = rule(value, values);
        if (error) {
          errors[field] = error;
          break;
        }
      }
    });
    
    return {
      isValid: Object.keys(errors).length === 0,
      errors
    };
  };
};

/**
 * Règle: champ requis
 * @param {string} message - Message d'erreur personnalisé
 * @returns {function} Règle de validation
 */
export const required = (message = 'Ce champ est requis') => {
  return (value) => {
    if (isEmpty(value)) return message;
    return null;
  };
};

/**
 * Règle: longueur minimale
 * @param {number} min - Longueur minimale
 * @param {string} message - Message d'erreur personnalisé
 * @returns {function} Règle de validation
 */
export const min = (minVal, message) => {
  return (value) => {
    if (isEmpty(value)) return null;
    if (String(value).length < minVal) {
      return message || `Minimum ${minVal} caractères`;
    }
    return null;
  };
};

/**
 * Règle: longueur maximale
 * @param {number} max - Longueur maximale
 * @param {string} message - Message d'erreur personnalisé
 * @returns {function} Règle de validation
 */
export const max = (maxVal, message) => {
  return (value) => {
    if (isEmpty(value)) return null;
    if (String(value).length > maxVal) {
      return message || `Maximum ${maxVal} caractères`;
    }
    return null;
  };
};

/**
 * Règle: email valide
 * @param {string} message - Message d'erreur personnalisé
 * @returns {function} Règle de validation
 */
export const email = (message = 'Email invalide') => {
  return (value) => {
    if (isEmpty(value)) return null;
    if (!isValidEmail(value)) return message;
    return null;
  };
};

/**
 * Règle: email MSSanté valide
 * @param {string} message - Message d'erreur personnalisé
 * @returns {function} Règle de validation
 */
export const mssanteEmail = (message = 'Adresse MSSanté invalide (format: xxx@domaine.mssante.fr)') => {
  return (value) => {
    if (isEmpty(value)) return null;
    if (!isValidMSSanteEmail(value)) return message;
    return null;
  };
};

/**
 * Règle: RPPS valide
 * @param {string} message - Message d'erreur personnalisé
 * @returns {function} Règle de validation
 */
export const rpps = (message = 'Numéro RPPS invalide (11 chiffres)') => {
  return (value) => {
    if (isEmpty(value)) return null;
    if (!isValidRPPS(value)) return message;
    return null;
  };
};

/**
 * Règle: mot de passe fort
 * @returns {function} Règle de validation
 */
export const strongPassword = () => {
  return (value) => {
    if (isEmpty(value)) return null;
    const result = validatePassword(value);
    if (!result.isValid) {
      return result.errors[0];
    }
    return null;
  };
};

/**
 * Règle: confirmation de valeur
 * @param {string} fieldName - Nom du champ à comparer
 * @param {string} message - Message d'erreur personnalisé
 * @returns {function} Règle de validation
 */
export const matches = (fieldName, message) => {
  return (value, allValues) => {
    if (isEmpty(value)) return null;
    if (value !== allValues[fieldName]) {
      return message || `Doit correspondre au champ ${fieldName}`;
    }
    return null;
  };
};

/**
 * Règle: pattern personnalisé
 * @param {RegExp} pattern - Expression régulière
 * @param {string} message - Message d'erreur
 * @returns {function} Règle de validation
 */
export const pattern = (patternRegex, message = 'Format invalide') => {
  return (value) => {
    if (isEmpty(value)) return null;
    if (!patternRegex.test(value)) return message;
    return null;
  };
};

// ============================================
// VALIDATEURS DE FORMULAIRES PRÉDÉFINIS
// ============================================

/**
 * Validateur pour le formulaire de connexion
 */
export const loginValidator = createFormValidator({
  email: [
    required('L\'email est requis'),
    email()
  ],
  password: [
    required('Le mot de passe est requis')
  ]
});

/**
 * Validateur pour le formulaire de création d'utilisateur
 */
export const userCreateValidator = createFormValidator({
  email: [
    required('L\'email est requis'),
    mssanteEmail()
  ],
  firstName: [
    required('Le prénom est requis'),
    min(1),
    max(100)
  ],
  lastName: [
    required('Le nom est requis'),
    min(1),
    max(100)
  ],
  rpps: [
    rpps()
  ],
  password: [
    required('Le mot de passe est requis'),
    strongPassword()
  ],
  passwordConfirm: [
    required('La confirmation est requise'),
    matches('password', 'Les mots de passe ne correspondent pas')
  ]
});

/**
 * Validateur pour le formulaire de création de BAL
 */
export const mailboxCreateValidator = createFormValidator({
  email: [
    required('L\'adresse email est requise'),
    mssanteEmail()
  ],
  type: [
    required('Le type de BAL est requis')
  ],
  ownerRpps: [
    rpps()
  ]
});

/**
 * Validateur pour le formulaire de changement de mot de passe
 */
export const passwordChangeValidator = createFormValidator({
  currentPassword: [
    required('Le mot de passe actuel est requis')
  ],
  newPassword: [
    required('Le nouveau mot de passe est requis'),
    strongPassword()
  ],
  confirmPassword: [
    required('La confirmation est requise'),
    matches('newPassword', 'Les mots de passe ne correspondent pas')
  ]
});

// ============================================
// UTILITAIRES
// ============================================

/**
 * Nettoie un numéro de téléphone (supprime espaces et caractères)
 * @param {string} phone - Numéro à nettoyer
 * @returns {string} Numéro nettoyé
 */
export const cleanPhoneNumber = (phone) => {
  if (!phone) return '';
  return phone.replace(/[\s.-]/g, '');
};

/**
 * Nettoie un RPPS (supprime espaces)
 * @param {string} rppsValue - RPPS à nettoyer
 * @returns {string} RPPS nettoyé
 */
export const cleanRPPS = (rppsValue) => {
  if (!rppsValue) return '';
  return rppsValue.replace(/\s/g, '');
};

/**
 * Formate les erreurs de validation pour l'affichage
 * @param {object} errors - Objet d'erreurs
 * @returns {array} Liste d'erreurs formatées
 */
export const formatValidationErrors = (errors) => {
  if (!errors || typeof errors !== 'object') return [];
  return Object.entries(errors).map(([field, message]) => ({
    field,
    message
  }));
};

// Export par défaut
export default {
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
};