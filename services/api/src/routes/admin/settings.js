// services/api/src/routes/admin/settings.js
/**
 * Routes configuration système (Super Admin)
 */

const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');
const adminSettingsController = require('../../controllers/admin/settingsController');
const { validate } = require('../../middleware/validation');

// ============================================
// CONFIGURATION GÉNÉRALE
// ============================================

/**
 * GET /api/v1/admin/settings
 * Récupérer la configuration système
 */
router.get('/',
  adminSettingsController.get
);

/**
 * PUT /api/v1/admin/settings
 * Modifier la configuration système
 */
router.put('/',
  [
    body('settings')
      .isObject()
      .withMessage('Settings doit être un objet')
  ],
  validate,
  adminSettingsController.update
);

// ============================================
// CONFIGURATION EMAIL
// ============================================

/**
 * GET /api/v1/admin/settings/email
 * Configuration des services email
 */
router.get('/email',
  adminSettingsController.getEmailConfig
);

/**
 * PUT /api/v1/admin/settings/email
 * Modifier la configuration email
 */
router.put('/email',
  [
    body('smtp')
      .optional()
      .isObject(),
    body('smtp.host')
      .optional()
      .isString(),
    body('smtp.port')
      .optional()
      .isInt({ min: 1, max: 65535 }),
    body('smtp.secure')
      .optional()
      .isBoolean(),
    body('imap')
      .optional()
      .isObject(),
    body('quotaDefault')
      .optional()
      .isInt({ min: 100, max: 10240 }),
    body('maxAttachmentSize')
      .optional()
      .isInt({ min: 1, max: 100 })
  ],
  validate,
  adminSettingsController.updateEmailConfig
);

/**
 * POST /api/v1/admin/settings/email/test
 * Tester la configuration email
 */
router.post('/email/test',
  [
    body('testEmail')
      .isEmail()
      .withMessage('Email de test requis')
  ],
  validate,
  adminSettingsController.testEmailConfig
);

// ============================================
// CONFIGURATION SÉCURITÉ
// ============================================

/**
 * GET /api/v1/admin/settings/security
 * Configuration de sécurité
 */
router.get('/security',
  adminSettingsController.getSecurityConfig
);

/**
 * PUT /api/v1/admin/settings/security
 * Modifier la configuration de sécurité
 */
router.put('/security',
  [
    body('passwordPolicy')
      .optional()
      .isObject(),
    body('passwordPolicy.minLength')
      .optional()
      .isInt({ min: 8, max: 128 }),
    body('passwordPolicy.requireUppercase')
      .optional()
      .isBoolean(),
    body('passwordPolicy.requireNumbers')
      .optional()
      .isBoolean(),
    body('passwordPolicy.requireSpecial')
      .optional()
      .isBoolean(),
    body('passwordPolicy.expirationDays')
      .optional()
      .isInt({ min: 0, max: 365 }),
    body('sessionTimeout')
      .optional()
      .isInt({ min: 300, max: 86400 }),
    body('maxLoginAttempts')
      .optional()
      .isInt({ min: 3, max: 10 }),
    body('lockoutDuration')
      .optional()
      .isInt({ min: 60, max: 86400 }),
    body('mfaRequired')
      .optional()
      .isBoolean()
  ],
  validate,
  adminSettingsController.updateSecurityConfig
);

// ============================================
// CONFIGURATION PRO SANTÉ CONNECT
// ============================================

/**
 * GET /api/v1/admin/settings/psc
 * Configuration Pro Santé Connect
 */
router.get('/psc',
  adminSettingsController.getPSCConfig
);

/**
 * PUT /api/v1/admin/settings/psc
 * Modifier la configuration PSC
 */
router.put('/psc',
  [
    body('clientId')
      .optional()
      .isString(),
    body('clientSecret')
      .optional()
      .isString(),
    body('scopes')
      .optional()
      .isArray(),
    body('redirectUri')
      .optional()
      .isURL()
  ],
  validate,
  adminSettingsController.updatePSCConfig
);

/**
 * POST /api/v1/admin/settings/psc/test
 * Tester la connexion PSC
 */
router.post('/psc/test',
  adminSettingsController.testPSCConnection
);

