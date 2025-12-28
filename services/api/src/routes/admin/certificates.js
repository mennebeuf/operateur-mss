// services/api/src/routes/admin/certificates.js
/**
 * Routes administration globale des certificats (Super Admin)
 */

const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');
const multer = require('multer');
const adminCertificateController = require('../../controllers/admin/certificateController');
const { validate } = require('../../middleware/validation');

// Configuration upload
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }
});

// ============================================
// GESTION GLOBALE DES CERTIFICATS
// ============================================

/**
 * GET /api/v1/admin/certificates
 * Liste de tous les certificats (tous domaines)
 */
router.get('/',
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('domainId').optional().isUUID(),
    query('type').optional().isIn(['SERV_SSL', 'ORG_AUTH_CLI', 'ORG_SIGN', 'ORG_CONF']),
    query('status').optional().isIn(['active', 'expired', 'revoked', 'pending']),
    query('expiringDays').optional().isInt({ min: 1, max: 365 }),
    query('sortBy').optional().isIn(['expires', 'created', 'domain']),
    query('sortOrder').optional().isIn(['asc', 'desc'])
  ],
  validate,
  adminCertificateController.list
);

/**
 * GET /api/v1/admin/certificates/:id
 * Détails complets d'un certificat
 */
router.get('/:id',
  [
    param('id').isUUID().withMessage('ID certificat invalide')
  ],
  validate,
  adminCertificateController.get
);

/**
 * DELETE /api/v1/admin/certificates/:id
 * Supprimer un certificat
 */
router.delete('/:id',
  [
    param('id').isUUID().withMessage('ID certificat invalide'),
    query('confirm').equals('true').withMessage('Confirmation requise')
  ],
  validate,
  adminCertificateController.delete
);

// ============================================
// CERTIFICATS EXPIRATION
// ============================================

/**
 * GET /api/v1/admin/certificates/expiring
 * Liste des certificats en expiration proche
 */
router.get('/expiring',
  [
    query('days')
      .optional()
      .isInt({ min: 1, max: 365 })
      .withMessage('Nombre de jours invalide'),
    query('domainId').optional().isUUID()
  ],
  validate,
  adminCertificateController.getExpiring
);

/**
 * GET /api/v1/admin/certificates/expired
 * Liste des certificats expirés
 */
router.get('/expired',
  [
    query('domainId').optional().isUUID(),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 })
  ],
  validate,
  adminCertificateController.getExpired
);

// ============================================
// ACTIONS SUR CERTIFICATS
// ============================================

/**
 * POST /api/v1/admin/certificates/:id/revoke
 * Révoquer un certificat
 */
router.post('/:id/revoke',
  [
    param('id').isUUID().withMessage('ID certificat invalide'),
    body('reason')
      .isIn(['keyCompromise', 'cessationOfOperation', 'superseded', 'affiliationChanged', 'adminAction'])
      .withMessage('Raison de révocation invalide'),
    body('comment')
      .optional()
      .trim()
      .isLength({ max: 500 })
  ],
  validate,
  adminCertificateController.revoke
);

/**
 * POST /api/v1/admin/certificates/bulk-revoke
 * Révocation en masse
 */
router.post('/bulk-revoke',
  [
    body('certificateIds')
      .isArray({ min: 1 })
      .withMessage('Liste de certificats requise'),
    body('certificateIds.*')
      .isUUID()
      .withMessage('ID certificat invalide'),
    body('reason')
      .isIn(['keyCompromise', 'cessationOfOperation', 'superseded', 'affiliationChanged', 'adminAction'])
  ],
  validate,
  adminCertificateController.bulkRevoke
);

// ============================================
// CERTIFICATS RACINE IGC SANTÉ
// ============================================

/**
 * GET /api/v1/admin/certificates/root-ca
 * Liste des certificats racine IGC Santé
 */
router.get('/root-ca',
  adminCertificateController.listRootCA
);

/**
 * POST /api/v1/admin/certificates/root-ca
 * Ajouter un certificat racine
 */
router.post('/root-ca',
  upload.single('certificate'),
  [
    body('name')
      .notEmpty()
      .trim()
      .isLength({ max: 255 })
  ],
  validate,
  adminCertificateController.addRootCA
);

/**
 * DELETE /api/v1/admin/certificates/root-ca/:id
 * Supprimer un certificat racine
 */
router.delete('/root-ca/:id',
  [
    param('id').isUUID().withMessage('ID certificat invalide')
  ],
  validate,
  adminCertificateController.removeRootCA
);

/**
 * POST /api/v1/admin/certificates/root-ca/sync
 * Synchroniser les certificats racine IGC
 */
router.post('/root-ca/sync',
  adminCertificateController.syncRootCA
);

// ============================================
// CRL (Certificate Revocation List)
// ============================================

/**
 * GET /api/v1/admin/certificates/crl
 * Liste des CRL configurées
 */
router.get('/crl',
  adminCertificateController.listCRL
);

/**
 * POST /api/v1/admin/certificates/crl/refresh
 * Forcer la mise à jour des CRL
 */
router.post('/crl/refresh',
  adminCertificateController.refreshCRL
);

/**
 * GET /api/v1/admin/certificates/crl/status
 * Statut des CRL
 */
router.get('/crl/status',
  adminCertificateController.getCRLStatus
);

// ============================================
// STATISTIQUES ET RAPPORTS
// ============================================

/**
 * GET /api/v1/admin/certificates/statistics
 * Statistiques globales des certificats
 */
router.get('/statistics',
  adminCertificateController.getStatistics
);

/**
 * GET /api/v1/admin/certificates/report
 * Rapport complet certificats
 */
router.get('/report',
  [
    query('format')
      .optional()
      .isIn(['json', 'csv', 'pdf']),
    query('domainId').optional().isUUID()
  ],
  validate,
  adminCertificateController.generateReport
);

// ============================================
// ALERTES
// ============================================

/**
 * GET /api/v1/admin/certificates/alerts
 * Liste des alertes certificats
 */
router.get('/alerts',
  [
    query('status')
      .optional()
      .isIn(['active', 'acknowledged', 'resolved'])
  ],
  validate,
  adminCertificateController.getAlerts
);

/**
 * PUT /api/v1/admin/certificates/alerts/config
 * Configuration des alertes
 */
router.put('/alerts/config',
  [
    body('alertDays')
      .isArray()
      .withMessage('alertDays doit être un tableau'),
    body('alertDays.*')
      .isInt({ min: 1, max: 365 }),
    body('recipients')
      .isArray(),
    body('recipients.*')
      .isEmail()
  ],
  validate,
  adminCertificateController.configureAlerts
);

module.exports = router;