/**
 * MSSanté API - Middleware d'authentification
 * Gestion de l'authentification JWT et OAuth2/PSC
 */

const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');
const { redisClient } = require('../config/redis');
const logger = require('../utils/logger');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_ISSUER = process.env.JWT_ISSUER || 'mssante-api';
const JWT_AUDIENCE = process.env.JWT_AUDIENCE || 'mssante-client';

/**
 * Middleware d'authentification principal
 * Vérifie le token JWT dans le header Authorization
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({
        error: 'Token d\'authentification requis',
        code: 'AUTH_TOKEN_MISSING'
      });
    }
    
    // Extraction du token (format: "Bearer <token>")
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return res.status(401).json({
        error: 'Format de token invalide',
        code: 'AUTH_TOKEN_INVALID_FORMAT'
      });
    }
    
    const token = parts[1];
    
    // Vérifier si le token est blacklisté (déconnexion)
    const isBlacklisted = await redisClient.get(`blacklist:${token}`);
    if (isBlacklisted) {
      return res.status(401).json({
        error: 'Token révoqué',
        code: 'AUTH_TOKEN_REVOKED'
      });
    }
    
    // Vérification et décodage du token
    const decoded = jwt.verify(token, JWT_SECRET, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE
    });
    
    // Récupérer les informations utilisateur depuis le cache ou la DB
    let user = await getUserFromCacheOrDB(decoded.sub);
    
    if (!user) {
      return res.status(401).json({
        error: 'Utilisateur non trouvé',
        code: 'AUTH_USER_NOT_FOUND'
      });
    }
    
    // Vérifier que l'utilisateur est actif
    if (user.status !== 'active') {
      return res.status(403).json({
        error: 'Compte utilisateur désactivé',
        code: 'AUTH_USER_DISABLED'
      });
    }
    
    // Attacher l'utilisateur et le token à la requête
    req.user = user;
    req.token = token;
    req.tokenPayload = decoded;
    
    // Mettre à jour la dernière activité (async, non bloquant)
    updateLastActivity(user.id).catch(err => 
      logger.warn('Erreur mise à jour dernière activité:', err)
    );
    
    next();
    
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Token expiré',
        code: 'AUTH_TOKEN_EXPIRED'
      });
    }
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        error: 'Token invalide',
        code: 'AUTH_TOKEN_INVALID'
      });
    }
    
    logger.error('Erreur authentification:', error);
    return res.status(500).json({
      error: 'Erreur d\'authentification',
      code: 'AUTH_ERROR'
    });
  }
};

/**
 * Middleware d'authentification optionnel
 * Ne bloque pas si pas de token, mais extrait l'utilisateur si présent
 */
const authenticateOptional = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return next();
  }
  
  // Utiliser le middleware standard mais ne pas bloquer en cas d'erreur
  try {
    await new Promise((resolve, reject) => {
      authenticate(req, res, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  } catch (error) {
    // Log mais ne bloque pas
    logger.debug('Auth optionnelle échouée:', error.message);
  }
  
  next();
};

/**
 * Middleware d'autorisation par rôle
 * @param {...string} allowedRoles - Rôles autorisés
 */
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentification requise',
        code: 'AUTH_REQUIRED'
      });
    }
    
    // Super admin a tous les droits
    if (req.user.is_super_admin) {
      return next();
    }
    
    // Vérifier si l'utilisateur a un rôle autorisé
    const userRole = req.user.role?.name || req.user.role;
    
    if (!allowedRoles.includes(userRole)) {
      logger.warn(`Accès refusé pour ${req.user.email} (role: ${userRole})`);
      return res.status(403).json({
        error: 'Accès non autorisé',
        code: 'AUTH_FORBIDDEN',
        required: allowedRoles,
        current: userRole
      });
    }
    
    next();
  };
};

/**
 * Récupérer l'utilisateur depuis le cache Redis ou la DB
 */
const getUserFromCacheOrDB = async (userId) => {
  const cacheKey = `user:${userId}`;
  
  // Essayer le cache d'abord
  try {
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (error) {
    logger.warn('Erreur lecture cache utilisateur:', error);
  }
  
  // Sinon, requête DB
  const result = await pool.query(`
    SELECT 
      u.id,
      u.email,
      u.first_name,
      u.last_name,
      u.rpps_id,
      u.status,
      u.is_super_admin,
      u.domain_id,
      d.domain_name,
      r.name as role,
      r.level as role_level
    FROM users u
    LEFT JOIN domains d ON u.domain_id = d.id
    LEFT JOIN roles r ON u.role_id = r.id
    WHERE u.id = $1
  `, [userId]);
  
  if (result.rows.length === 0) {
    return null;
  }
  
  const user = result.rows[0];
  
  // Récupérer les permissions
  const permsResult = await pool.query(`
    SELECT DISTINCT p.name
    FROM permissions p
    INNER JOIN role_permissions rp ON p.id = rp.permission_id
    INNER JOIN roles r ON rp.role_id = r.id
    INNER JOIN users u ON u.role_id = r.id
    WHERE u.id = $1
  `, [userId]);
  
  user.permissions = permsResult.rows.map(r => r.name);
  
  // Mettre en cache pour 5 minutes
  try {
    await redisClient.setEx(cacheKey, 300, JSON.stringify(user));
  } catch (error) {
    logger.warn('Erreur mise en cache utilisateur:', error);
  }
  
  return user;
};

/**
 * Mettre à jour la dernière activité de l'utilisateur
 */
const updateLastActivity = async (userId) => {
  await pool.query(
    'UPDATE users SET last_activity = CURRENT_TIMESTAMP WHERE id = $1',
    [userId]
  );
};

/**
 * Invalider le cache utilisateur (après modification)
 */
const invalidateUserCache = async (userId) => {
  try {
    await redisClient.del(`user:${userId}`);
  } catch (error) {
    logger.warn('Erreur invalidation cache utilisateur:', error);
  }
};

/**
 * Blacklister un token (déconnexion)
 */
const blacklistToken = async (token, expiresIn = 86400) => {
  try {
    await redisClient.setEx(`blacklist:${token}`, expiresIn, '1');
  } catch (error) {
    logger.error('Erreur blacklist token:', error);
    throw error;
  }
};

module.exports = {
  authenticate,
  authenticateOptional,
  authorize,
  getUserFromCacheOrDB,
  invalidateUserCache,
  blacklistToken
};