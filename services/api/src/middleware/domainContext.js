/**
 * MSSanté API - Middleware de contexte domaine
 * Gestion du multi-tenant par domaine MSSanté
 */

const { pool } = require('../config/database');
const { redisClient } = require('../config/redis');
const { ApiError } = require('./errorHandler');
const logger = require('../utils/logger');

/**
 * Middleware pour extraire et valider le contexte domaine
 * Le domaine peut être spécifié via:
 * 1. Header X-Domain
 * 2. Subdomain de l'URL
 * 3. Token JWT de l'utilisateur authentifié
 */
const domainContext = async (req, res, next) => {
  try {
    let domainName = null;
    let domainSource = null;
    
    // 1. Priorité au header X-Domain (pour API)
    if (req.headers['x-domain']) {
      domainName = req.headers['x-domain'].toLowerCase().trim();
      domainSource = 'header';
    }
    
    // 2. Extraction depuis le subdomain (pour web)
    if (!domainName && req.hostname) {
      const parts = req.hostname.split('.');
      // Format: <org>.mssante.fr ou <org>.api.mssante.fr
      if (parts.length >= 3 && parts[parts.length - 2] === 'mssante') {
        domainName = parts.slice(-3).join('.');
        domainSource = 'subdomain';
      }
    }
    
    // 3. Extraction depuis le token utilisateur
    if (!domainName && req.user?.domain_name) {
      domainName = req.user.domain_name;
      domainSource = 'user';
    }
    
    // Si toujours pas de domaine et qu'un est requis
    if (!domainName) {
      // Pour certaines routes, le domaine n'est pas obligatoire
      if (req.domainOptional) {
        return next();
      }
      
      throw new ApiError(400, 'Domaine non spécifié', 'DOMAIN_REQUIRED', {
        hint: 'Spécifiez le domaine via le header X-Domain'
      });
    }
    
    // Récupérer le domaine depuis le cache ou la DB
    const domain = await getDomainByName(domainName);
    
    if (!domain) {
      throw new ApiError(404, 'Domaine non trouvé', 'DOMAIN_NOT_FOUND', {
        domain: domainName
      });
    }
    
    // Vérifier que le domaine est actif
    if (domain.status !== 'active') {
      throw new ApiError(403, `Domaine ${domain.status}`, 'DOMAIN_INACTIVE', {
        domain: domainName,
        status: domain.status
      });
    }
    
    // Si l'utilisateur est authentifié, vérifier qu'il a accès au domaine
    if (req.user && !req.user.is_super_admin) {
      const hasAccess = await checkUserDomainAccess(req.user.id, domain.id);
      if (!hasAccess) {
        throw new ApiError(403, 'Accès au domaine non autorisé', 'DOMAIN_ACCESS_DENIED');
      }
    }
    
    // Attacher le domaine au contexte de la requête
    req.domain = domain;
    req.domainSource = domainSource;
    
    // Ajouter le domaine aux headers de réponse (pour debug)
    res.setHeader('X-Domain-Id', domain.id);
    res.setHeader('X-Domain-Name', domain.domain_name);
    
    next();
    
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware optionnel - n'échoue pas si pas de domaine
 */
const domainContextOptional = (req, res, next) => {
  req.domainOptional = true;
  return domainContext(req, res, next);
};

/**
 * Récupérer un domaine par son nom (avec cache)
 */
const getDomainByName = async (domainName) => {
  const cacheKey = `domain:name:${domainName}`;
  
  // Essayer le cache
  try {
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (error) {
    logger.warn('Erreur lecture cache domaine:', error);
  }
  
  // Requête DB
  const result = await pool.query(`
    SELECT 
      d.*,
      COUNT(DISTINCT m.id) as mailbox_count,
      COALESCE(SUM(m.storage_used_mb), 0) as total_storage_mb
    FROM domains d
    LEFT JOIN mailboxes m ON d.id = m.domain_id AND m.status = 'active'
    WHERE d.domain_name = $1
    GROUP BY d.id
  `, [domainName]);
  
  if (result.rows.length === 0) {
    return null;
  }
  
  const domain = result.rows[0];
  
  // Parser les quotas JSONB si présents
  if (typeof domain.quotas === 'string') {
    domain.quotas = JSON.parse(domain.quotas);
  }
  
  // Mettre en cache (5 minutes)
  try {
    await redisClient.setEx(cacheKey, 300, JSON.stringify(domain));
  } catch (error) {
    logger.warn('Erreur mise en cache domaine:', error);
  }
  
  return domain;
};

/**
 * Récupérer un domaine par son ID (avec cache)
 */
const getDomainById = async (domainId) => {
  const cacheKey = `domain:id:${domainId}`;
  
  try {
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (error) {
    logger.warn('Erreur lecture cache domaine:', error);
  }
  
  const result = await pool.query(`
    SELECT 
      d.*,
      COUNT(DISTINCT m.id) as mailbox_count,
      COALESCE(SUM(m.storage_used_mb), 0) as total_storage_mb
    FROM domains d
    LEFT JOIN mailboxes m ON d.id = m.domain_id AND m.status = 'active'
    WHERE d.id = $1
    GROUP BY d.id
  `, [domainId]);
  
  if (result.rows.length === 0) {
    return null;
  }
  
  const domain = result.rows[0];
  
  try {
    await redisClient.setEx(cacheKey, 300, JSON.stringify(domain));
  } catch (error) {
    logger.warn('Erreur mise en cache domaine:', error);
  }
  
  return domain;
};

/**
 * Vérifier si un utilisateur a accès à un domaine
 */
const checkUserDomainAccess = async (userId, domainId) => {
  const result = await pool.query(`
    SELECT 1 FROM users 
    WHERE id = $1 
    AND (domain_id = $2 OR is_super_admin = true)
    AND status = 'active'
  `, [userId, domainId]);
  
  return result.rows.length > 0;
};

/**
 * Invalider le cache d'un domaine
 */
const invalidateDomainCache = async (domainId, domainName) => {
  try {
    const keys = [`domain:id:${domainId}`];
    if (domainName) {
      keys.push(`domain:name:${domainName}`);
    }
    await redisClient.del(keys);
  } catch (error) {
    logger.warn('Erreur invalidation cache domaine:', error);
  }
};

module.exports = {
  domainContext,
  domainContextOptional,
  getDomainByName,
  getDomainById,
  checkUserDomainAccess,
  invalidateDomainCache
};