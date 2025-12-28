// services/api/src/services/email/smtpService.js
const nodemailer = require('nodemailer');
const { htmlToText } = require('html-to-text');
const { pool } = require('../../config/database');
const logger = require('../../utils/logger');

/**
 * Service SMTP pour l'envoi des emails
 * Utilisé par le webmail et les BAL applicatives
 */
class SmtpService {
  constructor() {
    this.config = {
      host: process.env.SMTP_HOST || 'localhost',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      requireTLS: true,
      tls: {
        minVersion: 'TLSv1.2',
        rejectUnauthorized: process.env.NODE_ENV === 'production'
      }
    };
  }

  /**
   * Crée un transport SMTP pour un utilisateur
   */
  createTransport(userEmail, accessToken) {
    return nodemailer.createTransport({
      ...this.config,
      auth: {
        type: process.env.SMTP_AUTH_TYPE || 'login',
        user: userEmail,
        pass: accessToken
      }
    });
  }

  /**
   * Envoie un email
   */
  async sendMail(userEmail, accessToken, mailOptions) {
    const transporter = this.createTransport(userEmail, accessToken);

    try {
      // Préparer le message
      const message = {
        from: mailOptions.from || userEmail,
        to: this.formatRecipients(mailOptions.to),
        cc: this.formatRecipients(mailOptions.cc),
        bcc: this.formatRecipients(mailOptions.bcc),
        subject: mailOptions.subject,
        html: mailOptions.html,
        text: mailOptions.text || (mailOptions.html ? htmlToText(mailOptions.html) : ''),
        inReplyTo: mailOptions.inReplyTo,
        references: mailOptions.references,
        attachments: this.formatAttachments(mailOptions.attachments),
        headers: {
          'X-Mailer': 'MSSante Webmail',
          'X-Priority': mailOptions.priority || '3',
          'X-Operator-ID': process.env.OPERATOR_ID
        }
      };

      // Envoyer
      const info = await transporter.sendMail(message);

      // Logger l'envoi
      await this.logMessage(userEmail, message, info, 'out');

      logger.mail('SMTP', 'send', {
        from: userEmail,
        to: mailOptions.to,
        messageId: info.messageId
      });

      return {
        success: true,
        messageId: info.messageId,
        accepted: info.accepted,
        rejected: info.rejected
      };
    } catch (error) {
      logger.error('Erreur envoi email:', error);
      throw error;
    } finally {
      transporter.close();
    }
  }

  /**
   * Formate les destinataires
   */
  formatRecipients(recipients) {
    if (!recipients) return undefined;
    if (typeof recipients === 'string') return recipients;
    if (Array.isArray(recipients)) {
      return recipients.map(r => {
        if (typeof r === 'string') return r;
        if (r.address) return r.name ? `"${r.name}" <${r.address}>` : r.address;
        return r;
      }).join(', ');
    }
    return undefined;
  }

  /**
   * Formate les pièces jointes
   */
  formatAttachments(attachments) {
    if (!attachments || !Array.isArray(attachments)) return [];

    return attachments.map(att => {
      if (att.content && typeof att.content === 'string') {
        // Base64 encoded
        return {
          filename: att.filename,
          content: Buffer.from(att.content, 'base64'),
          contentType: att.contentType
        };
      }
      return att;
    });
  }

  /**
   * Sauvegarde un brouillon dans le dossier Drafts via IMAP
   */
  async saveDraft(userEmail, accessToken, mailOptions) {
    const Imap = require('imap');

    return new Promise((resolve, reject) => {
      const imap = new Imap({
        user: userEmail,
        password: accessToken,
        host: process.env.IMAP_HOST || 'localhost',
        port: parseInt(process.env.IMAP_PORT || '143'),
        tls: process.env.IMAP_TLS === 'true'
      });

      imap.once('ready', () => {
        const rfc822 = this.buildRFC822Message(mailOptions, {
          messageId: `<draft-${Date.now()}@${userEmail.split('@')[1]}>`
        });

        imap.append(rfc822, { mailbox: 'Drafts', flags: ['\\Draft', '\\Seen'] }, (err) => {
          imap.end();
          if (err) return reject(err);
          
          logger.mail('IMAP', 'save_draft', { user: userEmail });
          resolve({ success: true });
        });
      });

      imap.once('error', reject);
      imap.connect();
    });
  }

