// services/api/src/controllers/emailController.js
/**
 * Contrôleur Webmail - Interface IMAP/SMTP
 */

const { pool } = require('../config/database');
const logger = require('../utils/logger');
const { imapService, smtpService } = require('../services/email');

// ============================================
// GESTION DES DOSSIERS (FOLDERS)
// ============================================

/**
 * GET /api/v1/email/folders
 * Liste des dossiers de la BAL
 */
const listFolders = async (req, res) => {
  try {
    const { mailboxId } = req.query;
    const user = req.user;

    // Vérifier l'accès à la BAL
    const accessCheck = await pool.query(
      `SELECT m.id, m.email, m.imap_host, m.imap_port
       FROM mailboxes m
       INNER JOIN user_mailboxes um ON um.mailbox_id = m.id
       WHERE m.id = $1 AND um.user_id = $2 AND m.status = 'active'`,
      [mailboxId, user.id]
    );

    if (accessCheck.rows.length === 0) {
      return res.status(403).json({
        success: false,
        error: 'Accès non autorisé à cette BAL',
        code: 'ACCESS_DENIED'
      });
    }

    const mailbox = accessCheck.rows[0];

    // Récupérer les dossiers via IMAP
    const folders = await imapService.listFolders(mailbox.email, req.accessToken || user.email);

    res.json({
      success: true,
      data: folders
    });
  } catch (error) {
    logger.error('Erreur list folders:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur récupération dossiers'
    });
  }
};

/**
 * POST /api/v1/email/folders
 * Créer un dossier
 */
const createFolder = async (req, res) => {
  try {
    const { mailboxId, name, parentFolder } = req.body;
    const user = req.user;

    // Vérifier l'accès
    const accessCheck = await pool.query(
      `SELECT m.email FROM mailboxes m
       INNER JOIN user_mailboxes um ON um.mailbox_id = m.id
       WHERE m.id = $1 AND um.user_id = $2`,
      [mailboxId, user.id]
    );

    if (accessCheck.rows.length === 0) {
      return res.status(403).json({
        success: false,
        error: 'Accès non autorisé'
      });
    }

    const mailbox = accessCheck.rows[0];
    const folderPath = parentFolder ? `${parentFolder}/${name}` : name;

    // Créer le dossier via IMAP
    await imapService.createFolder(mailbox.email, req.accessToken, folderPath);

    logger.info('Dossier créé:', { mailboxId, folder: folderPath });

    res.status(201).json({
      success: true,
      message: 'Dossier créé',
      data: { name: folderPath }
    });
  } catch (error) {
    logger.error('Erreur create folder:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur création dossier'
    });
  }
};

/**
 * DELETE /api/v1/email/folders/:folderName
 * Supprimer un dossier
 */
const deleteFolder = async (req, res) => {
  try {
    const { folderName } = req.params;
    const { mailboxId } = req.query;
    const user = req.user;

    // Vérifier l'accès
    const accessCheck = await pool.query(
      `SELECT m.email FROM mailboxes m
       INNER JOIN user_mailboxes um ON um.mailbox_id = m.id
       WHERE m.id = $1 AND um.user_id = $2`,
      [mailboxId, user.id]
    );

    if (accessCheck.rows.length === 0) {
      return res.status(403).json({
        success: false,
        error: 'Accès non autorisé'
      });
    }

    const mailbox = accessCheck.rows[0];

    // Supprimer le dossier via IMAP
    await imapService.deleteFolder(mailbox.email, req.accessToken, folderName);

    logger.info('Dossier supprimé:', { mailboxId, folder: folderName });

    res.json({
      success: true,
      message: 'Dossier supprimé'
    });
  } catch (error) {
    logger.error('Erreur delete folder:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur suppression dossier'
    });
  }
};

/**
 * PUT /api/v1/email/folders/:folderName/rename
 * Renommer un dossier
 */
const renameFolder = async (req, res) => {
  try {
    const { folderName } = req.params;
    const { mailboxId, newName } = req.body;
    const user = req.user;

    // Vérifier l'accès
    const accessCheck = await pool.query(
      `SELECT m.email FROM mailboxes m
       INNER JOIN user_mailboxes um ON um.mailbox_id = m.id
       WHERE m.id = $1 AND um.user_id = $2`,
      [mailboxId, user.id]
    );

    if (accessCheck.rows.length === 0) {
      return res.status(403).json({
        success: false,
        error: 'Accès non autorisé'
      });
    }

    const mailbox = accessCheck.rows[0];

    // Renommer le dossier via IMAP
    await imapService.renameFolder(mailbox.email, req.accessToken, folderName, newName);

    logger.info('Dossier renommé:', { mailboxId, oldName: folderName, newName });

    res.json({
      success: true,
      message: 'Dossier renommé',
      data: { oldName: folderName, newName }
    });
  } catch (error) {
    logger.error('Erreur rename folder:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur renommage dossier'
    });
  }
};

