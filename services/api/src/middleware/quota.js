/**
 * MSSanté API - Middleware de gestion des quotas
 * Vérification des limites par domaine (BAL, stockage)
 */

const { pool } = require('../config/database');
const { redisClient } = require('../config/redis');
const { ApiError } = require('./errorHandler');
const logger = require('../utils/logger');

/**
 * Middleware: Vérifier le quota de BAL avant création
 */
const checkMailboxQuota = async (req, res, next) => {
  try {
    if (!req.domain) {
      throw new ApiError(400, 'Contexte domaine requis', 'DOMAIN_CONTEXT_REQUIRED');
    }
    
    const domainId = req.domain.id;
    const quotas = req.domain.quotas || {};
    const maxMailboxes = quotas.max_mailboxes || 1000;
    
    // Compter les BAL actives du domaine
    const countResult = await pool.query(`
      SELECT COUNT(*) as count 
      FROM mailboxes 
      WHERE domain_id = $1 
      AND status IN ('active', 'pending')
    `, [domainId]);
    
    const currentCount = parseInt(countResult.rows[0].count, 10);
    
    if (currentCount >= maxMailboxes) {
      logger.security('quota_exceeded', {
        type: 'mailbox',
        domain: req.domain.domain_name,
        current: currentCount,
        max: maxMailboxes,
        userId: req.user?.id
      });
      throw new ApiError(403, 'Quota de boîtes aux lettres atteint', 'MAILBOX_QUOTA_EXCEEDED', {
        current: currentCount,
        max: maxMailboxes,
        domain: req.domain.domain_name
      });
    }
    
    // Attacher les infos de quota à la requête
    req.quotaInfo = {
      mailboxes: {
        current: currentCount,
        max: maxMailboxes,
        remaining: maxMailboxes - currentCount
      }
    };
    
    next();
    
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware: Vérifier le quota de stockage avant ajout
 * @param {number} requiredMb - Espace requis en Mo (optionnel, vérifie juste la limite globale si non spécifié)
 */
const checkStorageQuota = (requiredMb = 0) => {
  return async (req, res, next) => {
    try {
      if (!req.domain) {
        throw new ApiError(400, 'Contexte domaine requis', 'DOMAIN_CONTEXT_REQUIRED');
      }
      
      const domainId = req.domain.id;
      const quotas = req.domain.quotas || {};
      const maxStorageGb = quotas.max_storage_gb || 100;
      const maxStorageMb = maxStorageGb * 1024;
      
      // Calculer le stockage utilisé
      const storageResult = await pool.query(`
        SELECT COALESCE(SUM(storage_used_mb), 0) as used_mb
        FROM mailboxes 
        WHERE domain_id = $1 
        AND status = 'active'
      `, [domainId]);
      
      const usedMb = parseInt(storageResult.rows[0].used_mb, 10);
      const availableMb = maxStorageMb - usedMb;
      
      if (requiredMb > 0 && usedMb + requiredMb > maxStorageMb) {
        logger.security('quota_exceeded', {
          type: 'storage',
          domain: req.domain.domain_name,
          used_mb: usedMb,
          max_mb: maxStorageMb,
          required_mb: requiredMb,
          userId: req.user?.id
        });
        throw new ApiError(403, 'Quota de stockage insuffisant', 'STORAGE_QUOTA_EXCEEDED', {
          used_mb: usedMb,
          max_mb: maxStorageMb,
          required_mb: requiredMb,
          available_mb: availableMb
        });
      }
      
      // Alerter si proche de la limite (> 90%)
      const usagePercent = (usedMb / maxStorageMb) * 100;
      if (usagePercent > 90) {
        logger.warn(`Alerte quota stockage ${req.domain.domain_name}: ${usagePercent.toFixed(1)}%`, {
          type: 'quota_warning',
          domain: req.domain.domain_name,
          usagePercent: usagePercent.toFixed(1)
        });
      }
      
      req.quotaInfo = {
        ...req.quotaInfo,
        storage: {
          used_mb: usedMb,
          max_mb: maxStorageMb,
          available_mb: availableMb,
          usage_percent: usagePercent.toFixed(1)
        }
      };
      
      next();
      
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Middleware combiné: Vérifier tous les quotas
 */
const checkQuota = async (req, res, next) => {
  try {
    // Vérifier quota BAL
    await new Promise((resolve, reject) => {
      checkMailboxQuota(req, res, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    
    // Vérifier quota stockage global
    await new Promise((resolve, reject) => {
      checkStorageQuota(0)(req, res, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    
    next();
    
  } catch (error) {
    next(error);
  }
};

/**
 * Récupérer les statistiques de quota d'un domaine
 */
const getQuotaStats = async (domainId) => {
  const cacheKey = `quota:stats:${domainId}`;
  
  try {
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (error) {
    logger.warn('Erreur lecture cache quota:', error);
  }
  
  // Requête DB complète
  const result = await pool.query(`
    SELECT 
      d.id as domain_id,
      d.domain_name,
      d.quotas,
      COUNT(DISTINCT m.id) FILTER (WHERE m.status = 'active') as active_mailboxes,
      COUNT(DISTINCT m.id) FILTER (WHERE m.status = 'pending') as pending_mailboxes,
      COALESCE(SUM(m.storage_used_mb) FILTER (WHERE m.status = 'active'), 0) as used_storage_mb,
      COUNT(DISTINCT u.id) FILTER (WHERE u.status = 'active') as active_users
    FROM domains d
    LEFT JOIN mailboxes m ON d.id = m.domain_id
    LEFT JOIN users u ON d.id = u.domain_id
    WHERE d.id = $1
    GROUP BY d.id
  `, [domainId]);
  
  if (result.rows.length === 0) {
    return null;
  }
  
  const row = result.rows[0];
  const quotas = row.quotas || {};
  
  const stats = {
    domain_id: row.domain_id,
    domain_name: row.domain_name,
    mailboxes: {
      active: parseInt(row.active_mailboxes, 10),
      pending: parseInt(row.pending_mailboxes, 10),
      max: quotas.max_mailboxes || 1000,
      get usage_percent() {
        return ((this.active / this.max) * 100).toFixed(1);
      }
    },
    storage: {
      used_mb: parseInt(row.used_storage_mb, 10),
      max_mb: (quotas.max_storage_gb || 100) * 1024,
      get available_mb() {
        return this.max_mb - this.used_mb;
      },
      get usage_percent() {
        return ((this.used_mb / this.max_mb) * 100).toFixed(1);
      }
    },
    users: {
      active: parseInt(row.active_users, 10)
    }
  };
  
  // Cache pour 2 minutes
  try {
    await redisClient.setEx(cacheKey, 120, JSON.stringify(stats));
  } catch (error) {
    logger.warn('Erreur mise en cache quota:', error);
  }
  
  return stats;
};

/**
 * Invalider le cache des quotas d'un domaine
 */
const invalidateQuotaCache = async (domainId) => {
  try {
    await redisClient.del(`quota:stats:${domainId}`);
  } catch (error) {
    logger.warn('Erreur invalidation cache quota:', error);
  }
};

/**
 * Vérifier et alerter sur les quotas proches de la limite
 * À appeler périodiquement (cron)
 */
const checkQuotaAlerts = async () => {
  const result = await pool.query(`
    SELECT 
      d.id,
      d.domain_name,
      d.quotas,
      d.admin_email,
      COUNT(m.id) FILTER (WHERE m.status = 'active') as mailbox_count,
      COALESCE(SUM(m.storage_used_mb), 0) as storage_used
    FROM domains d
    LEFT JOIN mailboxes m ON d.id = m.domain_id
    WHERE d.status = 'active'
    GROUP BY d.id
  `);
  
  const alerts = [];
  
  for (const domain of result.rows) {
    const quotas = domain.quotas || {};
    const maxMailboxes = quotas.max_mailboxes || 1000;
    const maxStorageMb = (quotas.max_storage_gb || 100) * 1024;
    
    const mailboxUsage = (domain.mailbox_count / maxMailboxes) * 100;
    const storageUsage = (domain.storage_used / maxStorageMb) * 100;
    
    if (mailboxUsage >= 90) {
      alerts.push({
        domain: domain.domain_name,
        type: 'mailbox',
        usage: mailboxUsage.toFixed(1),
        admin_email: domain.admin_email
      });
    }
    
    if (storageUsage >= 90) {
      alerts.push({
        domain: domain.domain_name,
        type: 'storage',
        usage: storageUsage.toFixed(1),
        admin_email: domain.admin_email
      });
    }
  }
  
  return alerts;
};

module.exports = {
  checkMailboxQuota,
  checkStorageQuota,
  checkQuota,
  getQuotaStats,
  invalidateQuotaCache,
  checkQuotaAlerts
};