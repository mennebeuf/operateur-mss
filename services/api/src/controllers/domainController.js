// services/api/src/controllers/domainController.js
const { pool } = require('../config/database');
const { redisClient } = require('../config/redis');
const dnsService = require('../services/dnsService');
const certificateService = require('../services/certificateService');
const logger = require('../utils/logger');

/**
 * GET /api/v1/domains
 * Lister les domaines (Super Admin: tous, Domain Admin: ses domaines)
 */
const list = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, search } = req.query;
    const offset = (page - 1) * limit;
    const user = req.user;

    let query = `
      SELECT d.*, 
             COUNT(DISTINCT m.id) FILTER (WHERE m.status = 'active') as mailbox_count,
             COUNT(DISTINCT u.id) FILTER (WHERE u.status = 'active') as user_count
      FROM domains d
      LEFT JOIN mailboxes m ON m.domain_id = d.id
      LEFT JOIN users u ON u.domain_id = d.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    // Super admin voit tout, sinon filtre par domaine
    if (!user.isSuperAdmin) {
      query += ` AND d.id = $${paramIndex++}`;
      params.push(user.domainId);
    }

    // Filtre par statut
    if (status) {
      query += ` AND d.status = $${paramIndex++}`;
      params.push(status);
    }

    // Recherche
    if (search) {
      query += ` AND (d.domain_name ILIKE $${paramIndex} OR d.organization_name ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    query += ' GROUP BY d.id';

    // Comptage total
    const countQuery = query.replace(
      /SELECT d\.\*,[\s\S]*?FROM domains d/,
      'SELECT COUNT(DISTINCT d.id) as total FROM domains d'
    ).replace('GROUP BY d.id', '');
    
    const countResult = await pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0]?.total || 0);

    // Récupération paginée
    query += ` ORDER BY d.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    res.json({
      success: true,
      data: result.rows.map(row => ({
        id: row.id,
        domainName: row.domain_name,
        organizationName: row.organization_name,
        type: row.type,
        status: row.status,
        finessJuridique: row.finess_juridique,
        siret: row.siret,
        quotas: row.quotas,
        mailboxCount: parseInt(row.mailbox_count),
        userCount: parseInt(row.user_count),
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
    logger.error('Erreur list domains:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur récupération domaines'
    });
  }
};

/**
 * GET /api/v1/domains/:id
 * Récupérer un domaine
 */
const get = async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;

    // Vérifier l'accès
    if (!user.isSuperAdmin && user.domainId !== id) {
      return res.status(403).json({
        success: false,
        error: 'Accès non autorisé à ce domaine',
        code: 'ACCESS_DENIED'
      });
    }

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

    // Récupérer les certificats du domaine
    const certsResult = await pool.query(
      `SELECT id, type, subject, issuer, serial_number, expires_at, status
       FROM certificates
       WHERE domain_id = $1
       ORDER BY expires_at ASC`,
      [id]
    );

    // Récupérer les statistiques
    const statsResult = await pool.query(
      `SELECT 
         COUNT(*) FILTER (WHERE direction = 'inbound') as emails_received,
         COUNT(*) FILTER (WHERE direction = 'outbound') as emails_sent
       FROM email_logs
       WHERE domain_id = $1 AND created_at > NOW() - INTERVAL '30 days'`,
      [id]
    );

    res.json({
      success: true,
      data: {
        id: domain.id,
        domainName: domain.domain_name,
        organizationName: domain.organization_name,
        type: domain.type,
        status: domain.status,
        finessJuridique: domain.finess_juridique,
        siret: domain.siret,
        quotas: domain.quotas,
        settings: domain.settings,
        dnsVerified: domain.dns_verified,
        dnsVerifiedAt: domain.dns_verified_at,
        stats: {
          mailboxCount: parseInt(domain.mailbox_count),
          userCount: parseInt(domain.user_count),
          totalUsedMb: parseInt(domain.total_used_mb),
          emailsReceived30d: parseInt(statsResult.rows[0]?.emails_received || 0),
          emailsSent30d: parseInt(statsResult.rows[0]?.emails_sent || 0)
        },
        certificates: certsResult.rows.map(c => ({
          id: c.id,
          type: c.type,
          subject: c.subject,
          issuer: c.issuer,
          serialNumber: c.serial_number,
          expiresAt: c.expires_at,
          status: c.status
        })),
        createdAt: domain.created_at,
        updatedAt: domain.updated_at
      }
    });

  } catch (error) {
    logger.error('Erreur get domain:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur récupération domaine'
    });
  }
};

/**
 * POST /api/v1/domains
 * Créer un domaine (Super Admin uniquement)
 */
const create = async (req, res) => {
  const client = await pool.connect();

  try {
    const {
      domainName,
      organizationName,
      type = 'hospital',
      finessJuridique,
      siret,
      quotas = { max_mailboxes: 100, max_storage_gb: 100 },
      settings = {}
    } = req.body;

    // Vérifier que le domaine n'existe pas
    const existingResult = await client.query(
      'SELECT id FROM domains WHERE domain_name = $1',
      [domainName]
    );

    if (existingResult.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'Ce domaine existe déjà',
        code: 'DOMAIN_EXISTS'
      });
    }

    // Vérifier le format du domaine MSSanté
    if (!domainName.endsWith('.mssante.fr')) {
      return res.status(400).json({
        success: false,
        error: 'Le domaine doit se terminer par .mssante.fr',
        code: 'INVALID_DOMAIN_FORMAT'
      });
    }

    await client.query('BEGIN');

    // Créer le domaine
    const result = await client.query(
      `INSERT INTO domains (domain_name, organization_name, type, finess_juridique, siret, quotas, settings, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
       RETURNING *`,
      [domainName, organizationName, type, finessJuridique, siret, JSON.stringify(quotas), JSON.stringify(settings)]
    );

    const domain = result.rows[0];

    // Générer les enregistrements DNS requis
    const dnsRecords = dnsService.generateRequiredRecords(domainName);

    // Log d'audit
    await client.query(
      `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details, ip_address)
       VALUES ($1, 'create', 'domain', $2, $3, $4)`,
      [req.user.userId, domain.id, JSON.stringify({ domainName, organizationName }), req.ip]
    );

    await client.query('COMMIT');

    // Invalider le cache
    await redisClient.del('domains:list');

    logger.info(`Domaine créé: ${domainName}`);

    res.status(201).json({
      success: true,
      data: {
        id: domain.id,
        domainName: domain.domain_name,
        organizationName: domain.organization_name,
        type: domain.type,
        status: domain.status,
        quotas: domain.quotas,
        createdAt: domain.created_at,
        requiredDnsRecords: dnsRecords
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Erreur create domain:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur création domaine'
    });
  } finally {
    client.release();
  }
};

/**
 * PUT /api/v1/domains/:id
 * Modifier un domaine
 */
const update = async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const { organizationName, quotas, settings, status } = req.body;
    const user = req.user;

    // Vérifier l'accès
    if (!user.isSuperAdmin && user.domainId !== id) {
      return res.status(403).json({
        success: false,
        error: 'Accès non autorisé',
        code: 'ACCESS_DENIED'
      });
    }

    // Vérifier que le domaine existe
    const existingResult = await client.query(
      'SELECT * FROM domains WHERE id = $1',
      [id]
    );

    if (existingResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Domaine non trouvé',
        code: 'DOMAIN_NOT_FOUND'
      });
    }

    await client.query('BEGIN');

    // Construire la requête de mise à jour
    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (organizationName !== undefined) {
      updates.push(`organization_name = $${paramIndex++}`);
      values.push(organizationName);
    }

    if (quotas !== undefined && user.isSuperAdmin) {
      updates.push(`quotas = $${paramIndex++}`);
      values.push(JSON.stringify(quotas));
    }

    if (settings !== undefined) {
      updates.push(`settings = $${paramIndex++}`);
      values.push(JSON.stringify(settings));
    }

    if (status !== undefined && user.isSuperAdmin) {
      updates.push(`status = $${paramIndex++}`);
      values.push(status);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Aucune modification fournie'
      });
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const result = await client.query(
      `UPDATE domains SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    const domain = result.rows[0];

    // Log d'audit
    await client.query(
      `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details, ip_address)
       VALUES ($1, 'update', 'domain', $2, $3, $4)`,
      [req.user.userId, id, JSON.stringify({ changes: req.body }), req.ip]
    );

    await client.query('COMMIT');

    // Invalider le cache
    await redisClient.del('domains:list');
    await redisClient.del(`domain:${id}`);

    logger.info(`Domaine mis à jour: ${domain.domain_name}`);

    res.json({
      success: true,
      data: {
        id: domain.id,
        domainName: domain.domain_name,
        organizationName: domain.organization_name,
        type: domain.type,
        status: domain.status,
        quotas: domain.quotas,
        settings: domain.settings,
        updatedAt: domain.updated_at
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Erreur update domain:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur mise à jour domaine'
    });
  } finally {
    client.release();
  }
};

