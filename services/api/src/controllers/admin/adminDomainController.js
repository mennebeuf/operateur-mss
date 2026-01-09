// services/api/src/controllers/admin/domainController.js
/**
 * Contrôleur d'administration des domaines (Super Admin)
 */

const { pool } = require('../../config/database');
const logger = require('../../utils/logger');

/**
 * GET /api/v1/admin/domains
 * Liste complète de tous les domaines
 */
const list = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = '',
      status = '',
      sortBy = 'created',
      sortOrder = 'desc'
    } = req.query;

    const offset = (page - 1) * limit;
    const allowedSort = ['name', 'created', 'mailboxCount', 'storage'];
    const sortField = allowedSort.includes(sortBy) ? sortBy : 'created_at';

    let query = `
      SELECT d.*,
             COUNT(DISTINCT m.id) FILTER (WHERE m.status = 'active') as mailbox_count,
             COUNT(DISTINCT u.id) FILTER (WHERE u.status = 'active') as user_count,
             COALESCE(SUM(m.used_mb), 0) as total_used_mb
      FROM domains d
      LEFT JOIN mailboxes m ON m.domain_id = d.id
      LEFT JOIN users u ON u.domain_id = d.id
      WHERE 1=1
    `;

    const params = [];
    let paramCount = 0;

    if (search) {
      paramCount++;
      query += ` AND (d.domain_name ILIKE $${paramCount} OR d.organization_name ILIKE $${paramCount})`;
      params.push(`%${search}%`);
    }

    if (status) {
      paramCount++;
      query += ` AND d.status = $${paramCount}`;
      params.push(status);
    }

    query += ` GROUP BY d.id`;
    query += ` ORDER BY ${sortField === 'mailboxCount' ? 'mailbox_count' : sortField === 'storage' ? 'total_used_mb' : `d.${sortField}`} ${sortOrder.toUpperCase()}`;
    query += ` LIMIT $${++paramCount} OFFSET $${++paramCount}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    const countQuery = `SELECT COUNT(*) FROM domains WHERE 1=1${search ? ' AND (domain_name ILIKE $1 OR organization_name ILIKE $1)' : ''}${status ? ` AND status = $${search ? 2 : 1}` : ''}`;
    const countParams = [];
    if (search) countParams.push(`%${search}%`);
    if (status) countParams.push(status);
    const countResult = await pool.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].count);

    res.json({
      success: true,
      data: result.rows.map(row => ({
        id: row.id,
        domainName: row.domain_name,
        organizationName: row.organization_name,
        organizationType: row.organization_type,
        status: row.status,
        mailboxCount: parseInt(row.mailbox_count),
        userCount: parseInt(row.user_count),
        totalUsedMb: parseFloat(row.total_used_mb),
        quotas: row.quotas,
        createdAt: row.created_at
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    logger.error('Erreur list domains (admin):', error);
    res.status(500).json({
      success: false,
      error: 'Erreur récupération domaines'
    });
  }
};

/**
 * POST /api/v1/admin/domains
 * Créer un nouveau domaine
 */
const create = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const {
      domainName,
      organizationName,
      organizationType,
      finessJuridique,
      siret,
      contactEmail,
      contactPhone,
      quotas = { maxMailboxes: 50, maxStorageGb: 50, maxUsersPerMailbox: 5 }
    } = req.body;

    // Vérifier si le domaine existe déjà
    const existingDomain = await client.query('SELECT id FROM domains WHERE domain_name = $1', [
      domainName
    ]);

    if (existingDomain.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        success: false,
        error: 'Ce domaine existe déjà',
        code: 'DOMAIN_EXISTS'
      });
    }

    // Créer le domaine
    const domainResult = await client.query(
      `INSERT INTO domains (
        domain_name, organization_name, organization_type,
        finess_juridique, siret, contact_email, contact_phone,
        quotas, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')
      RETURNING *`,
      [
        domainName,
        organizationName,
        organizationType,
        finessJuridique,
        siret,
        contactEmail,
        contactPhone,
        JSON.stringify(quotas)
      ]
    );

    const domain = domainResult.rows[0];

    // Créer les enregistrements DNS requis
    const dnsRecords = [
      { type: 'MX', name: `@.${domainName}`, value: `mail.${domainName}`, priority: 10 },
      { type: 'A', name: `mail.${domainName}`, value: process.env.SERVER_IP || '0.0.0.0' },
      { type: 'TXT', name: `@.${domainName}`, value: `v=spf1 mx ~all` },
      {
        type: 'TXT',
        name: `_dmarc.${domainName}`,
        value: `v=DMARC1; p=quarantine; rua=mailto:postmaster@${domainName}`
      }
    ];

    for (const record of dnsRecords) {
      await client.query(
        'INSERT INTO dns_records (domain_id, type, name, value, priority) VALUES ($1, $2, $3, $4, $5)',
        [domain.id, record.type, record.name, record.value, record.priority || null]
      );
    }

    await client.query('COMMIT');

    logger.info('Domaine créé:', { domainId: domain.id, domainName });

    res.status(201).json({
      success: true,
      data: {
        id: domain.id,
        domainName: domain.domain_name,
        organizationName: domain.organization_name,
        status: domain.status,
        createdAt: domain.created_at
      }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Erreur création domaine:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur création domaine'
    });
  } finally {
    client.release();
  }
};

/**
 * GET /api/v1/admin/domains/:id
 * Détails complets d'un domaine
 */
const get = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT d.*,
              COUNT(DISTINCT m.id) FILTER (WHERE m.status = 'active') as mailbox_count,
              COUNT(DISTINCT u.id) FILTER (WHERE u.status = 'active') as user_count,
              COALESCE(SUM(m.used_mb), 0) as total_used_mb
       FROM domains d
       LEFT JOIN mailboxes m ON m.domain_id = d.id
       LEFT JOIN users u ON u.domain_id = d.id
       WHERE d.id = $1
       GROUP BY d.id`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Domaine non trouvé',
        code: 'DOMAIN_NOT_FOUND'
      });
    }

    const domain = result.rows[0];

    res.json({
      success: true,
      data: {
        id: domain.id,
        domainName: domain.domain_name,
        organizationName: domain.organization_name,
        organizationType: domain.organization_type,
        finessJuridique: domain.finess_juridique,
        siret: domain.siret,
        contactEmail: domain.contact_email,
        contactPhone: domain.contact_phone,
        status: domain.status,
        quotas: domain.quotas,
        mailboxCount: parseInt(domain.mailbox_count),
        userCount: parseInt(domain.user_count),
        totalUsedMb: parseFloat(domain.total_used_mb),
        createdAt: domain.created_at,
        updatedAt: domain.updated_at
      }
    });
  } catch (error) {
    logger.error('Erreur get domain (admin):', error);
    res.status(500).json({
      success: false,
      error: 'Erreur récupération domaine'
    });
  }
};

