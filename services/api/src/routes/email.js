// services/api/src/routes/email.js
/**
 * Routes Webmail API
 * Interface IMAP/SMTP pour le frontend
 */

const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');
const multer = require('multer');
const emailController = require('../controllers/emailController');
const { authenticate } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const { validate } = require('../middleware/validation');

// Configuration upload pièces jointes
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB max par fichier
    files: 10 // 10 fichiers max
  }
});

// Toutes les routes nécessitent l'authentification
router.use(authenticate);

// ============================================
// DOSSIERS (FOLDERS)
// ============================================

/**
 * GET /api/v1/email/folders
 * Liste des dossiers de la BAL
 */
router.get('/folders',
  [
    query('mailboxId')
      .isUUID()
      .withMessage('ID BAL requis')
  ],
  validate,
  emailController.listFolders
);

/**
 * POST /api/v1/email/folders
 * Créer un dossier
 */
router.post('/folders',
  [
    body('mailboxId')
      .isUUID()
      .withMessage('ID BAL requis'),
    body('name')
      .notEmpty()
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage('Nom du dossier requis (1-100 caractères)'),
    body('parentFolder')
      .optional()
      .isString()
  ],
  validate,
  emailController.createFolder
);

/**
 * DELETE /api/v1/email/folders/:folderName
 * Supprimer un dossier
 */
router.delete('/folders/:folderName',
  [
    param('folderName').notEmpty().withMessage('Nom du dossier requis'),
    query('mailboxId').isUUID().withMessage('ID BAL requis')
  ],
  validate,
  emailController.deleteFolder
);

/**
 * PUT /api/v1/email/folders/:folderName/rename
 * Renommer un dossier
 */
router.put('/folders/:folderName/rename',
  [
    param('folderName').notEmpty().withMessage('Nom du dossier requis'),
    body('mailboxId').isUUID().withMessage('ID BAL requis'),
    body('newName')
      .notEmpty()
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage('Nouveau nom requis')
  ],
  validate,
  emailController.renameFolder
);

// ============================================
// MESSAGES
// ============================================

/**
 * GET /api/v1/email/messages
 * Liste des messages d'un dossier
 */
router.get('/messages',
  [
    query('mailboxId').isUUID().withMessage('ID BAL requis'),
    query('folder').optional().isString(),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('search').optional().isString().trim(),
    query('unreadOnly').optional().isBoolean(),
    query('from').optional().isISO8601(),
    query('to').optional().isISO8601()
  ],
  validate,
  emailController.listMessages
);

/**
 * GET /api/v1/email/messages/:uid
 * Récupérer un message complet
 */
router.get('/messages/:uid',
  [
    param('uid').isInt({ min: 1 }).withMessage('UID message invalide'),
    query('mailboxId').isUUID().withMessage('ID BAL requis'),
    query('folder').optional().isString()
  ],
  validate,
  emailController.getMessage
);

/**
 * DELETE /api/v1/email/messages/:uid
 * Supprimer un message
 */
router.delete('/messages/:uid',
  [
    param('uid').isInt({ min: 1 }).withMessage('UID message invalide'),
    query('mailboxId').isUUID().withMessage('ID BAL requis'),
    query('folder').optional().isString(),
    query('permanent').optional().isBoolean()
  ],
  validate,
  emailController.deleteMessage
);

/**
 * PUT /api/v1/email/messages/:uid/flags
 * Modifier les flags d'un message (lu, important, etc.)
 */
router.put('/messages/:uid/flags',
  [
    param('uid').isInt({ min: 1 }).withMessage('UID message invalide'),
    body('mailboxId').isUUID().withMessage('ID BAL requis'),
    body('folder').optional().isString(),
    body('flags')
      .isObject()
      .withMessage('Flags requis'),
    body('flags.seen').optional().isBoolean(),
    body('flags.flagged').optional().isBoolean(),
    body('flags.answered').optional().isBoolean()
  ],
  validate,
  emailController.updateFlags
);

/**
 * POST /api/v1/email/messages/:uid/move
 * Déplacer un message vers un autre dossier
 */
router.post('/messages/:uid/move',
  [
    param('uid').isInt({ min: 1 }).withMessage('UID message invalide'),
    body('mailboxId').isUUID().withMessage('ID BAL requis'),
    body('sourceFolder').optional().isString(),
    body('destinationFolder')
      .notEmpty()
      .withMessage('Dossier de destination requis')
  ],
  validate,
  emailController.moveMessage
);