// ============================================
// CONFIGURATION ANNUAIRE ANS
// ============================================

/**
 * GET /api/v1/admin/settings/annuaire
 * Configuration Annuaire ANS
 */
router.get('/annuaire',
  adminSettingsController.getAnnuaireConfig
);

/**
 * PUT /api/v1/admin/settings/annuaire
 * Modifier la configuration Annuaire
 */
router.put('/annuaire',
  [
    body('apiUrl')
      .optional()
      .isURL(),
    body('apiKey')
      .optional()
      .isString(),
    body('operatorId')
      .optional()
      .isString(),
    body('syncEnabled')
      .optional()
      .isBoolean(),
    body('syncSchedule')
      .optional()
      .matches(/^(\*|[0-9]+)\s+(\*|[0-9]+)\s+(\*|[0-9]+)\s+(\*|[0-9]+)\s+(\*|[0-9]+)$/)
  ],
  validate,
  adminSettingsController.updateAnnuaireConfig
);

/**
 * POST /api/v1/admin/settings/annuaire/test
 * Tester la connexion Annuaire
 */
router.post('/annuaire/test',
  adminSettingsController.testAnnuaireConnection
);

// ============================================
// CONFIGURATION RÉTENTION DES DONNÉES
// ============================================

/**
 * GET /api/v1/admin/settings/retention
 * Politique de rétention des données
 */
router.get('/retention',
  adminSettingsController.getRetentionConfig
);

/**
 * PUT /api/v1/admin/settings/retention
 * Modifier la politique de rétention
 */
router.put('/retention',
  [
    body('auditLogs')
      .optional()
      .isInt({ min: 365, max: 3650 }),
    body('emailLogs')
      .optional()
      .isInt({ min: 30, max: 365 }),
    body('deletedMailboxes')
      .optional()
      .isInt({ min: 30, max: 365 }),
    body('sessionData')
      .optional()
      .isInt({ min: 1, max: 90 })
  ],
  validate,
  adminSettingsController.updateRetentionConfig
);

// ============================================
// CONFIGURATION NOTIFICATIONS
// ============================================

/**
 * GET /api/v1/admin/settings/notifications
 * Configuration des notifications
 */
router.get('/notifications',
  adminSettingsController.getNotificationConfig
);

/**
 * PUT /api/v1/admin/settings/notifications
 * Modifier la configuration des notifications
 */
router.put('/notifications',
  [
    body('emailAlerts')
      .optional()
      .isBoolean(),
    body('alertRecipients')
      .optional()
      .isArray(),
    body('alertRecipients.*')
      .optional()
      .isEmail(),
    body('certificateExpiryDays')
      .optional()
      .isArray(),
    body('quotaWarningPercent')
      .optional()
      .isInt({ min: 50, max: 95 })
  ],
  validate,
  adminSettingsController.updateNotificationConfig
);

// ============================================
// MAINTENANCE
// ============================================

/**
 * GET /api/v1/admin/settings/maintenance
 * Statut mode maintenance
 */
router.get('/maintenance',
  adminSettingsController.getMaintenanceStatus
);

/**
 * POST /api/v1/admin/settings/maintenance/enable
 * Activer le mode maintenance
 */
router.post('/maintenance/enable',
  [
    body('message')
      .optional()
      .trim()
      .isLength({ max: 500 }),
    body('estimatedEnd')
      .optional()
      .isISO8601()
  ],
  validate,
  adminSettingsController.enableMaintenance
);

/**
 * POST /api/v1/admin/settings/maintenance/disable
 * Désactiver le mode maintenance
 */
router.post('/maintenance/disable',
  adminSettingsController.disableMaintenance
);

// ============================================
// BACKUP DE CONFIGURATION
// ============================================

/**
 * GET /api/v1/admin/settings/backup
 * Exporter la configuration
 */
router.get('/backup',
  adminSettingsController.exportConfig
);

/**
 * POST /api/v1/admin/settings/restore
 * Restaurer la configuration
 */
router.post('/restore',
  [
    body('config')
      .isObject()
      .withMessage('Configuration invalide')
  ],
  validate,
  adminSettingsController.restoreConfig
);

module.exports = router;