/**
 * PUT /api/v1/admin/domains/:id
 * Mettre à jour un domaine
 */
const update = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const allowedFields = [
      'organization_name',
      'organization_type',
      'finess_juridique',
      'siret',
      'contact_email',
      'contact_phone',
      'status'
    ];

    const setClause = [];
    const values = [];
    let paramCount = 0;

    Object.keys(updates).forEach(key => {
      const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
      if (allowedFields.includes(snakeKey)) {
        paramCount++;
        setClause.push(`${snakeKey} = $${paramCount}`);
        values.push(updates[key]);
      }
    });

    if (setClause.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Aucun champ valide à mettre à jour'
      });
    }

    values.push(id);
    const query = `
      UPDATE domains
      SET ${setClause.join(', ')}, updated_at = NOW()
      WHERE id = $${paramCount + 1}
      RETURNING *
    `;

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Domaine non trouvé'
      });
    }

    logger.info('Domaine mis à jour:', { domainId: id });

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    logger.error('Erreur update domain (admin):', error);
    res.status(500).json({
      success: false,
      error: 'Erreur mise à jour domaine'
    });
  }
};

/**
 * DELETE /api/v1/admin/domains/:id
 * Supprimer un domaine
 */
const deleteDomain = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { id } = req.params;

    // Vérifier si le domaine a des BAL actives
    const mailboxCheck = await client.query(
      'SELECT COUNT(*) FROM mailboxes WHERE domain_id = $1 AND status = $2',
      [id, 'active']
    );

    if (parseInt(mailboxCheck.rows[0].count) > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        success: false,
        error: 'Impossible de supprimer un domaine avec des BAL actives',
        code: 'DOMAIN_HAS_ACTIVE_MAILBOXES'
      });
    }

    // Supprimer les entités liées
    await client.query('DELETE FROM dns_records WHERE domain_id = $1', [id]);
    await client.query('DELETE FROM certificates WHERE domain_id = $1', [id]);
    await client.query('DELETE FROM mailboxes WHERE domain_id = $1', [id]);
    await client.query('DELETE FROM users WHERE domain_id = $1', [id]);

    // Supprimer le domaine
    const result = await client.query('DELETE FROM domains WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        error: 'Domaine non trouvé'
      });
    }

    await client.query('COMMIT');

    logger.info('Domaine supprimé:', { domainId: id });

    res.json({
      success: true,
      message: 'Domaine supprimé avec succès'
    });
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Erreur delete domain (admin):', error);
    res.status(500).json({
      success: false,
      error: 'Erreur suppression domaine'
    });
  } finally {
    client.release();
  }
};

