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

// ============================================
// PRO SANTÉ CONNECT (OAuth2/OIDC)
// ============================================

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
      redirectUri: redirect_uri || process.env.FRONTEND_URL,
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
 * GET /api/v1/auth/psc/callback
 * Callback après authentification PSC
 */
const pscCallback = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { code, state } = req.query;

    // 1. Vérifier le state (protection CSRF)
    const storedStateData = await redisClient.get(`psc_state:${state}`);
    if (!storedStateData) {
      const errorUrl = `${process.env.FRONTEND_URL}/auth/error?message=${encodeURIComponent('Session expirée')}`;
      return res.redirect(errorUrl);
    }

    const stateData = JSON.parse(storedStateData);
    
    // Supprimer le state utilisé
    await redisClient.del(`psc_state:${state}`);

    // 2. Échanger le code contre des tokens PSC
    const pscTokens = await pscService.exchangeCode(code);

    // 3. Récupérer les informations utilisateur depuis PSC
    const pscUserInfo = await pscService.getUserInfo(pscTokens.accessToken);

    logger.info('Authentification PSC réussie', {
      pscSubject: pscUserInfo.pscSubject,
      rppsId: pscUserInfo.rppsId,
      email: pscUserInfo.email
    });

    // 4. Chercher ou créer l'utilisateur dans notre base
    let userResult = await client.query(
      `SELECT u.id, u.email, u.first_name, u.last_name, u.rpps_id, u.status,
              r.name as role_name, d.id as domain_id, d.domain_name
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       LEFT JOIN domains d ON u.domain_id = d.id
       WHERE u.rpps_id = $1 OR u.email = $2`,
      [pscUserInfo.rppsId, pscUserInfo.email]
    );

    let user;

    if (userResult.rows.length === 0) {
      // Nouvel utilisateur - Créer automatiquement
      await client.query('BEGIN');

      try {
        // Récupérer le rôle 'user' par défaut
        const roleResult = await client.query(
          `SELECT id FROM roles WHERE name = 'user' LIMIT 1`
        );

        const roleId = roleResult.rows[0]?.id;

        // Créer l'utilisateur
        const insertResult = await client.query(
          `INSERT INTO users (email, first_name, last_name, rpps_id, role_id, status, auth_method)
           VALUES ($1, $2, $3, $4, $5, 'active', 'psc')
           RETURNING id, email, first_name, last_name, rpps_id, status`,
          [
            pscUserInfo.email,
            pscUserInfo.firstName,
            pscUserInfo.lastName,
            pscUserInfo.rppsId,
            roleId
          ]
        );

        user = insertResult.rows[0];
        user.role_name = 'user';
        user.domain_id = null;
        user.domain_name = null;

        await client.query('COMMIT');

        logger.info('Nouvel utilisateur créé via PSC', {
          userId: user.id,
          email: user.email,
          rppsId: user.rpps_id
        });

      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }

    } else {
      user = userResult.rows[0];

      // Vérifier que l'utilisateur est actif
      if (user.status !== 'active') {
        const errorUrl = `${process.env.FRONTEND_URL}/auth/error?message=${encodeURIComponent('Compte désactivé')}`;
        return res.redirect(errorUrl);
      }

      // Mettre à jour la date de dernière connexion
      await client.query(
        `UPDATE users SET last_login = NOW() WHERE id = $1`,
        [user.id]
      );
    }

    // 5. Stocker les tokens PSC dans Redis (pour refresh ultérieur)
    await redisClient.setEx(
      `psc_tokens:${user.id}`,
      7 * 24 * 60 * 60, // 7 jours
      JSON.stringify({
        accessToken: pscTokens.accessToken,
        refreshToken: pscTokens.refreshToken,
        idToken: pscTokens.idToken,
        expiresAt: Date.now() + (pscTokens.expiresIn * 1000)
      })
    );

    // 6. Générer nos propres tokens JWT
    const { token, refreshToken } = generateTokens(user);

    // 7. Stocker le refresh token
    await redisClient.setEx(
      `refresh_token:${user.id}`,
      7 * 24 * 60 * 60,
      refreshToken
    );

    // 8. Audit log
    await client.query(
      `INSERT INTO audit_logs (user_id, action, resource_type, ip_address, details)
       VALUES ($1, 'psc_login', 'authentication', $2, $3)`,
      [
        user.id,
        req.ip,
        JSON.stringify({
          pscSubject: pscUserInfo.pscSubject,
          rppsId: pscUserInfo.rppsId,
          method: 'psc'
        })
      ]
    );

    // 9. Rediriger vers l'application avec le token
    const redirectUri = stateData.redirectUri || process.env.FRONTEND_URL;
    const redirectUrl = `${redirectUri}?token=${token}&refreshToken=${refreshToken}`;

    logger.info(`Connexion PSC réussie: ${user.email}`, {
      userId: user.id,
      ip: req.ip
    });

    // Redirection vers le frontend
    res.redirect(redirectUrl);

  } catch (error) {
    logger.error('Erreur PSC callback:', error);
    
    // Rediriger vers le frontend avec une erreur
    const errorUrl = `${process.env.FRONTEND_URL}/auth/error?message=${encodeURIComponent('Erreur authentification PSC')}`;
    res.redirect(errorUrl);

  } finally {
    client.release();
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
    const pscUserInfo = await pscService.getUserInfo(pscTokens.accessToken);

    // Chercher ou créer l'utilisateur
    let userResult = await client.query(
      `SELECT u.*, r.name as role_name, d.domain_name
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       LEFT JOIN domains d ON u.domain_id = d.id
       WHERE u.rpps_id = $1`,
      [pscUserInfo.rppsId]
    );

    let user;

    if (userResult.rows.length === 0) {
      // Créer un nouvel utilisateur
      await client.query('BEGIN');

      const insertResult = await client.query(
        `INSERT INTO users (email, first_name, last_name, rpps_id, status, role_id, auth_method)
         VALUES ($1, $2, $3, $4, 'active', (SELECT id FROM roles WHERE name = 'user'), 'psc')
         RETURNING *`,
        [pscUserInfo.email, pscUserInfo.firstName, pscUserInfo.lastName, pscUserInfo.rppsId]
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
      pscTokens.expiresIn,
      pscTokens.accessToken
    );

    // Log d'audit
    await client.query(
      `INSERT INTO audit_logs (user_id, action, resource_type, details, ip_address)
       VALUES ($1, 'psc_login', 'user', $2, $3)`,
      [user.id, JSON.stringify({ rpps: pscUserInfo.rppsId }), req.ip]
    );

    logger.info(`Connexion PSC réussie: ${user.email}`);

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
          domain: user.domain_id ? {
            id: user.domain_id,
            name: user.domain_name
          } : null
        },
        pscInfo: {
          rpps: pscUserInfo.rppsId,
          firstName: pscUserInfo.firstName,
          lastName: pscUserInfo.lastName,
          profession: pscUserInfo.profession
        }
      }
    });

  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
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
        sub: userInfo.pscSubject,
        rpps: userInfo.rppsId,
        given_name: userInfo.firstName,
        family_name: userInfo.lastName,
        email: userInfo.email,
        profession: userInfo.profession,
        specialty: userInfo.specialty
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
 * POST /api/v1/auth/psc/logout
 * Déconnexion PSC avec Single Logout (SLO)
 */