/**
 * DELETE /api/v1/domains/:id
 * Supprimer un domaine (Super Admin uniquement)
 */
const remove = async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const { permanent = false, transferTo } = req.query;

    // Vérifier que le domaine existe
    const existingResult = await client.query(
      'SELECT * FROM domains WHERE id = $1',
      [id]
    );

    if (existingResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Domaine non trouvé',
        code: 'DOMAIN_NOT_FOUND'
      });
    }

    const domain = existingResult.rows[0];

    // Vérifier qu'il n'y a plus de BAL actives
    const mailboxCheck = await client.query(
      `SELECT COUNT(*) as count FROM mailboxes WHERE domain_id = $1 AND status = 'active'`,
      [id]
    );

    if (parseInt(mailboxCheck.rows[0].count) > 0 && !transferTo) {
      return res.status(400).json({
        success: false,
        error: 'Le domaine contient encore des BAL actives',
        code: 'DOMAIN_NOT_EMPTY'
      });
    }

    await client.query('BEGIN');

    if (transferTo) {
      // Transférer les ressources
      await client.query(
        `UPDATE mailboxes SET domain_id = $1 WHERE domain_id = $2`,
        [transferTo, id]
      );
      await client.query(
        `UPDATE users SET domain_id = $1 WHERE domain_id = $2`,
        [transferTo, id]
      );
    }

    if (permanent) {
      // Suppression définitive
      await client.query('DELETE FROM domains WHERE id = $1', [id]);
    } else {
      // Soft delete
      await client.query(
        `UPDATE domains SET status = 'deleted', deleted_at = NOW() WHERE id = $1`,
        [id]
      );
    }

    // Log d'audit
    await client.query(
      `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details, ip_address)
       VALUES ($1, 'delete', 'domain', $2, $3, $4)`,
      [req.user.userId, id, JSON.stringify({ permanent, transferTo, domainName: domain.domain_name }), req.ip]
    );

    await client.query('COMMIT');

    // Invalider le cache
    await redisClient.del('domains:list');
    await redisClient.del(`domain:${id}`);

    logger.info(`Domaine supprimé: ${domain.domain_name} (permanent: ${permanent})`);

    res.json({
      success: true,
      message: permanent ? 'Domaine supprimé définitivement' : 'Domaine désactivé'
    });

  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Erreur delete domain:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur suppression domaine'
    });
  } finally {
    client.release();
  }
};