/**
 * POST /api/v1/admin/domains/:id/suspend
 * Suspendre un domaine
 */
const suspend = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const result = await pool.query(
      `UPDATE domains
       SET status = 'suspended', updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Domaine non trouvé'
      });
    }

    logger.warn('Domaine suspendu:', { domainId: id, reason });

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    logger.error('Erreur suspend domain:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur suspension domaine'
    });
  }
};

/**
 * POST /api/v1/admin/domains/:id/activate
 * Activer un domaine
 */
const activate = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `UPDATE domains
       SET status = 'active', updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Domaine non trouvé'
      });
    }

    logger.info('Domaine activé:', { domainId: id });

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    logger.error('Erreur activate domain:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur activation domaine'
    });
  }
};

/**
 * GET /api/v1/admin/domains/:id/statistics
 * Statistiques détaillées d'un domaine
 */
const getStatistics = async (req, res) => {
  try {
    const { id } = req.params;

    const stats = await pool.query(
      `SELECT
         COUNT(DISTINCT m.id) as total_mailboxes,
         COUNT(DISTINCT m.id) FILTER (WHERE m.status = 'active') as active_mailboxes,
         COUNT(DISTINCT u.id) as total_users,
         COUNT(DISTINCT u.id) FILTER (WHERE u.status = 'active') as active_users,
         COALESCE(SUM(m.quota_mb), 0) as total_quota_mb,
         COALESCE(SUM(m.used_mb), 0) as total_used_mb,
         COUNT(DISTINCT c.id) as certificate_count,
         COUNT(DISTINCT c.id) FILTER (WHERE c.expires_at < NOW() + INTERVAL '30 days') as expiring_certificates
       FROM domains d
       LEFT JOIN mailboxes m ON m.domain_id = d.id
       LEFT JOIN users u ON u.domain_id = d.id
       LEFT JOIN certificates c ON c.domain_id = d.id AND c.status = 'active'
       WHERE d.id = $1
       GROUP BY d.id`,
      [id]
    );

    if (stats.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Domaine non trouvé'
      });
    }

    res.json({
      success: true,
      data: {
        mailboxes: {
          total: parseInt(stats.rows[0].total_mailboxes),
          active: parseInt(stats.rows[0].active_mailboxes)
        },
        users: {
          total: parseInt(stats.rows[0].total_users),
          active: parseInt(stats.rows[0].active_users)
        },
        storage: {
          totalQuotaMb: parseFloat(stats.rows[0].total_quota_mb),
          totalUsedMb: parseFloat(stats.rows[0].total_used_mb),
          usagePercentage:
            stats.rows[0].total_quota_mb > 0
              ? ((stats.rows[0].total_used_mb / stats.rows[0].total_quota_mb) * 100).toFixed(2)
              : 0
        },
        certificates: {
          total: parseInt(stats.rows[0].certificate_count),
          expiringSoon: parseInt(stats.rows[0].expiring_certificates)
        }
      }
    });
  } catch (error) {
    logger.error('Erreur get domain statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur récupération statistiques'
    });
  }
};

module.exports = {
  list,
  create,
  get,
  update,
  delete: deleteDomain,
  suspend,
  activate,
  getStatistics
};