// ============================================
// GESTION DES MESSAGES
// ============================================

/**
 * GET /api/v1/email/messages
 * Liste des messages d'un dossier
 */
const listMessages = async (req, res) => {
  try {
    const { mailboxId, folder = 'INBOX', page = 1, limit = 50, search = null } = req.query;

    const user = req.user;

    // Vérifier l'accès
    const accessCheck = await pool.query(
      `SELECT m.email FROM mailboxes m
       INNER JOIN user_mailboxes um ON um.mailbox_id = m.id
       WHERE m.id = $1 AND um.user_id = $2 AND m.status = 'active'`,
      [mailboxId, user.id]
    );

    if (accessCheck.rows.length === 0) {
      return res.status(403).json({
        success: false,
        error: 'Accès non autorisé'
      });
    }

    const mailbox = accessCheck.rows[0];

    // Récupérer les messages via IMAP
    const result = await imapService.listMessages(mailbox.email, req.accessToken, folder, {
      page: parseInt(page),
      limit: parseInt(limit),
      search
    });

    res.json({
      success: true,
      data: result.messages,
      pagination: result.pagination
    });
  } catch (error) {
    logger.error('Erreur list messages:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur récupération messages'
    });
  }
};

/**
 * GET /api/v1/email/messages/:uid
 * Récupérer un message complet
 */
const getMessage = async (req, res) => {
  try {
    const { uid } = req.params;
    const { mailboxId, folder = 'INBOX' } = req.query;
    const user = req.user;

    // Vérifier l'accès
    const accessCheck = await pool.query(
      `SELECT m.email FROM mailboxes m
       INNER JOIN user_mailboxes um ON um.mailbox_id = m.id
       WHERE m.id = $1 AND um.user_id = $2`,
      [mailboxId, user.id]
    );

    if (accessCheck.rows.length === 0) {
      return res.status(403).json({
        success: false,
        error: 'Accès non autorisé'
      });
    }

    const mailbox = accessCheck.rows[0];

    // Récupérer le message via IMAP
    const message = await imapService.getMessage(mailbox.email, req.accessToken, folder, uid);

    // Marquer comme lu automatiquement
    await imapService.setFlags(mailbox.email, req.accessToken, folder, uid, {
      add: ['\\Seen']
    });

    res.json({
      success: true,
      data: message
    });
  } catch (error) {
    logger.error('Erreur get message:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur récupération message'
    });
  }
};

/**
 * GET /api/v1/email/messages/:uid/attachments/:index
 * Télécharger une pièce jointe
 */
const getAttachment = async (req, res) => {
  try {
    const { uid, index } = req.params;
    const { mailboxId, folder = 'INBOX' } = req.query;
    const user = req.user;

    // Vérifier l'accès
    const accessCheck = await pool.query(
      `SELECT m.email FROM mailboxes m
       INNER JOIN user_mailboxes um ON um.mailbox_id = m.id
       WHERE m.id = $1 AND um.user_id = $2`,
      [mailboxId, user.id]
    );

    if (accessCheck.rows.length === 0) {
      return res.status(403).json({
        success: false,
        error: 'Accès non autorisé'
      });
    }

    const mailbox = accessCheck.rows[0];

    // Récupérer la pièce jointe via IMAP
    const attachment = await imapService.getAttachment(
      mailbox.email,
      req.accessToken,
      folder,
      uid,
      parseInt(index)
    );

    // Définir les headers de téléchargement
    res.setHeader('Content-Type', attachment.contentType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${attachment.filename}"`);
    res.send(attachment.content);
  } catch (error) {
    logger.error('Erreur get attachment:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur téléchargement pièce jointe'
    });
  }
};

/**
 * PATCH /api/v1/email/messages/:uid/flags
 * Modifier les flags d'un message
 */
