// services/api/src/models/User.js
const { query, transaction } = require('../config/database');
const bcrypt = require('bcrypt');
const logger = require('../utils/logger');

const SALT_ROUNDS = 12;

class User {
  constructor(data) {
    this.id = data.id;
    this.email = data.email;
    this.passwordHash = data.password_hash;
    this.rpps = data.rpps;
    this.adeli = data.adeli;
    this.pscSubject = data.psc_subject;
    this.firstName = data.first_name;
    this.lastName = data.last_name;
    this.profession = data.profession;
    this.specialty = data.specialty;
    this.roleId = data.role_id;
    this.roleName = data.role_name;
    this.isSuperAdmin = data.is_super_admin || false;
    this.status = data.status || 'active';
    this.domainId = data.domain_id;
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
    this.lastLogin = data.last_login;
  }

  get fullName() {
    return `${this.firstName} ${this.lastName}`.trim();
  }

  toJSON() {
    return {
      id: this.id,
      email: this.email,
      rpps: this.rpps,
      adeli: this.adeli,
      firstName: this.firstName,
      lastName: this.lastName,
      fullName: this.fullName,
      profession: this.profession,
      specialty: this.specialty,
      role: this.roleName,
      isSuperAdmin: this.isSuperAdmin,
      status: this.status,
      domainId: this.domainId,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      lastLogin: this.lastLogin
    };
  }

  // Vérifier le mot de passe
  async verifyPassword(password) {
    if (!this.passwordHash) return false;
    return bcrypt.compare(password, this.passwordHash);
  }

  // Créer un nouvel utilisateur
  static async create(userData) {
    const { email, password, rpps, adeli, firstName, lastName, profession, specialty, roleId, domainId } = userData;
    
    const passwordHash = password ? await bcrypt.hash(password, SALT_ROUNDS) : null;
    
    const result = await query(`
      INSERT INTO users (email, password_hash, rpps, adeli, first_name, last_name, profession, specialty, role_id, domain_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [email, passwordHash, rpps, adeli, firstName, lastName, profession, specialty, roleId, domainId]);
    
    logger.info('Utilisateur créé', { userId: result.rows[0].id, email });
    return new User(result.rows[0]);
  }

  // Trouver par ID
  static async findById(id) {
    const result = await query(`
      SELECT u.*, r.name as role_name
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      WHERE u.id = $1
    `, [id]);
    
    return result.rows[0] ? new User(result.rows[0]) : null;
  }

  // Trouver par email
  static async findByEmail(email) {
    const result = await query(`
      SELECT u.*, r.name as role_name
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      WHERE LOWER(u.email) = LOWER($1)
    `, [email]);
    
    return result.rows[0] ? new User(result.rows[0]) : null;
  }

  // Trouver par RPPS
  static async findByRpps(rpps) {
    const result = await query(`
      SELECT u.*, r.name as role_name
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      WHERE u.rpps = $1
    `, [rpps]);
    
    return result.rows[0] ? new User(result.rows[0]) : null;
  }

  // Trouver par PSC Subject (Pro Santé Connect)
  static async findByPscSubject(pscSubject) {
    const result = await query(`
      SELECT u.*, r.name as role_name
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      WHERE u.psc_subject = $1
    `, [pscSubject]);
    
    return result.rows[0] ? new User(result.rows[0]) : null;
  }

  // Lister les utilisateurs avec filtres et pagination
  static async findAll({ page = 1, limit = 20, search, status, domainId, role } = {}) {
    let whereClause = 'WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (search) {
      whereClause += ` AND (u.email ILIKE $${paramIndex} OR u.first_name ILIKE $${paramIndex} OR u.last_name ILIKE $${paramIndex} OR u.rpps = $${paramIndex + 1})`;
      params.push(`%${search}%`, search);
      paramIndex += 2;
    }

    if (status) {
      whereClause += ` AND u.status = $${paramIndex++}`;
      params.push(status);
    }

    if (domainId) {
      whereClause += ` AND u.domain_id = $${paramIndex++}`;
      params.push(domainId);
    }

    if (role) {
      whereClause += ` AND r.name = $${paramIndex++}`;
      params.push(role);
    }

    const countResult = await query(`SELECT COUNT(*) FROM users u LEFT JOIN roles r ON u.role_id = r.id ${whereClause}`, params);
    const total = parseInt(countResult.rows[0].count, 10);

    const offset = (page - 1) * limit;
    params.push(limit, offset);

    const result = await query(`
      SELECT u.*, r.name as role_name
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      ${whereClause}
      ORDER BY u.created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex}
    `, params);

    return {
      data: result.rows.map(row => new User(row)),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    };
  }

  // Mettre à jour
  async update(updates) {
    const allowedFields = ['first_name', 'last_name', 'profession', 'specialty', 'status', 'role_id', 'domain_id'];
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
      UPDATE users SET ${setClauses.join(', ')}
      WHERE id = $1
      RETURNING *
    `, params);

    logger.info('Utilisateur mis à jour', { userId: this.id });
    Object.assign(this, new User(result.rows[0]));
    return this;
  }

  // Mettre à jour le mot de passe
  async updatePassword(newPassword) {
    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await query('UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [passwordHash, this.id]);
    logger.info('Mot de passe mis à jour', { userId: this.id });
  }

  // Enregistrer la dernière connexion
  async recordLogin() {
    await query('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1', [this.id]);
    this.lastLogin = new Date();
  }

  // Supprimer (soft delete)
  async delete() {
    await query(`UPDATE users SET status = 'deleted', updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [this.id]);
    this.status = 'deleted';
    logger.info('Utilisateur supprimé', { userId: this.id });
  }

  // Obtenir les permissions de l'utilisateur
  async getPermissions() {
    const result = await query(`
      SELECT p.name, p.resource, p.action
      FROM permissions p
      JOIN role_permissions rp ON p.id = rp.permission_id
      JOIN roles r ON rp.role_id = r.id
      JOIN users u ON u.role_id = r.id
      WHERE u.id = $1
    `, [this.id]);
    
    return result.rows;
  }

  // Vérifier une permission
  async hasPermission(permissionName) {
    if (this.isSuperAdmin) return true;
    
    const result = await query(`
      SELECT EXISTS (
        SELECT 1 FROM permissions p
        JOIN role_permissions rp ON p.id = rp.permission_id
        WHERE rp.role_id = $1 AND p.name = $2
      ) as has_permission
    `, [this.roleId, permissionName]);
    
    return result.rows[0].has_permission;
  }

  // Vérifier si admin d'un domaine
  async isDomainAdmin(domainId) {
    if (this.isSuperAdmin) return true;
    
    const result = await query(`
      SELECT EXISTS (
        SELECT 1 FROM domain_admins
        WHERE user_id = $1 AND domain_id = $2
      ) as is_admin
    `, [this.id, domainId]);
    
    return result.rows[0].is_admin;
  }
}

module.exports = User;