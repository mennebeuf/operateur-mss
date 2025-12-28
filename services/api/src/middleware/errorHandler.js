/**
 * MSSanté API - Middleware de gestion des erreurs
 * Gestion centralisée des erreurs avec logging et formatage
 */

const logger = require('../utils/logger');

/**
 * Classe d'erreur personnalisée pour l'API
 */
class ApiError extends Error {
  constructor(statusCode, message, code = null, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code || this.getDefaultCode(statusCode);
    this.details = details;
    this.isOperational = true;
    
    Error.captureStackTrace(this, this.constructor);
  }
  
  getDefaultCode(statusCode) {
    const codes = {
      400: 'BAD_REQUEST',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      422: 'VALIDATION_ERROR',
      429: 'RATE_LIMIT_EXCEEDED',
      500: 'INTERNAL_ERROR',
      502: 'BAD_GATEWAY',
      503: 'SERVICE_UNAVAILABLE'
    };
    return codes[statusCode] || 'ERROR';
  }
}

/**
 * Erreurs prédéfinies courantes
 */
const Errors = {
  badRequest: (message, details) => new ApiError(400, message, 'BAD_REQUEST', details),
  unauthorized: (message) => new ApiError(401, message || 'Non authentifié', 'UNAUTHORIZED'),
  forbidden: (message) => new ApiError(403, message || 'Accès refusé', 'FORBIDDEN'),
  notFound: (resource) => new ApiError(404, `${resource || 'Ressource'} non trouvé(e)`, 'NOT_FOUND'),
  conflict: (message) => new ApiError(409, message, 'CONFLICT'),
  validation: (details) => new ApiError(422, 'Erreur de validation', 'VALIDATION_ERROR', details),
  tooManyRequests: () => new ApiError(429, 'Trop de requêtes', 'RATE_LIMIT_EXCEEDED'),
  internal: (message) => new ApiError(500, message || 'Erreur serveur', 'INTERNAL_ERROR'),
  serviceUnavailable: (service) => new ApiError(503, `Service ${service || ''} indisponible`, 'SERVICE_UNAVAILABLE')
};

/**
 * Middleware de gestion des erreurs
 */
const errorHandler = (err, req, res, next) => {
  // Si les headers ont déjà été envoyés, déléguer à Express
  if (res.headersSent) {
    return next(err);
  }
  
  // Déterminer le statut et le message
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Erreur serveur';
  let code = err.code || 'INTERNAL_ERROR';
  let details = err.details || null;
  
  // Gestion des erreurs Joi (validation)
  if (err.isJoi || err.name === 'ValidationError') {
    statusCode = 422;
    code = 'VALIDATION_ERROR';
    message = 'Erreur de validation';
    details = err.details?.map(d => ({
      field: d.path?.join('.') || d.context?.key,
      message: d.message
    })) || err.message;
  }
  
  // Gestion des erreurs PostgreSQL
  if (err.code && err.code.startsWith('23')) {
    statusCode = 409;
    
    switch (err.code) {
      case '23505': // unique_violation
        code = 'DUPLICATE_ENTRY';
        message = 'Cette entrée existe déjà';
        if (err.constraint) {
          const field = err.constraint.replace(/_key$|_unique$/, '').split('_').pop();
          details = { field, constraint: err.constraint };
        }
        break;
      case '23503': // foreign_key_violation
        code = 'REFERENCE_ERROR';
        message = 'Référence invalide';
        break;
      case '23502': // not_null_violation
        code = 'REQUIRED_FIELD';
        message = 'Champ requis manquant';
        details = { field: err.column };
        break;
      default:
        code = 'DATABASE_ERROR';
        message = 'Erreur de base de données';
    }
  }
  
  // Gestion des erreurs JWT
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    code = 'INVALID_TOKEN';
    message = 'Token invalide';
  }
  
  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    code = 'TOKEN_EXPIRED';
    message = 'Token expiré';
  }
  
  // Gestion des erreurs de syntaxe JSON
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    statusCode = 400;
    code = 'INVALID_JSON';
    message = 'JSON invalide dans le corps de la requête';
  }
  
  // Logging
  const logData = {
    requestId: req.requestId,
    method: req.method,
    url: req.originalUrl,
    statusCode,
    code,
    message,
    userId: req.user?.id,
    ip: req.ip,
    userAgent: req.headers['user-agent']
  };
  
  if (statusCode >= 500) {
    // Erreur serveur - log complet avec stack
    logger.error('Erreur serveur:', {
      ...logData,
      stack: err.stack,
      details
    });
  } else if (statusCode >= 400) {
    // Erreur client - log warning
    logger.warn('Erreur client:', logData);
  }
  
  // Construire la réponse
  const response = {
    error: message,
    code,
    requestId: req.requestId
  };
  
  // Ajouter les détails si présents (sauf en production pour les erreurs 500)
  if (details && (statusCode < 500 || process.env.NODE_ENV !== 'production')) {
    response.details = details;
  }
  
  // Ajouter la stack trace en développement
  if (process.env.NODE_ENV === 'development' && err.stack) {
    response.stack = err.stack.split('\n');
  }
  
  res.status(statusCode).json(response);
};

/**
 * Wrapper async pour les routes (évite les try/catch répétitifs)
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * Middleware 404 pour les routes non trouvées
 */
const notFoundHandler = (req, res, next) => {
  next(new ApiError(404, 'Route non trouvée', 'ROUTE_NOT_FOUND'));
};

module.exports = errorHandler;
module.exports.ApiError = ApiError;
module.exports.Errors = Errors;
module.exports.asyncHandler = asyncHandler;
module.exports.notFoundHandler = notFoundHandler;