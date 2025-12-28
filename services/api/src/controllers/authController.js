// services/api/src/controllers/authController.js
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { pool } = require('../config/database');
const { redisClient } = require('../config/redis');
const pscService = require('../services/pscService');
const logger = require('../utils/logger');

// Configuration JWT
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';
const REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';

/**
 * Génère un token JWT
 */
const generateTokens = (user) => {
  const payload = {
    userId: user.id,
    email: user.email,
    role: user.role_name || user.role,
    domainId: user.domain_id,
    domainName: user.domain_name
  };

  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  const refreshToken = jwt.sign(
    { userId: user.id, type: 'refresh' },
    JWT_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRES_IN }
  );

  return { token, refreshToken };
};

/**
 * POST /api/v1/auth/login
 * Connexion avec email/mot de passe (administrateurs)
 */
const login = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { email, password } = req.body;

    // Récupérer l'utilisateur avec son rôle et domaine
    const result = await client.query(
      `SELECT u.*, r.name as role_name, d.domain_name
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       LEFT JOIN domains d ON u.domain_id = d.id
       WHERE u.email = $1 AND u.status = 'active'`,
      [email]
    );

    if (result.rows.length === 0) {
      logger.warn(`Tentative de connexion échouée: ${email}`);
      return res.status(401).json({
        success: false,
        error: 'Email ou mot de passe incorrect',
        code: 'INVALID_CREDENTIALS'
      });
    }

    const user = result.rows[0];

    // Vérifier le mot de passe
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      // Incrémenter le compteur d'échecs
      await client.query(
        `UPDATE users SET failed_login_attempts = failed_login_attempts + 1,
         last_failed_login = NOW() WHERE id = $1`,
        [user.id]
      );

      logger.warn(`Mot de passe incorrect pour: ${email}`);
      return res.status(401).json({
        success: false,
        error: 'Email ou mot de passe incorrect',
        code: 'INVALID_CREDENTIALS'
      });
    }

    // Vérifier le verrouillage du compte
    if (user.failed_login_attempts >= 5) {
      const lockoutTime = new Date(user.last_failed_login);
      lockoutTime.setMinutes(lockoutTime.getMinutes() + 15);
      
      if (new Date() < lockoutTime) {
        return res.status(423).json({
          success: false,
          error: 'Compte temporairement verrouillé',
          code: 'ACCOUNT_LOCKED'
        });
      }
    }

    // Réinitialiser les échecs de connexion
    await client.query(
      `UPDATE users SET failed_login_attempts = 0, last_login = NOW() WHERE id = $1`,
      [user.id]
    );

    // Générer les tokens
    const { token, refreshToken } = generateTokens(user);

    // Stocker le refresh token dans Redis
    await redisClient.setEx(
      `refresh_token:${user.id}`,
      7 * 24 * 60 * 60,
      refreshToken
    );

    // Log d'audit
    await client.query(
      `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, ip_address, user_agent)
       VALUES ($1, 'login', 'user', $1, $2, $3)`,
      [user.id, req.ip, req.get('User-Agent')]
    );

    logger.info(`Connexion réussie: ${email}`);

    res.json({
      success: true,
      data: {
        token,
        refreshToken,
        expiresIn: 3600,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          role: user.role_name,
          domain: {
            id: user.domain_id,
            name: user.domain_name
          }
        }
      }
    });

  } catch (error) {
    logger.error('Erreur login:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur',
      code: 'SERVER_ERROR'
    });
  } finally {
    client.release();
  }
};

/**
 * POST /api/v1/auth/logout
 * Déconnexion
 */
