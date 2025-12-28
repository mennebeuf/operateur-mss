// services/api/src/models/Certificate.js
const { query, transaction } = require('../config/database');
const crypto = require('crypto');
const logger = require('../utils/logger');

// Types de certificats IGC Santé
const CertificateTypes = {
  SERV_SSL: 'SERV_SSL',        // Certificat serveur SSL/TLS
  ORG_AUTH_CLI: 'ORG_AUTH_CLI', // Authentification client
  ORG_SIGN: 'ORG_SIGN',        // Signature
  ORG_CONF: 'ORG_CONF'         // Confidentialité (chiffrement)
};

const CertificateStatus = {
  ACTIVE: 'active',
  EXPIRED: 'expired',
  REVOKED: 'revoked',
  PENDING: 'pending'
};

class Certificate {
  constructor(data) {
    this.id = data.id;
    this.domainId = data.domain_id;
    this.domainName = data.domain_name;
    this.mailboxId = data.mailbox_id;
    this.type = data.type;
    this.subject = data.subject;
    this.issuer = data.issuer;
    this.serialNumber = data.serial_number;
    this.fingerprintSha256 = data.fingerprint_sha256;
    this.keySize = data.key_size;
    this.certificatePem = data.certificate_pem;
    this.chainPem = data.chain_pem;
    this.issuedAt = data.issued_at;
    this.expiresAt = data.expires_at;
    this.revokedAt = data.revoked_at;
    this.status = data.status || CertificateStatus.ACTIVE;
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
  }

  get isExpired() {
    return new Date() > new Date(this.expiresAt);
  }

  get isRevoked() {
    return this.revokedAt !== null;
  }

