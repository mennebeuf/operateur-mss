// services/api/src/controllers/admin/userController.js
/**
 * Contrôleur d'administration des utilisateurs (Super Admin)
 */

const { pool } = require('../../config/database');
const bcrypt = require('bcrypt');
const logger = require('../../utils/logger');
const { sendPasswordResetEmail } = require('../../services/email/emailService');

/**
 * GET /api/v1/admin/users
 * Liste de tous les utilisateurs (tous domaines)
 */
const list = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = '',
      domainId = '',
      role = '',
      status = '',
      sortBy = 'created',
      sortOrder = 'desc'
    } = req.query;

    const offset = (page - 1) * limit;
    const allowedSort = ['name', 'email', 'created', 'lastLogin'];
    const sortField = allowedSort.includes(sortBy)
      ? sortBy === 'name'
        ? 'last_name'
        : sortBy === 'created'
          ? 'created_at'
          : sortBy === 'lastLogin'
            ? 'last_login_at'
            : sortBy
      : 'created_at';

    let query = `
      SELECT u.*, d.domain_name, d.organization_name
      FROM users u
      LEFT JOIN domains d ON d.id = u.domain_id
      WHERE 1=1
    `;

    const params = [];
    let paramCount = 0;

    if (search) {
      paramCount++;
      query += ` AND (u.email ILIKE $${paramCount} OR u.first_name ILIKE $${paramCount} OR u.last_name ILIKE $${paramCount})`;
      params.push(`%${search}%`);
    }

    if (domainId) {
      paramCount++;
      query += ` AND u.domain_id = $${paramCount}`;
      params.push(domainId);
    }

    if (role) {
      paramCount++;
      query += ` AND u.role = $${paramCount}`;
      params.push(role);
    }

    if (status) {
      paramCount++;
      query += ` AND u.status = $${paramCount}`;
      params.push(status);
    }

    query += ` ORDER BY u.${sortField} ${sortOrder.toUpperCase()}`;
    query += ` LIMIT $${++paramCount} OFFSET $${++paramCount}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    const countQuery = `
      SELECT COUNT(*) FROM users u WHERE 1=1
      ${search ? ` AND (u.email ILIKE '%${search}%' OR u.first_name ILIKE '%${search}%' OR u.last_name ILIKE '%${search}%')` : ''}
      ${domainId ? ` AND u.domain_id = '${domainId}'` : ''}
      ${role ? ` AND u.role = '${role}'` : ''}
      ${status ? ` AND u.status = '${status}'` : ''}
    `;
    const countResult = await pool.query(countQuery);
    const total = parseInt(countResult.rows[0].count);

    res.json({
      success: true,
      data: result.rows.map(row => ({
        id: row.id,
        email: row.email,
        firstName: row.first_name,
        lastName: row.last_name,
        rppsId: row.rpps_id,
        role: row.role,
        status: row.status,
        domainId: row.domain_id,
        domainName: row.domain_name,
        organizationName: row.organization_name,
        lastLoginAt: row.last_login_at,
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
    logger.error('Erreur list users (admin):', error);
    res.status(500).json({
      success: false,
      error: 'Erreur récupération utilisateurs'
    });
  }
};

/**
 * POST /api/v1/admin/users
 * Créer un utilisateur (Super Admin)
 */
const create = async (req, res) => {
  try {
    const { email, firstName, lastName, rppsId, domainId, role = 'user', password } = req.body;

    // Vérifier si l'utilisateur existe déjà
    const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email]);

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'Cet email est déjà utilisé',
        code: 'EMAIL_EXISTS'
      });
    }

    // Vérifier que le domaine existe
    const domainCheck = await pool.query('SELECT id FROM domains WHERE id = $1', [domainId]);

    if (domainCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Domaine non trouvé',
        code: 'DOMAIN_NOT_FOUND'
      });
    }

    // Hasher le mot de passe
    const hashedPassword = password ? await bcrypt.hash(password, 10) : null;

    // Créer l'utilisateur
    const result = await pool.query(
      `INSERT INTO users (
        email, first_name, last_name, rpps_id, domain_id, role, password, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'active')
      RETURNING id, email, first_name, last_name, rpps_id, role, status, created_at`,
      [email, firstName, lastName, rppsId, domainId, role, hashedPassword]
    );

    const user = result.rows[0];

    logger.info('Utilisateur créé (admin):', { userId: user.id, email });

    res.status(201).json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        rppsId: user.rpps_id,
        role: user.role,
        status: user.status,
        createdAt: user.created_at
      }
    });
  } catch (error) {
    logger.error('Erreur création utilisateur (admin):', error);
    res.status(500).json({
      success: false,
      error: 'Erreur création utilisateur'
    });
  }
};

/**
 * GET /api/v1/admin/users/:id
 * Détails d'un utilisateur
 */
const get = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT u.*, d.domain_name, d.organization_name,
              COUNT(DISTINCT m.id) as mailbox_count
       FROM users u
       LEFT JOIN domains d ON d.id = u.domain_id
       LEFT JOIN user_mailboxes um ON um.user_id = u.id
       LEFT JOIN mailboxes m ON m.id = um.mailbox_id
       WHERE u.id = $1
       GROUP BY u.id, d.id`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Utilisateur non trouvé',
        code: 'USER_NOT_FOUND'
      });
    }

    const user = result.rows[0];

    res.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        rppsId: user.rpps_id,
        role: user.role,
        status: user.status,
        domainId: user.domain_id,
        domainName: user.domain_name,
        organizationName: user.organization_name,
        mailboxCount: parseInt(user.mailbox_count),
        lastLoginAt: user.last_login_at,
        createdAt: user.created_at,
        updatedAt: user.updated_at
      }
    });
  } catch (error) {
    logger.error('Erreur get user (admin):', error);
    res.status(500).json({
      success: false,
      error: 'Erreur récupération utilisateur'
    });
  }
};

