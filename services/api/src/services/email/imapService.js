// services/api/src/services/email/imapService.js
const Imap = require('imap');
const { simpleParser } = require('mailparser');
const logger = require('../../utils/logger');

/**
 * Service IMAP pour la lecture des emails
 * Utilisé par le webmail pour accéder aux boîtes aux lettres
 */
class ImapService {
  constructor() {
    this.connections = new Map();
    this.config = {
      host: process.env.IMAP_HOST || 'localhost',
      port: parseInt(process.env.IMAP_PORT || '143'),
      tls: process.env.IMAP_TLS === 'true',
      tlsOptions: { rejectUnauthorized: process.env.NODE_ENV === 'production' }
    };
  }

  /**
   * Crée une connexion IMAP pour un utilisateur
   */
  async getConnection(userEmail, accessToken) {
    const cacheKey = `${userEmail}`;
    
    if (this.connections.has(cacheKey)) {
      const conn = this.connections.get(cacheKey);
      if (conn.state === 'authenticated') return conn;
      this.connections.delete(cacheKey);
    }

    return new Promise((resolve, reject) => {
      const imap = new Imap({
        user: userEmail,
        password: accessToken,
        host: this.config.host,
        port: this.config.port,
        tls: this.config.tls,
        tlsOptions: this.config.tlsOptions,
        authTimeout: 10000
      });

      imap.once('ready', () => {
        this.connections.set(cacheKey, imap);
        setTimeout(() => {
          if (this.connections.has(cacheKey)) {
            this.connections.get(cacheKey).end();
            this.connections.delete(cacheKey);
          }
        }, 300000); // 5 min timeout
        resolve(imap);
      });

      imap.once('error', (err) => {
        logger.error('IMAP connection error:', err);
        reject(err);
      });

      imap.connect();
    });
  }

  /**
   * Liste les dossiers (INBOX, Sent, Drafts, etc.)
   */
  async listFolders(userEmail, accessToken) {
    const imap = await this.getConnection(userEmail, accessToken);

    return new Promise((resolve, reject) => {
      imap.getBoxes((err, boxes) => {
        if (err) return reject(err);
        resolve(this.formatFolders(boxes));
      });
    });
  }

  /**
   * Formate l'arbre des dossiers
   */
  formatFolders(boxes, parent = '') {
    const folders = [];
    
    for (const [name, box] of Object.entries(boxes)) {
      const path = parent ? `${parent}${box.delimiter}${name}` : name;
      const folder = {
        name,
        path,
        delimiter: box.delimiter,
        flags: box.attribs || [],
        specialUse: this.getSpecialUse(name, box.attribs),
        children: box.children ? this.formatFolders(box.children, path) : []
      };
      folders.push(folder);
    }

    return folders;
  }

  /**
   * Détermine l'usage spécial d'un dossier
   */
  getSpecialUse(name, attribs = []) {
    const lowerName = name.toLowerCase();
    if (attribs.includes('\\Sent') || lowerName === 'sent') return 'sent';
    if (attribs.includes('\\Drafts') || lowerName === 'drafts') return 'drafts';
    if (attribs.includes('\\Trash') || lowerName === 'trash') return 'trash';
    if (attribs.includes('\\Junk') || lowerName === 'junk' || lowerName === 'spam') return 'junk';
    if (lowerName === 'inbox') return 'inbox';
    return null;
  }

  /**
   * Liste les messages d'un dossier
   */
  async listMessages(userEmail, accessToken, folder = 'INBOX', options = {}) {
    const imap = await this.getConnection(userEmail, accessToken);
    const { page = 1, limit = 50, search = null } = options;

    return new Promise((resolve, reject) => {
      imap.openBox(folder, true, (err, box) => {
        if (err) return reject(err);

        const total = box.messages.total;
        const start = Math.max(1, total - (page * limit) + 1);
        const end = Math.max(1, total - ((page - 1) * limit));

        if (total === 0) {
          return resolve({ messages: [], total: 0, page, limit });
        }

        const range = `${start}:${end}`;
        const messages = [];

        const fetch = imap.seq.fetch(range, {
          bodies: ['HEADER.FIELDS (FROM TO SUBJECT DATE MESSAGE-ID)'],
          struct: true
        });

        fetch.on('message', (msg, seqno) => {
          const message = { seqno, uid: null };

          msg.on('body', (stream, info) => {
            let buffer = '';
            stream.on('data', chunk => buffer += chunk.toString('utf8'));
            stream.once('end', () => {
              const headers = Imap.parseHeader(buffer);
              message.from = headers.from?.[0] || '';
              message.to = headers.to || [];
              message.subject = headers.subject?.[0] || '(Sans sujet)';
              message.date = headers.date?.[0] ? new Date(headers.date[0]) : null;
              message.messageId = headers['message-id']?.[0] || '';
            });
          });

          msg.once('attributes', attrs => {
            message.uid = attrs.uid;
            message.flags = attrs.flags || [];
            message.seen = attrs.flags?.includes('\\Seen') || false;
            message.flagged = attrs.flags?.includes('\\Flagged') || false;
            message.hasAttachment = this.hasAttachment(attrs.struct);
            message.size = attrs.size;
          });

          msg.once('end', () => messages.push(message));
        });

        fetch.once('error', reject);
        fetch.once('end', () => {
          resolve({
            messages: messages.reverse(),
            total,
            page,
            limit,
            pages: Math.ceil(total / limit)
          });
        });
      });
    });
  }

  /**
   * Détecte si un message a des pièces jointes
   */
  hasAttachment(struct) {
    if (!struct) return false;
    if (Array.isArray(struct)) {
      return struct.some(s => this.hasAttachment(s));
    }
    if (struct.disposition?.type?.toLowerCase() === 'attachment') return true;
    if (struct.parts) return struct.parts.some(p => this.hasAttachment(p));
    return false;
  }

