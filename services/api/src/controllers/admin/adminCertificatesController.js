// services/api/src/controllers/admin/certificatesController.js
/**
 * Contrôleur d'administration des certificats (Super Admin)
 */

const { pool } = require('../../config/database');
const logger = require('../../utils/logger');
const { verifyCertificate, extractCertificateInfo } = require('../../utils/certificateUtils');

/**
 * GET /api/v1/admin/certificates
 * Liste de tous les certificats (tous domaines)
 */
const list = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      domainId = '',
      type = '',
      status = '',
      expiringSoon = false,
      days = 30
    } = req.query;

    const offset = (page - 1) * limit;

    let query = `
      SELECT c.*, d.domain_name, d.organization_name, m.email as mailbox_email
      FROM certificates c
      LEFT JOIN domains d ON d.id = c.domain_id
      LEFT JOIN mailboxes m ON m.id = c.mailbox_id
      WHERE 1=1
    `;

    const params = [];
    let paramCount = 0;

    if (domainId) {
      paramCount++;
      query += ` AND c.domain_id = $${paramCount}`;
      params.push(domainId);
    }

    if (type) {
      paramCount++;
      query += ` AND c.type = $${paramCount}`;
      params.push(type);
    }

    if (status) {
      paramCount++;
      query += ` AND c.status = $${paramCount}`;
      params.push(status);
    }

    if (expiringSoon === 'true' || expiringSoon === true) {
      paramCount++;
      query += ` AND c.expires_at <= NOW() + INTERVAL '${parseInt(days)} days' AND c.expires_at > NOW()`;
    }

    query += ` ORDER BY c.expires_at ASC`;
    query += ` LIMIT $${++paramCount} OFFSET $${++paramCount}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    const countQuery = `SELECT COUNT(*) FROM certificates c WHERE 1=1${domainId ? ` AND c.domain_id = '${domainId}'` : ''}${type ? ` AND c.type = '${type}'` : ''}${status ? ` AND c.status = '${status}'` : ''}${expiringSoon === 'true' ? ` AND c.expires_at <= NOW() + INTERVAL '${days} days' AND c.expires_at > NOW()` : ''}`;
    const countResult = await pool.query(countQuery);
    const total = parseInt(countResult.rows[0].count);

    res.json({
      success: true,
      data: result.rows.map(row => ({
        id: row.id,
        type: row.type,
        subject: row.subject,
        issuer: row.issuer,
        serialNumber: row.serial_number,
        validFrom: row.valid_from,
        validTo: row.valid_to,
        expiresAt: row.expires_at,
        status: row.status,
        domainId: row.domain_id,
        domainName: row.domain_name,
        organizationName: row.organization_name,
        mailboxEmail: row.mailbox_email,
        daysUntilExpiry: Math.ceil((new Date(row.expires_at) - new Date()) / (1000 * 60 * 60 * 24)),
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
    logger.error('Erreur list certificates (admin):', error);
    res.status(500).json({
      success: false,
      error: 'Erreur récupération certificats'
    });
  }
};

/**
 * GET /api/v1/admin/certificates/:id
 * Détails d'un certificat
 */
const get = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT c.*, d.domain_name, d.organization_name, m.email as mailbox_email
       FROM certificates c
       LEFT JOIN domains d ON d.id = c.domain_id
       LEFT JOIN mailboxes m ON m.id = c.mailbox_id
       WHERE c.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Certificat non trouvé',
        code: 'CERTIFICATE_NOT_FOUND'
      });
    }

    const cert = result.rows[0];

    res.json({
      success: true,
      data: {
        id: cert.id,
        type: cert.type,
        subject: cert.subject,
        issuer: cert.issuer,
        serialNumber: cert.serial_number,
        validFrom: cert.valid_from,
        validTo: cert.valid_to,
        expiresAt: cert.expires_at,
        status: cert.status,
        domainId: cert.domain_id,
        domainName: cert.domain_name,
        organizationName: cert.organization_name,
        mailboxId: cert.mailbox_id,
        mailboxEmail: cert.mailbox_email,
        fingerprint: cert.fingerprint,
        publicKey: cert.public_key,
        daysUntilExpiry: Math.ceil(
          (new Date(cert.expires_at) - new Date()) / (1000 * 60 * 60 * 24)
        ),
        createdAt: cert.created_at,
        updatedAt: cert.updated_at
      }
    });
  } catch (error) {
    logger.error('Erreur get certificate (admin):', error);
    res.status(500).json({
      success: false,
      error: 'Erreur récupération certificat'
    });
  }
};

/**
 * DELETE /api/v1/admin/certificates/:id
 * Supprimer/Révoquer un certificat
 */
const revoke = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason = 'administrative_revocation' } = req.body;

    const result = await pool.query(
      `UPDATE certificates
       SET status = 'revoked', updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Certificat non trouvé'
      });
    }

    // Logger l'action de révocation
    await pool.query(
      `INSERT INTO audit_logs (
        user_id, action, resource_type, resource_id, details
      ) VALUES ($1, $2, $3, $4, $5)`,
      [req.user.id, 'certificate_revoked', 'certificate', id, JSON.stringify({ reason })]
    );

    logger.warn('Certificat révoqué (admin):', { certificateId: id, reason });

    res.json({
      success: true,
      message: 'Certificat révoqué avec succès',
      data: result.rows[0]
    });
  } catch (error) {
    logger.error('Erreur revoke certificate (admin):', error);
    res.status(500).json({
      success: false,
      error: 'Erreur révocation certificat'
    });
  }
};

/**
 * GET /api/v1/admin/certificates/expiring
 * Certificats expirant bientôt (tous domaines)
 */
