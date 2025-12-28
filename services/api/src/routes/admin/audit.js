// services/api/src/routes/admin/audit.js
/**
 * Routes administration avancée Audit
 */

const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');
const adminAuditController = require('../../controllers/admin/auditController');
const { domainContext } = require('../../middleware/domainContext');
const { requireSuperAdmin } = require('../../middleware/permissions');
const { validate } = require('../../middleware/validation');

// Contexte domaine
router.use(domainContext);

// ============================================
// RECHERCHE AVANCÉE
// ============================================

/**
 * POST /api/v1/admin/audit/search
 * Recherche avancée dans les logs
 */
router.post('/search',
  [
    body('query')
      .optional()
      .isString(),
    body('filters')
      .optional()
      .isObject(),
    body('filters.actions')
      .optional()
      .isArray(),
    body('filters.users')
      .optional()
      .isArray(),
    body('filters.mailboxes')
      .optional()
      .isArray(),
    body('filters.status')
      .optional()
      .isIn(['success', 'failure', 'error']),
    body('filters.ipAddresses')
      .optional()
      .isArray(),
    body('dateRange')
      .optional()
      .isObject(),
    body('dateRange.from')
      .optional()
      .isISO8601(),
    body('dateRange.to')
      .optional()
      .isISO8601(),
    body('page')
      .optional()
      .isInt({ min: 1 }),
    body('limit')
      .optional()
      .isInt({ min: 1, max: 500 }),
    body('sortBy')
      .optional()
      .isIn(['timestamp', 'action', 'user']),
    body('sortOrder')
      .optional()
      .isIn(['asc', 'desc'])
  ],
  validate,
  adminAuditController.advancedSearch
);

// ============================================
// ANALYSE ET RAPPORTS
// ============================================

/**
 * GET /api/v1/admin/audit/analysis
 * Analyse des activités
 */
router.get('/analysis',
  [
    query('period')
      .optional()
      .isIn(['day', 'week', 'month']),
    query('type')
      .optional()
      .isIn(['security', 'usage', 'compliance'])
  ],
  validate,
  adminAuditController.getAnalysis
);

/**
 * GET /api/v1/admin/audit/report
 * Générer un rapport d'audit
 */
router.get('/report',
  [
    query('type')
      .isIn(['security', 'compliance', 'activity', 'custom'])
      .withMessage('Type de rapport requis'),
    query('from')
      .isISO8601()
      .withMessage('Date de début requise'),
    query('to')
      .isISO8601()
      .withMessage('Date de fin requise'),
    query('format')
      .optional()
      .isIn(['json', 'csv', 'pdf'])
  ],
  validate,
  adminAuditController.generateReport
);

/**
 * GET /api/v1/admin/audit/reports
 * Liste des rapports générés
 */
router.get('/reports',
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 50 })
  ],
  validate,
  adminAuditController.listReports
);

/**
 * GET /api/v1/admin/audit/reports/:id/download
 * Télécharger un rapport
 */
router.get('/reports/:id/download',
  [
    param('id').isUUID().withMessage('ID rapport invalide')
  ],
  validate,
  adminAuditController.downloadReport
);

// ============================================
// DÉTECTION D'ANOMALIES
// ============================================

/**
 * GET /api/v1/admin/audit/anomalies
 * Liste des anomalies détectées
 */
router.get('/anomalies',
  [
    query('type')
      .optional()
      .isIn([
        'brute_force',
        'unusual_hours',
        'geo_anomaly',
        'mass_deletion',
        'privilege_escalation',
        'data_exfiltration'
      ]),
    query('severity')
      .optional()
      .isIn(['low', 'medium', 'high', 'critical']),
    query('status')
      .optional()
      .isIn(['new', 'investigating', 'resolved', 'false_positive']),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 })
  ],
  validate,
  adminAuditController.getAnomalies
);

/**
 * GET /api/v1/admin/audit/anomalies/:id
 * Détails d'une anomalie
 */