/**
 * POST /api/v1/email/messages/:uid/copy
 * Copier un message vers un autre dossier
 */
router.post('/messages/:uid/copy',
  [
    param('uid').isInt({ min: 1 }).withMessage('UID message invalide'),
    body('mailboxId').isUUID().withMessage('ID BAL requis'),
    body('sourceFolder').optional().isString(),
    body('destinationFolder')
      .notEmpty()
      .withMessage('Dossier de destination requis')
  ],
  validate,
  emailController.copyMessage
);

// ============================================
// PIÈCES JOINTES
// ============================================

/**
 * GET /api/v1/email/messages/:uid/attachments/:partId
 * Télécharger une pièce jointe
 */
router.get('/messages/:uid/attachments/:partId',
  [
    param('uid').isInt({ min: 1 }).withMessage('UID message invalide'),
    param('partId').notEmpty().withMessage('Part ID requis'),
    query('mailboxId').isUUID().withMessage('ID BAL requis'),
    query('folder').optional().isString()
  ],
  validate,
  emailController.downloadAttachment
);

// ============================================
// ENVOI DE MESSAGES
// ============================================

/**
 * POST /api/v1/email/send
 * Envoyer un email
 */
router.post('/send',
  upload.array('attachments', 10),
  [
    body('mailboxId').isUUID().withMessage('ID BAL requis'),
    body('to')
      .isArray({ min: 1 })
      .withMessage('Au moins un destinataire requis'),
    body('to.*')
      .isEmail()
      .withMessage('Email destinataire invalide'),
    body('cc')
      .optional()
      .isArray(),
    body('cc.*')
      .optional()
      .isEmail(),
    body('bcc')
      .optional()
      .isArray(),
    body('bcc.*')
      .optional()
      .isEmail(),
    body('subject')
      .notEmpty()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Sujet requis (max 500 caractères)'),
    body('body')
      .notEmpty()
      .withMessage('Corps du message requis'),
    body('isHtml')
      .optional()
      .isBoolean(),
    body('priority')
      .optional()
      .isIn(['low', 'normal', 'high']),
    body('requestReadReceipt')
      .optional()
      .isBoolean(),
    body('replyTo')
      .optional()
      .isUUID()
      .withMessage('ID message de réponse invalide')
  ],
  validate,
  emailController.send
);

// ============================================
// BROUILLONS
// ============================================

/**
 * GET /api/v1/email/drafts
 * Liste des brouillons
 */
router.get('/drafts',
  [
    query('mailboxId').isUUID().withMessage('ID BAL requis')
  ],
  validate,
  emailController.listDrafts
);

/**
 * POST /api/v1/email/drafts
 * Créer/sauvegarder un brouillon
 */
router.post('/drafts',
  upload.array('attachments', 10),
  [
    body('mailboxId').isUUID().withMessage('ID BAL requis'),
    body('to').optional().isArray(),
    body('cc').optional().isArray(),
    body('bcc').optional().isArray(),
    body('subject').optional().isString(),
    body('body').optional().isString()
  ],
  validate,
  emailController.saveDraft
);

/**
 * PUT /api/v1/email/drafts/:uid
 * Mettre à jour un brouillon
 */
router.put('/drafts/:uid',
  upload.array('attachments', 10),
  [
    param('uid').isInt({ min: 1 }).withMessage('UID brouillon invalide'),
    body('mailboxId').isUUID().withMessage('ID BAL requis')
  ],
  validate,
  emailController.updateDraft
);

/**
 * DELETE /api/v1/email/drafts/:uid
 * Supprimer un brouillon
 */
router.delete('/drafts/:uid',
  [
    param('uid').isInt({ min: 1 }).withMessage('UID brouillon invalide'),
    query('mailboxId').isUUID().withMessage('ID BAL requis')
  ],
  validate,
  emailController.deleteDraft
);

// ============================================
// RECHERCHE
// ============================================

/**
 * POST /api/v1/email/search
 * Recherche avancée dans les emails
 */
router.post('/search',
  [
    body('mailboxId').isUUID().withMessage('ID BAL requis'),
    body('query').notEmpty().withMessage('Requête de recherche requise'),
    body('folders').optional().isArray(),
    body('from').optional().isString(),
    body('to').optional().isString(),
    body('subject').optional().isString(),
    body('dateFrom').optional().isISO8601(),
    body('dateTo').optional().isISO8601(),
    body('hasAttachment').optional().isBoolean(),
    body('limit').optional().isInt({ min: 1, max: 100 })
  ],
  validate,
  emailController.search
);

module.exports = router;