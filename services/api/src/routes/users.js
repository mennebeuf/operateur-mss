// services/api/src/routes/users.js
/**
 * Routes de gestion des utilisateurs
 */

const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');
const userController = require('../controllers/userController');
const { authenticate } = require('../middleware/auth');
const { domainContext } = require('../middleware/domainContext');
const { requirePermission, requireDomainAdmin } = require('../middleware/permissions');
const { validate } = require('../middleware/validation');

// Toutes les routes nécessitent l'authentification
router.use(authenticate);
router.use(domainContext);

// ============================================
// ROUTES UTILISATEURS
// ============================================

/**
 * GET /api/v1/users
 * Liste des utilisateurs du domaine
 */
router.get('/',
  requirePermission('users:read'),
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('search').optional().isString().trim(),
    query('role').optional().isString(),
    query('status').optional().isIn(['active', 'inactive', 'pending'])
  ],
  validate,
  userController.list
);

/**
 * POST /api/v1/users
 * Créer un utilisateur
 */
router.post('/',
  requirePermission('users:create'),
  [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Email invalide'),
    body('firstName')
      .notEmpty()
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage('Prénom requis (2-100 caractères)'),
    body('lastName')
      .notEmpty()
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage('Nom requis (2-100 caractères)'),
    body('rppsId')
      .optional()
      .matches(/^\d{11}$/)
      .withMessage('RPPS invalide (11 chiffres)'),
    body('role')
      .optional()
      .isIn(['user', 'domain_admin'])
      .withMessage('Rôle invalide')
  ],
  validate,
  userController.create
);

/**
 * GET /api/v1/users/:id
 * Récupérer un utilisateur
 */
router.get('/:id',
  requirePermission('users:read'),
  [
    param('id').isUUID().withMessage('ID utilisateur invalide')
  ],
  validate,
  userController.get
);

/**
 * PUT /api/v1/users/:id
 * Mettre à jour un utilisateur
 */
router.put('/:id',
  requirePermission('users:update'),
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
  userController.update
);

/**
 * DELETE /api/v1/users/:id
 * Supprimer (désactiver) un utilisateur
 */
router.delete('/:id',
  requireDomainAdmin,
  [
    param('id').isUUID().withMessage('ID utilisateur invalide')
  ],
  validate,
  userController.remove
);

/**
 * POST /api/v1/users/:id/activate
 * Activer un utilisateur
 */
router.post('/:id/activate',
  requireDomainAdmin,
  [
    param('id').isUUID().withMessage('ID utilisateur invalide')
  ],
  validate,
  userController.activate
);

/**
 * POST /api/v1/users/:id/deactivate
 * Désactiver un utilisateur
 */
router.post('/:id/deactivate',
  requireDomainAdmin,
  [
    param('id').isUUID().withMessage('ID utilisateur invalide')
  ],
  validate,
  userController.deactivate
);

/**
 * GET /api/v1/users/:id/mailboxes
 * Liste des BAL de l'utilisateur
 */
router.get('/:id/mailboxes',
  requirePermission('users:read'),
  [
    param('id').isUUID().withMessage('ID utilisateur invalide')
  ],
  validate,
  userController.getMailboxes
);

/**
 * POST /api/v1/users/:id/reset-password
 * Réinitialiser le mot de passe d'un utilisateur
 */
router.post('/:id/reset-password',
  requireDomainAdmin,
  [
    param('id').isUUID().withMessage('ID utilisateur invalide')
  ],
  validate,
  userController.resetPassword
);

module.exports = router;