/**
 * Agrégation des statistiques quotidiennes
 * S'exécute tous les jours à 1h
 * 
 * @module jobs/dailyStatistics
 */

const cron = require('node-cron');
const pool = require('../config/database');
const logger = require('../utils/logger');

/**
 * Agrégation des statistiques quotidiennes
 * Planification: Tous les jours à 1h
 */
cron.schedule('0 1 * * *', async () => {
  logger.info('📈 Agrégation des statistiques quotidiennes');
  
  const client = await pool.connect();
  
  try {
    // Date de la veille
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split('T')[0];
    
    logger.info(`📅 Agrégation pour: ${dateStr}`);
    
    await client.query('BEGIN');
    
    // 1. Récupérer toutes les BAL actives
    const { rows: mailboxes } = await client.query(`
      SELECT id, domain_id FROM mailboxes WHERE status = 'active'
    `);
    
    logger.info(`📬 ${mailboxes.length} BAL à traiter`);
    
    let processedCount = 0;
    
    for (const mailbox of mailboxes) {
      try {
        // Calculer les statistiques pour cette BAL
        const stats = await calculateMailboxStats(client, mailbox.id, dateStr);
        
        // Insérer ou mettre à jour les statistiques
        await client.query(`
          INSERT INTO statistics (
            date, mailbox_id,
            messages_sent, messages_received,
            storage_used_mb, connections_count,
            imap_connections, smtp_connections,
            avg_response_time_ms
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT (date, mailbox_id)
          DO UPDATE SET
            messages_sent = EXCLUDED.messages_sent,
            messages_received = EXCLUDED.messages_received,
            storage_used_mb = EXCLUDED.storage_used_mb,
            connections_count = EXCLUDED.connections_count,
            imap_connections = EXCLUDED.imap_connections,
            smtp_connections = EXCLUDED.smtp_connections,
            avg_response_time_ms = EXCLUDED.avg_response_time_ms
        `, [
          dateStr,
          mailbox.id,
          stats.messages_sent,
          stats.messages_received,
          stats.storage_used_mb,
          stats.connections_count,
          stats.imap_connections,
          stats.smtp_connections,
          stats.avg_response_time_ms
        ]);
        
        processedCount++;
      } catch (error) {
        logger.error(`❌ Erreur BAL ${mailbox.id}:`, error.message);
      }
    }
    
    // 2. Calculer les statistiques globales par domaine
    await calculateDomainStats(client, dateStr);
    
    // 3. Calculer les statistiques plateforme
    await calculatePlatformStats(client, dateStr);
    
    await client.query('COMMIT');
    
    // Logger dans l'audit
    await pool.query(`
      INSERT INTO audit_logs (action, resource_type, details, ip_address)
      VALUES ('daily_statistics', 'statistics', $1, '127.0.0.1')
    `, [JSON.stringify({ date: dateStr, mailboxes_processed: processedCount })]);
    
    logger.info(`✅ Statistiques agrégées: ${processedCount} BAL traitées`);
    
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('❌ Erreur agrégation statistiques:', error);
  } finally {
    client.release();
  }
});

/**
 * Calculer les statistiques pour une BAL
 * @param {Object} client - Client PostgreSQL
 * @param {string} mailboxId - ID de la BAL
 * @param {string} dateStr - Date au format YYYY-MM-DD
 * @returns {Object} Statistiques
 */
async function calculateMailboxStats(client, mailboxId, dateStr) {
  // Messages envoyés (depuis les logs Postfix)
  const { rows: sentResult } = await client.query(`
    SELECT COUNT(*) as count
    FROM mail_logs
    WHERE mailbox_id = $1
    AND direction = 'outbound'
    AND DATE(logged_at) = $2
  `, [mailboxId, dateStr]);
  
  // Messages reçus
  const { rows: receivedResult } = await client.query(`
    SELECT COUNT(*) as count
    FROM mail_logs
    WHERE mailbox_id = $1
    AND direction = 'inbound'
    AND DATE(logged_at) = $2
  `, [mailboxId, dateStr]);
  
  // Stockage utilisé (estimation basée sur la dernière mesure)
  const { rows: storageResult } = await client.query(`
    SELECT storage_used_mb
    FROM mailboxes
    WHERE id = $1
  `, [mailboxId]);
  
  // Connexions IMAP
  const { rows: imapResult } = await client.query(`
    SELECT COUNT(*) as count
    FROM connection_logs
    WHERE mailbox_id = $1
    AND protocol = 'imap'
    AND DATE(connected_at) = $2
  `, [mailboxId, dateStr]);
  
  // Connexions SMTP
  const { rows: smtpResult } = await client.query(`
    SELECT COUNT(*) as count
    FROM connection_logs
    WHERE mailbox_id = $1
    AND protocol = 'smtp'
    AND DATE(connected_at) = $2
  `, [mailboxId, dateStr]);
  
  // Temps de réponse moyen
  const { rows: responseResult } = await client.query(`
    SELECT AVG(response_time_ms) as avg_time
    FROM api_logs
    WHERE mailbox_id = $1
    AND DATE(logged_at) = $2
  `, [mailboxId, dateStr]);
  
  return {
    messages_sent: parseInt(sentResult[0]?.count || 0),
    messages_received: parseInt(receivedResult[0]?.count || 0),
    storage_used_mb: parseInt(storageResult[0]?.storage_used_mb || 0),
    imap_connections: parseInt(imapResult[0]?.count || 0),
    smtp_connections: parseInt(smtpResult[0]?.count || 0),
    connections_count: parseInt(imapResult[0]?.count || 0) + parseInt(smtpResult[0]?.count || 0),
    avg_response_time_ms: parseInt(responseResult[0]?.avg_time || 0)
  };
}

