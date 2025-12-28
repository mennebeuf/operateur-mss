/**
 * MSSanté API - Middleware d'audit
 * Journalisation des actions pour traçabilité et conformité
 */

const { pool } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Actions d'audit prédéfinies
 */
const AuditActions = {
  // Authentification
  AUTH_LOGIN: 'auth.login',
  AUTH_LOGOUT: 'auth.logout',
  AUTH_LOGIN_FAILED: 'auth.login_failed',
  AUTH_TOKEN_REFRESH: 'auth.token_refresh',
  AUTH_PASSWORD_RESET: 'auth.password_reset',
  
  // Utilisateurs
  USER_CREATE: 'user.create',
  USER_UPDATE: 'user.update',
  USER_DELETE: 'user.delete',
  USER_STATUS_CHANGE: 'user.status_change',
  USER_ROLE_CHANGE: 'user.role_change',
  
  // Boîtes aux lettres
  MAILBOX_CREATE: 'mailbox.create',
  MAILBOX_UPDATE: 'mailbox.update',
  MAILBOX_DELETE: 'mailbox.delete',
  MAILBOX_STATUS_CHANGE: 'mailbox.status_change',
  MAILBOX_DELEGATION_ADD: 'mailbox.delegation_add',
  MAILBOX_DELEGATION_REMOVE: 'mailbox.delegation_remove',
  
  // Domaines
  DOMAIN_CREATE: 'domain.create',
  DOMAIN_UPDATE: 'domain.update',
  DOMAIN_DELETE: 'domain.delete',
  DOMAIN_STATUS_CHANGE: 'domain.status_change',
  
  // Certificats
  CERTIFICATE_UPLOAD: 'certificate.upload',
  CERTIFICATE_RENEW: 'certificate.renew',
  CERTIFICATE_REVOKE: 'certificate.revoke',
  CERTIFICATE_DELETE: 'certificate.delete',
  
  // Emails
  EMAIL_SEND: 'email.send',
  EMAIL_DELETE: 'email.delete',
  
  // Administration
  ADMIN_SETTINGS_UPDATE: 'admin.settings_update',
  ADMIN_EXPORT_DATA: 'admin.export_data',
  
  // Annuaire
  ANNUAIRE_PUBLISH: 'annuaire.publish',
  ANNUAIRE_UNPUBLISH: 'annuaire.unpublish',
  ANNUAIRE_SYNC: 'annuaire.sync'
};

/**
 * Enregistrer une entrée d'audit
 * @param {Object} data - Données d'audit
 */
const logAudit = async (data) => {
  const {
    action,
    userId,
    userEmail,
    ip,
    userAgent,
    resourceType,
    resourceId,
    domainId,
    details,
    status = 'success',
    errorMessage = null
  } = data;
  
  try {
    await pool.query(`
      INSERT INTO audit_logs (
        action,
        user_id,
        user_email,
        ip_address,
        user_agent,
        resource_type,
        resource_id,
        domain_id,
        details,
        status,
        error_message
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    `, [
      action,
      userId,
      userEmail,
      ip,
      userAgent,
      resourceType,
      resourceId,
      domainId,
      details ? JSON.stringify(details) : null,
      status,
      errorMessage
    ]);
    
    // Log aussi dans Winston pour monitoring temps réel
    logger.info('Audit:', {
      action,
      userId,
      resourceType,
      resourceId,
      status
    });
    
  } catch (error) {
    // Ne pas bloquer l'application si l'audit échoue
    logger.error('Erreur enregistrement audit:', error);
  }
};

/**
 * Middleware d'audit automatique
 * Enregistre les requêtes API importantes
 * @param {string} action - Action à enregistrer
 * @param {Object} options - Options de configuration
 */
