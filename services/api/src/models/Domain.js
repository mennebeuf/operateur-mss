// services/api/src/models/Domain.js
const { query, transaction } = require('../config/database');
const logger = require('../utils/logger');

const DomainStatus = {
  PENDING: 'pending',
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
  DELETED: 'deleted'
};

class Domain {
  constructor(data) {
    this.id = data.id;
    this.domainName = data.domain_name;
    this.organizationName = data.organization_name;
    this.organizationType = data.organization_type;
    this.finessJuridique = data.finess_juridique;
    this.finessGeographique = data.finess_geographique;
    this.siret = data.siret;
    this.status = data.status || DomainStatus.PENDING;
    this.quotas = data.quotas || {};
    this.settings = data.settings || {};
    this.ansRegistered = data.ans_registered || false;
    this.ansRegistrationDate = data.ans_registration_date;
    this.primaryContactId = data.primary_contact_id;
    this.technicalContactId = data.technical_contact_id;
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
    this.activatedAt = data.activated_at;
    // Statistiques (si jointure)
    this.mailboxCount = data.mailbox_count;
    this.userCount = data.user_count;
  }

  toJSON() {
    return {
      id: this.id,
      domainName: this.domainName,
      organizationName: this.organizationName,
      organizationType: this.organizationType,
      finessJuridique: this.finessJuridique,
      finessGeographique: this.finessGeographique,
      siret: this.siret,
      status: this.status,
      quotas: this.quotas,
      settings: this.settings,
      ansRegistered: this.ansRegistered,
      ansRegistrationDate: this.ansRegistrationDate,
      createdAt: this.createdAt,
      activatedAt: this.activatedAt,
      stats: this.mailboxCount !== undefined ? {
        mailboxes: parseInt(this.mailboxCount, 10) || 0,
        users: parseInt(this.userCount, 10) || 0
      } : undefined
    };
  }

  // Créer un nouveau domaine
  static async create(domainData) {
    const {
      domainName, organizationName, organizationType,
      finessJuridique, finessGeographique, siret,
      quotas, settings, primaryContactId, technicalContactId
    } = domainData;

    const defaultQuotas = {
      maxMailboxes: 1000,
      maxStorageGb: 500,
      maxUsersPerMailbox: 10,
      ...quotas
    };

    const defaultSettings = {
      allowExternalEmails: true,
      requireTls: true,
      allowForwarding: false,
      retentionDays: 365,
      ...settings
    };

    const result = await query(`
      INSERT INTO domains (
        domain_name, organization_name, organization_type,
        finess_juridique, finess_geographique, siret,
        quotas, settings, primary_contact_id, technical_contact_id, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `, [
      domainName, organizationName, organizationType,
      finessJuridique, finessGeographique, siret,
      JSON.stringify(defaultQuotas), JSON.stringify(defaultSettings),
      primaryContactId, technicalContactId, DomainStatus.PENDING
    ]);

    logger.info('Domaine créé', { domainId: result.rows[0].id, domainName });
    return new Domain(result.rows[0]);
  }

  // Trouver par ID
  static async findById(id, includeStats = false) {
    let selectClause = 'd.*';
    let joinClause = '';

    if (includeStats) {
      selectClause += `,
        (SELECT COUNT(*) FROM mailboxes m WHERE m.domain_id = d.id AND m.status != 'deleted') as mailbox_count,
        (SELECT COUNT(*) FROM users u WHERE u.domain_id = d.id AND u.status != 'deleted') as user_count
      `;
    }

    const result = await query(`
      SELECT ${selectClause}
      FROM domains d
      ${joinClause}
      WHERE d.id = $1
    `, [id]);

    return result.rows[0] ? new Domain(result.rows[0]) : null;
  }

  // Trouver par nom de domaine
  static async findByName(domainName) {
    const result = await query(`
      SELECT * FROM domains WHERE LOWER(domain_name) = LOWER($1)
    `, [domainName]);

    return result.rows[0] ? new Domain(result.rows[0]) : null;
  }

  // Trouver par FINESS
  static async findByFiness(finessJuridique) {
    const result = await query(`
      SELECT * FROM domains WHERE finess_juridique = $1
    `, [finessJuridique]);

    return result.rows.map(row => new Domain(row));
  }

  // Lister tous les domaines avec filtres et pagination
  static async findAll({ page = 1, limit = 20, search, status, includeStats = true } = {}) {
    let whereClause = `WHERE d.status != 'deleted'`;
    const params = [];
    let paramIndex = 1;

    if (search) {
      whereClause += ` AND (d.domain_name ILIKE $${paramIndex} OR d.organization_name ILIKE $${paramIndex} OR d.finess_juridique = $${paramIndex + 1})`;
      params.push(`%${search}%`, search);
      paramIndex += 2;
    }

    if (status) {
      whereClause += ` AND d.status = $${paramIndex++}`;
      params.push(status);
    }

    const countResult = await query(`SELECT COUNT(*) FROM domains d ${whereClause}`, params);
    const total = parseInt(countResult.rows[0].count, 10);

    let selectClause = 'd.*';
    if (includeStats) {
      selectClause += `,
        (SELECT COUNT(*) FROM mailboxes m WHERE m.domain_id = d.id AND m.status != 'deleted') as mailbox_count,
        (SELECT COUNT(*) FROM users u WHERE u.domain_id = d.id AND u.status != 'deleted') as user_count
      `;
    }

    const offset = (page - 1) * limit;
    params.push(limit, offset);

    const result = await query(`
      SELECT ${selectClause}
      FROM domains d
      ${whereClause}
      ORDER BY d.organization_name
      LIMIT $${paramIndex++} OFFSET $${paramIndex}
    `, params);

    return {
      data: result.rows.map(row => new Domain(row)),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    };
  }

