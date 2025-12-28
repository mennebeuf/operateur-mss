// services/api/src/routes/admin/users.js
/**
 * Routes administration globale des utilisateurs (Super Admin)
 */

const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');
const adminUserController = require('../../controllers/admin/userController');
const { validate } = require('../../middleware/validation');

// ============================================
// GESTION GLOBALE DES UTILISATEURS
// ============================================

/**
 * GET /api/v1/admin/users
 * Liste de tous les utilisateurs (tous domaines)
 */
router.get('/',
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('search').optional().isString().trim(),
    query('domainId').optional().isUUID(),
    query('role').optional().isIn(['user', 'domain_admin', 'super_admin']),
    query('status').optional().isIn(['active', 'inactive', 'pending', 'locked']),
    query('sortBy').optional().isIn(['name', 'email', 'created', 'lastLogin']),
    query('sortOrder').optional().isIn(['asc', 'desc'])
  ],
  validate,
  adminUserController.list
);

/**
 * POST /api/v1/admin/users
 * Créer un utilisateur (Super Admin)
 */
router.post('/',
  [
    body('email')
      .isEmail()
      .normalizeEmail(),
    body('firstName')
      .notEmpty()
      .trim()
      .isLength({ min: 2, max: 100 }),
    body('lastName')
      .notEmpty()
      .trim()
      .isLength({ min: 2, max: 100 }),
    body('rppsId')
      .optional()
      .matches(/^\d{11}$/),
    body('domainId')
      .isUUID()
      .withMessage('Domaine requis'),
    body('role')
      .optional()
      .isIn(['user', 'domain_admin']),
    body('sendWelcomeEmail')
      .optional()
      .isBoolean()
  ],
  validate,
  adminUserController.create
);

/**
 * GET /api/v1/admin/users/:id
 * Détails complets d'un utilisateur
 */
router.get('/:id',
  [
    param('id').isUUID().withMessage('ID utilisateur invalide')
  ],
  validate,
  adminUserController.get
);

/**
 * PUT /api/v1/admin/users/:id
 * Modifier un utilisateur
 */
router.put('/:id',
  [
    param('id').isUUID().withMessage('ID utilisateur invalide'),
    body('firstName')
      .optional()
      .trim()
      .isLength({ min: 2, max: 100 }),
    body('lastName')
      .optional()
      .trim()
      .isLength({ min: 2, max: 100 }),
    body('role')
      .optional()
      .isIn(['user', 'domain_admin']),
    body('status')
      .optional()
      .isIn(['active', 'inactive'])
  ],
  validate,
  adminUserController.update
);

/**
 * DELETE /api/v1/admin/users/:id
 * Supprimer un utilisateur
 */
router.delete('/:id',
  [
    param('id').isUUID().withMessage('ID utilisateur invalide'),
    query('permanent')
      .optional()
      .isBoolean()
  ],
  validate,
  adminUserController.delete
);

// ============================================
// ACTIONS SUR UTILISATEURS
// ============================================

/**
 * POST /api/v1/admin/users/:id/lock
 * Verrouiller un compte utilisateur
 */
router.post('/:id/lock',
  [
    param('id').isUUID().withMessage('ID utilisateur invalide'),
    body('reason')
      .optional()
      .trim()
      .isLength({ max: 500 })
  ],
  validate,
  adminUserController.lock
);

/**
 * POST /api/v1/admin/users/:id/unlock
 * Déverrouiller un compte utilisateur
 */
router.post('/:id/unlock',
  [
    param('id').isUUID().withMessage('ID utilisateur invalide')
  ],
  validate,
  adminUserController.unlock
);

/**
 * POST /api/v1/admin/users/:id/reset-password
 * Réinitialiser le mot de passe
 */
router.post('/:id/reset-password',
  [
    param('id').isUUID().withMessage('ID utilisateur invalide'),
    body('sendEmail')
      .optional()
      .isBoolean()
  ],
  validate,
  adminUserController.resetPassword
);

/**
 * POST /api/v1/admin/users/:id/force-logout
 * Forcer la déconnexion
 */
router.post('/:id/force-logout',
  [
    param('id').isUUID().withMessage('ID utilisateur invalide')
  ],
  validate,
  adminUserController.forceLogout
);

/**
 * POST /api/v1/admin/users/:id/change-domain
 * Transférer un utilisateur vers un autre domaine
 */
router.post('/:id/change-domain',
  [
    param('id').isUUID().withMessage('ID utilisateur invalide'),
    body('newDomainId')
      .isUUID()
      .withMessage('Nouveau domaine requis'),
    body('transferMailboxes')
      .optional()
      .isBoolean()
  ],
  validate,
  adminUserController.changeDomain
);

// ============================================
// RÔLES ET PERMISSIONS
// ============================================

/**
 * POST /api/v1/admin/users/:id/promote
 * Promouvoir en admin domaine
 */
router.post('/:id/promote',
  [
    param('id').isUUID().withMessage('ID utilisateur invalide'),
    body('role')
      .isIn(['domain_admin'])
      .withMessage('Rôle invalide')
  ],
  validate,
  adminUserController.promote
);

/**
 * POST /api/v1/admin/users/:id/demote
 * Rétrograder un admin
 */
router.post('/:id/demote',
  [
    param('id').isUUID().withMessage('ID utilisateur invalide')
  ],
  validate,
  adminUserController.demote
);

// ============================================
// STATISTIQUES ET ACTIVITÉ
// ============================================

/**
 * GET /api/v1/admin/users/:id/activity
 * Historique d'activité d'un utilisateur
 */
router.get('/:id/activity',
  [
    param('id').isUUID().withMessage('ID utilisateur invalide'),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('from').optional().isISO8601(),
    query('to').optional().isISO8601()
  ],
  validate,
  adminUserController.getActivity
);

/**
 * GET /api/v1/admin/users/:id/sessions
 * Sessions actives d'un utilisateur
 */
router.get('/:id/sessions',
  [
    param('id').isUUID().withMessage('ID utilisateur invalide')
  ],
  validate,
  adminUserController.getSessions
);

/**
 * DELETE /api/v1/admin/users/:id/sessions
 * Terminer toutes les sessions
 */
router.delete('/:id/sessions',
  [
    param('id').isUUID().withMessage('ID utilisateur invalide')
  ],
  validate,
  adminUserController.terminateSessions
);

/**
 * GET /api/v1/admin/users/statistics
 * Statistiques globales utilisateurs
 */
router.get('/statistics',
  adminUserController.getStatistics
);

module.exports = router;