/**
 * POST /api/v1/domains/:id/verify-dns
 * Vérifier la configuration DNS du domaine
 */
const verifyDns = async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;

    const domainResult = await client.query(
      'SELECT * FROM domains WHERE id = $1',
      [id]
    );

    if (domainResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Domaine non trouvé'
      });
    }

    const domain = domainResult.rows[0];

    // Vérifier les enregistrements DNS
    const dnsCheck = await dnsService.verifyDomain(domain.domain_name);

    await client.query('BEGIN');

    // Mettre à jour le statut
    if (dnsCheck.allValid) {
      await client.query(
        `UPDATE domains SET dns_verified = true, dns_verified_at = NOW(), status = 'active' WHERE id = $1`,
        [id]
      );
    }

    // Log d'audit
    await client.query(
      `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details, ip_address)
       VALUES ($1, 'verify_dns', 'domain', $2, $3, $4)`,
      [req.user.userId, id, JSON.stringify(dnsCheck), req.ip]
    );

    await client.query('COMMIT');

    logger.info(`Vérification DNS pour ${domain.domain_name}: ${dnsCheck.allValid ? 'OK' : 'FAILED'}`);

    res.json({
      success: true,
      data: {
        domainName: domain.domain_name,
        allValid: dnsCheck.allValid,
        records: dnsCheck.records
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Erreur verify DNS:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur vérification DNS'
    });
  } finally {
    client.release();
  }
};

