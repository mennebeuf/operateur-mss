// services/api/src/services/indicatorsService.js
const { pool } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Service de génération des indicateurs mensuels
 * Conforme aux exigences de reporting de l'ANS
 */
class IndicatorsService {
  constructor() {
    this.operatorId = process.env.OPERATOR_ID;
  }

  /**
   * Génère les indicateurs pour un domaine sur une période
   */
  async generateDomainIndicators(domainId, year, month) {
    const client = await pool.connect();
    
    try {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59);

      // Volumétrie BAL par type
      const { rows: balCounts } = await client.query(`
        SELECT type, COUNT(*) as count
        FROM mailboxes
        WHERE domain_id = $1 AND status = 'active' AND created_at <= $2
        GROUP BY type
      `, [domainId, endDate]);

      const balPersonal = parseInt(balCounts.find(r => r.type === 'personal')?.count || 0);
      const balOrg = parseInt(balCounts.find(r => r.type === 'organizational')?.count || 0);
      const balApp = parseInt(balCounts.find(r => r.type === 'applicative')?.count || 0);

      // BAL créées dans le mois
      const { rows: [created] } = await client.query(`
        SELECT COUNT(*) as count FROM mailboxes
        WHERE domain_id = $1 AND created_at BETWEEN $2 AND $3
      `, [domainId, startDate, endDate]);

      // BAL supprimées dans le mois
      const { rows: [deleted] } = await client.query(`
        SELECT COUNT(*) as count FROM mailboxes
        WHERE domain_id = $1 AND deleted_at BETWEEN $2 AND $3
      `, [domainId, startDate, endDate]);

      // BAL liste rouge
      const { rows: [listeRouge] } = await client.query(`
        SELECT COUNT(*) as count FROM mailboxes
        WHERE domain_id = $1 AND hide_from_directory = true AND status = 'active'
      `, [domainId]);

      // Messages envoyés/reçus (depuis les logs)
      const { rows: [msgStats] } = await client.query(`
        SELECT 
          COALESCE(SUM(CASE WHEN direction = 'out' THEN 1 ELSE 0 END), 0) as sent,
          COALESCE(SUM(CASE WHEN direction = 'in' THEN 1 ELSE 0 END), 0) as received,
          COALESCE(SUM(size_bytes), 0) as total_bytes
        FROM mail_logs
        WHERE domain_id = $1 AND logged_at BETWEEN $2 AND $3
      `, [domainId, startDate, endDate]);

      // Disponibilité (depuis les checks de monitoring)
      const { rows: [uptime] } = await client.query(`
        SELECT 
          ROUND(
            COUNT(*) FILTER (WHERE status = 'up') * 100.0 / NULLIF(COUNT(*), 0),
            2
          ) as uptime_pct
        FROM health_checks
        WHERE domain_id = $1 AND checked_at BETWEEN $2 AND $3
      `, [domainId, startDate, endDate]);

      const indicators = {
        domainId,
        year,
        month,
        balPersonalCount: balPersonal,
        balOrganizationalCount: balOrg,
        balApplicativeCount: balApp,
        balCreatedCount: parseInt(created.count),
        balDeletedCount: parseInt(deleted.count),
        balListeRougeCount: parseInt(listeRouge.count),
        messagesSent: parseInt(msgStats.sent),
        messagesReceived: parseInt(msgStats.received),
        dataVolumeMb: Math.round(parseInt(msgStats.total_bytes) / 1024 / 1024),
        uptimePercentage: parseFloat(uptime?.uptime_pct || 99.9)
      };

      // Insérer ou mettre à jour
      await client.query(`
        INSERT INTO monthly_indicators (
          domain_id, year, month,
          bal_personal_count, bal_organizational_count, bal_applicative_count,
          bal_created_count, bal_deleted_count, bal_liste_rouge_count,
          messages_sent, messages_received, data_volume_mb,
          uptime_percentage, generated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
        ON CONFLICT (year, month, domain_id) DO UPDATE SET
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
          generated_at = NOW()
      `, [
        domainId, year, month,
        indicators.balPersonalCount, indicators.balOrganizationalCount, indicators.balApplicativeCount,
        indicators.balCreatedCount, indicators.balDeletedCount, indicators.balListeRougeCount,
        indicators.messagesSent, indicators.messagesReceived, indicators.dataVolumeMb,
        indicators.uptimePercentage
      ]);

      logger.info(`Indicateurs générés pour domaine ${domainId}`, { year, month });
      return indicators;
    } finally {
      client.release();
    }
  }

  /**
   * Génère les indicateurs globaux (tous domaines)
   */
  async generateGlobalIndicators(year, month) {
    const { rows: domains } = await pool.query(
      "SELECT id FROM domains WHERE status = 'active'"
    );

    for (const domain of domains) {
      await this.generateDomainIndicators(domain.id, year, month);
    }

    // Calculer les totaux
    const { rows: [totals] } = await pool.query(`
      SELECT
        SUM(bal_personal_count) as total_personal,
        SUM(bal_organizational_count) as total_org,
        SUM(bal_applicative_count) as total_app,
        SUM(bal_created_count) as total_created,
        SUM(bal_deleted_count) as total_deleted,
        SUM(messages_sent) as total_sent,
        SUM(messages_received) as total_received,
        SUM(data_volume_mb) as total_volume
      FROM monthly_indicators
      WHERE year = $1 AND month = $2 AND domain_id IS NOT NULL
    `, [year, month]);

    // Insérer les totaux globaux (domain_id = NULL)
    await pool.query(`
      INSERT INTO monthly_indicators (
        domain_id, year, month,
        bal_personal_count, bal_organizational_count, bal_applicative_count,
        bal_created_count, bal_deleted_count,
        messages_sent, messages_received, data_volume_mb,
        generated_at
      ) VALUES (NULL, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
      ON CONFLICT (year, month, domain_id) DO UPDATE SET
        bal_personal_count = EXCLUDED.bal_personal_count,
        bal_organizational_count = EXCLUDED.bal_organizational_count,
        bal_applicative_count = EXCLUDED.bal_applicative_count,
        bal_created_count = EXCLUDED.bal_created_count,
        bal_deleted_count = EXCLUDED.bal_deleted_count,
        messages_sent = EXCLUDED.messages_sent,
        messages_received = EXCLUDED.messages_received,
        data_volume_mb = EXCLUDED.data_volume_mb,
        generated_at = NOW()
    `, [
      year, month,
      totals.total_personal, totals.total_org, totals.total_app,
      totals.total_created, totals.total_deleted,
      totals.total_sent, totals.total_received, totals.total_volume
    ]);

    logger.info(`Indicateurs globaux générés`, { year, month, domains: domains.length });
  }

  /**
   * Récupère les indicateurs d'une période
   */
  async getIndicators(year, month, domainId = null) {
    const query = domainId
      ? `SELECT * FROM monthly_indicators WHERE year = $1 AND month = $2 AND domain_id = $3`
      : `SELECT * FROM monthly_indicators WHERE year = $1 AND month = $2 ORDER BY domain_id NULLS FIRST`;
    
    const params = domainId ? [year, month, domainId] : [year, month];
    const { rows } = await pool.query(query, params);

    return rows.map(row => ({
      domainId: row.domain_id,
      year: row.year,
      month: row.month,
      balPersonalCount: row.bal_personal_count,
      balOrganizationalCount: row.bal_organizational_count,
      balApplicativeCount: row.bal_applicative_count,
      balCreatedCount: row.bal_created_count,
      balDeletedCount: row.bal_deleted_count,
      balListeRougeCount: row.bal_liste_rouge_count,
      messagesSent: row.messages_sent,
      messagesReceived: row.messages_received,
      dataVolumeMb: row.data_volume_mb,
      uptimePercentage: row.uptime_percentage,
      generatedAt: row.generated_at,
      submittedAt: row.submitted_at
    }));
  }

  /**
   * Exporte les indicateurs au format CSV (pour soumission ANS)
   */
  async exportCSV(year, month) {
    const { rows } = await pool.query(`
      SELECT mi.*, d.domain_name, d.organization_name, d.finess_juridique
      FROM monthly_indicators mi
      LEFT JOIN domains d ON mi.domain_id = d.id
      WHERE mi.year = $1 AND mi.month = $2
      ORDER BY d.domain_name NULLS FIRST
    `, [year, month]);

    // En-tête CSV
    const header = [
      'operateur_id', 'annee', 'mois', 'domaine', 'nom_organisation', 'finess',
      'bal_personnelles', 'bal_organisationnelles', 'bal_applicatives',
      'bal_creees', 'bal_supprimees', 'bal_liste_rouge',
      'messages_envoyes', 'messages_recus', 'volume_donnees_mb', 'taux_disponibilite'
    ].join(';');

    // Lignes de données
    const lines = rows.map(row => [
      this.operatorId,
      row.year,
      row.month,
      row.domain_name || 'GLOBAL',
      row.organization_name || 'Tous domaines',
      row.finess_juridique || '',
      row.bal_personal_count,
      row.bal_organizational_count,
      row.bal_applicative_count,
      row.bal_created_count,
      row.bal_deleted_count,
      row.bal_liste_rouge_count || 0,
      row.messages_sent,
      row.messages_received,
      row.data_volume_mb,
      row.uptime_percentage || '99.9'
    ].join(';'));

    return header + '\n' + lines.join('\n');
  }

  /**
   * Obtient les statistiques en temps réel (dashboard)
   */
  async getRealTimeStats(domainId = null) {
    const whereClause = domainId ? 'WHERE domain_id = $1' : '';
    const params = domainId ? [domainId] : [];

    const { rows: [stats] } = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'active') as active_mailboxes,
        COUNT(*) FILTER (WHERE type = 'personal' AND status = 'active') as personal_count,
        COUNT(*) FILTER (WHERE type = 'organizational' AND status = 'active') as org_count,
        COUNT(*) FILTER (WHERE type = 'applicative' AND status = 'active') as app_count,
        COALESCE(SUM(used_mb), 0) as total_used_mb,
        COALESCE(SUM(quota_mb), 0) as total_quota_mb
      FROM mailboxes
      ${whereClause}
    `, params);

    // Messages des dernières 24h
    const { rows: [recent] } = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE direction = 'out') as sent_24h,
        COUNT(*) FILTER (WHERE direction = 'in') as received_24h
      FROM mail_logs
      WHERE logged_at > NOW() - INTERVAL '24 hours'
      ${domainId ? 'AND domain_id = $1' : ''}
    `, params);

    return {
      mailboxes: {
        total: parseInt(stats.active_mailboxes),
        personal: parseInt(stats.personal_count),
        organizational: parseInt(stats.org_count),
        applicative: parseInt(stats.app_count)
      },
      storage: {
        usedMb: parseInt(stats.total_used_mb),
        quotaMb: parseInt(stats.total_quota_mb),
        usagePercent: stats.total_quota_mb > 0 
          ? Math.round(stats.total_used_mb / stats.total_quota_mb * 100) 
          : 0
      },
      messages24h: {
        sent: parseInt(recent?.sent_24h || 0),
        received: parseInt(recent?.received_24h || 0)
      },
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = new IndicatorsService();