const auditMiddleware = (action, options = {}) => {
  const {
    resourceType = null,
    getResourceId = null,  // Function: (req) => resourceId
    getDetails = null,     // Function: (req, res) => details
    logOnSuccess = true,
    logOnError = true
  } = options;
  
  return async (req, res, next) => {
    const startTime = Date.now();
    
    // Capturer la réponse originale
    const originalSend = res.send;
    
    res.send = function(body) {
      res.send = originalSend;
      
      // Enregistrer l'audit après la réponse
      setImmediate(async () => {
        try {
          const isSuccess = res.statusCode < 400;
          
          if ((isSuccess && logOnSuccess) || (!isSuccess && logOnError)) {
            const auditData = {
              action,
              userId: req.user?.id,
              userEmail: req.user?.email,
              ip: req.ip,
              userAgent: req.headers['user-agent'],
              resourceType: resourceType || req.baseUrl?.split('/').pop(),
              resourceId: getResourceId ? getResourceId(req) : req.params?.id,
              domainId: req.domain?.id,
              details: getDetails ? getDetails(req, res) : {
                method: req.method,
                path: req.originalUrl,
                duration: Date.now() - startTime,
                statusCode: res.statusCode
              },
              status: isSuccess ? 'success' : 'error',
              errorMessage: isSuccess ? null : parseErrorFromBody(body)
            };
            
            await logAudit(auditData);
          }
        } catch (error) {
          logger.error('Erreur middleware audit:', error);
        }
      });
      
      return originalSend.call(this, body);
    };
    
    next();
  };
};

/**
 * Extraire le message d'erreur du body de la réponse
 */
const parseErrorFromBody = (body) => {
  try {
    if (typeof body === 'string') {
      const parsed = JSON.parse(body);
      return parsed.error || parsed.message || 'Erreur inconnue';
    }
    return body?.error || body?.message || 'Erreur inconnue';
  } catch {
    return 'Erreur inconnue';
  }
};

/**
 * Créer un audit helper pour un contrôleur
 * Simplifie l'enregistrement d'audits dans le code
 */
const createAuditHelper = (req) => {
  return {
    log: async (action, resourceType, resourceId, details = {}) => {
      await logAudit({
        action,
        userId: req.user?.id,
        userEmail: req.user?.email,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        resourceType,
        resourceId,
        domainId: req.domain?.id,
        details,
        status: 'success'
      });
    },
    
    logError: async (action, resourceType, resourceId, error) => {
      await logAudit({
        action,
        userId: req.user?.id,
        userEmail: req.user?.email,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        resourceType,
        resourceId,
        domainId: req.domain?.id,
        details: { error: error.message },
        status: 'error',
        errorMessage: error.message
      });
    }
  };
};

/**
 * Récupérer les logs d'audit avec filtres
 */
const getAuditLogs = async (filters = {}) => {
  const {
    userId,
    domainId,
    action,
    resourceType,
    resourceId,
    status,
    startDate,
    endDate,
    page = 1,
    limit = 50
  } = filters;
  
  let query = `
    SELECT 
      al.*,
      u.first_name || ' ' || u.last_name as user_name
    FROM audit_logs al
    LEFT JOIN users u ON al.user_id = u.id
    WHERE 1=1
  `;
  const params = [];
  let paramIndex = 1;
  
  if (userId) {
    query += ` AND al.user_id = $${paramIndex++}`;
    params.push(userId);
  }
  
  if (domainId) {
    query += ` AND al.domain_id = $${paramIndex++}`;
    params.push(domainId);
  }
  
  if (action) {
    query += ` AND al.action = $${paramIndex++}`;
    params.push(action);
  }
  
  if (resourceType) {
    query += ` AND al.resource_type = $${paramIndex++}`;
    params.push(resourceType);
  }
  
  if (resourceId) {
    query += ` AND al.resource_id = $${paramIndex++}`;
    params.push(resourceId);
  }
  
  if (status) {
    query += ` AND al.status = $${paramIndex++}`;
    params.push(status);
  }
  
  if (startDate) {
    query += ` AND al.timestamp >= $${paramIndex++}`;
    params.push(startDate);
  }
  
  if (endDate) {
    query += ` AND al.timestamp <= $${paramIndex++}`;
    params.push(endDate);
  }
  
  // Count total
  const countResult = await pool.query(
    query.replace('SELECT al.*, u.first_name || \' \' || u.last_name as user_name', 'SELECT COUNT(*)'),
    params
  );
  const total = parseInt(countResult.rows[0].count, 10);
  
  // Pagination
  query += ` ORDER BY al.timestamp DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
  params.push(limit, (page - 1) * limit);
  
  const result = await pool.query(query, params);
  
  return {
    data: result.rows,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
};

module.exports = {
  AuditActions,
  logAudit,
  auditMiddleware,
  createAuditHelper,
  getAuditLogs
};