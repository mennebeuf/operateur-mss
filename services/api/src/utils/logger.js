// services/api/src/utils/logger.js
const winston = require('winston');
const path = require('path');

// Format personnalisé pour les logs
const customFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    let log = `${timestamp} [${level.toUpperCase()}] ${message}`;
    
    // Ajouter les métadonnées si présentes
    if (Object.keys(meta).length > 0) {
      log += ` ${JSON.stringify(meta)}`;
    }
    
    // Ajouter la stack trace en cas d'erreur
    if (stack) {
      log += `\n${stack}`;
    }
    
    return log;
  })
);

// Format JSON pour la production
const jsonFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Déterminer le niveau de log selon l'environnement
const getLogLevel = () => {
  switch (process.env.NODE_ENV) {
    case 'production':
      return 'info';
    case 'test':
      return 'error';
    default:
      return 'debug';
  }
};

// Configuration des transports
const transports = [
  // Console - toujours actif
  new winston.transports.Console({
    format: process.env.NODE_ENV === 'production' 
      ? jsonFormat 
      : winston.format.combine(
          winston.format.colorize(),
          customFormat
        )
  })
];

// Fichiers de log en production
if (process.env.NODE_ENV === 'production') {
  const logDir = process.env.LOG_DIR || '/var/log/mssante-api';
  
  transports.push(
    // Logs combinés
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
      format: jsonFormat,
      maxsize: 10 * 1024 * 1024, // 10 MB
      maxFiles: 10,
      tailable: true
    }),
    // Logs d'erreur uniquement
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      format: jsonFormat,
      maxsize: 10 * 1024 * 1024,
      maxFiles: 10,
      tailable: true
    }),
    // Logs de sécurité (audit)
    new winston.transports.File({
      filename: path.join(logDir, 'security.log'),
      level: 'info',
      format: jsonFormat,
      maxsize: 10 * 1024 * 1024,
      maxFiles: 30,
      tailable: true
    })
  );
}

// Créer le logger principal
const logger = winston.createLogger({
  level: getLogLevel(),
  format: customFormat,
  transports,
  exitOnError: false
});

// Logger spécialisé pour les audits de sécurité
const securityLogger = winston.createLogger({
  level: 'info',
  format: jsonFormat,
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        customFormat
      )
    })
  ]
});

// Ajouter fichier de sécurité en production
if (process.env.NODE_ENV === 'production') {
  const logDir = process.env.LOG_DIR || '/var/log/mssante-api';
  securityLogger.add(
    new winston.transports.File({
      filename: path.join(logDir, 'security.log'),
      format: jsonFormat,
      maxsize: 10 * 1024 * 1024,
      maxFiles: 30
    })
  );
}

/**
 * Log un événement de sécurité (audit)
 * @param {string} action - Type d'action (login, logout, access, modification)
 * @param {Object} details - Détails de l'événement
 */
logger.security = (action, details = {}) => {
  securityLogger.info({
    type: 'security_audit',
    action,
    timestamp: new Date().toISOString(),
    ...details
  });
};

/**
 * Log une requête HTTP
 * @param {Object} req - Requête Express
 * @param {Object} res - Réponse Express
 * @param {number} duration - Durée en ms
 */
logger.request = (req, res, duration) => {
  const logData = {
    method: req.method,
    url: req.originalUrl,
    status: res.statusCode,
    duration: `${duration}ms`,
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('user-agent'),
    userId: req.user?.id
  };

  if (res.statusCode >= 500) {
    logger.error('Request error', logData);
  } else if (res.statusCode >= 400) {
    logger.warn('Request warning', logData);
  } else {
    logger.info('Request', logData);
  }
};

/**
 * Log une opération sur une BAL
 * @param {string} operation - Type d'opération
 * @param {string} mailbox - Adresse de la BAL
 * @param {Object} details - Détails supplémentaires
 */
logger.mailbox = (operation, mailbox, details = {}) => {
  logger.info(`Mailbox ${operation}`, {
    type: 'mailbox_operation',
    operation,
    mailbox,
    ...details
  });
};

/**
 * Log une opération SMTP/IMAP
 * @param {string} protocol - SMTP ou IMAP
 * @param {string} operation - Type d'opération
 * @param {Object} details - Détails
 */
logger.mail = (protocol, operation, details = {}) => {
  logger.info(`${protocol} ${operation}`, {
    type: 'mail_operation',
    protocol,
    operation,
    ...details
  });
};

/**
 * Log un événement d'authentification
 * @param {string} event - Type d'événement (success, failure, logout)
 * @param {Object} details - Détails de l'auth
 */
logger.auth = (event, details = {}) => {
  const level = event === 'failure' ? 'warn' : 'info';
  logger[level](`Auth ${event}`, {
    type: 'auth_event',
    event,
    ...details
  });
  
  // Toujours logger dans security pour les événements d'auth
  logger.security(`auth_${event}`, details);
};

/**
 * Log une erreur de connexion à un service externe
 * @param {string} service - Nom du service (postgres, redis, psc, ans)
 * @param {Error} error - L'erreur
 */
logger.serviceError = (service, error) => {
  logger.error(`Service ${service} connection error`, {
    type: 'service_error',
    service,
    error: error.message,
    stack: error.stack
  });
};

module.exports = logger;