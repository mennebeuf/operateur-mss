// services/api/src/services/mailService.js
const { exec } = require('child_process');
const util = require('util');
const fs = require('fs').promises;
const path = require('path');
const { pool } = require('../config/database');
const logger = require('../utils/logger');

const execPromise = util.promisify(exec);

/**
 * Service de gestion des boîtes aux lettres
 * Interactions avec Dovecot/Postfix pour la création et gestion des BAL
 */
class MailService {
  constructor() {
    this.mailDir = process.env.MAIL_DIR || '/var/mail/vhosts';
    this.dovecotCtl = process.env.DOVEADM_PATH || '/usr/bin/doveadm';
    this.postmapPath = process.env.POSTMAP_PATH || '/usr/sbin/postmap';
    this.virtualMailboxFile = process.env.VIRTUAL_MAILBOX_FILE || '/etc/postfix/vmailbox';
    this.virtualAliasFile = process.env.VIRTUAL_ALIAS_FILE || '/etc/postfix/virtual';
  }

  /**
   * Crée une boîte aux lettres sur le serveur mail
   */
  async createMailbox(email, password = null) {
    const [localPart, domain] = email.split('@');
    const mailboxPath = path.join(this.mailDir, domain, localPart);

    try {
      // Créer la structure de dossiers Maildir
      await this.createMaildirStructure(mailboxPath);

      // Ajouter dans le fichier virtual mailbox de Postfix
      await this.addToVirtualMailbox(email, domain, localPart);

      // Si un mot de passe est fourni, le définir
      if (password) {
        await this.setPassword(email, password);
      }

      // Recharger Postfix
      await this.reloadPostfix();

      logger.mailbox('create', email, { path: mailboxPath });

      return {
        success: true,
        email,
        path: mailboxPath
      };
    } catch (error) {
      logger.error(`Erreur création mailbox ${email}:`, error);
      throw error;
    }
  }

  /**
   * Crée la structure Maildir
   */
  async createMaildirStructure(mailboxPath) {
    const dirs = [
      mailboxPath,
      path.join(mailboxPath, 'cur'),
      path.join(mailboxPath, 'new'),
      path.join(mailboxPath, 'tmp'),
      path.join(mailboxPath, '.Sent'),
      path.join(mailboxPath, '.Sent', 'cur'),
      path.join(mailboxPath, '.Sent', 'new'),
      path.join(mailboxPath, '.Sent', 'tmp'),
      path.join(mailboxPath, '.Drafts'),
      path.join(mailboxPath, '.Drafts', 'cur'),
      path.join(mailboxPath, '.Drafts', 'new'),
      path.join(mailboxPath, '.Drafts', 'tmp'),
      path.join(mailboxPath, '.Trash'),
      path.join(mailboxPath, '.Trash', 'cur'),
      path.join(mailboxPath, '.Trash', 'new'),
      path.join(mailboxPath, '.Trash', 'tmp'),
      path.join(mailboxPath, '.Junk'),
      path.join(mailboxPath, '.Junk', 'cur'),
      path.join(mailboxPath, '.Junk', 'new'),
      path.join(mailboxPath, '.Junk', 'tmp')
    ];

    for (const dir of dirs) {
      await fs.mkdir(dir, { recursive: true, mode: 0o700 });
    }

    // Définir le propriétaire (vmail:vmail généralement)
    const vmailUid = process.env.VMAIL_UID || 5000;
    const vmailGid = process.env.VMAIL_GID || 5000;
    
    await execPromise(`chown -R ${vmailUid}:${vmailGid} ${mailboxPath}`);
  }

