/**
 * Génération des indicateurs mensuels pour l'ANS
 * S'exécute le 1er de chaque mois à 3h
 * 
 * @module jobs/generateIndicators
 */

const cron = require('node-cron');
const pool = require('../config/database');
const logger = require('../utils/logger');

/**
 * Génération des indicateurs mensuels
 * Planification: Le 1er de chaque mois à 3h
 */
cron.schedule('0 3 1 * *', async () => {
  logger.info('📊 Génération des indicateurs mensuels');
  
  try {
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const year = lastMonth.getFullYear();
    const month = lastMonth.getMonth() + 1;
    
    logger.info(`📅 Période: ${year}-${month.toString().padStart(2, '0')}`);
    
    // Récupérer tous les domaines actifs
    const { rows: domains } = await pool.query(
      'SELECT * FROM domains WHERE status = $1',
      ['active']
    );
    
    logger.info(`🏢 ${domains.length} domaine(s) à traiter`);
    
    for (const domain of domains) {
      await generateDomainIndicators(domain, year, month);
    }
    
    // Générer les indicateurs globaux (tous domaines)
    await generateGlobalIndicators(year, month);
    
    // Logger dans l'audit
    await pool.query(`
      INSERT INTO audit_logs (action, resource_type, details, ip_address)
      VALUES ('indicators_generated', 'monthly_indicators', $1, '127.0.0.1')
    `, [JSON.stringify({ year, month, domains_count: domains.length })]);
    
    logger.info('✅ Indicateurs mensuels générés');
    
  } catch (error) {
    logger.error('❌ Erreur génération indicateurs:', error);
    
    // Notification d'erreur
    await pool.query(`
      INSERT INTO notifications (type, severity, title, message, target_roles)
      VALUES ('indicators_error', 'high', 'Erreur génération indicateurs', $1, ARRAY['super_admin'])
    `, [error.message]);
  }
});

/**
 * Générer les indicateurs pour un domaine spécifique
 * @param {Object} domain - Domaine concerné
 * @param {number} year - Année
 * @param {number} month - Mois
 */
async function generateDomainIndicators(domain, year, month) {
  const client = await pool.connect();
  
  try {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);
    
    // 1. Volumétrie BAL par type
    const { rows: balCounts } = await client.query(`
      SELECT 
        type,
        COUNT(*) as count
      FROM mailboxes
      WHERE domain_id = $1
      AND status = 'active'
      AND created_at <= $2
      GROUP BY type
    `, [domain.id, endDate]);
    
    const balPersonal = parseInt(balCounts.find(r => r.type === 'personal')?.count || 0);
    const balOrg = parseInt(balCounts.find(r => r.type === 'organizational')?.count || 0);
    const balApp = parseInt(balCounts.find(r => r.type === 'applicative')?.count || 0);
    
    // 2. BAL créées dans le mois
    const { rows: balCreated } = await client.query(`
      SELECT COUNT(*) as count
      FROM mailboxes
      WHERE domain_id = $1
      AND created_at BETWEEN $2 AND $3
    `, [domain.id, startDate, endDate]);
    
    // 3. BAL supprimées dans le mois
    const { rows: balDeleted } = await client.query(`
      SELECT COUNT(*) as count
      FROM mailboxes
      WHERE domain_id = $1
      AND deleted_at BETWEEN $2 AND $3
    `, [domain.id, startDate, endDate]);
    
    // 4. BAL en liste rouge
    const { rows: balListeRouge } = await client.query(`
      SELECT COUNT(*) as count
      FROM mailboxes
      WHERE domain_id = $1
      AND status = 'active'
      AND hide_from_directory = true
      AND created_at <= $2
    `, [domain.id, endDate]);
    
    // 5. Statistiques de messages
    const { rows: msgStats } = await client.query(`
      SELECT 
        COALESCE(SUM(messages_sent), 0) as sent,
        COALESCE(SUM(messages_received), 0) as received,
        COALESCE(SUM(storage_used_mb), 0) as storage
      FROM statistics s
      JOIN mailboxes m ON s.mailbox_id = m.id
      WHERE m.domain_id = $1
      AND s.date BETWEEN $2 AND $3
    `, [domain.id, startDate, endDate]);
    
    // 6. Calcul du taux de disponibilité
    const { rows: uptimeData } = await client.query(`
      SELECT 
        COUNT(*) FILTER (WHERE status = 'up') as up_count,
        COUNT(*) as total_count
      FROM monitoring_checks
      WHERE domain_id = $1
      AND checked_at BETWEEN $2 AND $3
    `, [domain.id, startDate, endDate]);
    
    const uptime = uptimeData[0].total_count > 0 
      ? (uptimeData[0].up_count / uptimeData[0].total_count * 100).toFixed(2)
      : 99.9;
    
    // 7. Nombre d'incidents
    const { rows: incidents } = await client.query(`
      SELECT COUNT(*) as count
      FROM incidents
      WHERE domain_id = $1
      AND created_at BETWEEN $2 AND $3
    `, [domain.id, startDate, endDate]);
    
    // Insérer ou mettre à jour les indicateurs
    await client.query(`
      INSERT INTO monthly_indicators (
        year, month, domain_id,
        bal_personal_count, bal_organizational_count, bal_applicative_count,
        bal_created_count, bal_deleted_count, bal_liste_rouge_count,
        messages_sent, messages_received, data_volume_mb,
        uptime_percentage, incidents_count
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      ON CONFLICT (year, month, domain_id) 
      DO UPDATE SET
        bal_personal_count = EXCLUDED.bal_personal_count,
        bal_organizational_count = EXCLUDED.bal_organizational_count,
        bal_applicative_count = EXCLUDED.bal_applicative_count,
        bal_created_count = EXCLUDED.bal_created_count,
        bal_deleted_count = EXCLUDED.bal_deleted_count,
        bal_liste_rouge_count = EXCLUDED.bal_liste_rouge_count,
        messages_sent = EXCLUDED.messages_sent,
        messages_received = EXCLUDED.messages_received,
        data_volume_mb = EXCLUDED.data_volume_mb,
        uptime_percentage = EXCLUDED.uptime_percentage,
        incidents_count = EXCLUDED.incidents_count,
        generated_at = NOW()
    `, [
      year, month, domain.id,
      balPersonal, balOrg, balApp,
      parseInt(balCreated[0].count), parseInt(balDeleted[0].count), parseInt(balListeRouge[0].count),
      parseInt(msgStats[0].sent), parseInt(msgStats[0].received), parseInt(msgStats[0].storage),
      parseFloat(uptime), parseInt(incidents[0].count)
    ]);
    
    logger.info(`✅ Indicateurs générés pour ${domain.domain_name}`);
    
  } catch (error) {
    logger.error(`❌ Erreur pour ${domain.domain_name}:`, error);
  } finally {
    client.release();
  }
}

