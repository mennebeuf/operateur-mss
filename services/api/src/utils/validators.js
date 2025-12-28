// services/api/src/utils/validators.js
const Joi = require('joi');

/**
 * Expressions régulières pour validation
 */
const PATTERNS = {
  // Email MSSanté: xxx@domaine.mssante.fr
  mssanteEmail: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.mssante\.fr$/i,
  
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
  
  // Numéro de téléphone français
  phoneNumber: /^(?:(?:\+|00)33|0)\s*[1-9](?:[\s.-]*\d{2}){4}$/,
  
  // Mot de passe fort (min 12 car, maj, min, chiffre, spécial)
  strongPassword: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{12,}$/,
  
  // UUID v4
  uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
};

/**
 * Schémas Joi personnalisés
 */
const customJoi = Joi.extend((joi) => ({
  type: 'mssante',
  base: joi.string(),
  messages: {
    'mssante.email': '{{#label}} doit être une adresse MSSanté valide',
    'mssante.domain': '{{#label}} doit être un domaine MSSanté valide',
    'mssante.rpps': '{{#label}} doit être un numéro RPPS valide (11 chiffres)',
    'mssante.adeli': '{{#label}} doit être un numéro ADELI valide (9 chiffres)',
    'mssante.finess': '{{#label}} doit être un numéro FINESS valide (9 chiffres)'
  },
  rules: {
    email: {
      validate(value, helpers) {
        if (!PATTERNS.mssanteEmail.test(value)) {
          return helpers.error('mssante.email');
        }
        return value.toLowerCase();
      }
    },
    domain: {
      validate(value, helpers) {
        if (!PATTERNS.mssanteDomain.test(value)) {
          return helpers.error('mssante.domain');
        }
        return value.toLowerCase();
      }
    },
    rpps: {
      validate(value, helpers) {
        if (!PATTERNS.rpps.test(value)) {
          return helpers.error('mssante.rpps');
        }
        return value;
      }
    },
    adeli: {
      validate(value, helpers) {
        if (!PATTERNS.adeli.test(value)) {
          return helpers.error('mssante.adeli');
        }
        return value;
      }
    },
    finess: {
      validate(value, helpers) {
        if (!PATTERNS.finess.test(value)) {
          return helpers.error('mssante.finess');
        }
        return value;
      }
    }
  }
}));

/**
 * Schémas de validation courants
 */