const getExpiring = async (req, res) => {
  try {
    const { days = 30 } = req.query;

    const result = await pool.query(
      `SELECT c.*, d.domain_name, d.organization_name, m.email as mailbox_email
       FROM certificates c
       LEFT JOIN domains d ON d.id = c.domain_id
       LEFT JOIN mailboxes m ON m.id = c.mailbox_id
       WHERE c.status = 'active'
         AND c.expires_at <= NOW() + INTERVAL '${parseInt(days)} days'
         AND c.expires_at > NOW()
       ORDER BY c.expires_at ASC`
    );

    res.json({
      success: true,
      data: result.rows.map(row => ({
        id: row.id,
        type: row.type,
        subject: row.subject,
        domainName: row.domain_name,
        organizationName: row.organization_name,
        mailboxEmail: row.mailbox_email,
        expiresAt: row.expires_at,
        daysUntilExpiry: Math.ceil((new Date(row.expires_at) - new Date()) / (1000 * 60 * 60 * 24))
      })),
      count: result.rows.length
    });
  } catch (error) {
    logger.error('Erreur get expiring certificates (admin):', error);
    res.status(500).json({
      success: false,
      error: 'Erreur récupération certificats expirant'
    });
  }
};

/**
 * POST /api/v1/admin/certificates/:id/renew
 * Initier le renouvellement d'un certificat
 */
const initiateRenewal = async (req, res) => {
  try {
    const { id } = req.params;

    const certResult = await pool.query('SELECT * FROM certificates WHERE id = $1', [id]);

    if (certResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Certificat non trouvé'
      });
    }

    const cert = certResult.rows[0];

    // Créer une demande de renouvellement
    await pool.query(
      `INSERT INTO certificate_renewal_requests (
        certificate_id, domain_id, status, requested_by
      ) VALUES ($1, $2, 'pending', $3)`,
      [id, cert.domain_id, req.user.id]
    );

    logger.info('Renouvellement initié (admin):', { certificateId: id });

    res.json({
      success: true,
      message: 'Demande de renouvellement créée'
    });
  } catch (error) {
    logger.error('Erreur initiate renewal (admin):', error);
    res.status(500).json({
      success: false,
      error: 'Erreur initiation renouvellement'
    });
  }
};

/**
 * GET /api/v1/admin/certificates/statistics
 * Statistiques globales sur les certificats
 */
const getStatistics = async (req, res) => {
  try {
    const stats = await pool.query(`
      SELECT
        COUNT(*) as total_certificates,
        COUNT(*) FILTER (WHERE status = 'active') as active_certificates,
        COUNT(*) FILTER (WHERE status = 'expired') as expired_certificates,
        COUNT(*) FILTER (WHERE status = 'revoked') as revoked_certificates,
        COUNT(*) FILTER (WHERE expires_at <= NOW() + INTERVAL '30 days' AND expires_at > NOW() AND status = 'active') as expiring_30_days,
        COUNT(*) FILTER (WHERE expires_at <= NOW() + INTERVAL '60 days' AND expires_at > NOW() AND status = 'active') as expiring_60_days,
        COUNT(*) FILTER (WHERE expires_at <= NOW() + INTERVAL '90 days' AND expires_at > NOW() AND status = 'active') as expiring_90_days,
        COUNT(*) FILTER (WHERE type = 'ssl_tls') as ssl_tls_count,
        COUNT(*) FILTER (WHERE type = 'smime') as smime_count,
        COUNT(*) FILTER (WHERE type = 'psc') as psc_count
      FROM certificates
    `);

    res.json({
      success: true,
      data: {
        total: parseInt(stats.rows[0].total_certificates),
        active: parseInt(stats.rows[0].active_certificates),
        expired: parseInt(stats.rows[0].expired_certificates),
        revoked: parseInt(stats.rows[0].revoked_certificates),
        expiring: {
          days30: parseInt(stats.rows[0].expiring_30_days),
          days60: parseInt(stats.rows[0].expiring_60_days),
          days90: parseInt(stats.rows[0].expiring_90_days)
        },
        byType: {
          sslTls: parseInt(stats.rows[0].ssl_tls_count),
          smime: parseInt(stats.rows[0].smime_count),
          psc: parseInt(stats.rows[0].psc_count)
        }
      }
    });
  } catch (error) {
    logger.error('Erreur get certificate statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur récupération statistiques'
    });
  }
};

/**
 * POST /api/v1/admin/certificates/bulk-revoke
 * Révoquer plusieurs certificats
 */
const bulkRevoke = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { certificateIds, reason = 'administrative_revocation' } = req.body;

    if (!Array.isArray(certificateIds) || certificateIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Liste de certificats invalide'
      });
    }

    const result = await client.query(
      `UPDATE certificates
       SET status = 'revoked', updated_at = NOW()
       WHERE id = ANY($1::uuid[])
       RETURNING id`,
      [certificateIds]
    );

    // Logger l'action
    for (const cert of result.rows) {
      await client.query(
        `INSERT INTO audit_logs (
          user_id, action, resource_type, resource_id, details
        ) VALUES ($1, $2, $3, $4, $5)`,
        [
          req.user.id,
          'certificate_revoked',
          'certificate',
          cert.id,
          JSON.stringify({ reason, bulk: true })
        ]
      );
    }

    await client.query('COMMIT');

    logger.warn('Certificats révoqués en masse (admin):', {
      count: result.rows.length,
      reason
    });

    res.json({
      success: true,
      message: `${result.rows.length} certificat(s) révoqué(s)`,
      count: result.rows.length
    });
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Erreur bulk revoke certificates (admin):', error);
    res.status(500).json({
      success: false,
      error: 'Erreur révocation en masse'
    });
  } finally {
    client.release();
  }
};

module.exports = {
  list,
  get,
  revoke,
  getExpiring,
  initiateRenewal,
  getStatistics,
  bulkRevoke
};
