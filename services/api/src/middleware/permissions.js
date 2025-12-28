/**
 * MSSanté API - Middleware de permissions
 * Gestion RBAC (Role-Based Access Control)
 */

const { pool } = require('../config/database');
const { redisClient } = require('../config/redis');
const { ApiError } = require('./errorHandler');
const logger = require('../utils/logger');

/**
 * Vérifier si un utilisateur a une permission spécifique
 * @param {string} userId - ID de l'utilisateur
 * @param {string} permission - Permission à vérifier (ex: 'mailbox.create')
 * @returns {Promise<boolean>}
 */
const checkPermission = async (userId, permission) => {
  const cacheKey = `perms:${userId}`;
  
  try {
    // Vérifier le cache
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      const permissions = JSON.parse(cached);
      return permissions.includes(permission) || permissions.includes('*');
    }
  } catch (error) {
    logger.warn('Erreur lecture cache permissions:', error);
  }
  
  // Requête DB
  const result = await pool.query(`
    SELECT DISTINCT p.name
    FROM permissions p
    INNER JOIN role_permissions rp ON p.id = rp.permission_id
    INNER JOIN roles r ON rp.role_id = r.id
    INNER JOIN users u ON u.role_id = r.id
    WHERE u.id = $1
  `, [userId]);
  
  const permissions = result.rows.map(r => r.name);
  
  // Mettre en cache (10 minutes)
  try {
    await redisClient.setEx(cacheKey, 600, JSON.stringify(permissions));
  } catch (error) {
    logger.warn('Erreur mise en cache permissions:', error);
  }
  
  return permissions.includes(permission) || permissions.includes('*');
};

/**
 * Vérifier si un utilisateur est super admin
 */
const isSuperAdmin = async (userId) => {
  const cacheKey = `superadmin:${userId}`;
  
  try {
    const cached = await redisClient.get(cacheKey);
    if (cached !== null) return cached === 'true';
  } catch (error) {
    logger.warn('Erreur lecture cache superadmin:', error);
  }
  
  const result = await pool.query(
    'SELECT is_super_admin FROM users WHERE id = $1',
    [userId]
  );
  
  const isSA = result.rows[0]?.is_super_admin || false;
  
  try {
    await redisClient.setEx(cacheKey, 600, String(isSA));
  } catch (error) {
    logger.warn('Erreur mise en cache superadmin:', error);
  }
  
  return isSA;
};

/**
 * Vérifier si un utilisateur est admin d'un domaine spécifique
 */
const isDomainAdmin = async (userId, domainId) => {
  const result = await pool.query(`
    SELECT 1 FROM users u
    INNER JOIN roles r ON u.role_id = r.id
    WHERE u.id = $1 
    AND u.domain_id = $2 
    AND r.name = 'domain_admin'
    AND u.status = 'active'
  `, [userId, domainId]);
  
  return result.rows.length > 0;
};

/**
 * Middleware: Exiger une permission spécifique
 * @param {string|string[]} permissions - Permission(s) requise(s)
 * @param {Object} options - Options supplémentaires
 */
const requirePermission = (permissions, options = {}) => {
  const permArray = Array.isArray(permissions) ? permissions : [permissions];
  const { requireAll = false } = options; // true = AND, false = OR
  
  return async (req, res, next) => {
    try {
      if (!req.user) {
        throw new ApiError(401, 'Authentification requise', 'AUTH_REQUIRED');
      }
      
      // Super admin a tous les droits
      if (req.user.is_super_admin) {
        return next();
      }
      
      // Vérifier les permissions
      const checks = await Promise.all(
        permArray.map(perm => checkPermission(req.user.id, perm))
      );
      
      const hasPermission = requireAll 
        ? checks.every(Boolean)  // Toutes requises
        : checks.some(Boolean);  // Au moins une
      
      if (!hasPermission) {
        logger.warn(`Permission refusée: ${req.user.email} n'a pas ${permArray.join(', ')}`);
        throw new ApiError(403, 'Permission insuffisante', 'PERMISSION_DENIED', {
          required: permArray,
          mode: requireAll ? 'all' : 'any'
        });
      }
      
      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Middleware: Exiger le statut super admin
 */
const requireSuperAdmin = async (req, res, next) => {
  try {
    if (!req.user) {
      throw new ApiError(401, 'Authentification requise', 'AUTH_REQUIRED');
    }
    
    const isAdmin = await isSuperAdmin(req.user.id);
    
    if (!isAdmin) {
      logger.warn(`Accès super admin refusé: ${req.user.email}`);
      throw new ApiError(403, 'Accès réservé aux super administrateurs', 'SUPER_ADMIN_REQUIRED');
    }
    
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware: Exiger le statut admin du domaine
 */
const requireDomainAdmin = async (req, res, next) => {
  try {
    if (!req.user) {
      throw new ApiError(401, 'Authentification requise', 'AUTH_REQUIRED');
    }
    
    // Super admin a tous les droits
    if (await isSuperAdmin(req.user.id)) {
      return next();
    }
    
    // Déterminer le domaine cible
    const domainId = req.domain?.id || req.params.domainId || req.body?.domain_id || req.user.domain_id;
    
    if (!domainId) {
      throw new ApiError(400, 'Domaine non spécifié', 'DOMAIN_REQUIRED');
    }
    
    const isAdmin = await isDomainAdmin(req.user.id, domainId);
    
    if (!isAdmin) {
      logger.warn(`Accès admin domaine refusé: ${req.user.email} pour domaine ${domainId}`);
      throw new ApiError(403, 'Accès réservé aux administrateurs du domaine', 'DOMAIN_ADMIN_REQUIRED');
    }
    
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware: Vérifier l'accès à une ressource (propriétaire ou admin)
 * @param {Function} getResourceOwnerId - Fonction pour récupérer l'ID du propriétaire
 */
const requireOwnerOrAdmin = (getResourceOwnerId) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        throw new ApiError(401, 'Authentification requise', 'AUTH_REQUIRED');
      }
      
      // Super admin a tous les droits
      if (await isSuperAdmin(req.user.id)) {
        return next();
      }
      
      // Récupérer l'ID du propriétaire de la ressource
      const ownerId = await getResourceOwnerId(req);
      
      // Vérifier si l'utilisateur est le propriétaire
      if (ownerId === req.user.id) {
        return next();
      }
      
      // Vérifier si l'utilisateur est admin du domaine
      const domainId = req.domain?.id || req.params.domainId;
      if (domainId && await isDomainAdmin(req.user.id, domainId)) {
        return next();
      }
      
      throw new ApiError(403, 'Accès non autorisé à cette ressource', 'ACCESS_DENIED');
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Invalider le cache des permissions d'un utilisateur
 */
const invalidatePermissionsCache = async (userId) => {
  try {
    await Promise.all([
      redisClient.del(`perms:${userId}`),
      redisClient.del(`superadmin:${userId}`)
    ]);
  } catch (error) {
    logger.warn('Erreur invalidation cache permissions:', error);
  }
};

module.exports = {
  checkPermission,
  isSuperAdmin,
  isDomainAdmin,
  requirePermission,
  requireSuperAdmin,
  requireDomainAdmin,
  requireOwnerOrAdmin,
  invalidatePermissionsCache
};