  /**
   * Construit un message au format RFC 822
   */
  buildRFC822Message(message, options = {}) {
    const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).substr(2)}`;
    const messageId = options.messageId || `<${Date.now()}.${Math.random().toString(36)}@mssante.fr>`;
    const date = new Date().toUTCString();

    const lines = [
      `Message-ID: ${messageId}`,
      `Date: ${date}`,
      `From: ${message.from || ''}`,
      `To: ${Array.isArray(message.to) ? message.to.join(', ') : message.to || ''}`,
    ];

    if (message.cc) {
      lines.push(`Cc: ${Array.isArray(message.cc) ? message.cc.join(', ') : message.cc}`);
    }

    lines.push(
      `Subject: =?UTF-8?B?${Buffer.from(message.subject || '').toString('base64')}?=`,
      'MIME-Version: 1.0'
    );

    if (message.inReplyTo) lines.push(`In-Reply-To: ${message.inReplyTo}`);
    if (message.references) lines.push(`References: ${message.references}`);

    // Corps du message
    if (message.attachments && message.attachments.length > 0) {
      lines.push(`Content-Type: multipart/mixed; boundary="${boundary}"`, '', `--${boundary}`);
    }

    lines.push(
      'Content-Type: text/html; charset=utf-8',
      'Content-Transfer-Encoding: base64',
      '',
      Buffer.from(message.html || message.text || '').toString('base64')
    );

    // Pièces jointes
    if (message.attachments) {
      for (const att of message.attachments) {
        lines.push(
          '',
          `--${boundary}`,
          `Content-Type: ${att.contentType || 'application/octet-stream'}; name="${att.filename}"`,
          'Content-Transfer-Encoding: base64',
          `Content-Disposition: attachment; filename="${att.filename}"`,
          '',
          att.content
        );
      }
      lines.push('', `--${boundary}--`);
    }

    return lines.join('\r\n');
  }

  /**
   * Enregistre un message dans les logs
   */
  async logMessage(userEmail, message, info, direction) {
    try {
      // Extraire le domaine
      const domain = userEmail.split('@')[1];
      const { rows } = await pool.query(
        'SELECT id FROM domains WHERE domain_name = $1',
        [domain]
      );

      const domainId = rows[0]?.id;

      await pool.query(`
        INSERT INTO mail_logs (
          domain_id, sender, recipients, subject, message_id,
          direction, size_bytes, status, logged_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      `, [
        domainId,
        message.from,
        message.to,
        message.subject,
        info.messageId,
        direction,
        info.size || 0,
        info.rejected?.length > 0 ? 'partial' : 'sent'
      ]);
    } catch (error) {
      logger.error('Erreur log message:', error);
    }
  }

  /**
   * Vérifie la connectivité SMTP
   */
  async verifyConnection(userEmail, accessToken) {
    const transporter = this.createTransport(userEmail, accessToken);

    try {
      await transporter.verify();
      return { success: true, message: 'Connexion SMTP OK' };
    } catch (error) {
      return { success: false, error: error.message };
    } finally {
      transporter.close();
    }
  }

  /**
   * Envoie un email de test
   */
  async sendTestEmail(userEmail, accessToken, recipient) {
    return this.sendMail(userEmail, accessToken, {
      to: recipient,
      subject: 'Test MSSanté - Email de vérification',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>✅ Test de messagerie MSSanté</h2>
          <p>Cet email confirme que votre boîte aux lettres MSSanté est correctement configurée.</p>
          <p><strong>Expéditeur:</strong> ${userEmail}</p>
          <p><strong>Date:</strong> ${new Date().toLocaleString('fr-FR')}</p>
          <hr>
          <p style="color: #666; font-size: 12px;">
            Ce message a été envoyé automatiquement par le système MSSanté.
          </p>
        </div>
      `
    });
  }

  /**
   * Envoie une notification système
   */
  async sendSystemNotification(recipients, subject, content) {
    const systemEmail = process.env.SYSTEM_EMAIL || 'noreply@mssante.fr';
    const systemToken = process.env.SYSTEM_EMAIL_TOKEN;

    if (!systemToken) {
      logger.warn('Token système non configuré pour les notifications');
      return;
    }

    return this.sendMail(systemEmail, systemToken, {
      to: recipients,
      subject: `[MSSanté] ${subject}`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; background: #f5f5f5;">
          <div style="max-width: 600px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px;">
            <h2 style="color: #0066cc;">MSSanté - Notification</h2>
            ${content}
            <hr style="margin: 20px 0;">
            <p style="color: #666; font-size: 12px;">
              Ceci est un message automatique du système MSSanté.
              Ne pas répondre à cet email.
            </p>
          </div>
        </div>
      `
    });
  }
}

module.exports = new SmtpService();