  // Mettre à jour
  async update(updates) {
    const allowedFields = [
      'organization_name', 'organization_type', 'status',
      'quotas', 'settings', 'primary_contact_id', 'technical_contact_id',
      'ans_registered', 'ans_registration_date'
    ];
    const setClauses = [];
    const params = [this.id];
    let paramIndex = 2;

    for (const [key, value] of Object.entries(updates)) {
      const dbField = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      if (allowedFields.includes(dbField)) {
        if (dbField === 'quotas' || dbField === 'settings') {
          setClauses.push(`${dbField} = $${paramIndex++}`);
          params.push(JSON.stringify(value));
        } else {
          setClauses.push(`${dbField} = $${paramIndex++}`);
          params.push(value);
        }
      }
    }

    if (setClauses.length === 0) return this;

    setClauses.push(`updated_at = CURRENT_TIMESTAMP`);

    const result = await query(`
      UPDATE domains SET ${setClauses.join(', ')}
      WHERE id = $1
      RETURNING *
    `, params);

    logger.info('Domaine mis à jour', { domainId: this.id });
    Object.assign(this, new Domain(result.rows[0]));
    return this;
  }

  // Activer le domaine
  async activate() {
    const result = await query(`
      UPDATE domains 
      SET status = 'active', activated_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `, [this.id]);

    logger.info('Domaine activé', { domainId: this.id, domainName: this.domainName });
    Object.assign(this, new Domain(result.rows[0]));
    return this;
  }

  // Suspendre
  async suspend() {
    await this.update({ status: DomainStatus.SUSPENDED });
    logger.info('Domaine suspendu', { domainId: this.id });
  }

  // Supprimer (soft delete)
  async delete() {
    await this.update({ status: DomainStatus.DELETED });
    logger.info('Domaine supprimé', { domainId: this.id });
  }

  // Obtenir les administrateurs du domaine
  async getAdmins() {
    const result = await query(`
      SELECT u.id, u.email, u.first_name, u.last_name, da.granted_at
      FROM domain_admins da
      JOIN users u ON da.user_id = u.id
      WHERE da.domain_id = $1
    `, [this.id]);

    return result.rows;
  }

  // Ajouter un administrateur
  async addAdmin(userId, grantedBy) {
    await query(`
      INSERT INTO domain_admins (domain_id, user_id, granted_by)
      VALUES ($1, $2, $3)
      ON CONFLICT (domain_id, user_id) DO NOTHING
    `, [this.id, userId, grantedBy]);

    logger.info('Admin domaine ajouté', { domainId: this.id, userId });
  }

  // Retirer un administrateur
  async removeAdmin(userId) {
    await query(`
      DELETE FROM domain_admins WHERE domain_id = $1 AND user_id = $2
    `, [this.id, userId]);

    logger.info('Admin domaine retiré', { domainId: this.id, userId });
  }

  // Vérifier les quotas
  async checkQuota(type = 'mailboxes') {
    const stats = await this.getStats();
    
    switch (type) {
      case 'mailboxes':
        return stats.mailboxCount < (this.quotas.maxMailboxes || 1000);
      case 'storage':
        return stats.totalStorageGb < (this.quotas.maxStorageGb || 500);
      default:
        return true;
    }
  }

  // Obtenir les statistiques détaillées
  async getStats() {
    const result = await query(`
      SELECT 
        COUNT(*) FILTER (WHERE status != 'deleted') as mailbox_count,
        COUNT(*) FILTER (WHERE type = 'PER' AND status != 'deleted') as personal_count,
        COUNT(*) FILTER (WHERE type = 'ORG' AND status != 'deleted') as organizational_count,
        COUNT(*) FILTER (WHERE type = 'APP' AND status != 'deleted') as applicative_count,
        COALESCE(SUM(used_mb) / 1024.0, 0) as total_storage_gb
      FROM mailboxes
      WHERE domain_id = $1
    `, [this.id]);

    const userCount = await query(`
      SELECT COUNT(*) FROM users WHERE domain_id = $1 AND status != 'deleted'
    `, [this.id]);

    return {
      mailboxCount: parseInt(result.rows[0].mailbox_count, 10),
      personalCount: parseInt(result.rows[0].personal_count, 10),
      organizationalCount: parseInt(result.rows[0].organizational_count, 10),
      applicativeCount: parseInt(result.rows[0].applicative_count, 10),
      totalStorageGb: parseFloat(result.rows[0].total_storage_gb).toFixed(2),
      userCount: parseInt(userCount.rows[0].count, 10)
    };
  }

  // Extraire le domaine depuis une adresse email
  static extractFromEmail(email) {
    const parts = email.split('@');
    return parts.length === 2 ? parts[1].toLowerCase() : null;
  }
}

Domain.Status = DomainStatus;

module.exports = Domain;