  /**
   * Ajoute une entrée au fichier virtual mailbox
   */
  async addToVirtualMailbox(email, domain, localPart) {
    const entry = `${email}    ${domain}/${localPart}/\n`;
    
    // Lire le fichier existant
    let content = '';
    try {
      content = await fs.readFile(this.virtualMailboxFile, 'utf8');
    } catch (e) {
      // Fichier n'existe pas encore
    }

    // Vérifier si l'entrée existe déjà
    if (content.includes(email)) {
      logger.warn(`Mailbox ${email} existe déjà dans vmailbox`);
      return;
    }

    // Ajouter l'entrée
    await fs.appendFile(this.virtualMailboxFile, entry);

    // Reconstruire la table hash
    await execPromise(`${this.postmapPath} ${this.virtualMailboxFile}`);
  }

  /**
   * Définit le mot de passe d'une BAL
   */
  async setPassword(email, password) {
    // Utiliser doveadm pour définir le mot de passe
    const escapedPassword = password.replace(/'/g, "'\\''");
    const cmd = `${this.dovecotCtl} pw -s SHA512-CRYPT -p '${escapedPassword}'`;
    
    const { stdout } = await execPromise(cmd);
    const hashedPassword = stdout.trim();

    // Mettre à jour dans la base de données (table passwd ou users)
    await pool.query(
      `UPDATE mailboxes SET password_hash = $1, updated_at = NOW() WHERE email = $2`,
      [hashedPassword, email]
    );

    logger.mailbox('password_set', email);
  }

  /**
   * Supprime une boîte aux lettres
   */
  async deleteMailbox(email, keepData = false) {
    const [localPart, domain] = email.split('@');
    const mailboxPath = path.join(this.mailDir, domain, localPart);

    try {
      // Supprimer du fichier virtual mailbox
      await this.removeFromVirtualMailbox(email);

      if (!keepData) {
        // Supprimer les données physiques
        await fs.rm(mailboxPath, { recursive: true, force: true });
      } else {
        // Archiver les données
        const archivePath = path.join(this.mailDir, 'archive', domain, `${localPart}_${Date.now()}`);
        await fs.mkdir(path.dirname(archivePath), { recursive: true });
        await fs.rename(mailboxPath, archivePath);
        logger.mailbox('archive', email, { archivePath });
      }

      // Recharger Postfix
      await this.reloadPostfix();

      logger.mailbox('delete', email, { keepData });

      return { success: true };
    } catch (error) {
      logger.error(`Erreur suppression mailbox ${email}:`, error);
      throw error;
    }
  }

  /**
   * Retire une entrée du fichier virtual mailbox
   */
  async removeFromVirtualMailbox(email) {
    const content = await fs.readFile(this.virtualMailboxFile, 'utf8');
    const lines = content.split('\n').filter(line => !line.startsWith(email));
    await fs.writeFile(this.virtualMailboxFile, lines.join('\n'));
    await execPromise(`${this.postmapPath} ${this.virtualMailboxFile}`);
  }

  /**
   * Calcule l'utilisation d'une BAL
   */
  async getMailboxUsage(email) {
    const [localPart, domain] = email.split('@');
    const mailboxPath = path.join(this.mailDir, domain, localPart);

    try {
      // Utiliser doveadm pour obtenir les quotas
      const { stdout } = await execPromise(
        `${this.dovecotCtl} quota get -u ${email} 2>/dev/null || echo "0 0 0"`
      );

      const lines = stdout.trim().split('\n');
      let usedBytes = 0;
      let limitBytes = 0;
      let messageCount = 0;

      for (const line of lines) {
        const parts = line.split(/\s+/);
        if (parts[0] === 'STORAGE') {
          usedBytes = parseInt(parts[1]) * 1024; // KB to bytes
          limitBytes = parseInt(parts[2]) * 1024;
        } else if (parts[0] === 'MESSAGE') {
          messageCount = parseInt(parts[1]);
        }
      }

      // Fallback: calcul direct si doveadm ne fonctionne pas
      if (usedBytes === 0) {
        const { stdout: duOutput } = await execPromise(`du -sb ${mailboxPath} 2>/dev/null || echo "0"`);
        usedBytes = parseInt(duOutput.split('\t')[0]) || 0;
      }

      return {
        usedBytes,
        usedMb: Math.round(usedBytes / 1024 / 1024 * 100) / 100,
        limitBytes,
        limitMb: limitBytes > 0 ? Math.round(limitBytes / 1024 / 1024) : null,
        messageCount,
        usagePercent: limitBytes > 0 ? Math.round(usedBytes / limitBytes * 100) : 0
      };
    } catch (error) {
      logger.error(`Erreur calcul usage ${email}:`, error);
      return { usedBytes: 0, usedMb: 0, messageCount: 0 };
    }
  }

  /**
   * Met à jour le quota d'une BAL
   */
  async setQuota(email, quotaMb) {
    try {
      // Mettre à jour via doveadm
      const quotaBytes = quotaMb * 1024 * 1024;
      await execPromise(
        `${this.dovecotCtl} quota set -u ${email} STORAGE=${quotaMb}M`
      );

      // Mettre à jour en base
      await pool.query(
        'UPDATE mailboxes SET quota_mb = $1, updated_at = NOW() WHERE email = $2',
        [quotaMb, email]
      );

      logger.mailbox('quota_set', email, { quotaMb });

      return { success: true, quotaMb };
    } catch (error) {
      logger.error(`Erreur définition quota ${email}:`, error);
      throw error;
    }
  }

  /**
   * Crée un alias email
   */
  async createAlias(alias, destination) {
    try {
      const entry = `${alias}    ${destination}\n`;
      
      let content = '';
      try {
        content = await fs.readFile(this.virtualAliasFile, 'utf8');
      } catch (e) {}

      if (content.includes(alias)) {
        throw new Error(`Alias ${alias} existe déjà`);
      }

      await fs.appendFile(this.virtualAliasFile, entry);
      await execPromise(`${this.postmapPath} ${this.virtualAliasFile}`);
      await this.reloadPostfix();

      logger.info(`Alias créé: ${alias} -> ${destination}`);

      return { success: true, alias, destination };
    } catch (error) {
      logger.error('Erreur création alias:', error);
      throw error;
    }
  }

  /**
   * Supprime un alias
   */
  async deleteAlias(alias) {
    const content = await fs.readFile(this.virtualAliasFile, 'utf8');
    const lines = content.split('\n').filter(line => !line.startsWith(alias));
    await fs.writeFile(this.virtualAliasFile, lines.join('\n'));
    await execPromise(`${this.postmapPath} ${this.virtualAliasFile}`);
    await this.reloadPostfix();
    
    logger.info(`Alias supprimé: ${alias}`);
  }

  /**
   * Force l'indexation d'une BAL
   */
  async reindexMailbox(email) {
    await execPromise(`${this.dovecotCtl} index -u ${email} '*'`);
    logger.mailbox('reindex', email);
  }

  /**
   * Recharge la configuration Postfix
   */
  async reloadPostfix() {
    await execPromise('systemctl reload postfix');
    logger.info('Postfix rechargé');
  }

  /**
   * Recharge la configuration Dovecot
   */
  async reloadDovecot() {
    await execPromise('systemctl reload dovecot');
    logger.info('Dovecot rechargé');
  }

  /**
   * Synchronise les quotas avec la base de données
   */
  async syncAllQuotas() {
    const { rows } = await pool.query(
      "SELECT email FROM mailboxes WHERE status = 'active'"
    );

    for (const row of rows) {
      try {
        const usage = await this.getMailboxUsage(row.email);
        await pool.query(
          'UPDATE mailboxes SET used_mb = $1, message_count = $2, updated_at = NOW() WHERE email = $3',
          [usage.usedMb, usage.messageCount, row.email]
        );
      } catch (e) {
        logger.error(`Erreur sync quota ${row.email}:`, e.message);
      }
    }

    logger.info('Synchronisation des quotas terminée');
  }
}

module.exports = new MailService();