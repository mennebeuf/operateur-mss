// services/api/src/utils/smtp.js
const nodemailer = require('nodemailer');
const { htmlToText } = require('html-to-text');
const logger = require('./logger');

/**
 * Configuration SMTP pour MSSanté
 * Supporte OAuth2 (PSC) et authentification par certificat
 */
class SmtpClient {
  constructor() {
    this.defaultConfig = {
      host: process.env.SMTP_HOST || 'localhost',
      port: parseInt(process.env.SMTP_PORT, 10) || 587,
      secure: false, // STARTTLS
      requireTLS: true,
      tls: {
        minVersion: 'TLSv1.2',
        rejectUnauthorized: process.env.NODE_ENV === 'production'
      }
    };
  }

  /**
   * Créer un transport SMTP avec OAuth2 (Pro Santé Connect)
   * @param {string} userEmail - Email de l'utilisateur
   * @param {string} accessToken - Token OAuth2 PSC
   * @returns {nodemailer.Transporter}
   */
  createOAuthTransport(userEmail, accessToken) {
    return nodemailer.createTransport({
      ...this.defaultConfig,
      auth: {
        type: 'OAuth2',
        user: userEmail,
        accessToken
      }
    });
  }

  /**
   * Créer un transport SMTP avec authentification classique
   * @param {string} username - Nom d'utilisateur
   * @param {string} password - Mot de passe
   * @returns {nodemailer.Transporter}
   */
  createBasicTransport(username, password) {
    return nodemailer.createTransport({
      ...this.defaultConfig,
      auth: {
        user: username,
        pass: password
      }
    });
  }

  /**
   * Créer un transport SMTP avec certificat client (BAL applicatives)
   * @param {Object} certOptions - Options du certificat
   * @param {Buffer|string} certOptions.cert - Certificat client
   * @param {Buffer|string} certOptions.key - Clé privée
   * @param {Buffer|string} [certOptions.ca] - Autorité de certification
   * @returns {nodemailer.Transporter}
   */
  createCertTransport(certOptions) {
    return nodemailer.createTransport({
      ...this.defaultConfig,
      tls: {
        ...this.defaultConfig.tls,
        cert: certOptions.cert,
        key: certOptions.key,
        ca: certOptions.ca
      }
    });
  }

