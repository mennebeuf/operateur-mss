// services/api/src/controllers/admin/monitoringController.js
/**
 * Contrôleur de monitoring système (Super Admin)
 */

const os = require('os');
const { pool } = require('../../config/database');
const logger = require('../../utils/logger');
const redis = require('../../config/redis');

/**
 * GET /api/v1/admin/monitoring/health
 * État de santé du système
 */
const getHealth = async (req, res) => {
  try {
    const health = {
      timestamp: new Date().toISOString(),
      status: 'healthy',
      services: {}
    };

    // PostgreSQL
    try {
      await pool.query('SELECT 1');
      health.services.database = { status: 'healthy', latency: null };
    } catch (error) {
      health.services.database = { status: 'unhealthy', error: error.message };
      health.status = 'unhealthy';
    }

    // Redis
    try {
      const start = Date.now();
      await redis.ping();
      health.services.redis = { status: 'healthy', latency: Date.now() - start };
    } catch (error) {
      health.services.redis = { status: 'unhealthy', error: error.message };
      health.status = 'degraded';
    }

    // SMTP/IMAP (à implémenter si services internes)
    health.services.smtp = { status: 'unknown', message: 'Check not implemented' };
    health.services.imap = { status: 'unknown', message: 'Check not implemented' };

    res.json({
      success: true,
      data: health
    });
  } catch (error) {
    logger.error('Erreur health check:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur vérification santé'
    });
  }
};

/**
 * GET /api/v1/admin/monitoring/metrics
 * Métriques système
 */
const getMetrics = async (req, res) => {
  try {
    const metrics = {
      timestamp: new Date().toISOString(),
      system: {
        platform: os.platform(),
        arch: os.arch(),
        cpus: os.cpus().length,
        totalMemory: os.totalmem(),
        freeMemory: os.freemem(),
        uptime: os.uptime(),
        loadAverage: os.loadavg()
      },
      process: {
        pid: process.pid,
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        cpuUsage: process.cpuUsage()
      }
    };

    // Statistiques base de données
    const dbStats = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM domains) as domains_count,
        (SELECT COUNT(*) FROM users WHERE status = 'active') as active_users,
        (SELECT COUNT(*) FROM mailboxes WHERE status = 'active') as active_mailboxes,
        (SELECT COUNT(*) FROM certificates WHERE status = 'active') as active_certificates,
        (SELECT pg_database_size(current_database())) as database_size
    `);

    metrics.database = {
      domains: parseInt(dbStats.rows[0].domains_count),
      activeUsers: parseInt(dbStats.rows[0].active_users),
      activeMailboxes: parseInt(dbStats.rows[0].active_mailboxes),
      activeCertificates: parseInt(dbStats.rows[0].active_certificates),
      size: parseInt(dbStats.rows[0].database_size)
    };

    // Stats Redis
    try {
      const redisInfo = await redis.info();
      metrics.redis = {
        connected: true,
        info: redisInfo
      };
    } catch (error) {
      metrics.redis = { connected: false, error: error.message };
    }

    res.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    logger.error('Erreur get metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur récupération métriques'
    });
  }
};

/**
 * GET /api/v1/admin/monitoring/logs
 * Logs système récents
 */
const getLogs = async (req, res) => {
  try {
    const { level = '', limit = 100, offset = 0 } = req.query;

    let query = 'SELECT * FROM system_logs WHERE 1=1';
    const params = [];
    let paramCount = 0;

    if (level) {
      paramCount++;
      query += ` AND level = $${paramCount}`;
      params.push(level);
    }

    query += ` ORDER BY created_at DESC LIMIT $${++paramCount} OFFSET $${++paramCount}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });
  } catch (error) {
    logger.error('Erreur get logs:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur récupération logs'
    });
  }
};

module.exports = {
  getHealth,
  getMetrics,
  getLogs
};