const setFlags = async (req, res) => {
  try {
    const { uid } = req.params;
    const { mailboxId, folder = 'INBOX', add, remove } = req.body;
    const user = req.user;

    // Vérifier l'accès
    const accessCheck = await pool.query(
      `SELECT m.email FROM mailboxes m
       INNER JOIN user_mailboxes um ON um.mailbox_id = m.id
       WHERE m.id = $1 AND um.user_id = $2`,
      [mailboxId, user.id]
    );

    if (accessCheck.rows.length === 0) {
      return res.status(403).json({
        success: false,
        error: 'Accès non autorisé'
      });
    }

    const mailbox = accessCheck.rows[0];

    // Modifier les flags via IMAP
    await imapService.setFlags(mailbox.email, req.accessToken, folder, uid, {
      add: add || [],
      remove: remove || []
    });

    res.json({
      success: true,
      message: 'Flags mis à jour'
    });
  } catch (error) {
    logger.error('Erreur set flags:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur modification flags'
    });
  }
};

/**
 * POST /api/v1/email/messages/move
 * Déplacer des messages
 */
const moveMessages = async (req, res) => {
  try {
    const { mailboxId, fromFolder, toFolder, uids } = req.body;
    const user = req.user;

    if (!Array.isArray(uids) || uids.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Liste de UIDs invalide'
      });
    }

    // Vérifier l'accès
    const accessCheck = await pool.query(
      `SELECT m.email FROM mailboxes m
       INNER JOIN user_mailboxes um ON um.mailbox_id = m.id
       WHERE m.id = $1 AND um.user_id = $2`,
      [mailboxId, user.id]
    );

    if (accessCheck.rows.length === 0) {
      return res.status(403).json({
        success: false,
        error: 'Accès non autorisé'
      });
    }

    const mailbox = accessCheck.rows[0];

    // Déplacer les messages via IMAP
    await imapService.moveMessages(mailbox.email, req.accessToken, fromFolder, toFolder, uids);

    logger.info('Messages déplacés:', {
      mailboxId,
      count: uids.length,
      from: fromFolder,
      to: toFolder
    });

    res.json({
      success: true,
      message: `${uids.length} message(s) déplacé(s)`
    });
  } catch (error) {
    logger.error('Erreur move messages:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur déplacement messages'
    });
  }
};

/**
 * DELETE /api/v1/email/messages
 * Supprimer des messages
 */
const deleteMessages = async (req, res) => {
  try {
    const { mailboxId, folder, uids } = req.body;
    const user = req.user;

    if (!Array.isArray(uids) || uids.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Liste de UIDs invalide'
      });
    }

    // Vérifier l'accès
    const accessCheck = await pool.query(
      `SELECT m.email FROM mailboxes m
       INNER JOIN user_mailboxes um ON um.mailbox_id = m.id
       WHERE m.id = $1 AND um.user_id = $2`,
      [mailboxId, user.id]
    );

    if (accessCheck.rows.length === 0) {
      return res.status(403).json({
        success: false,
        error: 'Accès non autorisé'
      });
    }

    const mailbox = accessCheck.rows[0];

    // Supprimer les messages via IMAP (marquer comme supprimé + expunge)
    await imapService.deleteMessages(mailbox.email, req.accessToken, folder, uids);

    logger.info('Messages supprimés:', { mailboxId, count: uids.length, folder });

    res.json({
      success: true,
      message: `${uids.length} message(s) supprimé(s)`
    });
  } catch (error) {
    logger.error('Erreur delete messages:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur suppression messages'
    });
  }
};

// ============================================
// ENVOI D'EMAILS (SMTP)
// ============================================

/**
 * POST /api/v1/email/send
 * Envoyer un email
 */
const sendEmail = async (req, res) => {
  try {
    const {
      mailboxId,
      to,
      cc,
      bcc,
      subject,
      html,
      text,
      attachments,
      inReplyTo,
      references,
      priority
    } = req.body;

    const user = req.user;

    // Validation
    if (!to || !subject) {
      return res.status(400).json({
        success: false,
        error: 'Destinataire et sujet requis'
      });
    }

    // Vérifier l'accès
    const accessCheck = await pool.query(
      `SELECT m.email, m.smtp_host, m.smtp_port 
       FROM mailboxes m
       INNER JOIN user_mailboxes um ON um.mailbox_id = m.id
       WHERE m.id = $1 AND um.user_id = $2 AND m.status = 'active'`,
      [mailboxId, user.id]
    );

    if (accessCheck.rows.length === 0) {
      return res.status(403).json({
        success: false,
        error: 'Accès non autorisé à cette BAL'
      });
    }

    const mailbox = accessCheck.rows[0];

    // Envoyer l'email via SMTP
    const result = await smtpService.sendMail(mailbox.email, req.accessToken, {
      from: mailbox.email,
      to,
      cc,
      bcc,
      subject,
      html,
      text,
      attachments,
      inReplyTo,
      references,
      priority
    });

    // Logger l'envoi
    await pool.query(
      `INSERT INTO email_logs (
        mailbox_id, direction, from_address, to_address, subject, status, message_id
      ) VALUES ($1, 'outbound', $2, $3, $4, 'sent', $5)`,
      [mailboxId, mailbox.email, to, subject, result.messageId]
    );

    logger.info('Email envoyé:', {
      mailboxId,
      from: mailbox.email,
      to,
      subject,
      messageId: result.messageId
    });

    res.json({
      success: true,
      message: 'Email envoyé',
      data: {
        messageId: result.messageId,
        accepted: result.accepted,
        rejected: result.rejected
      }
    });
  } catch (error) {
    logger.error('Erreur send email:', error);

    // Logger l'échec
    try {
      await pool.query(
        `INSERT INTO email_logs (
          mailbox_id, direction, from_address, to_address, subject, status, error_message
        ) VALUES ($1, 'outbound', $2, $3, $4, 'failed', $5)`,
        [req.body.mailboxId, req.user.email, req.body.to, req.body.subject, error.message]
      );
    } catch (logError) {
      logger.error('Erreur log email failed:', logError);
    }

    res.status(500).json({
      success: false,
      error: 'Erreur envoi email',
      details: error.message
    });
  }
};

