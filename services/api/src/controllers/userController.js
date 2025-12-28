// services/api/src/controllers/userController.js
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { pool } = require('../config/database');
const { redisClient } = require('../config/redis');
const logger = require('../utils/logger');

/**
 * GET /api/v1/users
 * Lister les utilisateurs
 */
const list = async (req, res) => {
  try {
    const { page = 1, limit = 20, role, status, search } = req.query;
    const offset = (page - 1) * limit;
    const domainId = req.domain?.id || req.user.domainId;

    let query = `
      SELECT u.*, r.name as role_name, r.display_name as role_display,
             COUNT(m.id) as mailbox_count
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      LEFT JOIN mailboxes m ON m.owner_id = u.id AND m.status = 'active'
      WHERE u.domain_id = $1
    `;
    const params = [domainId];
    let paramIndex = 2;

    // Filtre par rôle
    if (role) {
      query += ` AND r.name = $${paramIndex++}`;
      params.push(role);
    }

    // Filtre par statut
    if (status) {
      query += ` AND u.status = $${paramIndex++}`;
      params.push(status);
    }

    // Recherche
    if (search) {
      query += ` AND (u.email ILIKE $${paramIndex} OR u.first_name ILIKE $${paramIndex} 
                 OR u.last_name ILIKE $${paramIndex} OR u.rpps_id ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    query += ' GROUP BY u.id, r.name, r.display_name';

    // Comptage total
    const countQuery = `SELECT COUNT(DISTINCT u.id) as total FROM users u 
                        LEFT JOIN roles r ON u.role_id = r.id 
                        WHERE u.domain_id = $1` + 
                        (role ? ` AND r.name = $2` : '') +
                        (status ? ` AND u.status = $${role ? 3 : 2}` : '');
    
    const countParams = [domainId];
    if (role) countParams.push(role);
    if (status) countParams.push(status);
    
    const countResult = await pool.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].total);

    // Récupération paginée
    query += ` ORDER BY u.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    res.json({
      success: true,
      data: result.rows.map(row => ({
        id: row.id,
        email: row.email,
        firstName: row.first_name,
        lastName: row.last_name,
        rppsId: row.rpps_id,
        status: row.status,
        role: {
          name: row.role_name,
          displayName: row.role_display
        },
        mailboxCount: parseInt(row.mailbox_count),
        lastLogin: row.last_login,
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
    logger.error('Erreur list users:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur récupération utilisateurs'
    });
  }
};

/**
 * GET /api/v1/users/:id
 * Récupérer un utilisateur
 */
const get = async (req, res) => {
  try {
    const { id } = req.params;
    const domainId = req.domain?.id || req.user.domainId;

    const result = await pool.query(
      `SELECT u.*, r.name as role_name, r.display_name as role_display,
              d.domain_name, d.organization_name
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       LEFT JOIN domains d ON u.domain_id = d.id
       WHERE u.id = $1 AND u.domain_id = $2`,
      [id, domainId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Utilisateur non trouvé',
        code: 'USER_NOT_FOUND'
      });
    }

    const user = result.rows[0];

    // Récupérer les BAL de l'utilisateur
    const mailboxesResult = await pool.query(
      `SELECT id, email, type, status FROM mailboxes WHERE owner_id = $1`,
      [id]
    );

    // Récupérer les permissions
    const permissionsResult = await pool.query(
      `SELECT p.name, p.resource, p.action
       FROM permissions p
       JOIN role_permissions rp ON p.id = rp.permission_id
       WHERE rp.role_id = $1`,
      [user.role_id]
    );

    res.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        rppsId: user.rpps_id,
        status: user.status,
        isSuperAdmin: user.is_super_admin,
        role: {
          id: user.role_id,
          name: user.role_name,
          displayName: user.role_display
        },
        domain: {
          id: user.domain_id,
          name: user.domain_name,
          organization: user.organization_name
        },
        mailboxes: mailboxesResult.rows,
        permissions: permissionsResult.rows.map(p => p.name),
        lastLogin: user.last_login,
        createdAt: user.created_at,
        updatedAt: user.updated_at
      }
    });

  } catch (error) {
    logger.error('Erreur get user:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur récupération utilisateur'
    });
  }
};