const schemas = {
  // Utilisateur
  user: {
    create: Joi.object({
      email: customJoi.mssante().email().required(),
      firstName: Joi.string().min(1).max(100).required(),
      lastName: Joi.string().min(1).max(100).required(),
      rpps: Joi.string().pattern(PATTERNS.rpps).allow(null),
      adeli: Joi.string().pattern(PATTERNS.adeli).allow(null),
      phone: Joi.string().pattern(PATTERNS.phoneNumber).allow(null, ''),
      role: Joi.string().valid('user', 'admin', 'domain_admin', 'super_admin').default('user')
    }),
    
    update: Joi.object({
      firstName: Joi.string().min(1).max(100),
      lastName: Joi.string().min(1).max(100),
      phone: Joi.string().pattern(PATTERNS.phoneNumber).allow(null, ''),
      role: Joi.string().valid('user', 'admin', 'domain_admin', 'super_admin')
    }).min(1)
  },

  // Boîte aux lettres
  mailbox: {
    create: Joi.object({
      email: customJoi.mssante().email().required(),
      type: Joi.string().valid('PERS', 'ORG', 'APP').required(),
      displayName: Joi.string().min(1).max(255).required(),
      quotaMb: Joi.number().integer().min(100).max(10240).default(1024),
      isPrivate: Joi.boolean().default(false),
      userId: Joi.string().pattern(PATTERNS.uuid).when('type', {
        is: 'PERS',
        then: Joi.required(),
        otherwise: Joi.optional()
      }),
      organizationId: Joi.string().pattern(PATTERNS.uuid).when('type', {
        is: Joi.valid('ORG', 'APP'),
        then: Joi.required(),
        otherwise: Joi.optional()
      })
    }),
    
    update: Joi.object({
      displayName: Joi.string().min(1).max(255),
      quotaMb: Joi.number().integer().min(100).max(10240),
      isPrivate: Joi.boolean(),
      status: Joi.string().valid('active', 'suspended', 'inactive')
    }).min(1)
  },

  // Domaine
  domain: {
    create: Joi.object({
      name: customJoi.mssante().domain().required(),
      organizationName: Joi.string().min(1).max(255).required(),
      finess: Joi.string().pattern(PATTERNS.finess).allow(null),
      siret: Joi.string().pattern(PATTERNS.siret).allow(null),
      quotaMb: Joi.number().integer().min(1024).max(102400).default(10240),
      maxMailboxes: Joi.number().integer().min(1).max(10000).default(100)
    }),
    
    update: Joi.object({
      organizationName: Joi.string().min(1).max(255),
      quotaMb: Joi.number().integer().min(1024).max(102400),
      maxMailboxes: Joi.number().integer().min(1).max(10000),
      status: Joi.string().valid('active', 'suspended', 'pending')
    }).min(1)
  },

  // Authentification
  auth: {
    login: Joi.object({
      email: Joi.string().email().required(),
      password: Joi.string().required()
    }),
    
    changePassword: Joi.object({
      currentPassword: Joi.string().required(),
      newPassword: Joi.string().pattern(PATTERNS.strongPassword).required()
        .messages({
          'string.pattern.base': 'Le mot de passe doit contenir au moins 12 caractères, une majuscule, une minuscule, un chiffre et un caractère spécial'
        }),
      confirmPassword: Joi.string().valid(Joi.ref('newPassword')).required()
        .messages({
          'any.only': 'Les mots de passe ne correspondent pas'
        })
    })
  },

  // Email
  email: {
    send: Joi.object({
      to: Joi.alternatives().try(
        Joi.string().email(),
        Joi.array().items(Joi.string().email()).min(1)
      ).required(),
      cc: Joi.alternatives().try(
        Joi.string().email(),
        Joi.array().items(Joi.string().email())
      ),
      bcc: Joi.alternatives().try(
        Joi.string().email(),
        Joi.array().items(Joi.string().email())
      ),
      subject: Joi.string().max(998).required(),
      html: Joi.string().max(10 * 1024 * 1024), // 10 MB max
      text: Joi.string().max(10 * 1024 * 1024),
      attachments: Joi.array().items(
        Joi.object({
          filename: Joi.string().max(255).required(),
          content: Joi.string().required(),
          contentType: Joi.string()
        })
      ).max(20), // 20 pièces jointes max
      priority: Joi.string().valid('high', 'normal', 'low').default('normal'),
      inReplyTo: Joi.string(),
      references: Joi.string()
    }).or('html', 'text')
  },

  // Pagination
  pagination: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    sortBy: Joi.string().max(50),
    sortOrder: Joi.string().valid('asc', 'desc').default('desc')
  }),

  // Recherche
  search: Joi.object({
    q: Joi.string().min(1).max(255),
    filters: Joi.object().pattern(Joi.string(), Joi.alternatives().try(
      Joi.string(),
      Joi.number(),
      Joi.boolean(),
      Joi.array()
    ))
  })
};

/**
 * Fonctions de validation
 */
const validators = {
  /**
   * Valider un email MSSanté
   */
  isValidMSSanteEmail(email) {
    return PATTERNS.mssanteEmail.test(email);
  },

  /**
   * Valider un domaine MSSanté
   */
  isValidMSSanteDomain(domain) {
    return PATTERNS.mssanteDomain.test(domain);
  },

  /**
   * Valider un numéro RPPS
   */
  isValidRPPS(rpps) {
    return PATTERNS.rpps.test(rpps);
  },

  /**
   * Valider un numéro ADELI
   */
  isValidADELI(adeli) {
    return PATTERNS.adeli.test(adeli);
  },

  /**
   * Valider un numéro FINESS
   */
  isValidFINESS(finess) {
    return PATTERNS.finess.test(finess);
  },

  /**
   * Valider un mot de passe fort
   */
  isStrongPassword(password) {
    return PATTERNS.strongPassword.test(password);
  },

  /**
   * Valider un UUID
   */
  isValidUUID(uuid) {
    return PATTERNS.uuid.test(uuid);
  },

  /**
   * Extraire le domaine d'un email
   */
  extractDomain(email) {
    if (!email || typeof email !== 'string') return null;
    const match = email.match(/@(.+)$/);
    return match ? match[1].toLowerCase() : null;
  },

  /**
   * Valider avec un schéma Joi
   */
  validate(data, schema, options = {}) {
    const defaultOptions = {
      abortEarly: false,
      stripUnknown: true,
      ...options
    };
    
    return schema.validate(data, defaultOptions);
  }
};

module.exports = {
  PATTERNS,
  schemas,
  validators,
  Joi: customJoi
};