/**
 * Générer les indicateurs globaux (somme de tous les domaines)
 * @param {number} year - Année
 * @param {number} month - Mois
 */
async function generateGlobalIndicators(year, month) {
  try {
    await pool.query(`
      INSERT INTO monthly_indicators (
        year, month, domain_id,
        bal_personal_count, bal_organizational_count, bal_applicative_count,
        bal_created_count, bal_deleted_count, bal_liste_rouge_count,
        messages_sent, messages_received, data_volume_mb,
        uptime_percentage, incidents_count
      )
      SELECT 
        $1, $2, NULL,
        COALESCE(SUM(bal_personal_count), 0),
        COALESCE(SUM(bal_organizational_count), 0),
        COALESCE(SUM(bal_applicative_count), 0),
        COALESCE(SUM(bal_created_count), 0),
        COALESCE(SUM(bal_deleted_count), 0),
        COALESCE(SUM(bal_liste_rouge_count), 0),
        COALESCE(SUM(messages_sent), 0),
        COALESCE(SUM(messages_received), 0),
        COALESCE(SUM(data_volume_mb), 0),
        COALESCE(AVG(uptime_percentage), 99.9),
        COALESCE(SUM(incidents_count), 0)
      FROM monthly_indicators
      WHERE year = $1 AND month = $2 AND domain_id IS NOT NULL
      ON CONFLICT (year, month, domain_id) 
      DO UPDATE SET
        bal_personal_count = EXCLUDED.bal_personal_count,
        bal_organizational_count = EXCLUDED.bal_organizational_count,
        bal_applicative_count = EXCLUDED.bal_applicative_count,
        bal_created_count = EXCLUDED.bal_created_count,
        bal_deleted_count = EXCLUDED.bal_deleted_count,
        bal_liste_rouge_count = EXCLUDED.bal_liste_rouge_count,
        messages_sent = EXCLUDED.messages_sent,
        messages_received = EXCLUDED.messages_received,
        data_volume_mb = EXCLUDED.data_volume_mb,
        uptime_percentage = EXCLUDED.uptime_percentage,
        incidents_count = EXCLUDED.incidents_count,
        generated_at = NOW()
    `, [year, month]);
    
    logger.info('✅ Indicateurs globaux générés');
    
  } catch (error) {
    logger.error('❌ Erreur indicateurs globaux:', error);
  }
}

/**
 * Exécution manuelle pour un mois spécifique
 * @param {number} year - Année
 * @param {number} month - Mois
 */
async function runManually(year, month) {
  logger.info(`🔧 Génération manuelle des indicateurs pour ${year}-${month}`);
  
  const { rows: domains } = await pool.query(
    'SELECT * FROM domains WHERE status = $1',
    ['active']
  );
  
  for (const domain of domains) {
    await generateDomainIndicators(domain, year, month);
  }
  
  await generateGlobalIndicators(year, month);
  
  return { success: true, domains_processed: domains.length };
}

logger.info('✅ Job generateIndicators initialisé (0 3 1 * *)');

module.exports = { runManually, generateDomainIndicators, generateGlobalIndicators };