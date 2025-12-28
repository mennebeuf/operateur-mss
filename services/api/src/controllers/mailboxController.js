// services/api/src/controllers/mailboxController.js
const { pool } = require('../config/database');
const { redisClient } = require('../config/redis');
const annuaireService = require('../services/annuaire');
const mailService = require('../services/mailService');
const logger = require('../utils/logger');

/**
 * GET /api/v1/mailboxes
 * Lister les boîtes aux lettres
 */
const list = async (req, res) => {
  try {
    const { page = 1, limit = 20, type, status, search } = req.query;
    const offset = (page - 1) * limit;
    const domainId = req.domain?.id || req.user.domainId;

    let query = `
      SELECT m.*, u.first_name, u.last_name, u.rpps_id,
             d.domain_name, d.organization_name
      FROM mailboxes m
      LEFT JOIN users u ON m.owner_id = u.id
      LEFT JOIN domains d ON m.domain_id = d.id
      WHERE m.domain_id = $1
    `;
    const params = [domainId];
    let paramIndex = 2;

    // Filtres optionnels
    if (type) {
      query += ` AND m.type = $${paramIndex++}`;
      params.push(type);
    }

    if (status) {
      query += ` AND m.status = $${paramIndex++}`;
      params.push(status);
    }

    if (search) {
      query += ` AND (m.email ILIKE $${paramIndex} OR u.first_name ILIKE $${paramIndex} OR u.last_name ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    // Comptage total
    const countResult = await pool.query(
      query.replace('SELECT m.*, u.first_name, u.last_name, u.rpps_id, d.domain_name, d.organization_name', 'SELECT COUNT(*) as total'),
      params
    );
    const total = parseInt(countResult.rows[0].total);

    // Récupération paginée
    query += ` ORDER BY m.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    res.json({
      success: true,
      data: result.rows.map(row => ({
        id: row.id,
        email: row.email,
        type: row.type,
        status: row.status,
        quotaMb: row.quota_mb,
        usedMb: row.used_mb,
        createdAt: row.created_at,
        owner: row.owner_id ? {
          id: row.owner_id,
          firstName: row.first_name,
          lastName: row.last_name,
          rppsId: row.rpps_id
        } : null,
        domain: {
          id: row.domain_id,
          name: row.domain_name,
          organization: row.organization_name
        }
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    logger.error('Erreur list mailboxes:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur récupération des BAL'
    });
  }
};

/**
 * GET /api/v1/mailboxes/:id
 * Récupérer une boîte aux lettres
 */
const get = async (req, res) => {
  try {
    const { id } = req.params;
    const domainId = req.domain?.id || req.user.domainId;

    const result = await pool.query(
      `SELECT m.*, u.first_name, u.last_name, u.rpps_id, u.email as owner_email,
              d.domain_name, d.organization_name,
              c.id as cert_id, c.subject as cert_subject, c.expires_at as cert_expires
       FROM mailboxes m
       LEFT JOIN users u ON m.owner_id = u.id
       LEFT JOIN domains d ON m.domain_id = d.id
       LEFT JOIN certificates c ON c.mailbox_id = m.id AND c.status = 'active'
       WHERE m.id = $1 AND m.domain_id = $2`,
      [id, domainId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'BAL non trouvée',
        code: 'MAILBOX_NOT_FOUND'
      });
    }

    const row = result.rows[0];

    // Récupérer les délégations
    const delegationsResult = await pool.query(
      `SELECT md.*, u.email, u.first_name, u.last_name
       FROM mailbox_delegations md
       JOIN users u ON md.delegate_id = u.id
       WHERE md.mailbox_id = $1 AND md.status = 'active'`,
      [id]
    );

    res.json({
      success: true,
      data: {
        id: row.id,
        email: row.email,
        type: row.type,
        status: row.status,
        quotaMb: row.quota_mb,
        usedMb: row.used_mb,
        messageCount: row.message_count,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        publishedToAnnuaire: row.published_to_annuaire,
        annuaireId: row.annuaire_id,
        owner: row.owner_id ? {
          id: row.owner_id,
          email: row.owner_email,
          firstName: row.first_name,
          lastName: row.last_name,
          rppsId: row.rpps_id
        } : null,
        domain: {
          id: row.domain_id,
          name: row.domain_name,
          organization: row.organization_name
        },
        certificate: row.cert_id ? {
          id: row.cert_id,
          subject: row.cert_subject,
          expiresAt: row.cert_expires
        } : null,
        delegations: delegationsResult.rows.map(d => ({
          id: d.id,
          permissions: d.permissions,
          delegate: {
            id: d.delegate_id,
            email: d.email,
            firstName: d.first_name,
            lastName: d.last_name
          }
        }))
      }
    });

  } catch (error) {
    logger.error('Erreur get mailbox:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur récupération BAL'
    });
  }
};

/**
 * POST /api/v1/mailboxes
 * Créer une boîte aux lettres
 */
const create = async (req, res) => {
  const client = await pool.connect();

  try {
    const { email, type, ownerRpps, quotaMb = 10240, publishToAnnuaire = true } = req.body;
    const domain = req.domain;

    // Vérifier que l'email appartient au domaine
    if (!email.endsWith(`@${domain.domain_name}`)) {
      return res.status(400).json({
        success: false,
        error: `L'email doit appartenir au domaine ${domain.domain_name}`,
        code: 'INVALID_DOMAIN'
      });
    }

    // Vérifier les quotas du domaine
    const quotaCheck = await client.query(
      `SELECT COUNT(*) as count FROM mailboxes WHERE domain_id = $1 AND status != 'deleted'`,
      [domain.id]
    );
    
    const maxMailboxes = domain.quotas?.max_mailboxes || 100;
    if (parseInt(quotaCheck.rows[0].count) >= maxMailboxes) {
      return res.status(403).json({
        success: false,
        error: 'Quota de BAL atteint pour ce domaine',
        code: 'QUOTA_EXCEEDED'
      });
    }

    // Vérifier si l'email existe déjà
    const existingCheck = await client.query(
      'SELECT id FROM mailboxes WHERE email = $1',
      [email]
    );

    if (existingCheck.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'Cette adresse email existe déjà',
        code: 'EMAIL_EXISTS'
      });
    }

    await client.query('BEGIN');

    // Trouver le propriétaire si RPPS fourni
    let ownerId = null;
    if (ownerRpps && type === 'personal') {
      const ownerResult = await client.query(
        'SELECT id FROM users WHERE rpps_id = $1 AND domain_id = $2',
        [ownerRpps, domain.id]
      );
      
      if (ownerResult.rows.length > 0) {
        ownerId = ownerResult.rows[0].id;
      }
    }

    // Créer la BAL en base
    const result = await client.query(
      `INSERT INTO mailboxes (email, type, domain_id, owner_id, quota_mb, status)
       VALUES ($1, $2, $3, $4, $5, 'active')
       RETURNING *`,
      [email, type, domain.id, ownerId, quotaMb]
    );

    const mailbox = result.rows[0];

    // Créer la boîte mail technique (Postfix/Dovecot)
    await mailService.createMailbox(mailbox, domain);

    // Publier dans l'annuaire si demandé et si BAL personnelle
    if (publishToAnnuaire && type === 'personal' && ownerId) {
      try {
        const annuaireResponse = await annuaireService.publishMailbox(mailbox, ownerRpps);
        
        await client.query(
          `UPDATE mailboxes SET published_to_annuaire = true, annuaire_id = $1 WHERE id = $2`,
          [annuaireResponse.id, mailbox.id]
        );

        // Tracer la publication
        await client.query(
          `INSERT INTO annuaire_publications (mailbox_id, publication_id, operation, status, response_data, success_at)
           VALUES ($1, $2, 'CREATE', 'success', $3, NOW())`,
          [mailbox.id, annuaireResponse.id, JSON.stringify(annuaireResponse)]
        );

        mailbox.published_to_annuaire = true;
        mailbox.annuaire_id = annuaireResponse.id;
      } catch (annuaireError) {
        logger.error('Erreur publication annuaire:', annuaireError);
        // Ne pas bloquer la création, juste logger
        await client.query(
          `INSERT INTO annuaire_publications (mailbox_id, operation, status, error_message)
           VALUES ($1, 'CREATE', 'error', $2)`,
          [mailbox.id, annuaireError.message]
        );
      }
    }

    // Log d'audit
    await client.query(
      `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details, ip_address)
       VALUES ($1, 'create', 'mailbox', $2, $3, $4)`,
      [req.user.userId, mailbox.id, JSON.stringify({ email, type }), req.ip]
    );

    await client.query('COMMIT');

    // Invalider le cache
    await redisClient.del(`domain_mailboxes:${domain.id}`);

    logger.info(`BAL créée: ${email}`);

    res.status(201).json({
      success: true,
      data: {
        id: mailbox.id,
        email: mailbox.email,
        type: mailbox.type,
        status: mailbox.status,
        quotaMb: mailbox.quota_mb,
        publishedToAnnuaire: mailbox.published_to_annuaire,
        createdAt: mailbox.created_at
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Erreur create mailbox:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur création BAL'
    });
  } finally {
    client.release();
  }
};

/**
 * PUT /api/v1/mailboxes/:id
 * Modifier une boîte aux lettres
 */
const update = async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const { quotaMb, status, ownerRpps } = req.body;
    const domainId = req.domain?.id || req.user.domainId;

    // Vérifier que la BAL existe
    const existingResult = await client.query(
      'SELECT * FROM mailboxes WHERE id = $1 AND domain_id = $2',
      [id, domainId]
    );

    if (existingResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'BAL non trouvée',
        code: 'MAILBOX_NOT_FOUND'
      });
    }

    const existing = existingResult.rows[0];

    await client.query('BEGIN');

    // Construire la requête de mise à jour
    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (quotaMb !== undefined) {
      updates.push(`quota_mb = $${paramIndex++}`);
      values.push(quotaMb);
    }

    if (status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      values.push(status);
    }

    if (ownerRpps !== undefined) {
      const ownerResult = await client.query(
        'SELECT id FROM users WHERE rpps_id = $1 AND domain_id = $2',
        [ownerRpps, domainId]
      );
      
      if (ownerResult.rows.length > 0) {
        updates.push(`owner_id = $${paramIndex++}`);
        values.push(ownerResult.rows[0].id);
      }
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
      `UPDATE mailboxes SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    const mailbox = result.rows[0];

    // Si changement de status, mettre à jour Postfix/Dovecot
    if (status && status !== existing.status) {
      if (status === 'suspended') {
        await mailService.suspendMailbox(mailbox);
      } else if (status === 'active' && existing.status === 'suspended') {
        await mailService.activateMailbox(mailbox);
      }
    }

    // Mettre à jour l'annuaire si nécessaire
    if (existing.published_to_annuaire && (status === 'deleted' || status === 'suspended')) {
      try {
        await annuaireService.unpublishMailbox(existing.annuaire_id);
        await client.query(
          `UPDATE mailboxes SET published_to_annuaire = false WHERE id = $1`,
          [id]
        );
      } catch (annuaireError) {
        logger.error('Erreur dépublication annuaire:', annuaireError);
      }
    }

    // Log d'audit
    await client.query(
      `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details, ip_address)
       VALUES ($1, 'update', 'mailbox', $2, $3, $4)`,
      [req.user.userId, id, JSON.stringify({ changes: req.body }), req.ip]
    );

    await client.query('COMMIT');

    // Invalider le cache
    await redisClient.del(`domain_mailboxes:${domainId}`);
    await redisClient.del(`mailbox:${id}`);

    logger.info(`BAL mise à jour: ${mailbox.email}`);

    res.json({
      success: true,
      data: {
        id: mailbox.id,
        email: mailbox.email,
        type: mailbox.type,
        status: mailbox.status,
        quotaMb: mailbox.quota_mb,
        updatedAt: mailbox.updated_at
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Erreur update mailbox:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur mise à jour BAL'
    });
  } finally {
    client.release();
  }
};

/**
 * DELETE /api/v1/mailboxes/:id
 * Supprimer une boîte aux lettres
 */
const remove = async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const { permanent = false } = req.query;
    const domainId = req.domain?.id || req.user.domainId;

    // Vérifier que la BAL existe
    const existingResult = await client.query(
      'SELECT * FROM mailboxes WHERE id = $1 AND domain_id = $2',
      [id, domainId]
    );

    if (existingResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'BAL non trouvée',
        code: 'MAILBOX_NOT_FOUND'
      });
    }

    const mailbox = existingResult.rows[0];

    await client.query('BEGIN');

    if (permanent) {
      // Suppression définitive
      await client.query('DELETE FROM mailboxes WHERE id = $1', [id]);
      await mailService.deleteMailbox(mailbox);
    } else {
      // Soft delete
      await client.query(
        `UPDATE mailboxes SET status = 'deleted', deleted_at = NOW() WHERE id = $1`,
        [id]
      );
      await mailService.suspendMailbox(mailbox);
    }

    // Dépublier de l'annuaire
    if (mailbox.published_to_annuaire) {
      try {
        await annuaireService.unpublishMailbox(mailbox.annuaire_id);
      } catch (annuaireError) {
        logger.error('Erreur dépublication annuaire:', annuaireError);
      }
    }

    // Supprimer les délégations
    await client.query('DELETE FROM mailbox_delegations WHERE mailbox_id = $1', [id]);

    // Log d'audit
    await client.query(
      `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details, ip_address)
       VALUES ($1, 'delete', 'mailbox', $2, $3, $4)`,
      [req.user.userId, id, JSON.stringify({ permanent, email: mailbox.email }), req.ip]
    );

    await client.query('COMMIT');

    // Invalider le cache
    await redisClient.del(`domain_mailboxes:${domainId}`);
    await redisClient.del(`mailbox:${id}`);

    logger.info(`BAL supprimée: ${mailbox.email} (permanent: ${permanent})`);

    res.json({
      success: true,
      message: permanent ? 'BAL supprimée définitivement' : 'BAL désactivée'
    });

  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Erreur delete mailbox:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur suppression BAL'
    });
  } finally {
    client.release();
  }
};

/**
 * GET /api/v1/mailboxes/:id/delegations
 * Lister les délégations d'une BAL
 */
const getDelegations = async (req, res) => {
  try {
    const { id } = req.params;
    const domainId = req.domain?.id || req.user.domainId;

    // Vérifier l'accès à la BAL
    const mailboxResult = await pool.query(
      'SELECT id FROM mailboxes WHERE id = $1 AND domain_id = $2',
      [id, domainId]
    );

    if (mailboxResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'BAL non trouvée'
      });
    }

    const result = await pool.query(
      `SELECT md.*, u.email, u.first_name, u.last_name, u.rpps_id
       FROM mailbox_delegations md
       JOIN users u ON md.delegate_id = u.id
       WHERE md.mailbox_id = $1
       ORDER BY md.created_at DESC`,
      [id]
    );

    res.json({
      success: true,
      data: result.rows.map(row => ({
        id: row.id,
        permissions: row.permissions,
        status: row.status,
        createdAt: row.created_at,
        expiresAt: row.expires_at,
        delegate: {
          id: row.delegate_id,
          email: row.email,
          firstName: row.first_name,
          lastName: row.last_name,
          rppsId: row.rpps_id
        }
      }))
    });

  } catch (error) {
    logger.error('Erreur get delegations:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur récupération délégations'
    });
  }
};

/**
 * POST /api/v1/mailboxes/:id/delegations
 * Ajouter une délégation
 */
const addDelegation = async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const { delegateEmail, permissions = ['read'], expiresAt } = req.body;
    const domainId = req.domain?.id || req.user.domainId;

    // Vérifier l'accès à la BAL
    const mailboxResult = await client.query(
      'SELECT * FROM mailboxes WHERE id = $1 AND domain_id = $2',
      [id, domainId]
    );

    if (mailboxResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'BAL non trouvée'
      });
    }

    // Trouver le délégué
    const delegateResult = await client.query(
      'SELECT id FROM users WHERE email = $1',
      [delegateEmail]
    );

    if (delegateResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Utilisateur délégué non trouvé',
        code: 'DELEGATE_NOT_FOUND'
      });
    }

    const delegateId = delegateResult.rows[0].id;

    // Vérifier si délégation existe déjà
    const existingResult = await client.query(
      'SELECT id FROM mailbox_delegations WHERE mailbox_id = $1 AND delegate_id = $2',
      [id, delegateId]
    );

    if (existingResult.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'Délégation déjà existante',
        code: 'DELEGATION_EXISTS'
      });
    }

    await client.query('BEGIN');

    const result = await client.query(
      `INSERT INTO mailbox_delegations (mailbox_id, delegate_id, permissions, expires_at, status)
       VALUES ($1, $2, $3, $4, 'active')
       RETURNING *`,
      [id, delegateId, JSON.stringify(permissions), expiresAt]
    );

    // Log d'audit
    await client.query(
      `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details, ip_address)
       VALUES ($1, 'add_delegation', 'mailbox', $2, $3, $4)`,
      [req.user.userId, id, JSON.stringify({ delegateEmail, permissions }), req.ip]
    );

    await client.query('COMMIT');

    logger.info(`Délégation ajoutée: ${delegateEmail} sur ${mailboxResult.rows[0].email}`);

    res.status(201).json({
      success: true,
      data: {
        id: result.rows[0].id,
        permissions: result.rows[0].permissions,
        expiresAt: result.rows[0].expires_at,
        status: result.rows[0].status
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Erreur add delegation:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur ajout délégation'
    });
  } finally {
    client.release();
  }
};

/**
 * DELETE /api/v1/mailboxes/:id/delegations/:delegationId
 * Supprimer une délégation
 */
const removeDelegation = async (req, res) => {
  const client = await pool.connect();

  try {
    const { id, delegationId } = req.params;
    const domainId = req.domain?.id || req.user.domainId;

    // Vérifier l'accès
    const mailboxResult = await client.query(
      'SELECT id FROM mailboxes WHERE id = $1 AND domain_id = $2',
      [id, domainId]
    );

    if (mailboxResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'BAL non trouvée'
      });
    }

    await client.query('BEGIN');

    const result = await client.query(
      'DELETE FROM mailbox_delegations WHERE id = $1 AND mailbox_id = $2 RETURNING *',
      [delegationId, id]
    );

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        error: 'Délégation non trouvée'
      });
    }

    // Log d'audit
    await client.query(
      `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, ip_address)
       VALUES ($1, 'remove_delegation', 'mailbox', $2, $3)`,
      [req.user.userId, id, req.ip]
    );

    await client.query('COMMIT');

    logger.info(`Délégation supprimée: ${delegationId}`);

    res.json({
      success: true,
      message: 'Délégation supprimée'
    });

  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Erreur remove delegation:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur suppression délégation'
    });
  } finally {
    client.release();
  }
};

/**
 * GET /api/v1/mailboxes/:id/stats
 * Statistiques d'une BAL
 */
const getStats = async (req, res) => {
  try {
    const { id } = req.params;
    const domainId = req.domain?.id || req.user.domainId;

    const mailboxResult = await pool.query(
      'SELECT * FROM mailboxes WHERE id = $1 AND domain_id = $2',
      [id, domainId]
    );

    if (mailboxResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'BAL non trouvée'
      });
    }

    const mailbox = mailboxResult.rows[0];

    // Statistiques des 30 derniers jours
    const statsResult = await pool.query(
      `SELECT 
         COUNT(*) FILTER (WHERE direction = 'inbound') as received,
         COUNT(*) FILTER (WHERE direction = 'outbound') as sent,
         AVG(size_bytes) as avg_size
       FROM email_logs
       WHERE mailbox_id = $1 AND created_at > NOW() - INTERVAL '30 days'`,
      [id]
    );

    const stats = statsResult.rows[0];

    res.json({
      success: true,
      data: {
        quota: {
          totalMb: mailbox.quota_mb,
          usedMb: mailbox.used_mb,
          percentUsed: Math.round((mailbox.used_mb / mailbox.quota_mb) * 100)
        },
        messages: {
          total: mailbox.message_count,
          received30d: parseInt(stats.received) || 0,
          sent30d: parseInt(stats.sent) || 0,
          avgSizeBytes: Math.round(stats.avg_size) || 0
        },
        lastActivity: mailbox.last_activity
      }
    });

  } catch (error) {
    logger.error('Erreur get stats:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur récupération statistiques'
    });
  }
};

module.exports = {
  list,
  get,
  create,
  update,
  remove,
  getDelegations,
  addDelegation,
  removeDelegation,
  getStats
};