/**
 * MSSanté API - Middleware de validation
 * Validation des requêtes avec Joi
 */

const Joi = require('joi');
const { ApiError } = require('./errorHandler');

/**
 * Middleware de validation générique
 * @param {Object} schema - Schéma Joi avec body, query, params
 * @param {Object} options - Options de validation Joi
 */
const validate = (schema, options = {}) => {
  const defaultOptions = {
    abortEarly: false,      // Retourner toutes les erreurs
    stripUnknown: true,     // Supprimer les champs inconnus
    allowUnknown: false,    // Ne pas autoriser les champs inconnus
    ...options
  };
  
  return (req, res, next) => {
    const errors = [];
    
    // Valider chaque partie de la requête
    ['body', 'query', 'params'].forEach(key => {
      if (schema[key]) {
        const { error, value } = schema[key].validate(req[key], defaultOptions);
        
        if (error) {
          errors.push(...error.details.map(d => ({
            location: key,
            field: d.path.join('.'),
            message: d.message.replace(/"/g, "'"),
            type: d.type
          })));
        } else {
          req[key] = value; // Utiliser la valeur nettoyée/transformée
        }
      }
    });
    
    if (errors.length > 0) {
      return next(new ApiError(422, 'Erreur de validation', 'VALIDATION_ERROR', errors));
    }
    
    next();
  };
};

// ============================================
// SCHÉMAS DE VALIDATION RÉUTILISABLES
// ============================================

/**
 * Types de base
 */
const types = {
  uuid: Joi.string().uuid({ version: 'uuidv4' }),
  email: Joi.string().email().lowercase().trim().max(255),
  emailMSSante: Joi.string()
    .email()
    .lowercase()
    .trim()
    .pattern(/^[a-z0-9._-]+@[a-z0-9.-]+\.mssante\.fr$/)
    .message('Email MSSanté invalide (doit se terminer par .mssante.fr)'),
  password: Joi.string().min(12).max(128)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .message('Le mot de passe doit contenir au moins une majuscule, une minuscule, un chiffre et un caractère spécial'),
  rpps: Joi.string().pattern(/^\d{11}$/).message('RPPS invalide (11 chiffres)'),
  finess: Joi.string().pattern(/^\d{9}$/).message('FINESS invalide (9 chiffres)'),
  domainName: Joi.string()
    .lowercase()
    .trim()
    .pattern(/^[a-z0-9][a-z0-9-]*[a-z0-9]\.mssante\.fr$/)
    .message('Nom de domaine invalide'),
  phone: Joi.string().pattern(/^(\+33|0)[1-9]\d{8}$/).message('Numéro de téléphone invalide'),
  pagination: {
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    sortBy: Joi.string().max(50),
    sortOrder: Joi.string().valid('asc', 'desc').default('desc')
  }
};

/**
 * Schémas pour les utilisateurs
 */
const userSchemas = {
  create: {
    body: Joi.object({
      email: types.email.required(),
      first_name: Joi.string().trim().min(1).max(100).required(),
      last_name: Joi.string().trim().min(1).max(100).required(),
      rpps_id: types.rpps,
      role_id: types.uuid,
      domain_id: types.uuid,
      phone: types.phone
    })
  },
  
  update: {
    params: Joi.object({
      id: types.uuid.required()
    }),
    body: Joi.object({
      first_name: Joi.string().trim().min(1).max(100),
      last_name: Joi.string().trim().min(1).max(100),
      phone: types.phone,
      status: Joi.string().valid('active', 'inactive', 'suspended')
    }).min(1) // Au moins un champ requis
  },
  
  getById: {
    params: Joi.object({
      id: types.uuid.required()
    })
  },
  
  list: {
    query: Joi.object({
      ...types.pagination,
      search: Joi.string().max(100),
      status: Joi.string().valid('active', 'inactive', 'suspended'),
      domain_id: types.uuid,
      role: Joi.string().max(50)
    })
  }
};

/**
 * Schémas pour les BAL (mailboxes)
 */
const mailboxSchemas = {
  create: {
    body: Joi.object({
      email: types.emailMSSante.required(),
      type: Joi.string().valid('PER', 'ORG', 'APP').required(),
      owner_id: types.uuid,
      owner_rpps: types.rpps,
      display_name: Joi.string().trim().max(200),
      quota_mb: Joi.number().integer().min(100).max(102400).default(5120),
      delegations: Joi.array().items(Joi.object({
        user_id: types.uuid.required(),
        permissions: Joi.array().items(Joi.string().valid('read', 'write', 'send', 'admin'))
      }))
    })
  },
  
  update: {
    params: Joi.object({
      id: types.uuid.required()
    }),
    body: Joi.object({
      display_name: Joi.string().trim().max(200),
      quota_mb: Joi.number().integer().min(100).max(102400),
      status: Joi.string().valid('active', 'suspended', 'archived'),
      forwarding_email: types.email.allow(null, ''),
      auto_reply_enabled: Joi.boolean(),
      auto_reply_message: Joi.string().max(2000)
    }).min(1)
  },
  
  list: {
    query: Joi.object({
      ...types.pagination,
      search: Joi.string().max(100),
      type: Joi.string().valid('PER', 'ORG', 'APP'),
      status: Joi.string().valid('active', 'suspended', 'archived', 'pending'),
      domain_id: types.uuid
    })
  }
};

/**
 * Schémas pour les domaines
 */
const domainSchemas = {
  create: {
    body: Joi.object({
      domain_name: types.domainName.required(),
      organization_name: Joi.string().trim().min(2).max(200).required(),
      finess_juridique: types.finess.required(),
      finess_geographique: types.finess,
      admin_email: types.email.required(),
      admin_name: Joi.string().trim().max(200),
      quotas: Joi.object({
        max_mailboxes: Joi.number().integer().min(1).max(100000).default(1000),
        max_storage_gb: Joi.number().integer().min(1).max(10000).default(100)
      }).default()
    })
  },
  
  update: {
    params: Joi.object({
      id: types.uuid.required()
    }),
    body: Joi.object({
      organization_name: Joi.string().trim().min(2).max(200),
      admin_email: types.email,
      admin_name: Joi.string().trim().max(200),
      status: Joi.string().valid('active', 'suspended', 'pending'),
      quotas: Joi.object({
        max_mailboxes: Joi.number().integer().min(1).max(100000),
        max_storage_gb: Joi.number().integer().min(1).max(10000)
      })
    }).min(1)
  }
};

/**
 * Schémas pour les certificats
 */
const certificateSchemas = {
  upload: {
    body: Joi.object({
      type: Joi.string().valid('AUTH_CLI', 'AUTH_SRV', 'SIGN').required(),
      domain_id: types.uuid.required(),
      certificate_pem: Joi.string().required(),
      private_key_pem: Joi.string().required(),
      passphrase: Joi.string().max(256),
      description: Joi.string().max(500)
    })
  },
  
  list: {
    query: Joi.object({
      ...types.pagination,
      type: Joi.string().valid('AUTH_CLI', 'AUTH_SRV', 'SIGN'),
      status: Joi.string().valid('valid', 'expiring', 'expired', 'revoked'),
      domain_id: types.uuid
    })
  }
};

/**
 * Schémas pour l'authentification
 */
const authSchemas = {
  login: {
    body: Joi.object({
      email: types.email.required(),
      password: Joi.string().required()
    })
  },
  
  refresh: {
    body: Joi.object({
      refresh_token: Joi.string().required()
    })
  },
  
  pscCallback: {
    query: Joi.object({
      code: Joi.string().required(),
      state: Joi.string().required()
    })
  }
};

/**
 * Schémas pour les emails (webmail)
 */
const emailSchemas = {
  send: {
    body: Joi.object({
      from: types.emailMSSante.required(),
      to: Joi.array().items(types.email).min(1).required(),
      cc: Joi.array().items(types.email),
      bcc: Joi.array().items(types.email),
      subject: Joi.string().max(500).required(),
      text: Joi.string().max(100000),
      html: Joi.string().max(500000),
      attachments: Joi.array().items(Joi.object({
        filename: Joi.string().max(255).required(),
        content: Joi.string().required(), // Base64
        contentType: Joi.string().max(100)
      })).max(10)
    }).or('text', 'html')
  },
  
  listMessages: {
    query: Joi.object({
      folder: Joi.string().default('INBOX'),
      page: Joi.number().integer().min(1).default(1),
      limit: Joi.number().integer().min(1).max(50).default(20),
      search: Joi.string().max(200),
      unread: Joi.boolean()
    })
  }
};

module.exports = {
  validate,
  types,
  schemas: {
    user: userSchemas,
    mailbox: mailboxSchemas,
    domain: domainSchemas,
    certificate: certificateSchemas,
    auth: authSchemas,
    email: emailSchemas
  }
};