const logout = async (req, res) => {
  try {
    const userId = req.user.userId;

    // Supprimer le refresh token de Redis
    await redisClient.del(`refresh_token:${userId}`);

    // Ajouter le token actuel à la blacklist
    const token = req.headers.authorization?.split(' ')[1];
    if (token) {
      const decoded = jwt.decode(token);
      const ttl = decoded.exp - Math.floor(Date.now() / 1000);
      if (ttl > 0) {
        await redisClient.setEx(`blacklist:${token}`, ttl, '1');
      }
    }

    // Log d'audit
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, resource_type, ip_address)
       VALUES ($1, 'logout', 'user', $2)`,
      [userId, req.ip]
    );

    logger.info(`Déconnexion: ${req.user.email}`);

    res.json({
      success: true,
      message: 'Déconnexion réussie'
    });

  } catch (error) {
    logger.error('Erreur logout:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur'
    });
  }
};

/**
 * POST /api/v1/auth/refresh
 * Rafraîchir le token d'accès
 */
const refresh = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        error: 'Refresh token requis',
        code: 'MISSING_TOKEN'
      });
    }

    // Vérifier le refresh token
    const decoded = jwt.verify(refreshToken, JWT_SECRET);
    
    if (decoded.type !== 'refresh') {
      return res.status(401).json({
        success: false,
        error: 'Token invalide',
        code: 'INVALID_TOKEN'
      });
    }

    // Vérifier que le token est toujours valide dans Redis
    const storedToken = await redisClient.get(`refresh_token:${decoded.userId}`);
    if (storedToken !== refreshToken) {
      return res.status(401).json({
        success: false,
        error: 'Token révoqué',
        code: 'TOKEN_REVOKED'
      });
    }

    // Récupérer les infos utilisateur
    const result = await pool.query(
      `SELECT u.*, r.name as role_name, d.domain_name
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       LEFT JOIN domains d ON u.domain_id = d.id
       WHERE u.id = $1 AND u.status = 'active'`,
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Utilisateur non trouvé',
        code: 'USER_NOT_FOUND'
      });
    }

    const user = result.rows[0];
    const { token: newToken } = generateTokens(user);

    res.json({
      success: true,
      data: {
        token: newToken,
        expiresIn: 3600
      }
    });

  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Refresh token expiré',
        code: 'TOKEN_EXPIRED'
      });
    }

    logger.error('Erreur refresh:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur'
    });
  }
};

/**
 * GET /api/v1/auth/psc/authorize
 * Redirection vers Pro Santé Connect
 */
const pscAuthorize = async (req, res) => {
  try {
    const { redirect_uri } = req.query;

    // Générer un state anti-CSRF
    const state = crypto.randomBytes(32).toString('hex');
    
    // Stocker le state dans Redis (5 minutes)
    await redisClient.setEx(`psc_state:${state}`, 300, JSON.stringify({
      redirectUri: redirect_uri,
      timestamp: Date.now()
    }));

    // Construire l'URL d'autorisation PSC
    const authUrl = pscService.getAuthorizationUrl(state);

    logger.info('Redirection vers PSC');
    res.redirect(authUrl);

  } catch (error) {
    logger.error('Erreur PSC authorize:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur de redirection PSC'
    });
  }
};

/**
 * POST /api/v1/auth/psc/token
 * Échanger le code d'autorisation contre un token
 */
const pscToken = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { code, state } = req.body;

    // Vérifier le state
    const storedState = await redisClient.get(`psc_state:${state}`);
    if (!storedState) {
      return res.status(400).json({
        success: false,
        error: 'State invalide ou expiré',
        code: 'INVALID_STATE'
      });
    }

    // Supprimer le state utilisé
    await redisClient.del(`psc_state:${state}`);

    // Échanger le code contre un token PSC
    const pscTokens = await pscService.exchangeCode(code);

    // Récupérer les infos utilisateur depuis PSC
    const pscUserInfo = await pscService.getUserInfo(pscTokens.access_token);

    // Chercher ou créer l'utilisateur
    let userResult = await client.query(
      `SELECT u.*, r.name as role_name, d.domain_name
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       LEFT JOIN domains d ON u.domain_id = d.id
       WHERE u.rpps_id = $1`,
      [pscUserInfo.rpps]
    );

    let user;

    if (userResult.rows.length === 0) {
      // Créer un nouvel utilisateur
      await client.query('BEGIN');

      const insertResult = await client.query(
        `INSERT INTO users (email, first_name, last_name, rpps_id, status, role_id)
         VALUES ($1, $2, $3, $4, 'active', (SELECT id FROM roles WHERE name = 'user'))
         RETURNING *`,
        [pscUserInfo.email, pscUserInfo.given_name, pscUserInfo.family_name, pscUserInfo.rpps]
      );

      await client.query('COMMIT');
      
      user = insertResult.rows[0];
      user.role_name = 'user';

      logger.info(`Nouvel utilisateur PSC créé: ${pscUserInfo.email}`);
    } else {
      user = userResult.rows[0];
      
      // Mettre à jour last_login
      await client.query(
        `UPDATE users SET last_login = NOW() WHERE id = $1`,
        [user.id]
      );
    }

    // Générer nos tokens JWT
    const { token, refreshToken } = generateTokens(user);

    // Stocker le refresh token
    await redisClient.setEx(`refresh_token:${user.id}`, 7 * 24 * 60 * 60, refreshToken);

    // Stocker le token PSC pour les appels IMAP/SMTP
    await redisClient.setEx(
      `psc_token:${user.id}`,
      pscTokens.expires_in,
      pscTokens.access_token
    );

    // Log d'audit
    await client.query(
      `INSERT INTO audit_logs (user_id, action, resource_type, details, ip_address)
       VALUES ($1, 'psc_login', 'user', $2, $3)`,
      [user.id, JSON.stringify({ rpps: pscUserInfo.rpps }), req.ip]
    );

    logger.info(`Connexion PSC réussie: ${user.email}`);

    res.json({
      success: true,
      data: {
        token,
        refreshToken,
        expiresIn: 3600,
        pscInfo: {
          rpps: pscUserInfo.rpps,
          firstName: pscUserInfo.given_name,
          lastName: pscUserInfo.family_name,
          profession: pscUserInfo.SubjectRole?.[0]
        }
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Erreur PSC token:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur d\'authentification PSC'
    });
  } finally {
    client.release();
  }
};

/**
 * GET /api/v1/auth/psc/userinfo
 * Récupérer les informations utilisateur PSC
 */
const pscUserInfo = async (req, res) => {
  try {
    const userId = req.user.userId;

    // Récupérer le token PSC stocké
    const pscToken = await redisClient.get(`psc_token:${userId}`);
    
    if (!pscToken) {
      return res.status(401).json({
        success: false,
        error: 'Session PSC expirée',
        code: 'PSC_SESSION_EXPIRED'
      });
    }

    const userInfo = await pscService.getUserInfo(pscToken);

    res.json({
      success: true,
      data: {
        sub: userInfo.sub,
        rpps: userInfo.SubjectNameID,
        given_name: userInfo.given_name,
        family_name: userInfo.family_name,
        email: userInfo.email,
        SubjectOrganization: userInfo.SubjectOrganization,
        SubjectRole: userInfo.SubjectRole
      }
    });

  } catch (error) {
    logger.error('Erreur PSC userinfo:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur récupération infos PSC'
    });
  }
};

/**
 * POST /api/v1/auth/change-password
 * Changer le mot de passe
 */
const changePassword = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.userId;

    // Récupérer l'utilisateur
    const result = await client.query(
      'SELECT password_hash FROM users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Utilisateur non trouvé'
      });
    }

    // Vérifier l'ancien mot de passe
    const isValid = await bcrypt.compare(currentPassword, result.rows[0].password_hash);
    if (!isValid) {
      return res.status(401).json({
        success: false,
        error: 'Mot de passe actuel incorrect',
        code: 'INVALID_PASSWORD'
      });
    }

    // Hasher le nouveau mot de passe
    const newHash = await bcrypt.hash(newPassword, 12);

    // Mettre à jour
    await client.query(
      `UPDATE users SET password_hash = $1, password_changed_at = NOW() WHERE id = $2`,
      [newHash, userId]
    );

    // Log d'audit
    await client.query(
      `INSERT INTO audit_logs (user_id, action, resource_type, ip_address)
       VALUES ($1, 'change_password', 'user', $2)`,
      [userId, req.ip]
    );

    // Invalider tous les tokens existants
    await redisClient.del(`refresh_token:${userId}`);

    logger.info(`Mot de passe changé pour user: ${userId}`);

    res.json({
      success: true,
      message: 'Mot de passe modifié avec succès'
    });

  } catch (error) {
    logger.error('Erreur change-password:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur'
    });
  } finally {
    client.release();
  }
};

/**
 * GET /api/v1/auth/me
 * Récupérer le profil de l'utilisateur connecté
 */
const me = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.email, u.first_name, u.last_name, u.rpps_id,
              u.created_at, u.last_login, r.name as role,
              d.id as domain_id, d.domain_name, d.organization_name
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       LEFT JOIN domains d ON u.domain_id = d.id
       WHERE u.id = $1`,
      [req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Utilisateur non trouvé'
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
        createdAt: user.created_at,
        lastLogin: user.last_login,
        domain: user.domain_id ? {
          id: user.domain_id,
          name: user.domain_name,
          organization: user.organization_name
        } : null
      }
    });

  } catch (error) {
    logger.error('Erreur me:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur'
    });
  }
};

module.exports = {
  login,
  logout,
  refresh,
  pscAuthorize,
  pscToken,
  pscUserInfo,
  changePassword,
  me
};