router.get('/anomalies/:id',
  [
    param('id').isUUID().withMessage('ID anomalie invalide')
  ],
  validate,
  adminAuditController.getAnomaly
);

/**
 * PUT /api/v1/admin/audit/anomalies/:id/status
 * Mettre à jour le statut d'une anomalie
 */
router.put('/anomalies/:id/status',
  [
    param('id').isUUID().withMessage('ID anomalie invalide'),
    body('status')
      .isIn(['investigating', 'resolved', 'false_positive'])
      .withMessage('Statut invalide'),
    body('notes')
      .optional()
      .trim()
      .isLength({ max: 1000 })
  ],
  validate,
  adminAuditController.updateAnomalyStatus
);

// ============================================
// ALERTES DE SÉCURITÉ
// ============================================

/**
 * GET /api/v1/admin/audit/security-alerts
 * Alertes de sécurité
 */
router.get('/security-alerts',
  [
    query('severity')
      .optional()
      .isIn(['info', 'warning', 'error', 'critical']),
    query('acknowledged')
      .optional()
      .isBoolean(),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 })
  ],
  validate,
  adminAuditController.getSecurityAlerts
);

/**
 * PUT /api/v1/admin/audit/security-alerts/:id/acknowledge
 * Acquitter une alerte
 */
router.put('/security-alerts/:id/acknowledge',
  [
    param('id').isUUID().withMessage('ID alerte invalide'),
    body('notes')
      .optional()
      .trim()
      .isLength({ max: 500 })
  ],
  validate,
  adminAuditController.acknowledgeSecurityAlert
);

// ============================================
// CONFORMITÉ
// ============================================

/**
 * GET /api/v1/admin/audit/compliance
 * Statut de conformité
 */
router.get('/compliance',
  adminAuditController.getComplianceStatus
);

/**
 * GET /api/v1/admin/audit/compliance/checklist
 * Checklist de conformité
 */
router.get('/compliance/checklist',
  adminAuditController.getComplianceChecklist
);

/**
 * GET /api/v1/admin/audit/compliance/gdpr
 * Rapport RGPD
 */
router.get('/compliance/gdpr',
  [
    query('from').optional().isISO8601(),
    query('to').optional().isISO8601()
  ],
  validate,
  adminAuditController.getGDPRReport
);

// ============================================
// RÉTENTION ET ARCHIVAGE
// ============================================

/**
 * GET /api/v1/admin/audit/retention/status
 * Statut de la rétention des logs
 */
router.get('/retention/status',
  adminAuditController.getRetentionStatus
);

/**
 * POST /api/v1/admin/audit/archive
 * Archiver les anciens logs
 */
router.post('/archive',
  requireSuperAdmin,
  [
    body('olderThanDays')
      .isInt({ min: 90 })
      .withMessage('Minimum 90 jours'),
    body('confirm')
      .equals('true')
      .withMessage('Confirmation requise')
  ],
  validate,
  adminAuditController.archiveLogs
);

/**
 * POST /api/v1/admin/audit/purge
 * Purger les logs archivés (Super Admin)
 */
router.post('/purge',
  requireSuperAdmin,
  [
    body('olderThanDays')
      .isInt({ min: 365 })
      .withMessage('Minimum 365 jours'),
    body('confirm')
      .equals('PURGE')
      .withMessage('Tapez "PURGE" pour confirmer')
  ],
  validate,
  adminAuditController.purgeLogs
);

// ============================================
// SUPER ADMIN - AUDIT GLOBAL
// ============================================

/**
 * GET /api/v1/admin/audit/global
 * Vue globale audit (tous domaines)
 */
router.get('/global',
  requireSuperAdmin,
  [
    query('domainId').optional().isUUID(),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 500 })
  ],
  validate,
  adminAuditController.getGlobalAudit
);

/**
 * GET /api/v1/admin/audit/global/statistics
 * Statistiques globales d'audit
 */
router.get('/global/statistics',
  requireSuperAdmin,
  adminAuditController.getGlobalStatistics
);

module.exports = router;