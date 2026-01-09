// services/api/src/controllers/admin/statisticsController.js
/**
 * Contrôleur de statistiques (Domain Admin & Super Admin)
 */

const { pool } = require('../../config/database');
const logger = require('../../utils/logger');

/**
 * GET /api/v1/admin/statistics/overview
 * Vue d'ensemble des statistiques
 */
const getOverview = async (req, res) => {
  try {
    const user = req.user;
    const domainFilter = user.role === 'super_admin' ? '' : `WHERE domain_id = '${user.domainId}'`;

    const stats = await pool.query(
      `
      SELECT
        (SELECT COUNT(*) FROM domains ${domainFilter ? 'WHERE id = $1' : ''}) as domains_count,
        (SELECT COUNT(*) FROM users ${domainFilter}) as users_count,
        (SELECT COUNT(*) FROM mailboxes ${domainFilter}) as mailboxes_count,
        (SELECT COUNT(*) FROM certificates ${domainFilter} AND status = 'active') as certificates_count
    `,
      user.role !== 'super_admin' ? [user.domainId] : []
    );

    const emailStats = await pool.query(
      `
      SELECT
        COUNT(*) FILTER (WHERE direction = 'inbound') as received,
        COUNT(*) FILTER (WHERE direction = 'outbound') as sent,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as last_24h
      FROM email_logs
      ${domainFilter}
    `,
      user.role !== 'super_admin' ? [user.domainId] : []
    );

    res.json({
      success: true,
      data: {
        domains: parseInt(stats.rows[0].domains_count),
        users: parseInt(stats.rows[0].users_count),
        mailboxes: parseInt(stats.rows[0].mailboxes_count),
        certificates: parseInt(stats.rows[0].certificates_count),
        emails: {
          received: parseInt(emailStats.rows[0].received),
          sent: parseInt(emailStats.rows[0].sent),
          last24h: parseInt(emailStats.rows[0].last_24h)
        }
      }
    });
  } catch (error) {
    logger.error('Erreur get overview statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur récupération statistiques'
    });
  }
};

/**
 * GET /api/v1/admin/statistics/emails
 * Statistiques d'emails
 */
const getEmailStats = async (req, res) => {
  try {
    const { from, to, domainId } = req.query;
    const user = req.user;

    let domainFilter = '';
    const params = [];
    let paramCount = 0;

    if (user.role !== 'super_admin') {
      paramCount++;
      domainFilter = ` AND domain_id = $${paramCount}`;
      params.push(user.domainId);
    } else if (domainId) {
      paramCount++;
      domainFilter = ` AND domain_id = $${paramCount}`;
      params.push(domainId);
    }

    let timeFilter = '';
    if (from) {
      paramCount++;
      timeFilter += ` AND created_at >= $${paramCount}`;
      params.push(from);
    }
    if (to) {
      paramCount++;
      timeFilter += ` AND created_at <= $${paramCount}`;
      params.push(to);
    }

    const result = await pool.query(
      `
      SELECT
        DATE(created_at) as date,
        COUNT(*) FILTER (WHERE direction = 'inbound') as received,
        COUNT(*) FILTER (WHERE direction = 'outbound') as sent,
        COUNT(*) FILTER (WHERE status = 'delivered') as delivered,
        COUNT(*) FILTER (WHERE status = 'failed') as failed
      FROM email_logs
      WHERE 1=1 ${domainFilter} ${timeFilter}
      GROUP BY DATE(created_at)
      ORDER BY date DESC
      LIMIT 30
    `,
      params
    );

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    logger.error('Erreur get email statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur récupération statistiques emails'
    });
  }
};

/**
 * GET /api/v1/admin/statistics/storage
 * Statistiques de stockage
 */
const getStorageStats = async (req, res) => {
  try {
    const user = req.user;
    const domainFilter = user.role === 'super_admin' ? '' : `WHERE domain_id = '${user.domainId}'`;

    const result = await pool.query(
      `
      SELECT
        COALESCE(SUM(quota_mb), 0) as total_quota,
        COALESCE(SUM(used_mb), 0) as total_used,
        COUNT(*) as mailbox_count
      FROM mailboxes
      ${domainFilter}
    `,
      user.role !== 'super_admin' ? [user.domainId] : []
    );

    const topConsumers = await pool.query(
      `
      SELECT email, used_mb, quota_mb,
             ROUND((used_mb::numeric / NULLIF(quota_mb, 0)) * 100, 2) as usage_percentage
      FROM mailboxes
      ${domainFilter}
      ORDER BY used_mb DESC
      LIMIT 10
    `,
      user.role !== 'super_admin' ? [user.domainId] : []
    );

    res.json({
      success: true,
      data: {
        total: {
          quotaMb: parseFloat(result.rows[0].total_quota),
          usedMb: parseFloat(result.rows[0].total_used),
          mailboxCount: parseInt(result.rows[0].mailbox_count),
          usagePercentage:
            result.rows[0].total_quota > 0
              ? ((result.rows[0].total_used / result.rows[0].total_quota) * 100).toFixed(2)
              : 0
        },
        topConsumers: topConsumers.rows
      }
    });
  } catch (error) {
    logger.error('Erreur get storage statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur récupération statistiques stockage'
    });
  }
};

module.exports = {
  getOverview,
  getEmailStats,
  getStorageStats
};
