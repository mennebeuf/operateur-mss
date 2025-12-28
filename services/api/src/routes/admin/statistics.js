// services/api/src/routes/admin/statistics.js
/**
 * Routes statistiques (Domain Admin et Super Admin)
 */

const express = require('express');
const router = express.Router();
const { query } = require('express-validator');
const adminStatisticsController = require('../../controllers/admin/statisticsController');
const { domainContext } = require('../../middleware/domainContext');
const { requireSuperAdmin } = require('../../middleware/permissions');
const { validate } = require('../../middleware/validation');

// Contexte domaine pour filtrage automatique
router.use(domainContext);

// ============================================
// STATISTIQUES GÉNÉRALES
// ============================================

/**
 * GET /api/v1/admin/statistics/overview
 * Vue d'ensemble des statistiques
 */
router.get('/overview',
  [
    query('period')
      .optional()
      .isIn(['day', 'week', 'month', 'quarter', 'year'])
  ],
  validate,
  adminStatisticsController.getOverview
);

/**
 * GET /api/v1/admin/statistics/summary
 * Résumé chiffré (KPIs)
 */
router.get('/summary',
  adminStatisticsController.getSummary
);

// ============================================
// STATISTIQUES EMAILS
// ============================================

/**
 * GET /api/v1/admin/statistics/emails
 * Statistiques des emails
 */
router.get('/emails',
  [
    query('period')
      .optional()
      .isIn(['day', 'week', 'month', 'year']),
    query('groupBy')
      .optional()
      .isIn(['hour', 'day', 'week', 'month'])
  ],
  validate,
  adminStatisticsController.getEmailStats
);

/**
 * GET /api/v1/admin/statistics/emails/volume
 * Volume d'emails
 */
router.get('/emails/volume',
  [
    query('from').optional().isISO8601(),
    query('to').optional().isISO8601(),
    query('direction')
      .optional()
      .isIn(['inbound', 'outbound', 'both'])
  ],
  validate,
  adminStatisticsController.getEmailVolume
);

/**
 * GET /api/v1/admin/statistics/emails/top-senders
 * Top expéditeurs
 */
router.get('/emails/top-senders',
  [
    query('period')
      .optional()
      .isIn(['day', 'week', 'month']),
    query('limit')
      .optional()
      .isInt({ min: 5, max: 50 })
  ],
  validate,
  adminStatisticsController.getTopSenders
);

/**
 * GET /api/v1/admin/statistics/emails/top-recipients
 * Top destinataires
 */
router.get('/emails/top-recipients',
  [
    query('period')
      .optional()
      .isIn(['day', 'week', 'month']),
    query('limit')
      .optional()
      .isInt({ min: 5, max: 50 })
  ],
  validate,
  adminStatisticsController.getTopRecipients
);

// ============================================
// STATISTIQUES UTILISATEURS
// ============================================

/**
 * GET /api/v1/admin/statistics/users
 * Statistiques utilisateurs
 */
router.get('/users',
  [
    query('period')
      .optional()
      .isIn(['day', 'week', 'month', 'year'])
  ],
  validate,
  adminStatisticsController.getUserStats
);

/**
 * GET /api/v1/admin/statistics/users/activity
 * Activité des utilisateurs
 */
router.get('/users/activity',
  [
    query('period')
      .optional()
      .isIn(['day', 'week', 'month']),
    query('groupBy')
      .optional()
      .isIn(['hour', 'day', 'weekday'])
  ],
  validate,
  adminStatisticsController.getUserActivity
);

/**
 * GET /api/v1/admin/statistics/users/logins
 * Statistiques de connexion
 */
router.get('/users/logins',
  [
    query('period')
      .optional()
      .isIn(['day', 'week', 'month'])
  ],
  validate,
  adminStatisticsController.getLoginStats
);

// ============================================
// STATISTIQUES BAL
// ============================================

/**
 * GET /api/v1/admin/statistics/mailboxes
 * Statistiques des BAL
 */
router.get('/mailboxes',
  adminStatisticsController.getMailboxStats
);

/**
 * GET /api/v1/admin/statistics/mailboxes/storage
 * Utilisation du stockage
 */
router.get('/mailboxes/storage',
  adminStatisticsController.getStorageStats
);

/**
 * GET /api/v1/admin/statistics/mailboxes/growth
 * Évolution du nombre de BAL
 */
router.get('/mailboxes/growth',
  [
    query('period')
      .optional()
      .isIn(['month', 'quarter', 'year'])
  ],
  validate,
  adminStatisticsController.getMailboxGrowth
);

// ============================================
// STATISTIQUES CERTIFICATS
// ============================================

/**
 * GET /api/v1/admin/statistics/certificates
 * Statistiques des certificats
 */
router.get('/certificates',
  adminStatisticsController.getCertificateStats
);

// ============================================
// STATISTIQUES ANNUAIRE
// ============================================

/**
 * GET /api/v1/admin/statistics/annuaire
 * Statistiques annuaire
 */
router.get('/annuaire',
  adminStatisticsController.getAnnuaireStats
);

// ============================================
// INDICATEURS ANS
// ============================================

/**
 * GET /api/v1/admin/statistics/indicators
 * Indicateurs pour l'ANS
 */
router.get('/indicators',
  [
    query('period')
      .optional()
      .matches(/^\d{4}-(0[1-9]|1[0-2])$/)
      .withMessage('Format: YYYY-MM')
  ],
  validate,
  adminStatisticsController.getANSIndicators
);

/**
 * GET /api/v1/admin/statistics/indicators/history
 * Historique des indicateurs
 */
router.get('/indicators/history',
  [
    query('months')
      .optional()
      .isInt({ min: 1, max: 24 })
  ],
  validate,
  adminStatisticsController.getIndicatorsHistory
);

// ============================================
// RAPPORTS
// ============================================

/**
 * GET /api/v1/admin/statistics/report
 * Générer un rapport statistique
 */
router.get('/report',
  [
    query('type')
      .optional()
      .isIn(['summary', 'detailed', 'compliance']),
    query('period')
      .optional()
      .isIn(['week', 'month', 'quarter', 'year']),
    query('format')
      .optional()
      .isIn(['json', 'csv', 'pdf'])
  ],
  validate,
  adminStatisticsController.generateReport
);

// ============================================
// STATISTIQUES GLOBALES (Super Admin)
// ============================================

/**
 * GET /api/v1/admin/statistics/global
 * Statistiques globales tous domaines
 */
router.get('/global',
  requireSuperAdmin,
  adminStatisticsController.getGlobalStats
);

/**
 * GET /api/v1/admin/statistics/global/domains
 * Comparaison entre domaines
 */
router.get('/global/domains',
  requireSuperAdmin,
  [
    query('sortBy')
      .optional()
      .isIn(['mailboxes', 'users', 'emails', 'storage']),
    query('limit')
      .optional()
      .isInt({ min: 5, max: 50 })
  ],
  validate,
  adminStatisticsController.getDomainComparison
);

/**
 * GET /api/v1/admin/statistics/global/trends
 * Tendances globales
 */
router.get('/global/trends',
  requireSuperAdmin,
  [
    query('period')
      .optional()
      .isIn(['month', 'quarter', 'year'])
  ],
  validate,
  adminStatisticsController.getGlobalTrends
);

module.exports = router;