/**
 * POST /api/v1/users
 * Créer un utilisateur
 */
const create = async (req, res) => {
  const client = await pool.connect();

  try {
    const { 
      email, 
      firstName, 
      lastName, 
      rppsId, 
      role = 'user',
      password,
      sendInvitation = true 
    } = req.body;
    
    const domainId = req.domain?.id || req.user.domainId;

    // Vérifier l'email unique
    const existingResult = await client.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existingResult.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'Cet email existe déjà',
        code: 'EMAIL_EXISTS'
      });
    }

    // Vérifier le RPPS unique si fourni
    if (rppsId) {
      const rppsCheck = await client.query(
        'SELECT id FROM users WHERE rpps_id = $1',
        [rppsId]
      );

      if (rppsCheck.rows.length > 0) {
        return res.status(409).json({
          success: false,
          error: 'Ce numéro RPPS est déjà utilisé',
          code: 'RPPS_EXISTS'
        });
      }
    }

    // Récupérer le rôle
    const roleResult = await client.query(
      'SELECT id FROM roles WHERE name = $1',
      [role]
    );

    if (roleResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Rôle invalide',
        code: 'INVALID_ROLE'
      });
    }

    const roleId = roleResult.rows[0].id;

    await client.query('BEGIN');

    // Générer un mot de passe temporaire si non fourni
    let passwordHash = null;
    let tempPassword = null;
    
    if (password) {
      passwordHash = await bcrypt.hash(password, 12);
    } else if (!sendInvitation) {
      tempPassword = crypto.randomBytes(16).toString('hex');
      passwordHash = await bcrypt.hash(tempPassword, 12);
    }

    // Créer l'utilisateur
    const result = await client.query(
      `INSERT INTO users (email, first_name, last_name, rpps_id, password_hash, role_id, domain_id, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [email, firstName, lastName, rppsId, passwordHash, roleId, domainId, 'active']
    );

    const user = result.rows[0];

    // Générer un token d'invitation si demandé
    let invitationToken = null;
    if (sendInvitation) {
      invitationToken = crypto.randomBytes(32).toString('hex');
      
      await client.query(
        `INSERT INTO user_invitations (user_id, token, expires_at)
         VALUES ($1, $2, NOW() + INTERVAL '7 days')`,
        [user.id, invitationToken]
      );

      // TODO: Envoyer l'email d'invitation
      // await emailService.sendInvitation(email, invitationToken);
    }

    // Log d'audit
    await client.query(
      `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details, ip_address)
       VALUES ($1, 'create', 'user', $2, $3, $4)`,
      [req.user.userId, user.id, JSON.stringify({ email, role }), req.ip]
    );

    await client.query('COMMIT');

    // Invalider le cache
    await redisClient.del(`domain_users:${domainId}`);

    logger.info(`Utilisateur créé: ${email}`);

    res.status(201).json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        rppsId: user.rpps_id,
        role: role,
        status: user.status,
        createdAt: user.created_at,
        ...(tempPassword && { temporaryPassword: tempPassword }),
        ...(invitationToken && { invitationSent: true })
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Erreur create user:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur création utilisateur'
    });
  } finally {
    client.release();
  }
};

/**
 * PUT /api/v1/users/:id
 * Modifier un utilisateur
 */
const update = async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const { firstName, lastName, rppsId, role, status } = req.body;
    const domainId = req.domain?.id || req.user.domainId;

    // Vérifier que l'utilisateur existe
    const existingResult = await client.query(
      'SELECT * FROM users WHERE id = $1 AND domain_id = $2',
      [id, domainId]
    );

    if (existingResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Utilisateur non trouvé',
        code: 'USER_NOT_FOUND'
      });
    }

    const existing = existingResult.rows[0];

    // Vérifier si RPPS est unique si modifié
    if (rppsId && rppsId !== existing.rpps_id) {
      const rppsCheck = await client.query(
        'SELECT id FROM users WHERE rpps_id = $1 AND id != $2',
        [rppsId, id]
      );

      if (rppsCheck.rows.length > 0) {
        return res.status(409).json({
          success: false,
          error: 'Ce numéro RPPS est déjà utilisé',
          code: 'RPPS_EXISTS'
        });
      }
    }

    await client.query('BEGIN');

    // Construire la requête de mise à jour
    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (firstName !== undefined) {
      updates.push(`first_name = ${paramIndex++}`);
      values.push(firstName);
    }

    if (lastName !== undefined) {
      updates.push(`last_name = ${paramIndex++}`);
      values.push(lastName);
    }

    if (rppsId !== undefined) {
      updates.push(`rpps_id = ${paramIndex++}`);
      values.push(rppsId);
    }

    if (status !== undefined) {
      updates.push(`status = ${paramIndex++}`);
      values.push(status);
    }

    if (role !== undefined) {
      const roleResult = await client.query(
        'SELECT id FROM roles WHERE name = $1',
        [role]
      );

      if (roleResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          error: 'Rôle invalide'
        });
      }

      updates.push(`role_id = ${paramIndex++}`);
      values.push(roleResult.rows[0].id);
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
      `UPDATE users SET ${updates.join(', ')} WHERE id = ${paramIndex} RETURNING *`,
      values
    );

    const user = result.rows[0];

    // Log d'audit
    await client.query(
      `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details, ip_address)
       VALUES ($1, 'update', 'user', $2, $3, $4)`,
      [req.user.userId, id, JSON.stringify({ changes: req.body }), req.ip]
    );

    await client.query('COMMIT');

    // Invalider le cache
    await redisClient.del(`domain_users:${domainId}`);
    await redisClient.del(`user:${id}`);

    logger.info(`Utilisateur mis à jour: ${user.email}`);

    res.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        rppsId: user.rpps_id,
        status: user.status,
        updatedAt: user.updated_at
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Erreur update user:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur mise à jour utilisateur'
    });
  } finally {
    client.release();
  }
};

/**
 * DELETE /api/v1/users/:id
 * Supprimer un utilisateur
 */
const remove = async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const { permanent = false } = req.query;
    const domainId = req.domain?.id || req.user.domainId;

    // Empêcher l'auto-suppression
    if (id === req.user.userId) {
      return res.status(400).json({
        success: false,
        error: 'Vous ne pouvez pas vous supprimer vous-même',
        code: 'SELF_DELETE'
      });
    }

    // Vérifier que l'utilisateur existe
    const existingResult = await client.query(
      'SELECT * FROM users WHERE id = $1 AND domain_id = $2',
      [id, domainId]
    );

    if (existingResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Utilisateur non trouvé',
        code: 'USER_NOT_FOUND'
      });
    }

    const user = existingResult.rows[0];

    await client.query('BEGIN');

    if (permanent) {
      // Transférer les BAL avant suppression
      await client.query(
        `UPDATE mailboxes SET owner_id = NULL WHERE owner_id = $1`,
        [id]
      );

      // Supprimer les délégations
      await client.query(
        `DELETE FROM mailbox_delegations WHERE delegate_id = $1`,
        [id]
      );

      // Supprimer définitivement
      await client.query('DELETE FROM users WHERE id = $1', [id]);
    } else {
      // Soft delete
      await client.query(
        `UPDATE users SET status = 'deleted', deleted_at = NOW() WHERE id = $1`,
        [id]
      );
    }

    // Log d'audit
    await client.query(
      `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details, ip_address)
       VALUES ($1, 'delete', 'user', $2, $3, $4)`,
      [req.user.userId, id, JSON.stringify({ permanent, email: user.email }), req.ip]
    );

    await client.query('COMMIT');

    // Invalider les tokens de l'utilisateur
    await redisClient.del(`refresh_token:${id}`);
    await redisClient.del(`domain_users:${domainId}`);

    logger.info(`Utilisateur supprimé: ${user.email} (permanent: ${permanent})`);

    res.json({
      success: true,
      message: permanent ? 'Utilisateur supprimé définitivement' : 'Utilisateur désactivé'
    });

  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Erreur delete user:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur suppression utilisateur'
    });
  } finally {
    client.release();
  }
};

/**
 * POST /api/v1/users/:id/reset-password
 * Réinitialiser le mot de passe d'un utilisateur
 */
const resetPassword = async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const { sendEmail = true } = req.body;
    const domainId = req.domain?.id || req.user.domainId;

    // Vérifier que l'utilisateur existe
    const userResult = await client.query(
      'SELECT * FROM users WHERE id = $1 AND domain_id = $2',
      [id, domainId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Utilisateur non trouvé'
      });
    }

    const user = userResult.rows[0];

    await client.query('BEGIN');

    // Générer un token de réinitialisation
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');

    await client.query(
      `UPDATE users SET 
         password_reset_token = $1,
         password_reset_expires = NOW() + INTERVAL '1 hour'
       WHERE id = $2`,
      [resetTokenHash, id]
    );

    // Log d'audit
    await client.query(
      `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, ip_address)
       VALUES ($1, 'reset_password', 'user', $2, $3)`,
      [req.user.userId, id, req.ip]
    );

    await client.query('COMMIT');

    // Envoyer l'email si demandé
    if (sendEmail) {
      // TODO: Envoyer l'email de réinitialisation
      // await emailService.sendPasswordReset(user.email, resetToken);
    }

    // Invalider les sessions existantes
    await redisClient.del(`refresh_token:${id}`);

    logger.info(`Réinitialisation mot de passe demandée pour: ${user.email}`);

    res.json({
      success: true,
      message: 'Email de réinitialisation envoyé',
      ...(sendEmail ? {} : { resetToken }) // Renvoyer le token uniquement si pas d'email
    });

  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Erreur reset password:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur réinitialisation mot de passe'
    });
  } finally {
    client.release();
  }
};

/**
 * GET /api/v1/users/:id/permissions
 * Récupérer les permissions d'un utilisateur
 */
const getPermissions = async (req, res) => {
  try {
    const { id } = req.params;
    const domainId = req.domain?.id || req.user.domainId;

    // Vérifier l'utilisateur
    const userResult = await pool.query(
      'SELECT role_id, is_super_admin FROM users WHERE id = $1 AND domain_id = $2',
      [id, domainId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Utilisateur non trouvé'
      });
    }

    const user = userResult.rows[0];

    // Super admin a toutes les permissions
    if (user.is_super_admin) {
      const allPermsResult = await pool.query('SELECT name FROM permissions');
      return res.json({
        success: true,
        data: {
          isSuperAdmin: true,
          permissions: allPermsResult.rows.map(p => p.name)
        }
      });
    }

    // Récupérer les permissions du rôle
    const permissionsResult = await pool.query(
      `SELECT p.name, p.resource, p.action, p.description
       FROM permissions p
       JOIN role_permissions rp ON p.id = rp.permission_id
       WHERE rp.role_id = $1`,
      [user.role_id]
    );

    res.json({
      success: true,
      data: {
        isSuperAdmin: false,
        permissions: permissionsResult.rows.map(p => p.name),
        details: permissionsResult.rows
      }
    });

  } catch (error) {
    logger.error('Erreur get permissions:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur récupération permissions'
    });
  }
};

/**
 * GET /api/v1/users/search
 * Rechercher des utilisateurs (pour autocomplétion)
 */
const search = async (req, res) => {
  try {
    const { q, limit = 10 } = req.query;
    const domainId = req.domain?.id || req.user.domainId;

    if (!q || q.length < 2) {
      return res.json({
        success: true,
        data: []
      });
    }

    const result = await pool.query(
      `SELECT id, email, first_name, last_name, rpps_id
       FROM users
       WHERE domain_id = $1 
         AND status = 'active'
         AND (email ILIKE $2 OR first_name ILIKE $2 OR last_name ILIKE $2 OR rpps_id ILIKE $2)
       ORDER BY last_name, first_name
       LIMIT $3`,
      [domainId, `%${q}%`, limit]
    );

    res.json({
      success: true,
      data: result.rows.map(row => ({
        id: row.id,
        email: row.email,
        firstName: row.first_name,
        lastName: row.last_name,
        rppsId: row.rpps_id,
        displayName: `${row.first_name} ${row.last_name}`
      }))
    });

  } catch (error) {
    logger.error('Erreur search users:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur recherche utilisateurs'
    });
  }
};

module.exports = {
  list,
  get,
  create,
  update,
  remove,
  resetPassword,
  getPermissions,
  search
};