const pscLogout = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const userId = req.user.userId;

    // 1. Récupérer les tokens PSC stockés
    const pscTokensData = await redisClient.get(`psc_tokens:${userId}`);
    
    let pscLogoutUrl = process.env.PSC_LOGOUT_URL || 
      'https://auth.esw.esante.gouv.fr/auth/realms/esante-wallet/protocol/openid-connect/logout';

    if (pscTokensData) {
      const pscTokens = JSON.parse(pscTokensData);

      // Construire l'URL de déconnexion PSC avec l'id_token_hint
      const logoutParams = new URLSearchParams({
        id_token_hint: pscTokens.idToken,
        post_logout_redirect_uri: process.env.FRONTEND_URL || 'http://localhost:3001'
      });

      pscLogoutUrl = `${pscLogoutUrl}?${logoutParams.toString()}`;

      // Supprimer les tokens PSC du cache
      await redisClient.del(`psc_tokens:${userId}`);
    }

    // 2. Supprimer le refresh token de notre système
    await redisClient.del(`refresh_token:${userId}`);
    await redisClient.del(`psc_token:${userId}`);

    // 3. Blacklister le token JWT actuel
    const token = req.headers.authorization?.split(' ')[1];
    if (token) {
      const decoded = jwt.decode(token);
      const expiresIn = decoded.exp - Math.floor(Date.now() / 1000);
      
      if (expiresIn > 0) {
        await redisClient.setEx(
          `blacklist:${token}`,
          expiresIn,
          'logged_out'
        );
      }
    }

    // 4. Audit log
    await client.query(
      `INSERT INTO audit_logs (user_id, action, resource_type, ip_address, details)
       VALUES ($1, 'psc_logout', 'authentication', $2, $3)`,
      [
        userId,
        req.ip,
        JSON.stringify({ method: 'psc' })
      ]
    );

    logger.info(`Déconnexion PSC: user ${userId}`, {
      userId,
      ip: req.ip
    });

    // 5. Retourner l'URL de déconnexion PSC pour le frontend
    res.json({
      success: true,
      message: 'Déconnexion réussie',
      pscLogoutUrl // Le frontend redirigera l'utilisateur vers cette URL
    });

  } catch (error) {
    logger.error('Erreur PSC logout:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la déconnexion'
    });
  } finally {
    client.release();
  }
};

module.exports = {
  login,
  logout,
  refresh,
  changePassword,
  me,
  pscAuthorize,
  pscCallback,
  pscToken,
  pscUserInfo,
  pscLogout
};