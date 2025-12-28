// services/api/src/routes/annuaire.js
/**
 * Routes Annuaire National Santé
 * Interface avec l'API ANS
 */

const express = require('express');
const router = express.Router();
const { body, query } = require('express-validator');
const annuaireController = require('../controllers/annuaireController');
const { authenticate } = require('../middleware/auth');
const { domainContext } = require('../middleware/domainContext');
const { requirePermission, requireDomainAdmin, requireSuperAdmin } = require('../middleware/permissions');
const { validate } = require('../middleware/validation');

// Toutes les routes nécessitent l'authentification
router.use(authenticate);
router.use(domainContext);

// ============================================
// RECHERCHE DANS L'ANNUAIRE
// ============================================

/**
 * GET /api/v1/annuaire/search
 * Recherche dans l'annuaire national
 */
router.get('/search',
  requirePermission('annuaire:read'),
  [
    query('q')
      .optional()
      .isString()
      .trim()
      .isLength({ min: 2 })
      .withMessage('Terme de recherche trop court (min 2 caractères)'),
    query('rpps')
      .optional()
      .matches(/^\d{11}$/)
      .withMessage('RPPS invalide'),
    query('email')
      .optional()
      .isEmail()
      .withMessage('Email invalide'),
    query('nom')
      .optional()
      .isString()
      .trim(),
    query('prenom')
      .optional()
      .isString()
      .trim(),
    query('profession')
      .optional()
      .isString(),
    query('specialite')
      .optional()
      .isString(),
    query('departement')
      .optional()
      .matches(/^\d{2,3}$/)
      .withMessage('Code département invalide'),
    query('ville')
      .optional()
      .isString()
      .trim(),
    query('page')
      .optional()
      .isInt({ min: 1 }),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
  ],
  validate,
  annuaireController.search
);

/**
 * GET /api/v1/annuaire/practitioner/:rpps
 * Récupérer les détails d'un professionnel
 */
router.get('/practitioner/:rpps',
  requirePermission('annuaire:read'),
  [
    query('rpps')
      .matches(/^\d{11}$/)
      .withMessage('RPPS invalide')
  ],
  validate,
  annuaireController.getPractitioner
);

/**
 * GET /api/v1/annuaire/organization/:finess
 * Récupérer les détails d'une structure
 */
router.get('/organization/:finess',
  requirePermission('annuaire:read'),
  [
    query('finess')
      .matches(/^\d{9}$/)
      .withMessage('FINESS invalide')
  ],
  validate,
  annuaireController.getOrganization
);

// ============================================
// PUBLICATION DANS L'ANNUAIRE
// ============================================

/**
 * POST /api/v1/annuaire/publish
 * Publier une BAL dans l'annuaire
 */
router.post('/publish',
  requireDomainAdmin,
  [
    body('mailboxId')
      .isUUID()
      .withMessage('ID BAL requis'),
    body('visibility')
      .optional()
      .isIn(['public', 'restricted'])
      .withMessage('Visibilité invalide')
  ],
  validate,
  annuaireController.publish
);

/**
 * PUT /api/v1/annuaire/update/:mailboxId
 * Mettre à jour une publication
 */
router.put('/update/:mailboxId',
  requireDomainAdmin,
  [
    body('mailboxId')
      .isUUID()
      .withMessage('ID BAL requis')
  ],
  validate,
  annuaireController.updatePublication
);

/**
 * DELETE /api/v1/annuaire/unpublish/:mailboxId
 * Dépublier une BAL
 */
router.delete('/unpublish/:mailboxId',
  requireDomainAdmin,
  [
    query('mailboxId')
      .isUUID()
      .withMessage('ID BAL requis')
  ],
  validate,
  annuaireController.unpublish
);

/**
 * GET /api/v1/annuaire/publications
 * Liste des publications du domaine
 */
router.get('/publications',
  requirePermission('annuaire:read'),
  [
    query('status')
      .optional()
      .isIn(['pending', 'success', 'error', 'retry']),
    query('page')
      .optional()
      .isInt({ min: 1 }),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
  ],
  validate,
  annuaireController.listPublications
);

// ============================================
// SYNCHRONISATION
// ============================================

/**
 * POST /api/v1/annuaire/sync
 * Synchroniser les données avec l'annuaire
 */
router.post('/sync',
  requireDomainAdmin,
  [
    body('force')
      .optional()
      .isBoolean()
  ],
  validate,
  annuaireController.sync
);

/**
 * GET /api/v1/annuaire/sync/status
 * Statut de la dernière synchronisation
 */
router.get('/sync/status',
  requirePermission('annuaire:read'),
  annuaireController.getSyncStatus
);

/**
 * GET /api/v1/annuaire/sync/history
 * Historique des synchronisations
 */
router.get('/sync/history',
  requireDomainAdmin,
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 })
  ],
  validate,
  annuaireController.getSyncHistory
);

// ============================================
// INDICATEURS ANS
// ============================================

/**
 * GET /api/v1/annuaire/indicators
 * Récupérer les indicateurs du domaine
 */
router.get('/indicators',
  requireDomainAdmin,
  [
    query('period')
      .optional()
      .isIn(['day', 'week', 'month', 'quarter', 'year'])
  ],
  validate,
  annuaireController.getIndicators
);

/**
 * POST /api/v1/annuaire/indicators/submit
 * Soumettre les indicateurs à l'ANS
 */
router.post('/indicators/submit',
  requireDomainAdmin,
  [
    body('period')
      .matches(/^\d{4}-(0[1-9]|1[0-2])$/)
      .withMessage('Période invalide (format: YYYY-MM)')
  ],
  validate,
  annuaireController.submitIndicators
);

/**
 * GET /api/v1/annuaire/indicators/reports
 * Liste des comptes rendus ANS
 */
router.get('/indicators/reports',
  requireDomainAdmin,
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 })
  ],
  validate,
  annuaireController.getReports
);

/**
 * GET /api/v1/annuaire/indicators/reports/:id
 * Détails d'un compte rendu
 */
router.get('/indicators/reports/:id',
  requireDomainAdmin,
  [
    query('id').isUUID().withMessage('ID rapport invalide')
  ],
  validate,
  annuaireController.getReport
);

// ============================================
// SUPER ADMIN - GESTION GLOBALE
// ============================================

/**
 * GET /api/v1/annuaire/global/statistics
 * Statistiques globales annuaire (Super Admin)
 */
router.get('/global/statistics',
  requireSuperAdmin,
  annuaireController.getGlobalStatistics
);

/**
 * POST /api/v1/annuaire/global/sync
 * Synchronisation globale (Super Admin)
 */
router.post('/global/sync',
  requireSuperAdmin,
  annuaireController.globalSync
);

module.exports = router;