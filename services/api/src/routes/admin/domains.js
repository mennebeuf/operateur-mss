// services/api/src/routes/admin/domains.js
/**
 * Routes administration des domaines (Super Admin)
 */

const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');
const adminDomainController = require('../../controllers/admin/domainController');
const { validate } = require('../../middleware/validation');

// ============================================
// GESTION DES DOMAINES
// ============================================

/**
 * GET /api/v1/admin/domains
 * Liste complète des domaines
 */
router.get('/',
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('search').optional().isString().trim(),
    query('status').optional().isIn(['active', 'inactive', 'pending', 'suspended']),
    query('sortBy').optional().isIn(['name', 'created', 'mailboxCount', 'storage']),
    query('sortOrder').optional().isIn(['asc', 'desc'])
  ],
  validate,
  adminDomainController.list
);

/**
 * POST /api/v1/admin/domains
 * Créer un nouveau domaine
 */
router.post('/',
  [
    body('domainName')
      .matches(/^[a-z0-9-]+\.mssante\.fr$/)
      .withMessage('Format de domaine invalide'),
    body('organizationName')
      .notEmpty()
      .trim()
      .isLength({ max: 255 }),
    body('organizationType')
      .isIn(['hospital', 'clinic', 'lab', 'pharmacy', 'other']),
    body('finessJuridique')
      .optional()
      .matches(/^\d{9}$/),
    body('siret')
      .optional()
      .matches(/^\d{14}$/),
    body('contactEmail')
      .isEmail(),
    body('contactPhone')
      .optional()
      .matches(/^(\+33|0)[1-9](\d{2}){4}$/),
    body('quotas')
      .optional()
      .isObject(),
    body('quotas.maxMailboxes')
      .optional()
      .isInt({ min: 1, max: 10000 }),
    body('quotas.maxStorageGb')
      .optional()
      .isInt({ min: 1, max: 1000 })
  ],
  validate,
  adminDomainController.create
);

/**
 * GET /api/v1/admin/domains/:id
 * Détails complets d'un domaine
 */
router.get('/:id',
  [
    param('id').isUUID().withMessage('ID domaine invalide')
  ],
  validate,
  adminDomainController.get
);

/**
 * PUT /api/v1/admin/domains/:id
 * Modifier un domaine
 */
router.put('/:id',
  [
    param('id').isUUID().withMessage('ID domaine invalide'),
    body('organizationName')
      .optional()
      .trim()
      .isLength({ max: 255 }),
    body('contactEmail')
      .optional()
      .isEmail(),
    body('settings')
      .optional()
      .isObject()
  ],
  validate,
  adminDomainController.update
);

/**
 * DELETE /api/v1/admin/domains/:id
 * Supprimer un domaine (soft delete)
 */
router.delete('/:id',
  [
    param('id').isUUID().withMessage('ID domaine invalide'),
    query('confirm')
      .equals('true')
      .withMessage('Confirmation requise')
  ],
  validate,
  adminDomainController.delete
);

// ============================================
// ACTIONS SUR DOMAINES
// ============================================

/**
 * POST /api/v1/admin/domains/:id/suspend
 * Suspendre un domaine
 */
router.post('/:id/suspend',
  [
    param('id').isUUID().withMessage('ID domaine invalide'),
    body('reason')
      .notEmpty()
      .trim()
      .isLength({ max: 500 })
  ],
  validate,
  adminDomainController.suspend
);

/**
 * POST /api/v1/admin/domains/:id/activate
 * Activer/réactiver un domaine
 */
router.post('/:id/activate',
  [
    param('id').isUUID().withMessage('ID domaine invalide')
  ],
  validate,
  adminDomainController.activate
);

/**
 * PUT /api/v1/admin/domains/:id/quotas
 * Modifier les quotas d'un domaine
 */
router.put('/:id/quotas',
  [
    param('id').isUUID().withMessage('ID domaine invalide'),
    body('maxMailboxes')
      .optional()
      .isInt({ min: 1, max: 10000 }),
    body('maxStorageGb')
      .optional()
      .isInt({ min: 1, max: 1000 }),
    body('maxUsersPerMailbox')
      .optional()
      .isInt({ min: 1, max: 100 })
  ],
  validate,
  adminDomainController.updateQuotas
);

// ============================================
// STATISTIQUES ET RAPPORTS
// ============================================

/**
 * GET /api/v1/admin/domains/:id/statistics
 * Statistiques détaillées d'un domaine
 */
router.get('/:id/statistics',
  [
    param('id').isUUID().withMessage('ID domaine invalide'),
    query('period').optional().isIn(['day', 'week', 'month', 'year'])
  ],
  validate,
  adminDomainController.getStatistics
);

/**
 * GET /api/v1/admin/domains/:id/usage
 * Utilisation des ressources
 */
router.get('/:id/usage',
  [
    param('id').isUUID().withMessage('ID domaine invalide')
  ],
  validate,
  adminDomainController.getUsage
);

/**
 * GET /api/v1/admin/domains/statistics/global
 * Statistiques globales tous domaines
 */
router.get('/statistics/global',
  adminDomainController.getGlobalStatistics
);

// ============================================
// GESTION DES ADMINISTRATEURS
// ============================================

/**
 * GET /api/v1/admin/domains/:id/admins
 * Liste des administrateurs d'un domaine
 */
router.get('/:id/admins',
  [
    param('id').isUUID().withMessage('ID domaine invalide')
  ],
  validate,
  adminDomainController.listAdmins
);

/**
 * POST /api/v1/admin/domains/:id/admins
 * Ajouter un administrateur au domaine
 */
router.post('/:id/admins',
  [
    param('id').isUUID().withMessage('ID domaine invalide'),
    body('userId')
      .isUUID()
      .withMessage('ID utilisateur invalide')
  ],
  validate,
  adminDomainController.addAdmin
);

/**
 * DELETE /api/v1/admin/domains/:id/admins/:userId
 * Retirer un administrateur
 */
router.delete('/:id/admins/:userId',
  [
    param('id').isUUID().withMessage('ID domaine invalide'),
    param('userId').isUUID().withMessage('ID utilisateur invalide')
  ],
  validate,
  adminDomainController.removeAdmin
);

module.exports = router;