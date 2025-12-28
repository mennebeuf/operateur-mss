// services/api/src/routes/admin/monitoring.js
/**
 * Routes monitoring système (Super Admin)
 */

const express = require('express');
const router = express.Router();
const { query } = require('express-validator');
const adminMonitoringController = require('../../controllers/admin/monitoringController');
const { validate } = require('../../middleware/validation');

// ============================================
// ÉTAT DU SYSTÈME
// ============================================

/**
 * GET /api/v1/admin/monitoring/status
 * État général du système
 */
router.get('/status',
  adminMonitoringController.getStatus
);

/**
 * GET /api/v1/admin/monitoring/health
 * Health check complet
 */
router.get('/health',
  adminMonitoringController.getHealth
);

/**
 * GET /api/v1/admin/monitoring/services
 * État des services (API, Postfix, Dovecot, DB, Redis)
 */
router.get('/services',
  adminMonitoringController.getServicesStatus
);

// ============================================
// MÉTRIQUES SYSTÈME
// ============================================

/**
 * GET /api/v1/admin/monitoring/metrics
 * Métriques système (CPU, RAM, Disk)
 */
router.get('/metrics',
  [
    query('period')
      .optional()
      .isIn(['realtime', 'hour', 'day', 'week'])
  ],
  validate,
  adminMonitoringController.getMetrics
);

/**
 * GET /api/v1/admin/monitoring/metrics/cpu
 * Métriques CPU
 */
router.get('/metrics/cpu',
  [
    query('period')
      .optional()
      .isIn(['realtime', 'hour', 'day'])
  ],
  validate,
  adminMonitoringController.getCPUMetrics
);

/**
 * GET /api/v1/admin/monitoring/metrics/memory
 * Métriques mémoire
 */
router.get('/metrics/memory',
  [
    query('period')
      .optional()
      .isIn(['realtime', 'hour', 'day'])
  ],
  validate,
  adminMonitoringController.getMemoryMetrics
);

/**
 * GET /api/v1/admin/monitoring/metrics/disk
 * Métriques disque
 */
router.get('/metrics/disk',
  adminMonitoringController.getDiskMetrics
);

/**
 * GET /api/v1/admin/monitoring/metrics/network
 * Métriques réseau
 */
router.get('/metrics/network',
  [
    query('period')
      .optional()
      .isIn(['realtime', 'hour', 'day'])
  ],
  validate,
  adminMonitoringController.getNetworkMetrics
);

// ============================================
// MÉTRIQUES APPLICATIVES
// ============================================

/**
 * GET /api/v1/admin/monitoring/api
 * Métriques API (requêtes, latence, erreurs)
 */
router.get('/api',
  [
    query('period')
      .optional()
      .isIn(['hour', 'day', 'week'])
  ],
  validate,
  adminMonitoringController.getAPIMetrics
);

/**
 * GET /api/v1/admin/monitoring/email
 * Métriques email (envois, réceptions, queues)
 */
router.get('/email',
  [
    query('period')
      .optional()
      .isIn(['hour', 'day', 'week'])
  ],
  validate,
  adminMonitoringController.getEmailMetrics
);

/**
 * GET /api/v1/admin/monitoring/database
 * Métriques base de données
 */
router.get('/database',
  adminMonitoringController.getDatabaseMetrics
);

/**
 * GET /api/v1/admin/monitoring/redis
 * Métriques Redis
 */
router.get('/redis',
  adminMonitoringController.getRedisMetrics
);

// ============================================
// QUEUES EMAIL
// ============================================

/**
 * GET /api/v1/admin/monitoring/queues
 * État des queues email
 */
router.get('/queues',
  adminMonitoringController.getQueues
);

/**
 * GET /api/v1/admin/monitoring/queues/deferred
 * Messages en attente
 */
router.get('/queues/deferred',
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 })
  ],
  validate,
  adminMonitoringController.getDeferredMessages
);

/**
 * POST /api/v1/admin/monitoring/queues/flush
 * Forcer le traitement de la queue
 */
router.post('/queues/flush',
  adminMonitoringController.flushQueue
);

/**
 * DELETE /api/v1/admin/monitoring/queues/clear
 * Vider la queue (attention!)
 */
router.delete('/queues/clear',
  [
    query('confirm').equals('true').withMessage('Confirmation requise')
  ],
  validate,
  adminMonitoringController.clearQueue
);

// ============================================
// LOGS EN TEMPS RÉEL
// ============================================

/**
 * GET /api/v1/admin/monitoring/logs
 * Logs système récents
 */
router.get('/logs',
  [
    query('service')
      .optional()
      .isIn(['api', 'postfix', 'dovecot', 'nginx']),
    query('level')
      .optional()
      .isIn(['error', 'warn', 'info', 'debug']),
    query('limit')
      .optional()
      .isInt({ min: 10, max: 1000 })
  ],
  validate,
  adminMonitoringController.getLogs
);

/**
 * GET /api/v1/admin/monitoring/logs/errors
 * Erreurs récentes
 */
router.get('/logs/errors',
  [
    query('period')
      .optional()
      .isIn(['hour', 'day', 'week']),
    query('limit')
      .optional()
      .isInt({ min: 10, max: 500 })
  ],
  validate,
  adminMonitoringController.getErrorLogs
);

// ============================================
// CONNEXIONS ACTIVES
// ============================================

/**
 * GET /api/v1/admin/monitoring/connections
 * Connexions actives
 */
router.get('/connections',
  adminMonitoringController.getActiveConnections
);

/**
 * GET /api/v1/admin/monitoring/sessions
 * Sessions utilisateurs actives
 */
router.get('/sessions',
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 })
  ],
  validate,
  adminMonitoringController.getActiveSessions
);

// ============================================
// ALERTES SYSTÈME
// ============================================

/**
 * GET /api/v1/admin/monitoring/alerts
 * Alertes système actives
 */
router.get('/alerts',
  [
    query('severity')
      .optional()
      .isIn(['info', 'warning', 'error', 'critical']),
    query('status')
      .optional()
      .isIn(['active', 'acknowledged', 'resolved'])
  ],
  validate,
  adminMonitoringController.getAlerts
);

/**
 * PUT /api/v1/admin/monitoring/alerts/:id/acknowledge
 * Acquitter une alerte
 */
router.put('/alerts/:id/acknowledge',
  adminMonitoringController.acknowledgeAlert
);

/**
 * GET /api/v1/admin/monitoring/alerts/history
 * Historique des alertes
 */
router.get('/alerts/history',
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('from').optional().isISO8601(),
    query('to').optional().isISO8601()
  ],
  validate,
  adminMonitoringController.getAlertHistory
);

// ============================================
// DASHBOARD
// ============================================

/**
 * GET /api/v1/admin/monitoring/dashboard
 * Données agrégées pour le dashboard
 */
router.get('/dashboard',
  adminMonitoringController.getDashboardData
);

module.exports = router;