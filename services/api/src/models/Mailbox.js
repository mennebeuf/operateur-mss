// services/api/src/models/Mailbox.js
const { query, transaction } = require('../config/database');
const logger = require('../utils/logger');

// Types de BAL MSSanté
const MailboxTypes = {
  PERSONAL: 'PER',      // BAL personnelle (liée à un PS)
  ORGANIZATIONAL: 'ORG', // BAL organisationnelle (service, secrétariat)
  APPLICATIVE: 'APP'     // BAL applicative (logiciel, DPI)
};

// Statuts possibles
const MailboxStatus = {
  PENDING: 'pending',
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
  ARCHIVED: 'archived',
  DELETED: 'deleted'
};

class Mailbox {
  constructor(data) {
    this.id = data.id;
    this.email = data.email;
    this.type = data.type;
    this.status = data.status || MailboxStatus.PENDING;
    this.ownerId = data.owner_id;
    this.ownerRpps = data.owner_rpps;
    this.domainId = data.domain_id;
    this.domainName = data.domain_name;
    this.displayName = data.display_name;
    this.organizationName = data.organization_name;
    this.serviceName = data.service_name;
    this.applicationName = data.application_name;
    this.finessJuridique = data.finess_juridique;
    this.finessGeographique = data.finess_geographique;
    this.quotaMb = data.quota_mb || 5120;
    this.usedMb = data.used_mb || 0;
    this.hideFromDirectory = data.hide_from_directory || false;
    this.forwardingEmail = data.forwarding_email;
    this.autoReplyEnabled = data.auto_reply_enabled || false;
    this.autoReplyMessage = data.auto_reply_message;
    this.certificateId = data.certificate_id;
    this.createdAt = data.created_at;
    this.activatedAt = data.activated_at;
    this.updatedAt = data.updated_at;
    this.lastActivity = data.last_activity;
  }

  get quotaPercentage() {
    return this.quotaMb > 0 ? Math.round((this.usedMb / this.quotaMb) * 100) : 0;
  }

  get isOverQuota() {
    return this.usedMb >= this.quotaMb;
  }

  get localPart() {
    return this.email.split('@')[0];
  }

  toJSON() {
    return {
      id: this.id,
      email: this.email,
      type: this.type,
      status: this.status,
      ownerId: this.ownerId,
      domainId: this.domainId,
      domainName: this.domainName,
      displayName: this.displayName,
      organizationName: this.organizationName,
      serviceName: this.serviceName,
      applicationName: this.applicationName,
      finessJuridique: this.finessJuridique,
      finessGeographique: this.finessGeographique,
      quota: {
        total: this.quotaMb,
        used: this.usedMb,
        percentage: this.quotaPercentage,
        isOverQuota: this.isOverQuota
      },
      hideFromDirectory: this.hideFromDirectory,
      forwardingEmail: this.forwardingEmail,
      autoReply: {
        enabled: this.autoReplyEnabled,
        message: this.autoReplyMessage
      },
      createdAt: this.createdAt,
      activatedAt: this.activatedAt,
      lastActivity: this.lastActivity
    };
  }

  // Créer une nouvelle BAL
  static async create(mailboxData) {
    const {
      email, type, ownerId, ownerRpps, domainId, displayName,
      organizationName, serviceName, applicationName,
      finessJuridique, finessGeographique, quotaMb, hideFromDirectory
    } = mailboxData;

    const result = await query(`
      INSERT INTO mailboxes (
        email, type, owner_id, owner_rpps, domain_id, display_name,
        organization_name, service_name, application_name,
        finess_juridique, finess_geographique, quota_mb, hide_from_directory, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *
    `, [
      email, type, ownerId, ownerRpps, domainId, displayName,
      organizationName, serviceName, applicationName,
      finessJuridique, finessGeographique, quotaMb || 5120, hideFromDirectory || false,
      type === MailboxTypes.PERSONAL ? MailboxStatus.ACTIVE : MailboxStatus.PENDING
    ]);

    logger.info('BAL créée', { mailboxId: result.rows[0].id, email, type });
    return new Mailbox(result.rows[0]);
  }

  // Trouver par ID
  static async findById(id) {
    const result = await query(`
      SELECT m.*, d.domain_name
      FROM mailboxes m
      LEFT JOIN domains d ON m.domain_id = d.id
      WHERE m.id = $1
    `, [id]);

    return result.rows[0] ? new Mailbox(result.rows[0]) : null;
  }

  // Trouver par email
  static async findByEmail(email) {
    const result = await query(`
      SELECT m.*, d.domain_name
      FROM mailboxes m
      LEFT JOIN domains d ON m.domain_id = d.id
      WHERE LOWER(m.email) = LOWER($1)
    `, [email]);

    return result.rows[0] ? new Mailbox(result.rows[0]) : null;
  }

  // Trouver les BAL d'un utilisateur
  static async findByOwnerId(ownerId) {
    const result = await query(`
      SELECT m.*, d.domain_name
      FROM mailboxes m
      LEFT JOIN domains d ON m.domain_id = d.id
      WHERE m.owner_id = $1 AND m.status != 'deleted'
      ORDER BY m.created_at DESC
    `, [ownerId]);

    return result.rows.map(row => new Mailbox(row));
  }

  // Trouver les BAL d'un domaine
  static async findByDomainId(domainId, options = {}) {
    const { type, status, includeDeleted = false } = options;
    let whereClause = 'WHERE m.domain_id = $1';
    const params = [domainId];
    let paramIndex = 2;

    if (!includeDeleted) {
      whereClause += ` AND m.status != 'deleted'`;
    }

    if (type) {
      whereClause += ` AND m.type = $${paramIndex++}`;
      params.push(type);
    }

    if (status) {
      whereClause += ` AND m.status = $${paramIndex++}`;
      params.push(status);
    }

    const result = await query(`
      SELECT m.*, d.domain_name
      FROM mailboxes m
      LEFT JOIN domains d ON m.domain_id = d.id
      ${whereClause}
      ORDER BY m.email
    `, params);

    return result.rows.map(row => new Mailbox(row));
  }