/**
 * Calculer les statistiques agrégées par domaine
 * @param {Object} client - Client PostgreSQL
 * @param {string} dateStr - Date
 */
async function calculateDomainStats(client, dateStr) {
  await client.query(`
    INSERT INTO domain_statistics (
      date, domain_id,
      total_mailboxes, active_mailboxes,
      messages_sent, messages_received,
      total_storage_mb, total_connections
    )
    SELECT 
      $1,
      m.domain_id,
      COUNT(DISTINCT m.id),
      COUNT(DISTINCT m.id) FILTER (WHERE m.status = 'active'),
      COALESCE(SUM(s.messages_sent), 0),
      COALESCE(SUM(s.messages_received), 0),
      COALESCE(SUM(s.storage_used_mb), 0),
      COALESCE(SUM(s.connections_count), 0)
    FROM mailboxes m
    LEFT JOIN statistics s ON m.id = s.mailbox_id AND s.date = $1
    GROUP BY m.domain_id
    ON CONFLICT (date, domain_id)
    DO UPDATE SET
      total_mailboxes = EXCLUDED.total_mailboxes,
      active_mailboxes = EXCLUDED.active_mailboxes,
      messages_sent = EXCLUDED.messages_sent,
      messages_received = EXCLUDED.messages_received,
      total_storage_mb = EXCLUDED.total_storage_mb,
      total_connections = EXCLUDED.total_connections
  `, [dateStr]);
  
  logger.info('✅ Statistiques domaines calculées');
}

/**
 * Calculer les statistiques globales de la plateforme
 * @param {Object} client - Client PostgreSQL
 * @param {string} dateStr - Date
 */
async function calculatePlatformStats(client, dateStr) {
  await client.query(`
    INSERT INTO platform_statistics (
      date,
      total_domains, active_domains,
      total_mailboxes, active_mailboxes,
      total_users, active_users,
      messages_sent, messages_received,
      total_storage_gb, peak_connections
    )
    SELECT 
      $1,
      (SELECT COUNT(*) FROM domains),
      (SELECT COUNT(*) FROM domains WHERE status = 'active'),
      (SELECT COUNT(*) FROM mailboxes),
      (SELECT COUNT(*) FROM mailboxes WHERE status = 'active'),
      (SELECT COUNT(*) FROM users),
      (SELECT COUNT(*) FROM users WHERE last_login_at > NOW() - INTERVAL '30 days'),
      COALESCE(SUM(messages_sent), 0),
      COALESCE(SUM(messages_received), 0),
      COALESCE(SUM(storage_used_mb) / 1024.0, 0),
      COALESCE(MAX(connections_count), 0)
    FROM statistics
    WHERE date = $1
    ON CONFLICT (date)
    DO UPDATE SET
      total_domains = EXCLUDED.total_domains,
      active_domains = EXCLUDED.active_domains,
      total_mailboxes = EXCLUDED.total_mailboxes,
      active_mailboxes = EXCLUDED.active_mailboxes,
      total_users = EXCLUDED.total_users,
      active_users = EXCLUDED.active_users,
      messages_sent = EXCLUDED.messages_sent,
      messages_received = EXCLUDED.messages_received,
      total_storage_gb = EXCLUDED.total_storage_gb,
      peak_connections = EXCLUDED.peak_connections
  `, [dateStr]);
  
  logger.info('✅ Statistiques plateforme calculées');
}

/**
 * Exécution manuelle pour une date spécifique
 * @param {string} dateStr - Date au format YYYY-MM-DD
 */
async function runManually(dateStr = null) {
  if (!dateStr) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    dateStr = yesterday.toISOString().split('T')[0];
  }
  
  logger.info(`🔧 Agrégation manuelle pour ${dateStr}`);
  
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { rows: mailboxes } = await client.query(`
      SELECT id FROM mailboxes WHERE status = 'active'
    `);
    
    for (const mailbox of mailboxes) {
      const stats = await calculateMailboxStats(client, mailbox.id, dateStr);
      await client.query(`
        INSERT INTO statistics (date, mailbox_id, messages_sent, messages_received, storage_used_mb, connections_count)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (date, mailbox_id) DO UPDATE SET
          messages_sent = EXCLUDED.messages_sent,
          messages_received = EXCLUDED.messages_received,
          storage_used_mb = EXCLUDED.storage_used_mb,
          connections_count = EXCLUDED.connections_count
      `, [dateStr, mailbox.id, stats.messages_sent, stats.messages_received, stats.storage_used_mb, stats.connections_count]);
    }
    
    await calculateDomainStats(client, dateStr);
    await calculatePlatformStats(client, dateStr);
    
    await client.query('COMMIT');
    
    return { success: true, date: dateStr, mailboxes_processed: mailboxes.length };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

logger.info('✅ Job dailyStatistics initialisé (0 1 * * *)');

module.exports = { runManually, calculateMailboxStats, calculateDomainStats, calculatePlatformStats };