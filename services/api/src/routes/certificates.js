// services/api/src/routes/certificates.js
/**
 * Routes de gestion des certificats IGC Santé
 */

const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');
const multer = require('multer');
const certificateController = require('../controllers/certificateController');
const { authenticate } = require('../middleware/auth');
const { domainContext } = require('../middleware/domainContext');
const { requirePermission, requireDomainAdmin, requireSuperAdmin } = require('../middleware/permissions');
const { validate } = require('../middleware/validation');

// Configuration upload
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max
    files: 2 // certificat + clé privée
  },
  fileFilter: (req, file, cb) => {
    const allowed = ['.pem', '.crt', '.cer', '.key', '.p12', '.pfx'];
    const ext = file.originalname.toLowerCase().slice(file.originalname.lastIndexOf('.'));
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Type de fichier non autorisé'));
    }
  }
});

// Toutes les routes nécessitent l'authentification
router.use(authenticate);
router.use(domainContext);

// ============================================
// ROUTES CERTIFICATS
// ============================================

/**
 * GET /api/v1/certificates
 * Liste des certificats du domaine
 */
router.get('/',
  requirePermission('certificates:read'),
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('type').optional().isIn(['SERV_SSL', 'ORG_AUTH_CLI', 'ORG_SIGN', 'ORG_CONF']),
    query('status').optional().isIn(['active', 'expired', 'revoked', 'pending']),
    query('expiringDays').optional().isInt({ min: 1, max: 365 })
  ],
  validate,
  certificateController.list
);

/**
 * POST /api/v1/certificates/upload
 * Uploader un certificat
 */
router.post('/upload',
  requireDomainAdmin,
  upload.fields([
    { name: 'certificate', maxCount: 1 },
    { name: 'privateKey', maxCount: 1 }
  ]),
  [
    body('type')
      .isIn(['SERV_SSL', 'ORG_AUTH_CLI', 'ORG_SIGN', 'ORG_CONF'])
      .withMessage('Type de certificat invalide'),
    body('mailboxId')
      .optional()
      .isUUID()
      .withMessage('ID BAL invalide'),
    body('passphrase')
      .optional()
      .isString()
  ],
  validate,
  certificateController.upload
);

/**
 * GET /api/v1/certificates/:id
 * Récupérer un certificat
 */
router.get('/:id',
  requirePermission('certificates:read'),
  [
    param('id').isUUID().withMessage('ID certificat invalide')
  ],
  validate,
  certificateController.get
);

/**
 * DELETE /api/v1/certificates/:id
 * Supprimer un certificat
 */
router.delete('/:id',
  requireDomainAdmin,
  [
    param('id').isUUID().withMessage('ID certificat invalide')
  ],
  validate,
  certificateController.delete
);

// ============================================
// VÉRIFICATION ET VALIDATION
// ============================================

/**
 * POST /api/v1/certificates/verify
 * Vérifier un certificat (sans l'importer)
 */
router.post('/verify',
  requirePermission('certificates:read'),
  upload.single('certificate'),
  certificateController.verify
);

/**
 * GET /api/v1/certificates/:id/chain
 * Récupérer la chaîne de certificats
 */
router.get('/:id/chain',
  requirePermission('certificates:read'),
  [
    param('id').isUUID().withMessage('ID certificat invalide')
  ],
  validate,
  certificateController.getChain
);

/**
 * GET /api/v1/certificates/:id/validate
 * Valider un certificat (vérification complète IGC)
 */
router.get('/:id/validate',
  requirePermission('certificates:read'),
  [
    param('id').isUUID().withMessage('ID certificat invalide')
  ],
  validate,
  certificateController.validateCertificate
);

// ============================================
// ACTIONS SUR CERTIFICATS
// ============================================

/**
 * POST /api/v1/certificates/:id/revoke
 * Révoquer un certificat
 */
router.post('/:id/revoke',
  requireDomainAdmin,
  [
    param('id').isUUID().withMessage('ID certificat invalide'),
    body('reason')
      .isIn(['keyCompromise', 'cessationOfOperation', 'superseded', 'affiliationChanged'])
      .withMessage('Raison de révocation invalide')
  ],
  validate,
  certificateController.revoke
);

/**
 * POST /api/v1/certificates/:id/renew
 * Initier le renouvellement d'un certificat
 */
router.post('/:id/renew',
  requireDomainAdmin,
  [
    param('id').isUUID().withMessage('ID certificat invalide')
  ],
  validate,
  certificateController.initiateRenewal
);

/**
 * GET /api/v1/certificates/:id/download
 * Télécharger un certificat (public uniquement)
 */
router.get('/:id/download',
  requirePermission('certificates:read'),
  [
    param('id').isUUID().withMessage('ID certificat invalide'),
    query('format').optional().isIn(['pem', 'der', 'p7b'])
  ],
  validate,
  certificateController.download
);

// ============================================
// ALERTES ET MONITORING
// ============================================

/**
 * GET /api/v1/certificates/expiring
 * Liste des certificats arrivant à expiration
 */
router.get('/expiring',
  requirePermission('certificates:read'),
  [
    query('days')
      .optional()
      .isInt({ min: 1, max: 365 })
      .withMessage('Nombre de jours invalide')
  ],
  validate,
  certificateController.getExpiring
);

/**
 * POST /api/v1/certificates/:id/alert
 * Configurer les alertes pour un certificat
 */
router.post('/:id/alert',
  requireDomainAdmin,
  [
    param('id').isUUID().withMessage('ID certificat invalide'),
    body('alertDays')
      .isArray()
      .withMessage('alertDays doit être un tableau'),
    body('alertDays.*')
      .isInt({ min: 1, max: 365 })
      .withMessage('Jours d\'alerte invalides'),
    body('recipients')
      .isArray()
      .withMessage('recipients doit être un tableau'),
    body('recipients.*')
      .isEmail()
      .withMessage('Email invalide')
  ],
  validate,
  certificateController.configureAlert
);

// ============================================
// SUPER ADMIN - GESTION GLOBALE
// ============================================

/**
 * GET /api/v1/certificates/all
 * Liste tous les certificats (Super Admin)
 */
router.get('/all',
  requireSuperAdmin,
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('domainId').optional().isUUID()
  ],
  validate,
  certificateController.listAll
);

module.exports = router;