/**
 * POST /api/v1/email/draft
 * Sauvegarder un brouillon
 */
const saveDraft = async (req, res) => {
  try {
    const { mailboxId, to, cc, bcc, subject, html, text, attachments } = req.body;

    const user = req.user;

    // Vérifier l'accès
    const accessCheck = await pool.query(
      `SELECT m.email FROM mailboxes m
       INNER JOIN user_mailboxes um ON um.mailbox_id = m.id
       WHERE m.id = $1 AND um.user_id = $2`,
      [mailboxId, user.id]
    );

    if (accessCheck.rows.length === 0) {
      return res.status(403).json({
        success: false,
        error: 'Accès non autorisé'
      });
    }

    const mailbox = accessCheck.rows[0];

    // Sauvegarder le brouillon via IMAP
    await smtpService.saveDraft(mailbox.email, req.accessToken, {
      from: mailbox.email,
      to,
      cc,
      bcc,
      subject,
      html,
      text,
      attachments
    });

    logger.info('Brouillon sauvegardé:', { mailboxId, subject });

    res.json({
      success: true,
      message: 'Brouillon sauvegardé'
    });
  } catch (error) {
    logger.error('Erreur save draft:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur sauvegarde brouillon'
    });
  }
};

/**
 * POST /api/v1/email/search
 * Rechercher des emails
 */
const searchEmails = async (req, res) => {
  try {
    const {
      mailboxId,
      folder = 'INBOX',
      query,
      from,
      to,
      subject,
      body,
      since,
      before,
      seen,
      flagged
    } = req.body;

    const user = req.user;

    // Vérifier l'accès
    const accessCheck = await pool.query(
      `SELECT m.email FROM mailboxes m
       INNER JOIN user_mailboxes um ON um.mailbox_id = m.id
       WHERE m.id = $1 AND um.user_id = $2`,
      [mailboxId, user.id]
    );

    if (accessCheck.rows.length === 0) {
      return res.status(403).json({
        success: false,
        error: 'Accès non autorisé'
      });
    }

    const mailbox = accessCheck.rows[0];

    // Construire les critères de recherche IMAP
    const searchCriteria = [];
    if (query) searchCriteria.push(['TEXT', query]);
    if (from) searchCriteria.push(['FROM', from]);
    if (to) searchCriteria.push(['TO', to]);
    if (subject) searchCriteria.push(['SUBJECT', subject]);
    if (body) searchCriteria.push(['BODY', body]);
    if (since) searchCriteria.push(['SINCE', since]);
    if (before) searchCriteria.push(['BEFORE', before]);
    if (seen !== undefined) searchCriteria.push([seen ? 'SEEN' : 'UNSEEN']);
    if (flagged !== undefined) searchCriteria.push([flagged ? 'FLAGGED' : 'UNFLAGGED']);

    // Rechercher via IMAP
    const results = await imapService.searchMessages(
      mailbox.email,
      req.accessToken,
      folder,
      searchCriteria
    );

    res.json({
      success: true,
      data: results,
      count: results.length
    });
  } catch (error) {
    logger.error('Erreur search emails:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur recherche emails'
    });
  }
};

module.exports = {
  // Folders
  listFolders,
  createFolder,
  deleteFolder,
  renameFolder,

  // Messages
  listMessages,
  getMessage,
  getAttachment,
  setFlags,
  moveMessages,
  deleteMessages,

  // Envoi
  sendEmail,
  saveDraft,
  searchEmails
};