  /**
   * Créer un transport interne (pour les notifications système)
   * @returns {nodemailer.Transporter}
   */
  createSystemTransport() {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'localhost',
      port: parseInt(process.env.SMTP_PORT, 10) || 25,
      secure: false,
      ignoreTLS: process.env.NODE_ENV !== 'production'
    });
  }

  /**
   * Envoyer un email
   * @param {nodemailer.Transporter} transporter - Transport SMTP
   * @param {Object} mailOptions - Options du mail
   * @returns {Promise<Object>} Résultat de l'envoi
   */
  async sendMail(transporter, mailOptions) {
    const startTime = Date.now();
    
    try {
      // Préparer le message
      const message = {
        from: mailOptions.from,
        to: this.normalizeRecipients(mailOptions.to),
        cc: this.normalizeRecipients(mailOptions.cc),
        bcc: this.normalizeRecipients(mailOptions.bcc),
        replyTo: mailOptions.replyTo,
        subject: mailOptions.subject || '(sans objet)',
        html: mailOptions.html,
        text: mailOptions.text || this.htmlToPlainText(mailOptions.html),
        inReplyTo: mailOptions.inReplyTo,
        references: mailOptions.references,
        attachments: this.normalizeAttachments(mailOptions.attachments),
        headers: {
          'X-Mailer': 'MSSante Webmail v1.0',
          'X-Priority': this.getPriority(mailOptions.priority),
          ...mailOptions.headers
        }
      };

      // Envoyer
      const info = await transporter.sendMail(message);
      
      const duration = Date.now() - startTime;
      logger.mail('SMTP', 'send', {
        messageId: info.messageId,
        from: mailOptions.from,
        to: mailOptions.to,
        duration: `${duration}ms`
      });

      return {
        success: true,
        messageId: info.messageId,
        accepted: info.accepted,
        rejected: info.rejected,
        response: info.response
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('SMTP send error', {
        error: error.message,
        from: mailOptions.from,
        to: mailOptions.to,
        duration: `${duration}ms`
      });
      throw error;
    }
  }

  /**
   * Envoyer un email avec OAuth2
   * @param {string} userEmail - Email de l'expéditeur
   * @param {string} accessToken - Token OAuth2
   * @param {Object} mailOptions - Options du mail
   */
  async sendWithOAuth(userEmail, accessToken, mailOptions) {
    const transporter = this.createOAuthTransport(userEmail, accessToken);
    return this.sendMail(transporter, {
      ...mailOptions,
      from: mailOptions.from || userEmail
    });
  }

  /**
   * Vérifier la connexion SMTP
   * @param {nodemailer.Transporter} transporter - Transport à tester
   * @returns {Promise<boolean>}
   */
  async verifyConnection(transporter) {
    try {
      await transporter.verify();
      logger.info('SMTP connection verified');
      return true;
    } catch (error) {
      logger.error('SMTP connection failed', { error: error.message });
      return false;
    }
  }

  /**
   * Normaliser les destinataires
   * @param {string|string[]|Object[]} recipients - Destinataires
   * @returns {string}
   */
  normalizeRecipients(recipients) {
    if (!recipients) return undefined;
    
    if (typeof recipients === 'string') {
      return recipients;
    }
    
    if (Array.isArray(recipients)) {
      return recipients
        .map(r => {
          if (typeof r === 'string') return r;
          if (r.name && r.address) return `"${r.name}" <${r.address}>`;
          if (r.address) return r.address;
          return null;
        })
        .filter(Boolean)
        .join(', ');
    }
    
    return undefined;
  }

  /**
   * Normaliser les pièces jointes
   * @param {Object[]} attachments - Pièces jointes
   * @returns {Object[]}
   */
  normalizeAttachments(attachments) {
    if (!attachments || !Array.isArray(attachments)) {
      return [];
    }

    return attachments.map(att => ({
      filename: att.filename || 'attachment',
      content: att.content,
      contentType: att.contentType || 'application/octet-stream',
      encoding: att.encoding || 'base64',
      cid: att.cid,
      contentDisposition: att.inline ? 'inline' : 'attachment'
    }));
  }

  /**
   * Convertir HTML en texte brut
   * @param {string} html - Contenu HTML
   * @returns {string}
   */
  htmlToPlainText(html) {
    if (!html) return '';
    
    return htmlToText(html, {
      wordwrap: 80,
      selectors: [
        { selector: 'a', options: { ignoreHref: false } },
        { selector: 'img', format: 'skip' }
      ]
    });
  }

  /**
   * Obtenir la priorité X-Priority
   * @param {string|number} priority - high, normal, low ou 1-5
   * @returns {string}
   */
  getPriority(priority) {
    if (!priority) return '3';
    
    const priorities = {
      high: '1',
      normal: '3',
      low: '5',
      '1': '1',
      '2': '2',
      '3': '3',
      '4': '4',
      '5': '5'
    };
    
    return priorities[String(priority).toLowerCase()] || '3';
  }

  /**
   * Valider une adresse email MSSanté
   * @param {string} email - Adresse à valider
   * @returns {boolean}
   */
  isValidMSSanteEmail(email) {
    if (!email || typeof email !== 'string') return false;
    
    // Format: xxx@domaine.mssante.fr
    const mssanteRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.mssante\.fr$/i;
    return mssanteRegex.test(email);
  }

  /**
   * Extraire le domaine d'une adresse email
   * @param {string} email - Adresse email
   * @returns {string|null}
   */
  extractDomain(email) {
    if (!email || typeof email !== 'string') return null;
    const parts = email.split('@');
    return parts.length === 2 ? parts[1].toLowerCase() : null;
  }
}

// Export une instance unique
module.exports = new SmtpClient();