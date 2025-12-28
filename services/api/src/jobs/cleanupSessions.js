/**
 * Nettoyage des sessions expirées
 * S'exécute toutes les heures
 * 
 * @module jobs/cleanupSessions
 */

const cron = require('node-cron');
const pool = require('../config/database');
const redis = require('../config/redis');
const logger = require('../utils/logger');

/**
 * Nettoyage des sessions expirées
 * Planification: Toutes les heures
 */
cron.schedule('0 * * * *', async () => {
  logger.info('🧹 Nettoyage des sessions expirées');
  
  try {
    const results = {
      postgres_sessions: 0,
      redis_sessions: 0,
      refresh_tokens: 0,
      password_resets: 0,
      audit_logs: 0
    };
    
    // 1. Nettoyer les sessions PostgreSQL expirées
    const sessionResult = await pool.query(`
      DELETE FROM sessions
      WHERE expires_at < NOW()
      RETURNING id
    `);
    results.postgres_sessions = sessionResult.rowCount;
    
    // 2. Nettoyer les tokens de rafraîchissement expirés
    const refreshResult = await pool.query(`
      DELETE FROM refresh_tokens
      WHERE expires_at < NOW()
      RETURNING id
    `);
    results.refresh_tokens = refreshResult.rowCount;
    
    // 3. Nettoyer les demandes de reset de mot de passe expirées
    const resetResult = await pool.query(`
      DELETE FROM password_resets
      WHERE expires_at < NOW()
      RETURNING id
    `);
    results.password_resets = resetResult.rowCount;
    
    // 4. Archiver les anciens logs d'audit (> 1 an)
    const auditResult = await pool.query(`
      WITH archived AS (
        INSERT INTO audit_logs_archive
        SELECT * FROM audit_logs
        WHERE timestamp < NOW() - INTERVAL '1 year'
        RETURNING id
      )
      DELETE FROM audit_logs
      WHERE id IN (SELECT id FROM archived)
      RETURNING id
    `);
    results.audit_logs = auditResult.rowCount;
    
    // 5. Nettoyer les sessions Redis expirées (normalement géré par TTL, mais vérification)
    if (redis.isReady) {
      try {
        // Lister les clés de session
        const sessionKeys = await redis.keys('session:*');
        let redisCleanupCount = 0;
        
        for (const key of sessionKeys) {
          const ttl = await redis.ttl(key);
          // Si TTL est -1 (pas d'expiration) ou -2 (clé n'existe plus)
          if (ttl === -1) {
            await redis.del(key);
            redisCleanupCount++;
          }
        }
        
        results.redis_sessions = redisCleanupCount;
      } catch (redisError) {
        logger.warn('⚠️ Erreur nettoyage Redis:', redisError.message);
      }
    }
    
    // 6. Nettoyer les notifications lues anciennes (> 30 jours)
    await pool.query(`
      DELETE FROM notifications
      WHERE read_at IS NOT NULL
      AND read_at < NOW() - INTERVAL '30 days'
    `);
    
    // 7. Nettoyer les verrous expirés
    await pool.query(`
      DELETE FROM locks
      WHERE expires_at < NOW()
    `);
    
    // Logger les résultats
    const totalCleaned = Object.values(results).reduce((a, b) => a + b, 0);
    
    if (totalCleaned > 0) {
      logger.info(`✅ Nettoyage terminé:`, results);
      
      // Logger dans l'audit
      await pool.query(`
        INSERT INTO audit_logs (action, resource_type, details, ip_address)
        VALUES ('cleanup_sessions', 'system', $1, '127.0.0.1')
      `, [JSON.stringify(results)]);
    } else {
      logger.info('✅ Rien à nettoyer');
    }
    
  } catch (error) {
    logger.error('❌ Erreur nettoyage sessions:', error);
  }
});

/**
 * Nettoyage supplémentaire hebdomadaire (dimanche à 3h)
 */
cron.schedule('0 3 * * 0', async () => {
  logger.info('🧹 Nettoyage hebdomadaire approfondi');
  
  try {
    // 1. VACUUM ANALYZE sur les tables fréquemment modifiées
    await pool.query('VACUUM ANALYZE sessions');
    await pool.query('VACUUM ANALYZE audit_logs');
    await pool.query('VACUUM ANALYZE statistics');
    
    // 2. Nettoyer les statistiques très anciennes (> 2 ans)
    const statsResult = await pool.query(`
      DELETE FROM statistics
      WHERE date < NOW() - INTERVAL '2 years'
      RETURNING id
    `);
    
    // 3. Nettoyer les anciennes publications annuaire traitées (> 6 mois)
    const pubResult = await pool.query(`
      DELETE FROM annuaire_publications
      WHERE status = 'success'
      AND completed_at < NOW() - INTERVAL '6 months'
      RETURNING id
    `);
    
    logger.info(`✅ Nettoyage hebdomadaire: ${statsResult.rowCount} stats, ${pubResult.rowCount} publications`);
    
  } catch (error) {
    logger.error('❌ Erreur nettoyage hebdomadaire:', error);
  }
});

/**
 * Exécution manuelle du nettoyage
 * @returns {Object} Résultats du nettoyage
 */
async function runManually() {
  logger.info('🔧 Nettoyage manuel des sessions');
  
  const { rowCount: sessions } = await pool.query(`
    DELETE FROM sessions WHERE expires_at < NOW() RETURNING id
  `);
  
  const { rowCount: tokens } = await pool.query(`
    DELETE FROM refresh_tokens WHERE expires_at < NOW() RETURNING id
  `);
  
  return {
    sessions_cleaned: sessions,
    tokens_cleaned: tokens
  };
}

logger.info('✅ Job cleanupSessions initialisé (0 * * * *)');

module.exports = { runManually };