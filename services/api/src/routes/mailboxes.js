// services/api/src/routes/mailboxes.js
/**
 * Routes de gestion des boîtes aux lettres (BAL)
 */

const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');
const mailboxController = require('../controllers/mailboxController');
const { authenticate } = require('../middleware/auth');
const { domainContext } = require('../middleware/domainContext');
const { requirePermission, requireDomainAdmin } = require('../middleware/permissions');
const { checkQuota } = require('../middleware/quota');
const { validate } = require('../middleware/validation');

// Toutes les routes nécessitent l'authentification
router.use(authenticate);
router.use(domainContext);

// ============================================
// ROUTES BAL
// ============================================

/**
 * GET /api/v1/mailboxes
 * Liste des BAL du domaine
 */
router.get('/',
  requirePermission('mailboxes:read'),
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('search').optional().isString().trim(),
    query('type').optional().isIn(['PER', 'ORG', 'APP', 'BAL']),
    query('status').optional().isIn(['active', 'inactive', 'pending', 'suspended'])
  ],
  validate,
  mailboxController.list
);

/**
 * POST /api/v1/mailboxes
 * Créer une BAL
 */
router.post('/',
  requirePermission('mailboxes:create'),
  checkQuota,
  [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Email invalide'),
    body('type')
      .isIn(['PER', 'ORG', 'APP', 'BAL'])
      .withMessage('Type de BAL invalide (PER, ORG, APP, BAL)'),
    body('ownerRpps')
      .optional()
      .matches(/^\d{11}$/)
      .withMessage('RPPS invalide (11 chiffres)'),
    body('displayName')
      .optional()
      .trim()
      .isLength({ max: 255 })
      .withMessage('Nom d\'affichage trop long'),
    body('quotaMb')
      .optional()
      .isInt({ min: 100, max: 10240 })
      .withMessage('Quota invalide (100-10240 Mo)')
  ],
  validate,
  mailboxController.create
);

/**
 * GET /api/v1/mailboxes/:id
 * Récupérer une BAL
 */
router.get('/:id',
  requirePermission('mailboxes:read'),
  [
    param('id').isUUID().withMessage('ID BAL invalide')
  ],
  validate,
  mailboxController.get
);

/**
 * PUT /api/v1/mailboxes/:id
 * Mettre à jour une BAL
 */
router.put('/:id',
  requirePermission('mailboxes:update'),
  [
    param('id').isUUID().withMessage('ID BAL invalide'),
    body('displayName')
      .optional()
      .trim()
      .isLength({ max: 255 }),
    body('quotaMb')
      .optional()
      .isInt({ min: 100, max: 10240 }),
    body('autoReply')
      .optional()
      .isBoolean(),
    body('autoReplyMessage')
      .optional()
      .trim()
      .isLength({ max: 1000 })
  ],
  validate,
  mailboxController.update
);

/**
 * DELETE /api/v1/mailboxes/:id
 * Supprimer une BAL
 */
router.delete('/:id',
  requireDomainAdmin,
  [
    param('id').isUUID().withMessage('ID BAL invalide')
  ],
  validate,
  mailboxController.delete
);

// ============================================
// STATUT ET ACTIONS
// ============================================

/**
 * POST /api/v1/mailboxes/:id/suspend
 * Suspendre une BAL
 */
router.post('/:id/suspend',
  requireDomainAdmin,
  [
    param('id').isUUID().withMessage('ID BAL invalide'),
    body('reason')
      .optional()
      .trim()
      .isLength({ max: 500 })
  ],
  validate,
  mailboxController.suspend
);

/**
 * POST /api/v1/mailboxes/:id/activate
 * Réactiver une BAL
 */
router.post('/:id/activate',
  requireDomainAdmin,
  [
    param('id').isUUID().withMessage('ID BAL invalide')
  ],
  validate,
  mailboxController.activate
);

/**
 * GET /api/v1/mailboxes/:id/statistics
 * Statistiques d'une BAL
 */
router.get('/:id/statistics',
  requirePermission('mailboxes:read'),
  [
    param('id').isUUID().withMessage('ID BAL invalide'),
    query('period').optional().isIn(['day', 'week', 'month', 'year'])
  ],
  validate,
  mailboxController.getStatistics
);

// ============================================
// DÉLÉGATIONS
// ============================================

/**
 * GET /api/v1/mailboxes/:id/delegations
 * Liste des délégations d'une BAL
 */
router.get('/:id/delegations',
  requirePermission('mailboxes:read'),
  [
    param('id').isUUID().withMessage('ID BAL invalide')
  ],
  validate,
  mailboxController.listDelegations
);

/**
 * POST /api/v1/mailboxes/:id/delegations
 * Ajouter une délégation
 */
router.post('/:id/delegations',
  requirePermission('mailboxes:update'),
  [
    param('id').isUUID().withMessage('ID BAL invalide'),
    body('userId')
      .isUUID()
      .withMessage('ID utilisateur invalide'),
    body('role')
      .isIn(['read', 'write', 'manage', 'admin'])
      .withMessage('Rôle invalide'),
    body('expiresAt')
      .optional()
      .isISO8601()
      .withMessage('Date d\'expiration invalide')
  ],
  validate,
  mailboxController.addDelegation
);

/**
 * DELETE /api/v1/mailboxes/:id/delegations/:delegationId
 * Supprimer une délégation
 */
router.delete('/:id/delegations/:delegationId',
  requirePermission('mailboxes:update'),
  [
    param('id').isUUID().withMessage('ID BAL invalide'),
    param('delegationId').isUUID().withMessage('ID délégation invalide')
  ],
  validate,
  mailboxController.removeDelegation
);

// ============================================
// PUBLICATION ANNUAIRE
// ============================================

/**
 * POST /api/v1/mailboxes/:id/publish
 * Publier la BAL dans l'annuaire national
 */
router.post('/:id/publish',
  requireDomainAdmin,
  [
    param('id').isUUID().withMessage('ID BAL invalide')
  ],
  validate,
  mailboxController.publishToAnnuaire
);

/**
 * POST /api/v1/mailboxes/:id/unpublish
 * Dépublier la BAL de l'annuaire national
 */
router.post('/:id/unpublish',
  requireDomainAdmin,
  [
    param('id').isUUID().withMessage('ID BAL invalide')
  ],
  validate,
  mailboxController.unpublishFromAnnuaire
);

module.exports = router;