  get daysUntilExpiry() {
    const now = new Date();
    const expiry = new Date(this.expiresAt);
    const diff = expiry - now;
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  get isExpiringSoon() {
    return this.daysUntilExpiry <= 30 && this.daysUntilExpiry > 0;
  }

  toJSON() {
    return {
      id: this.id,
      domainId: this.domainId,
      domainName: this.domainName,
      mailboxId: this.mailboxId,
      type: this.type,
      subject: this.subject,
      issuer: this.issuer,
      serialNumber: this.serialNumber,
      fingerprintSha256: this.fingerprintSha256,
      keySize: this.keySize,
      issuedAt: this.issuedAt,
      expiresAt: this.expiresAt,
      revokedAt: this.revokedAt,
      status: this.status,
      daysUntilExpiry: this.daysUntilExpiry,
      isExpired: this.isExpired,
      isExpiringSoon: this.isExpiringSoon
    };
  }

  // Créer un nouveau certificat
  static async create(certData) {
    const {
      domainId, mailboxId, type, subject, issuer, serialNumber,
      certificatePem, privateKeyPem, chainPem, issuedAt, expiresAt, keySize
    } = certData;

    // Calculer l'empreinte SHA256
    const fingerprint = Certificate.calculateFingerprint(certificatePem);

    const result = await query(`
      INSERT INTO certificates (
        domain_id, mailbox_id, type, subject, issuer, serial_number,
        fingerprint_sha256, key_size, certificate_pem, private_key_pem, chain_pem,
        issued_at, expires_at, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, pgp_sym_encrypt($10, $11), $12, $13, $14, $15)
      RETURNING id, domain_id, mailbox_id, type, subject, issuer, serial_number,
                fingerprint_sha256, key_size, certificate_pem, chain_pem,
                issued_at, expires_at, status, created_at
    `, [
      domainId, mailboxId, type, subject, issuer, serialNumber,
      fingerprint, keySize, certificatePem, privateKeyPem, 
      process.env.CERTIFICATE_ENCRYPTION_KEY,
      chainPem, issuedAt, expiresAt, CertificateStatus.ACTIVE
    ]);

    logger.info('Certificat créé', { 
      certId: result.rows[0].id, 
      type, 
      serialNumber,
      expiresAt 
    });
    
    return new Certificate(result.rows[0]);
  }

  // Trouver par ID
  static async findById(id) {
    const result = await query(`
      SELECT c.*, d.domain_name
      FROM certificates c
      LEFT JOIN domains d ON c.domain_id = d.id
      WHERE c.id = $1
    `, [id]);

    return result.rows[0] ? new Certificate(result.rows[0]) : null;
  }

  // Trouver par numéro de série
  static async findBySerialNumber(serialNumber) {
    const result = await query(`
      SELECT c.*, d.domain_name
      FROM certificates c
      LEFT JOIN domains d ON c.domain_id = d.id
      WHERE c.serial_number = $1
    `, [serialNumber]);

    return result.rows[0] ? new Certificate(result.rows[0]) : null;
  }

  // Trouver les certificats d'un domaine
  static async findByDomainId(domainId, options = {}) {
    const { type, status, includeExpired = false } = options;
    let whereClause = 'WHERE c.domain_id = $1';
    const params = [domainId];
    let paramIndex = 2;

    if (!includeExpired) {
      whereClause += ` AND c.status != 'expired'`;
    }

    if (type) {
      whereClause += ` AND c.type = $${paramIndex++}`;
      params.push(type);
    }

    if (status) {
      whereClause += ` AND c.status = $${paramIndex++}`;
      params.push(status);
    }

    const result = await query(`
      SELECT c.*, d.domain_name
      FROM certificates c
      LEFT JOIN domains d ON c.domain_id = d.id
      ${whereClause}
      ORDER BY c.expires_at DESC
    `, params);

    return result.rows.map(row => new Certificate(row));
  }

  // Trouver les certificats d'une BAL
  static async findByMailboxId(mailboxId) {
    const result = await query(`
      SELECT c.*, d.domain_name
      FROM certificates c
      LEFT JOIN domains d ON c.domain_id = d.id
      WHERE c.mailbox_id = $1 AND c.status = 'active'
      ORDER BY c.expires_at DESC
    `, [mailboxId]);

    return result.rows.map(row => new Certificate(row));
  }

  // Lister avec filtres et pagination
  static async findAll({ page = 1, limit = 20, search, type, status, domainId, expiringSoon = false } = {}) {
    let whereClause = 'WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (search) {
      whereClause += ` AND (c.subject ILIKE $${paramIndex} OR c.serial_number ILIKE $${paramIndex} OR d.domain_name ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (type) {
      whereClause += ` AND c.type = $${paramIndex++}`;
      params.push(type);
    }

    if (status) {
      whereClause += ` AND c.status = $${paramIndex++}`;
      params.push(status);
    }

    if (domainId) {
      whereClause += ` AND c.domain_id = $${paramIndex++}`;
      params.push(domainId);
    }

    if (expiringSoon) {
      whereClause += ` AND c.expires_at BETWEEN CURRENT_TIMESTAMP AND CURRENT_TIMESTAMP + INTERVAL '30 days'`;
      whereClause += ` AND c.status = 'active'`;
    }

    const countResult = await query(
      `SELECT COUNT(*) FROM certificates c LEFT JOIN domains d ON c.domain_id = d.id ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const offset = (page - 1) * limit;
    params.push(limit, offset);

    const result = await query(`
      SELECT c.*, d.domain_name
      FROM certificates c
      LEFT JOIN domains d ON c.domain_id = d.id
      ${whereClause}
      ORDER BY c.expires_at ASC
      LIMIT $${paramIndex++} OFFSET $${paramIndex}
    `, params);

    return {
      data: result.rows.map(row => new Certificate(row)),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    };
  }

  // Trouver les certificats expirant bientôt
  static async findExpiringSoon(days = 30) {
    const result = await query(`
      SELECT c.*, d.domain_name
      FROM certificates c
      LEFT JOIN domains d ON c.domain_id = d.id
      WHERE c.status = 'active'
      AND c.expires_at BETWEEN CURRENT_TIMESTAMP AND CURRENT_TIMESTAMP + INTERVAL '${days} days'
      ORDER BY c.expires_at ASC
    `);

    return result.rows.map(row => new Certificate(row));
  }

  // Révoquer le certificat
  async revoke(reason = null) {
    const result = await query(`
      UPDATE certificates 
      SET status = 'revoked', revoked_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `, [this.id]);

    logger.info('Certificat révoqué', { 
      certId: this.id, 
      serialNumber: this.serialNumber,
      reason 
    });

    Object.assign(this, new Certificate(result.rows[0]));
    return this;
  }

  // Marquer comme expiré
  async markExpired() {
    await query(`
      UPDATE certificates SET status = 'expired', updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [this.id]);
    this.status = CertificateStatus.EXPIRED;
  }

  // Obtenir la clé privée déchiffrée
  async getPrivateKey() {
    const result = await query(`
      SELECT pgp_sym_decrypt(private_key_pem, $1) as private_key
      FROM certificates WHERE id = $2
    `, [process.env.CERTIFICATE_ENCRYPTION_KEY, this.id]);

    return result.rows[0]?.private_key;
  }

  // Calculer l'empreinte SHA256 d'un certificat PEM
  static calculateFingerprint(pem) {
    // Extraire le contenu base64 du PEM
    const base64 = pem
      .replace(/-----BEGIN CERTIFICATE-----/g, '')
      .replace(/-----END CERTIFICATE-----/g, '')
      .replace(/\s/g, '');
    
    const der = Buffer.from(base64, 'base64');
    return crypto.createHash('sha256').update(der).digest('hex');
  }

  // Parser un certificat PEM pour extraire les informations
  static parsePem(pem) {
    // Note: En production, utiliser une vraie librairie comme node-forge
    // Ici, parsing simplifié pour les informations basiques
    const info = {
      subject: null,
      issuer: null,
      serialNumber: null,
      validFrom: null,
      validTo: null,
      keySize: null
    };

    // Extraction basique via regex (à remplacer par node-forge en prod)
    const subjectMatch = pem.match(/Subject: (.+)/);
    if (subjectMatch) info.subject = subjectMatch[1];

    const issuerMatch = pem.match(/Issuer: (.+)/);
    if (issuerMatch) info.issuer = issuerMatch[1];

    return info;
  }

  // Mettre à jour les statuts des certificats expirés (job cron)
  static async updateExpiredStatus() {
    const result = await query(`
      UPDATE certificates 
      SET status = 'expired', updated_at = CURRENT_TIMESTAMP
      WHERE status = 'active' AND expires_at < CURRENT_TIMESTAMP
      RETURNING id, serial_number
    `);

    if (result.rowCount > 0) {
      logger.info('Certificats marqués expirés', { count: result.rowCount });
    }

    return result.rowCount;
  }

  // Compter par type et statut (pour dashboard)
  static async getStats(domainId = null) {
    let whereClause = '';
    const params = [];

    if (domainId) {
      whereClause = 'WHERE domain_id = $1';
      params.push(domainId);
    }

    const result = await query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'active') as active,
        COUNT(*) FILTER (WHERE status = 'expired') as expired,
        COUNT(*) FILTER (WHERE status = 'revoked') as revoked,
        COUNT(*) FILTER (WHERE status = 'active' AND expires_at < CURRENT_TIMESTAMP + INTERVAL '30 days') as expiring_soon
      FROM certificates
      ${whereClause}
    `, params);

    return {
      total: parseInt(result.rows[0].total, 10),
      active: parseInt(result.rows[0].active, 10),
      expired: parseInt(result.rows[0].expired, 10),
      revoked: parseInt(result.rows[0].revoked, 10),
      expiringSoon: parseInt(result.rows[0].expiring_soon, 10)
    };
  }
}

Certificate.Types = CertificateTypes;
Certificate.Status = CertificateStatus;

module.exports = Certificate;