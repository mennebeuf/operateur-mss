// services/api/src/routes/audit.js
/**
 * Routes de consultation des journaux d'audit
 * Conformité RGPD et traçabilité
 */

const express = require('express');
const router = express.Router();
const { param, query } = require('express-validator');
const auditController = require('../controllers/auditController');
const { authenticate } = require('../middleware/auth');
const { domainContext } = require('../middleware/domainContext');
const { requireDomainAdmin, requireSuperAdmin } = require('../middleware/permissions');
const { validate } = require('../middleware/validation');

// Toutes les routes nécessitent l'authentification
router.use(authenticate);
router.use(domainContext);

// ============================================
// CONSULTATION DES LOGS
// ============================================

/**
 * GET /api/v1/audit/logs
 * Liste des logs d'audit du domaine
 */
router.get('/logs',
  requireDomainAdmin,
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 500 }),
    query('action')
      .optional()
      .isIn([
        'login', 'logout', 'login_failed',
        'mailbox_create', 'mailbox_update', 'mailbox_delete',
        'user_create', 'user_update', 'user_delete',
        'email_send', 'email_receive', 'email_read',
        'certificate_upload', 'certificate_revoke',
        'delegation_create', 'delegation_delete',
        'annuaire_publish', 'annuaire_sync',
        'admin_action', 'config_change'
      ]),
    query('userId').optional().isUUID(),
    query('mailboxId').optional().isUUID(),
    query('resourceType')
      .optional()
      .isIn(['user', 'mailbox', 'domain', 'certificate', 'email', 'delegation']),
    query('status')
      .optional()
      .isIn(['success', 'failure', 'error']),
    query('ipAddress').optional().isIP(),
    query('from').optional().isISO8601(),
    query('to').optional().isISO8601(),
    query('search').optional().isString().trim()
  ],
  validate,
  auditController.list
);

/**
 * GET /api/v1/audit/logs/:id
 * Détails d'un log d'audit
 */
router.get('/logs/:id',
  requireDomainAdmin,
  [
    param('id').isUUID().withMessage('ID log invalide')
  ],
  validate,
  auditController.get
);

/**
 * GET /api/v1/audit/logs/export
 * Exporter les logs d'audit (CSV/JSON)
 */
router.get('/logs/export',
  requireDomainAdmin,
  [
    query('format')
      .optional()
      .isIn(['csv', 'json'])
      .withMessage('Format invalide (csv ou json)'),
    query('from').optional().isISO8601(),
    query('to').optional().isISO8601(),
    query('action').optional().isString()
  ],
  validate,
  auditController.export
);

// ============================================
// STATISTIQUES D'AUDIT
// ============================================

/**
 * GET /api/v1/audit/statistics
 * Statistiques des activités
 */
router.get('/statistics',
  requireDomainAdmin,
  [
    query('period')
      .optional()
      .isIn(['day', 'week', 'month', 'year']),
    query('groupBy')
      .optional()
      .isIn(['action', 'user', 'status', 'hour', 'day'])
  ],
  validate,
  auditController.getStatistics
);

/**
 * GET /api/v1/audit/activity
 * Flux d'activité récente
 */
router.get('/activity',
  requireDomainAdmin,
  [
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
  ],
  validate,
  auditController.getRecentActivity
);

// ============================================
// ACTIVITÉ PAR UTILISATEUR
// ============================================

/**
 * GET /api/v1/audit/users/:userId
 * Activité d'un utilisateur spécifique
 */
router.get('/users/:userId',
  requireDomainAdmin,
  [
    param('userId').isUUID().withMessage('ID utilisateur invalide'),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('from').optional().isISO8601(),
    query('to').optional().isISO8601()
  ],
  validate,
  auditController.getUserActivity
);

/**
 * GET /api/v1/audit/mailboxes/:mailboxId
 * Activité sur une BAL spécifique
 */
router.get('/mailboxes/:mailboxId',
  requireDomainAdmin,
  [
    param('mailboxId').isUUID().withMessage('ID BAL invalide'),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('from').optional().isISO8601(),
    query('to').optional().isISO8601()
  ],
  validate,
  auditController.getMailboxActivity
);

// ============================================
// ALERTES ET ANOMALIES
// ============================================

/**
 * GET /api/v1/audit/alerts
 * Alertes de sécurité
 */
router.get('/alerts',
  requireDomainAdmin,
  [
    query('severity')
      .optional()
      .isIn(['low', 'medium', 'high', 'critical']),
    query('status')
      .optional()
      .isIn(['new', 'acknowledged', 'resolved']),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 })
  ],
  validate,
  auditController.getAlerts
);

/**
 * PUT /api/v1/audit/alerts/:id/acknowledge
 * Acquitter une alerte
 */
router.put('/alerts/:id/acknowledge',
  requireDomainAdmin,
  [
    param('id').isUUID().withMessage('ID alerte invalide')
  ],
  validate,
  auditController.acknowledgeAlert
);

/**
 * GET /api/v1/audit/anomalies
 * Détection d'anomalies
 */
router.get('/anomalies',
  requireDomainAdmin,
  [
    query('type')
      .optional()
      .isIn(['login_failed', 'unusual_activity', 'data_export', 'permission_change']),
    query('period')
      .optional()
      .isIn(['day', 'week', 'month'])
  ],
  validate,
  auditController.getAnomalies
);

// ============================================
// CONFORMITÉ RGPD
// ============================================

/**
 * GET /api/v1/audit/gdpr/access-requests
 * Liste des demandes d'accès aux données
 */
router.get('/gdpr/access-requests',
  requireDomainAdmin,
  [
    query('status')
      .optional()
      .isIn(['pending', 'completed', 'rejected']),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 })
  ],
  validate,
  auditController.listAccessRequests
);

/**
 * POST /api/v1/audit/gdpr/access-requests
 * Créer une demande d'accès aux données
 */
router.post('/gdpr/access-requests',
  requireDomainAdmin,
  [
    // body validations si nécessaire
  ],
  validate,
  auditController.createAccessRequest
);

/**
 * GET /api/v1/audit/gdpr/retention
 * Politique de rétention des données
 */
router.get('/gdpr/retention',
  requireDomainAdmin,
  auditController.getRetentionPolicy
);

// ============================================
// SUPER ADMIN - AUDIT GLOBAL
// ============================================

/**
 * GET /api/v1/audit/global/logs
 * Tous les logs (Super Admin)
 */
router.get('/global/logs',
  requireSuperAdmin,
  [
    query('domainId').optional().isUUID(),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 500 }),
    query('from').optional().isISO8601(),
    query('to').optional().isISO8601()
  ],
  validate,
  auditController.listGlobal
);

/**
 * GET /api/v1/audit/global/statistics
 * Statistiques globales (Super Admin)
 */
router.get('/global/statistics',
  requireSuperAdmin,
  auditController.getGlobalStatistics
);

/**
 * POST /api/v1/audit/global/anonymize
 * Anonymiser les anciens logs (Super Admin)
 */
router.post('/global/anonymize',
  requireSuperAdmin,
  [
    query('olderThanDays')
      .isInt({ min: 365 })
      .withMessage('Minimum 365 jours')
  ],
  validate,
  auditController.anonymize
);

module.exports = router;