  /**
   * Récupère un message complet
   */
  async getMessage(userEmail, accessToken, folder, uid) {
    const imap = await this.getConnection(userEmail, accessToken);

    return new Promise((resolve, reject) => {
      imap.openBox(folder, true, err => {
        if (err) return reject(err);

        const fetch = imap.fetch(uid, { bodies: '', struct: true });
        let rawMessage = '';

        fetch.on('message', msg => {
          msg.on('body', stream => {
            stream.on('data', chunk => rawMessage += chunk.toString('utf8'));
          });

          msg.once('attributes', attrs => {
            msg.attrs = attrs;
          });

          msg.once('end', async () => {
            try {
              const parsed = await simpleParser(rawMessage);
              resolve({
                uid,
                messageId: parsed.messageId,
                from: parsed.from?.value?.[0] || {},
                to: parsed.to?.value || [],
                cc: parsed.cc?.value || [],
                bcc: parsed.bcc?.value || [],
                subject: parsed.subject || '(Sans sujet)',
                date: parsed.date,
                html: parsed.html || '',
                text: parsed.text || '',
                attachments: (parsed.attachments || []).map(att => ({
                  filename: att.filename,
                  contentType: att.contentType,
                  size: att.size,
                  contentId: att.contentId,
                  content: att.content?.toString('base64')
                })),
                headers: Object.fromEntries(parsed.headers)
              });
            } catch (e) {
              reject(e);
            }
          });
        });

        fetch.once('error', reject);
      });
    });
  }

  /**
   * Modifie les flags d'un message
   */
  async setFlags(userEmail, accessToken, folder, uid, flags) {
    const imap = await this.getConnection(userEmail, accessToken);

    return new Promise((resolve, reject) => {
      imap.openBox(folder, false, err => {
        if (err) return reject(err);

        const flagsToSet = flags.add || [];
        const flagsToRemove = flags.remove || [];

        const operations = [];

        if (flagsToSet.length > 0) {
          operations.push(new Promise((res, rej) => {
            imap.addFlags(uid, flagsToSet, err => err ? rej(err) : res());
          }));
        }

        if (flagsToRemove.length > 0) {
          operations.push(new Promise((res, rej) => {
            imap.delFlags(uid, flagsToRemove, err => err ? rej(err) : res());
          }));
        }

        Promise.all(operations)
          .then(() => resolve({ success: true, uid, flags }))
          .catch(reject);
      });
    });
  }

  /**
   * Déplace des messages vers un autre dossier
   */
  async moveMessages(userEmail, accessToken, fromFolder, toFolder, uids) {
    const imap = await this.getConnection(userEmail, accessToken);

    return new Promise((resolve, reject) => {
      imap.openBox(fromFolder, false, err => {
        if (err) return reject(err);

        imap.move(uids, toFolder, err => {
          if (err) return reject(err);
          logger.mail('IMAP', 'move', { from: fromFolder, to: toFolder, count: uids.length });
          resolve({ success: true, moved: uids.length });
        });
      });
    });
  }

  /**
   * Supprime des messages (déplace vers Trash ou suppression définitive)
   */
  async deleteMessages(userEmail, accessToken, folder, uids, permanent = false) {
    const imap = await this.getConnection(userEmail, accessToken);

    return new Promise((resolve, reject) => {
      imap.openBox(folder, false, err => {
        if (err) return reject(err);

        if (permanent || folder.toLowerCase() === 'trash') {
          // Suppression définitive
          imap.addFlags(uids, ['\\Deleted'], err => {
            if (err) return reject(err);
            imap.expunge(err => {
              if (err) return reject(err);
              resolve({ success: true, deleted: uids.length });
            });
          });
        } else {
          // Déplacer vers Trash
          imap.move(uids, 'Trash', err => {
            if (err) return reject(err);
            resolve({ success: true, moved: uids.length });
          });
        }
      });
    });
  }

  /**
   * Recherche des messages
   */
  async searchMessages(userEmail, accessToken, folder, criteria) {
    const imap = await this.getConnection(userEmail, accessToken);

    return new Promise((resolve, reject) => {
      imap.openBox(folder, true, err => {
        if (err) return reject(err);

        const searchCriteria = this.buildSearchCriteria(criteria);
        
        imap.search(searchCriteria, (err, results) => {
          if (err) return reject(err);
          resolve({ uids: results, count: results.length });
        });
      });
    });
  }

  /**
   * Construit les critères de recherche IMAP
   */
  buildSearchCriteria(criteria) {
    const search = [];
    
    if (criteria.from) search.push(['FROM', criteria.from]);
    if (criteria.to) search.push(['TO', criteria.to]);
    if (criteria.subject) search.push(['SUBJECT', criteria.subject]);
    if (criteria.body) search.push(['BODY', criteria.body]);
    if (criteria.text) search.push(['TEXT', criteria.text]);
    if (criteria.since) search.push(['SINCE', criteria.since]);
    if (criteria.before) search.push(['BEFORE', criteria.before]);
    if (criteria.unseen) search.push('UNSEEN');
    if (criteria.seen) search.push('SEEN');
    if (criteria.flagged) search.push('FLAGGED');

    return search.length > 0 ? search : ['ALL'];
  }

  /**
   * Ferme toutes les connexions
   */
  async closeAll() {
    for (const [key, conn] of this.connections) {
      try {
        conn.end();
      } catch (e) {
        logger.error(`Erreur fermeture IMAP ${key}:`, e);
      }
    }
    this.connections.clear();
  }
}

module.exports = new ImapService();