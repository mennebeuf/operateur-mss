/**
 * MSSanté API - Middleware de logging des requêtes
 * Journalisation des requêtes HTTP avec métriques
 */

const logger = require('../utils/logger');

/**
 * Middleware de logging des requêtes HTTP
 */
const requestLogger = (req, res, next) => {
  const startTime = Date.now();
  
  // Données de la requête
  const requestData = {
    requestId: req.requestId,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip || req.connection?.remoteAddress,
    userAgent: req.headers['user-agent'],
    referer: req.headers['referer'],
    contentLength: req.headers['content-length']
  };
  
  // Log au début de la requête (niveau debug)
  logger.debug('Requête entrante', requestData);
  
  // Intercepter la fin de la réponse
  const originalEnd = res.end;
  res.end = function(chunk, encoding) {
    res.end = originalEnd;
    res.end(chunk, encoding);
    
    const duration = Date.now() - startTime;
    const responseData = {
      ...requestData,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      contentLength: res.getHeader('content-length')
    };
    
    // Niveau de log selon le status
    if (res.statusCode >= 500) {
      logger.error('Réponse serveur error', responseData);
    } else if (res.statusCode >= 400) {
      logger.warn('Réponse client error', responseData);
    } else if (duration > 5000) {
      // Alerter sur les requêtes lentes
      logger.warn('Requête lente', responseData);
    } else {
      logger.info('Réponse envoyée', responseData);
    }
  };
  
  next();
};

/**
 * Middleware de logging pour les requêtes API sensibles
 * À utiliser sur les routes critiques (auth, admin, etc.)
 */
const sensitiveRequestLogger = (req, res, next) => {
  const startTime = Date.now();
  
  // Masquer les données sensibles
  const sanitizedBody = req.body ? sanitizeBody(req.body) : undefined;
  
  const requestData = {
    requestId: req.requestId,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userId: req.user?.id,
    userEmail: req.user?.email,
    body: sanitizedBody
  };
  
  logger.info('Requête sensible', requestData);
  
  // Intercepter la réponse
  const originalSend = res.send;
  res.send = function(body) {
    const duration = Date.now() - startTime;
    
    logger.info('Réponse sensible', {
      requestId: req.requestId,
      statusCode: res.statusCode,
      duration: `${duration}ms`
    });
    
    return originalSend.call(this, body);
  };
  
  next();
};

/**
 * Masquer les champs sensibles dans le body
 */
const sanitizeBody = (body) => {
  const sensitiveFields = [
    'password', 'mot_de_passe', 'secret', 
    'token', 'access_token', 'refresh_token',
    'private_key', 'private_key_pem', 'passphrase',
    'credit_card', 'cvv', 'pin'
  ];
  
  const sanitized = { ...body };
  
  for (const field of sensitiveFields) {
    if (sanitized[field]) {
      sanitized[field] = '[MASQUÉ]';
    }
  }
  
  // Récursif pour les objets imbriqués
  for (const key in sanitized) {
    if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
      sanitized[key] = sanitizeBody(sanitized[key]);
    }
  }
  
  return sanitized;
};

/**
 * Middleware de métriques de performance
 * Collecte des statistiques pour monitoring
 */
const performanceMetrics = (req, res, next) => {
  const startTime = process.hrtime.bigint();
  const startMemory = process.memoryUsage().heapUsed;
  
  res.on('finish', () => {
    const endTime = process.hrtime.bigint();
    const endMemory = process.memoryUsage().heapUsed;
    
    const durationNs = Number(endTime - startTime);
    const durationMs = durationNs / 1e6;
    const memoryDelta = endMemory - startMemory;
    
    // Enregistrer les métriques (pour Prometheus/Grafana)
    const metrics = {
      route: req.route?.path || req.path,
      method: req.method,
      statusCode: res.statusCode,
      durationMs: durationMs.toFixed(2),
      memoryDeltaKb: (memoryDelta / 1024).toFixed(2)
    };
    
    // Log uniquement si activé ou si requête lente
    if (process.env.ENABLE_METRICS_LOG === 'true' || durationMs > 1000) {
      logger.debug('Métriques requête', metrics);
    }
    
    // Ajouter les headers de performance (optionnel)
    if (process.env.NODE_ENV === 'development') {
      res.setHeader('X-Response-Time', `${durationMs.toFixed(2)}ms`);
    }
  });
  
  next();
};

module.exports = {
  requestLogger,
  sensitiveRequestLogger,
  performanceMetrics,
  sanitizeBody
};