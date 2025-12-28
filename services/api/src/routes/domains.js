// services/api/src/routes/domains.js
/**
 * Routes de gestion des domaines
 * Support multi-tenant
 */

const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');
const domainController = require('../controllers/domainController');
const { authenticate } = require('../middleware/auth');
const { requireSuperAdmin, requireDomainAdmin } = require('../middleware/permissions');
const { validate } = require('../middleware/validation');

// Toutes les routes nécessitent l'authentification
router.use(authenticate);

// ============================================
// ROUTES DOMAINES
// ============================================

/**
 * GET /api/v1/domains
 * Liste des domaines (Super Admin: tous, Domain Admin: seulement le sien)
 */
router.get('/',
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('search').optional().isString().trim(),
    query('status').optional().isIn(['active', 'inactive', 'pending', 'suspended']),
    query('type').optional().isIn(['hospital', 'clinic', 'lab', 'pharmacy', 'other'])
  ],
  validate,
  domainController.list
);

/**
 * POST /api/v1/domains
 * Créer un domaine (Super Admin uniquement)
 */
router.post('/',
  requireSuperAdmin,
  [
    body('domainName')
      .matches(/^[a-z0-9-]+\.mssante\.fr$/)
      .withMessage('Nom de domaine invalide (format: xxx.mssante.fr)'),
    body('organizationName')
      .notEmpty()
      .trim()
      .isLength({ min: 2, max: 255 })
      .withMessage('Nom de l\'organisation requis'),
    body('organizationType')
      .isIn(['hospital', 'clinic', 'lab', 'pharmacy', 'other'])
      .withMessage('Type d\'organisation invalide'),
    body('finessJuridique')
      .optional()
      .matches(/^\d{9}$/)
      .withMessage('FINESS juridique invalide (9 chiffres)'),
    body('siret')
      .optional()
      .matches(/^\d{14}$/)
      .withMessage('SIRET invalide (14 chiffres)'),
    body('quotas')
      .optional()
      .isObject()
      .withMessage('Quotas doivent être un objet'),
    body('quotas.maxMailboxes')
      .optional()
      .isInt({ min: 1, max: 10000 }),
    body('quotas.maxStorageGb')
      .optional()
      .isInt({ min: 1, max: 1000 }),
    body('quotas.maxUsersPerMailbox')
      .optional()
      .isInt({ min: 1, max: 100 })
  ],
  validate,
  domainController.create
);

/**
 * GET /api/v1/domains/:id
 * Récupérer un domaine
 */
router.get('/:id',
  [
    param('id').isUUID().withMessage('ID domaine invalide')
  ],
  validate,
  domainController.get
);

/**
 * PUT /api/v1/domains/:id
 * Mettre à jour un domaine
 */
router.put('/:id',
  requireDomainAdmin,
  [
    param('id').isUUID().withMessage('ID domaine invalide'),
    body('organizationName')
      .optional()
      .trim()
      .isLength({ min: 2, max: 255 }),
    body('contactEmail')
      .optional()
      .isEmail(),
    body('contactPhone')
      .optional()
      .matches(/^(\+33|0)[1-9](\d{2}){4}$/),
    body('settings')
      .optional()
      .isObject()
  ],
  validate,
  domainController.update
);

/**
 * DELETE /api/v1/domains/:id
 * Supprimer un domaine (Super Admin uniquement)
 */
router.delete('/:id',
  requireSuperAdmin,
  [
    param('id').isUUID().withMessage('ID domaine invalide')
  ],
  validate,
  domainController.delete
);

// ============================================
// STATUT ET ACTIONS
// ============================================

/**
 * POST /api/v1/domains/:id/suspend
 * Suspendre un domaine (Super Admin uniquement)
 */
router.post('/:id/suspend',
  requireSuperAdmin,
  [
    param('id').isUUID().withMessage('ID domaine invalide'),
    body('reason')
      .optional()
      .trim()
      .isLength({ max: 500 })
  ],
  validate,
  domainController.suspend
);

/**
 * POST /api/v1/domains/:id/activate
 * Activer un domaine (Super Admin uniquement)
 */
router.post('/:id/activate',
  requireSuperAdmin,
  [
    param('id').isUUID().withMessage('ID domaine invalide')
  ],
  validate,
  domainController.activate
);

// ============================================
// STATISTIQUES ET QUOTAS
// ============================================

/**
 * GET /api/v1/domains/:id/statistics
 * Statistiques du domaine
 */
router.get('/:id/statistics',
  requireDomainAdmin,
  [
    param('id').isUUID().withMessage('ID domaine invalide'),
    query('period').optional().isIn(['day', 'week', 'month', 'year'])
  ],
  validate,
  domainController.getStatistics
);

/**
 * GET /api/v1/domains/:id/usage
 * Utilisation des quotas du domaine
 */
router.get('/:id/usage',
  requireDomainAdmin,
  [
    param('id').isUUID().withMessage('ID domaine invalide')
  ],
  validate,
  domainController.getUsage
);

/**
 * PUT /api/v1/domains/:id/quotas
 * Modifier les quotas (Super Admin uniquement)
 */
router.put('/:id/quotas',
  requireSuperAdmin,
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
  domainController.updateQuotas
);

// ============================================
// CERTIFICATS DU DOMAINE
// ============================================

/**
 * GET /api/v1/domains/:id/certificates
 * Liste des certificats du domaine
 */
router.get('/:id/certificates',
  requireDomainAdmin,
  [
    param('id').isUUID().withMessage('ID domaine invalide')
  ],
  validate,
  domainController.getCertificates
);

// ============================================
// UTILISATEURS DU DOMAINE
// ============================================

/**
 * GET /api/v1/domains/:id/users
 * Liste des utilisateurs du domaine
 */
router.get('/:id/users',
  requireDomainAdmin,
  [
    param('id').isUUID().withMessage('ID domaine invalide'),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 })
  ],
  validate,
  domainController.getUsers
);

/**
 * GET /api/v1/domains/:id/mailboxes
 * Liste des BAL du domaine
 */
router.get('/:id/mailboxes',
  requireDomainAdmin,
  [
    param('id').isUUID().withMessage('ID domaine invalide'),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 })
  ],
  validate,
  domainController.getMailboxes
);

module.exports = router;