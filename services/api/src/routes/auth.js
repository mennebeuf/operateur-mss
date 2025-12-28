// services/api/src/routes/auth.js
/**
 * Routes d'authentification
 * - Authentification locale (JWT)
 * - Pro Santé Connect (OAuth2/OIDC)
 */

const express = require('express');
const router = express.Router();
const { body, query } = require('express-validator');
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validation');

// ============================================
// AUTHENTIFICATION LOCALE
// ============================================

/**
 * POST /api/v1/auth/login
 * Connexion avec email/mot de passe (administrateurs)
 */
router.post('/login',
  [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Email invalide'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Mot de passe requis (min 8 caractères)')
  ],
  validate,
  authController.login
);

/**
 * POST /api/v1/auth/logout
 * Déconnexion - Invalide le token
 */
router.post('/logout',
  authenticate,
  authController.logout
);

/**
 * POST /api/v1/auth/refresh
 * Rafraîchir le token d'accès
 */
router.post('/refresh',
  [
    body('refreshToken')
      .notEmpty()
      .withMessage('Refresh token requis')
  ],
  validate,
  authController.refresh
);

/**
 * POST /api/v1/auth/change-password
 * Changer le mot de passe
 */
router.post('/change-password',
  authenticate,
  [
    body('currentPassword')
      .notEmpty()
      .withMessage('Mot de passe actuel requis'),
    body('newPassword')
      .isLength({ min: 12 })
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      .withMessage('Le nouveau mot de passe doit contenir au moins 12 caractères, une majuscule, une minuscule, un chiffre et un caractère spécial')
  ],
  validate,
  authController.changePassword
);

/**
 * GET /api/v1/auth/me
 * Récupérer le profil de l'utilisateur connecté
 */
router.get('/me',
  authenticate,
  authController.me
);

// ============================================
// PRO SANTÉ CONNECT (OAuth2/OIDC)
// ============================================

/**
 * GET /api/v1/auth/psc/authorize
 * Initier l'authentification PSC
 * Redirige vers Pro Santé Connect
 */
router.get('/psc/authorize',
  [
    query('redirect_uri')
      .optional()
      .isURL()
      .withMessage('URL de redirection invalide')
  ],
  validate,
  authController.pscAuthorize
);

/**
 * GET /api/v1/auth/psc/callback
 * Callback après authentification PSC
 */
router.get('/psc/callback',
  [
    query('code')
      .notEmpty()
      .withMessage('Code d\'autorisation requis'),
    query('state')
      .notEmpty()
      .withMessage('State requis')
  ],
  validate,
  authController.pscCallback
);

/**
 * POST /api/v1/auth/psc/token
 * Échanger le code d'autorisation contre un token
 */
router.post('/psc/token',
  [
    body('code')
      .notEmpty()
      .withMessage('Code d\'autorisation requis'),
    body('state')
      .notEmpty()
      .withMessage('State requis')
  ],
  validate,
  authController.pscToken
);

/**
 * GET /api/v1/auth/psc/userinfo
 * Récupérer les informations utilisateur PSC
 */
router.get('/psc/userinfo',
  authenticate,
  authController.pscUserInfo
);

/**
 * POST /api/v1/auth/psc/logout
 * Déconnexion PSC (Single Logout)
 */
router.post('/psc/logout',
  authenticate,
  authController.pscLogout
);

module.exports = router;