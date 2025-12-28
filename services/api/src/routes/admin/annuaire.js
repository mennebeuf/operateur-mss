// services/api/src/routes/admin/annuaire.js
/**
 * Routes administration avancée Annuaire ANS
 */

const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');
const adminAnnuaireController = require('../../controllers/admin/annuaireController');
const { domainContext } = require('../../middleware/domainContext');
const { requireSuperAdmin } = require('../../middleware/permissions');
const { validate } = require('../../middleware/validation');

// Contexte domaine
router.use(domainContext);

// ============================================
// GESTION DES PUBLICATIONS
// ============================================

/**
 * GET /api/v1/admin/annuaire/publications
 * Liste détaillée des publications
 */
router.get('/publications',
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('status')
      .optional()
      .isIn(['pending', 'success', 'error', 'retry']),
    query('operation')
      .optional()
      .isIn(['CREATE', 'UPDATE', 'DELETE'])
  ],
  validate,
  adminAnnuaireController.listPublications
);

/**
 * GET /api/v1/admin/annuaire/publications/:id
 * Détails d'une publication
 */
router.get('/publications/:id',
  [
    param('id').isUUID().withMessage('ID publication invalide')
  ],
  validate,
  adminAnnuaireController.getPublication
);

/**
 * POST /api/v1/admin/annuaire/publications/:id/retry
 * Réessayer une publication en erreur
 */
router.post('/publications/:id/retry',
  [
    param('id').isUUID().withMessage('ID publication invalide')
  ],
  validate,
  adminAnnuaireController.retryPublication
);

/**
 * POST /api/v1/admin/annuaire/publications/bulk-retry
 * Réessayer plusieurs publications
 */
router.post('/publications/bulk-retry',
  [
    body('publicationIds')
      .isArray({ min: 1 })
      .withMessage('Liste de publications requise'),
    body('publicationIds.*')
      .isUUID()
  ],
  validate,
  adminAnnuaireController.bulkRetryPublications
);

// ============================================
// SYNCHRONISATION
// ============================================

/**
 * GET /api/v1/admin/annuaire/sync/status
 * Statut de synchronisation détaillé
 */
router.get('/sync/status',
  adminAnnuaireController.getSyncStatus
);

/**
 * POST /api/v1/admin/annuaire/sync/start
 * Démarrer une synchronisation manuelle
 */
router.post('/sync/start',
  [
    body('type')
      .optional()
      .isIn(['full', 'incremental', 'verify']),
    body('force')
      .optional()
      .isBoolean()
  ],
  validate,
  adminAnnuaireController.startSync
);

/**
 * POST /api/v1/admin/annuaire/sync/stop
 * Arrêter la synchronisation en cours
 */
router.post('/sync/stop',
  adminAnnuaireController.stopSync
);

/**
 * GET /api/v1/admin/annuaire/sync/history
 * Historique des synchronisations
 */
router.get('/sync/history',
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 })
  ],
  validate,
  adminAnnuaireController.getSyncHistory
);

/**
 * GET /api/v1/admin/annuaire/sync/conflicts
 * Conflits de synchronisation
 */
router.get('/sync/conflicts',
  [
    query('resolved')
      .optional()
      .isBoolean()
  ],
  validate,
  adminAnnuaireController.getConflicts
);

/**
 * POST /api/v1/admin/annuaire/sync/conflicts/:id/resolve
 * Résoudre un conflit
 */
router.post('/sync/conflicts/:id/resolve',
  [
    param('id').isUUID().withMessage('ID conflit invalide'),
    body('resolution')
      .isIn(['local', 'remote', 'manual'])
      .withMessage('Résolution invalide'),
    body('data')
      .optional()
      .isObject()
  ],
  validate,
  adminAnnuaireController.resolveConflict
);

// ============================================
// INDICATEURS ANS
// ============================================

/**
 * GET /api/v1/admin/annuaire/indicators
 * Indicateurs du domaine
 */
router.get('/indicators',
  [
    query('period')
      .optional()
      .matches(/^\d{4}-(0[1-9]|1[0-2])$/)
  ],
  validate,
  adminAnnuaireController.getIndicators
);

/**
 * GET /api/v1/admin/annuaire/indicators/preview
 * Prévisualisation avant soumission
 */
router.get('/indicators/preview',
  [
    query('period')
      .matches(/^\d{4}-(0[1-9]|1[0-2])$/)
      .withMessage('Période requise (YYYY-MM)')
  ],
  validate,
  adminAnnuaireController.previewIndicators
);

/**
 * POST /api/v1/admin/annuaire/indicators/submit
 * Soumettre les indicateurs
 */
router.post('/indicators/submit',
  [
    body('period')
      .matches(/^\d{4}-(0[1-9]|1[0-2])$/)
      .withMessage('Période requise (YYYY-MM)'),
    body('confirm')
      .equals('true')
      .withMessage('Confirmation requise')
  ],
  validate,
  adminAnnuaireController.submitIndicators
);

/**
 * GET /api/v1/admin/annuaire/indicators/submissions
 * Historique des soumissions
 */
router.get('/indicators/submissions',
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 })
  ],
  validate,
  adminAnnuaireController.getSubmissions
);

// ============================================
// COMPTES RENDUS ANS
// ============================================

/**
 * GET /api/v1/admin/annuaire/reports
 * Liste des comptes rendus
 */
router.get('/reports',
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('status')
      .optional()
      .isIn(['pending', 'processed', 'error'])
  ],
  validate,
  adminAnnuaireController.listReports
);

/**
 * GET /api/v1/admin/annuaire/reports/:id
 * Détails d'un compte rendu
 */
router.get('/reports/:id',
  [
    param('id').isUUID().withMessage('ID rapport invalide')
  ],
  validate,
  adminAnnuaireController.getReport
);

/**
 * POST /api/v1/admin/annuaire/reports/download
 * Télécharger les derniers comptes rendus
 */
router.post('/reports/download',
  adminAnnuaireController.downloadReports
);

// ============================================
// SUPER ADMIN - GESTION GLOBALE
// ============================================

/**
 * GET /api/v1/admin/annuaire/global/status
 * Statut global annuaire (tous domaines)
 */
router.get('/global/status',
  requireSuperAdmin,
  adminAnnuaireController.getGlobalStatus
);

/**
 * GET /api/v1/admin/annuaire/global/statistics
 * Statistiques globales annuaire
 */
router.get('/global/statistics',
  requireSuperAdmin,
  adminAnnuaireController.getGlobalStatistics
);

/**
 * POST /api/v1/admin/annuaire/global/sync
 * Synchronisation globale
 */
router.post('/global/sync',
  requireSuperAdmin,
  [
    body('domainIds')
      .optional()
      .isArray(),
    body('domainIds.*')
      .optional()
      .isUUID()
  ],
  validate,
  adminAnnuaireController.globalSync
);

module.exports = router;