/**
 * GET /api/v1/domains/:id/statistics
 * Récupérer les statistiques détaillées du domaine
 */
const getStatistics = async (req, res) => {
  try {
    const { id } = req.params;
    const { period = '30d' } = req.query;
    const user = req.user;

    // Vérifier l'accès
    if (!user.isSuperAdmin && user.domainId !== id) {
      return res.status(403).json({
        success: false,
        error: 'Accès non autorisé'
      });
    }

    // Calculer l'intervalle
    const intervalMap = {
      '7d': '7 days',
      '30d': '30 days',
      '90d': '90 days',
      '1y': '1 year'
    };
    const interval = intervalMap[period] || '30 days';

    // Statistiques globales
    const globalStats = await pool.query(
      `SELECT 
         COUNT(*) FILTER (WHERE direction = 'inbound') as emails_received,
         COUNT(*) FILTER (WHERE direction = 'outbound') as emails_sent,
         AVG(size_bytes) as avg_size,
         SUM(size_bytes) as total_size
       FROM email_logs
       WHERE domain_id = $1 AND created_at > NOW() - INTERVAL '${interval}'`,
      [id]
    );

    // Statistiques par jour
    const dailyStats = await pool.query(
      `SELECT 
         DATE(created_at) as date,
         COUNT(*) FILTER (WHERE direction = 'inbound') as received,
         COUNT(*) FILTER (WHERE direction = 'outbound') as sent
       FROM email_logs
       WHERE domain_id = $1 AND created_at > NOW() - INTERVAL '${interval}'
       GROUP BY DATE(created_at)
       ORDER BY date`,
      [id]
    );

    // Top expéditeurs/destinataires
    const topSenders = await pool.query(
      `SELECT sender_email, COUNT(*) as count
       FROM email_logs
       WHERE domain_id = $1 AND direction = 'outbound' AND created_at > NOW() - INTERVAL '${interval}'
       GROUP BY sender_email
       ORDER BY count DESC
       LIMIT 10`,
      [id]
    );

    // Utilisation des quotas
    const quotaUsage = await pool.query(
      `SELECT 
         COUNT(*) as mailbox_count,
         SUM(used_mb) as total_used_mb,
         SUM(quota_mb) as total_quota_mb
       FROM mailboxes
       WHERE domain_id = $1 AND status = 'active'`,
      [id]
    );

    res.json({
      success: true,
      data: {
        period,
        global: {
          emailsReceived: parseInt(globalStats.rows[0]?.emails_received || 0),
          emailsSent: parseInt(globalStats.rows[0]?.emails_sent || 0),
          avgSizeBytes: Math.round(globalStats.rows[0]?.avg_size || 0),
          totalSizeBytes: parseInt(globalStats.rows[0]?.total_size || 0)
        },
        daily: dailyStats.rows.map(row => ({
          date: row.date,
          received: parseInt(row.received),
          sent: parseInt(row.sent)
        })),
        topSenders: topSenders.rows.map(row => ({
          email: row.sender_email,
          count: parseInt(row.count)
        })),
        quotaUsage: {
          mailboxCount: parseInt(quotaUsage.rows[0]?.mailbox_count || 0),
          usedMb: parseInt(quotaUsage.rows[0]?.total_used_mb || 0),
          totalQuotaMb: parseInt(quotaUsage.rows[0]?.total_quota_mb || 0)
        }
      }
    });

  } catch (error) {
    logger.error('Erreur get statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur récupération statistiques'
    });
  }
};

/**
 * GET /api/v1/domains/:id/dns-records
 * Récupérer les enregistrements DNS requis
 */
const getDnsRecords = async (req, res) => {
  try {
    const { id } = req.params;

    const domainResult = await pool.query(
      'SELECT domain_name FROM domains WHERE id = $1',
      [id]
    );

    if (domainResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Domaine non trouvé'
      });
    }

    const domainName = domainResult.rows[0].domain_name;
    const dnsRecords = dnsService.generateRequiredRecords(domainName);

    res.json({
      success: true,
      data: {
        domainName,
        records: dnsRecords
      }
    });

  } catch (error) {
    logger.error('Erreur get DNS records:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur génération enregistrements DNS'
    });
  }
};

module.exports = {
  list,
  get,
  create,
  update,
  remove,
  verifyDns,
  getStatistics,
  getDnsRecords
};