  // Lister avec filtres et pagination
  static async findAll({ page = 1, limit = 20, search, type, status, domainId } = {}) {
    let whereClause = `WHERE m.status != 'deleted'`;
    const params = [];
    let paramIndex = 1;

    if (search) {
      whereClause += ` AND (m.email ILIKE $${paramIndex} OR m.display_name ILIKE $${paramIndex} OR m.organization_name ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (type) {
      whereClause += ` AND m.type = $${paramIndex++}`;
      params.push(type);
    }

    if (status) {
      whereClause += ` AND m.status = $${paramIndex++}`;
      params.push(status);
    }

    if (domainId) {
      whereClause += ` AND m.domain_id = $${paramIndex++}`;
      params.push(domainId);
    }

    const countResult = await query(
      `SELECT COUNT(*) FROM mailboxes m ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const offset = (page - 1) * limit;
    params.push(limit, offset);

    const result = await query(`
      SELECT m.*, d.domain_name
      FROM mailboxes m
      LEFT JOIN domains d ON m.domain_id = d.id
      ${whereClause}
      ORDER BY m.created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex}
    `, params);

    return {
      data: result.rows.map(row => new Mailbox(row)),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    };
  }

  // Mettre à jour
  async update(updates) {
    const allowedFields = [
      'display_name', 'status', 'quota_mb', 'hide_from_directory',
      'forwarding_email', 'auto_reply_enabled', 'auto_reply_message',
      'organization_name', 'service_name'
    ];
    const setClauses = [];
    const params = [this.id];
    let paramIndex = 2;

    for (const [key, value] of Object.entries(updates)) {
      const dbField = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      if (allowedFields.includes(dbField)) {
        setClauses.push(`${dbField} = $${paramIndex++}`);
        params.push(value);
      }
    }

    if (setClauses.length === 0) return this;

    setClauses.push(`updated_at = CURRENT_TIMESTAMP`);

    const result = await query(`
      UPDATE mailboxes SET ${setClauses.join(', ')}
      WHERE id = $1
      RETURNING *
    `, params);

    logger.info('BAL mise à jour', { mailboxId: this.id });
    Object.assign(this, new Mailbox(result.rows[0]));
    return this;
  }

  // Activer la BAL
  async activate() {
    const result = await query(`
      UPDATE mailboxes 
      SET status = 'active', activated_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `, [this.id]);

    logger.info('BAL activée', { mailboxId: this.id, email: this.email });
    Object.assign(this, new Mailbox(result.rows[0]));
    return this;
  }

  // Suspendre
  async suspend() {
    await this.update({ status: MailboxStatus.SUSPENDED });
    logger.info('BAL suspendue', { mailboxId: this.id });
  }

  // Supprimer (soft delete)
  async delete() {
    await this.update({ status: MailboxStatus.DELETED });
    logger.info('BAL supprimée', { mailboxId: this.id });
  }

  // Mettre à jour l'utilisation du quota
  async updateUsage(usedMb) {
    await query(`
      UPDATE mailboxes SET used_mb = $1, last_activity = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [usedMb, this.id]);
    this.usedMb = usedMb;
  }

  // Obtenir les délégations
  async getDelegations() {
    const result = await query(`
      SELECT md.*, u.email as user_email, u.first_name, u.last_name
      FROM mailbox_delegations md
      JOIN users u ON md.user_id = u.id
      WHERE md.mailbox_id = $1
      AND md.revoked_at IS NULL
      AND (md.expires_at IS NULL OR md.expires_at > CURRENT_TIMESTAMP)
    `, [this.id]);

    return result.rows;
  }

  // Ajouter une délégation
  async addDelegation(userId, role, grantedBy, expiresAt = null) {
    const result = await query(`
      INSERT INTO mailbox_delegations (mailbox_id, user_id, role, granted_by, expires_at)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (mailbox_id, user_id) 
      DO UPDATE SET role = $3, granted_by = $4, expires_at = $5, revoked_at = NULL
      RETURNING *
    `, [this.id, userId, role, grantedBy, expiresAt]);

    logger.info('Délégation ajoutée', { mailboxId: this.id, userId, role });
    return result.rows[0];
  }

  // Révoquer une délégation
  async revokeDelegation(userId, revokedBy) {
    await query(`
      UPDATE mailbox_delegations 
      SET revoked_at = CURRENT_TIMESTAMP, revoked_by = $3
      WHERE mailbox_id = $1 AND user_id = $2
    `, [this.id, userId, revokedBy]);

    logger.info('Délégation révoquée', { mailboxId: this.id, userId });
  }

  // Compter par type et domaine (pour statistiques)
  static async countByTypeAndDomain(domainId = null) {
    let whereClause = `WHERE status != 'deleted'`;
    const params = [];

    if (domainId) {
      whereClause += ` AND domain_id = $1`;
      params.push(domainId);
    }

    const result = await query(`
      SELECT type, COUNT(*) as count
      FROM mailboxes
      ${whereClause}
      GROUP BY type
    `, params);

    return result.rows.reduce((acc, row) => {
      acc[row.type] = parseInt(row.count, 10);
      return acc;
    }, { PER: 0, ORG: 0, APP: 0 });
  }
}

Mailbox.Types = MailboxTypes;
Mailbox.Status = MailboxStatus;

module.exports = Mailbox;