/**
 * PUT /api/v1/admin/users/:id
 * Mettre à jour un utilisateur
 */
const update = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const allowedFields = ['first_name', 'last_name', 'rpps_id', 'role', 'status', 'domain_id'];

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
      UPDATE users
      SET ${setClause.join(', ')}, updated_at = NOW()
      WHERE id = $${paramCount + 1}
      RETURNING *
    `;

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Utilisateur non trouvé'
      });
    }

    logger.info('Utilisateur mis à jour (admin):', { userId: id });

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    logger.error('Erreur update user (admin):', error);
    res.status(500).json({
      success: false,
      error: 'Erreur mise à jour utilisateur'
    });
  }
};

/**
 * DELETE /api/v1/admin/users/:id
 * Supprimer un utilisateur
 */
const deleteUser = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { id } = req.params;

    // Supprimer les associations avec les BAL
    await client.query('DELETE FROM user_mailboxes WHERE user_id = $1', [id]);

    // Supprimer l'utilisateur
    const result = await client.query('DELETE FROM users WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        error: 'Utilisateur non trouvé'
      });
    }

    await client.query('COMMIT');

    logger.info('Utilisateur supprimé (admin):', { userId: id });

    res.json({
      success: true,
      message: 'Utilisateur supprimé avec succès'
    });
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Erreur delete user (admin):', error);
    res.status(500).json({
      success: false,
      error: 'Erreur suppression utilisateur'
    });
  } finally {
    client.release();
  }
};

/**
 * POST /api/v1/admin/users/:id/reset-password
 * Réinitialiser le mot de passe
 */
const resetPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body;

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `UPDATE users
       SET password = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, email`,
      [hashedPassword, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Utilisateur non trouvé'
      });
    }

    logger.info('Mot de passe réinitialisé (admin):', { userId: id });

    res.json({
      success: true,
      message: 'Mot de passe réinitialisé avec succès'
    });
  } catch (error) {
    logger.error('Erreur reset password (admin):', error);
    res.status(500).json({
      success: false,
      error: 'Erreur réinitialisation mot de passe'
    });
  }
};

/**
 * POST /api/v1/admin/users/:id/promote
 * Promouvoir un utilisateur admin
 */
const promote = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    const result = await pool.query(
      `UPDATE users
       SET role = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [role, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Utilisateur non trouvé'
      });
    }

    logger.info('Utilisateur promu:', { userId: id, role });

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    logger.error('Erreur promote user:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur promotion utilisateur'
    });
  }
};

/**
 * POST /api/v1/admin/users/:id/demote
 * Rétrograder un admin
 */
const demote = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `UPDATE users
       SET role = 'user', updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Utilisateur non trouvé'
      });
    }

    logger.info('Utilisateur rétrogradé:', { userId: id });

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    logger.error('Erreur demote user:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur rétrogradation utilisateur'
    });
  }
};

/**
 * GET /api/v1/admin/users/:id/activity
 * Historique d'activité
 */
const getActivity = async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 20, from, to } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT * FROM audit_logs
      WHERE user_id = $1
    `;
    const params = [id];
    let paramCount = 1;

    if (from) {
      paramCount++;
      query += ` AND created_at >= $${paramCount}`;
      params.push(from);
    }

    if (to) {
      paramCount++;
      query += ` AND created_at <= $${paramCount}`;
      params.push(to);
    }

    query += ` ORDER BY created_at DESC LIMIT $${++paramCount} OFFSET $${++paramCount}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    logger.error('Erreur get activity:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur récupération activité'
    });
  }
};

/**
 * GET /api/v1/admin/users/:id/sessions
 * Sessions actives
 */
const getSessions = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT * FROM user_sessions
       WHERE user_id = $1 AND expires_at > NOW()
       ORDER BY created_at DESC`,
      [id]
    );

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    logger.error('Erreur get sessions:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur récupération sessions'
    });
  }
};

/**
 * DELETE /api/v1/admin/users/:id/sessions
 * Terminer toutes les sessions
 */
const terminateSessions = async (req, res) => {
  try {
    const { id } = req.params;

    await pool.query('DELETE FROM user_sessions WHERE user_id = $1', [id]);

    logger.info('Sessions terminées:', { userId: id });

    res.json({
      success: true,
      message: 'Sessions terminées avec succès'
    });
  } catch (error) {
    logger.error('Erreur terminate sessions:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur terminaison sessions'
    });
  }
};

/**
 * GET /api/v1/admin/users/statistics
 * Statistiques globales utilisateurs
 */
const getStatistics = async (req, res) => {
  try {
    const stats = await pool.query(`
      SELECT
        COUNT(*) as total_users,
        COUNT(*) FILTER (WHERE status = 'active') as active_users,
        COUNT(*) FILTER (WHERE role = 'super_admin') as super_admins,
        COUNT(*) FILTER (WHERE role = 'domain_admin') as domain_admins,
        COUNT(*) FILTER (WHERE last_login_at > NOW() - INTERVAL '7 days') as active_last_week,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days') as new_last_month
      FROM users
    `);

    res.json({
      success: true,
      data: {
        total: parseInt(stats.rows[0].total_users),
        active: parseInt(stats.rows[0].active_users),
        superAdmins: parseInt(stats.rows[0].super_admins),
        domainAdmins: parseInt(stats.rows[0].domain_admins),
        activeLastWeek: parseInt(stats.rows[0].active_last_week),
        newLastMonth: parseInt(stats.rows[0].new_last_month)
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

module.exports = {
  list,
  create,
  get,
  update,
  delete: deleteUser,
  resetPassword,
  promote,
  demote,
  getActivity,
  getSessions,
  terminateSessions,
  getStatistics
};
