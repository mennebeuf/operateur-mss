// services/api/src/services/pscService.js
const axios = require('axios');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');
const { pool } = require('../config/database');
const { redisClient } = require('../config/redis');
const logger = require('../utils/logger');

/**
 * Service Pro Santé Connect (PSC)
 * Gère l'authentification OAuth 2.0 / OpenID Connect
 */
class PSCService {
  constructor() {
    this.config = {
      clientId: process.env.PSC_CLIENT_ID,
      clientSecret: process.env.PSC_CLIENT_SECRET,
      authorizationUrl: process.env.PSC_AUTHORIZATION_URL || 
        'https://auth.esw.esante.gouv.fr/auth/realms/esante-wallet/protocol/openid-connect/auth',
      tokenUrl: process.env.PSC_TOKEN_URL || 
        'https://auth.esw.esante.gouv.fr/auth/realms/esante-wallet/protocol/openid-connect/token',
      userInfoUrl: process.env.PSC_USERINFO_URL || 
        'https://auth.esw.esante.gouv.fr/auth/realms/esante-wallet/protocol/openid-connect/userinfo',
      logoutUrl: process.env.PSC_LOGOUT_URL || 
        'https://auth.esw.esante.gouv.fr/auth/realms/esante-wallet/protocol/openid-connect/logout',
      jwksUrl: process.env.PSC_JWKS_URL ||
        'https://auth.esw.esante.gouv.fr/auth/realms/esante-wallet/protocol/openid-connect/certs',
      redirectUri: process.env.PSC_REDIRECT_URI,
      scopes: (process.env.PSC_SCOPES || 'openid email profile scope_all').split(' '),
      timeout: parseInt(process.env.PSC_TIMEOUT || '10000')
    };

    // Client HTTP
    this.client = axios.create({
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      }
    });

    // Client JWKS pour vérification des tokens
    this.jwksClient = jwksClient({
      jwksUri: this.config.jwksUrl,
      cache: true,
      cacheMaxAge: 86400000, // 24h
      rateLimit: true
    });
  }

  /**
   * Génère l'URL d'autorisation PSC
   */
  getAuthorizationUrl(state = null, nonce = null) {
    const authState = state || crypto.randomBytes(32).toString('hex');
    const authNonce = nonce || crypto.randomBytes(32).toString('hex');

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      scope: this.config.scopes.join(' '),
      state: authState,
      nonce: authNonce,
      acr_values: 'eidas2' // Niveau d'authentification requis
    });

    return {
      url: `${this.config.authorizationUrl}?${params.toString()}`,
      state: authState,
      nonce: authNonce
    };
  }

  /**
   * Échange le code d'autorisation contre des tokens
   */
  async exchangeCodeForTokens(code) {
    try {
      const params = new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: this.config.redirectUri,
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret
      });

      const response = await this.client.post(this.config.tokenUrl, params.toString());

      const { access_token, refresh_token, id_token, expires_in, token_type } = response.data;

      // Vérifier et décoder l'ID token
      const decodedIdToken = await this.verifyIdToken(id_token);

      logger.info('Tokens PSC obtenus', { subject: decodedIdToken.sub });

      return {
        accessToken: access_token,
        refreshToken: refresh_token,
        idToken: id_token,
        decodedIdToken,
        expiresIn: expires_in,
        tokenType: token_type
      };
    } catch (error) {
      logger.error('Erreur échange code PSC:', error.response?.data || error.message);
      throw new Error('Échec de l\'authentification PSC');
    }
  }

  /**
   * Rafraîchit les tokens
   */
  async refreshTokens(refreshToken) {
    try {
      const params = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret
      });

      const response = await this.client.post(this.config.tokenUrl, params.toString());

      logger.info('Tokens PSC rafraîchis');
      return response.data;
    } catch (error) {
      logger.error('Erreur refresh token PSC:', error.response?.data || error.message);
      throw new Error('Échec du rafraîchissement des tokens');
    }
  }

  /**
   * Récupère les informations utilisateur depuis PSC
   */
  async getUserInfo(accessToken) {
    try {
      const response = await this.client.get(this.config.userInfoUrl, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      const userInfo = response.data;

      // Normaliser les données utilisateur
      return {
        pscSubject: userInfo.sub,
        rppsId: userInfo.SubjectRefPro?.identifiantPP || this.extractRPPS(userInfo),
        adeliId: this.extractAdeli(userInfo),
        email: userInfo.email || userInfo.emailAddress,
        emailVerified: userInfo.email_verified,
        firstName: userInfo.given_name || userInfo.SubjectRefPro?.prenomExercice,
        lastName: userInfo.family_name || userInfo.SubjectRefPro?.nomExercice,
        fullName: userInfo.name,
        profession: userInfo.SubjectRefPro?.codeProfession,
        professionLabel: userInfo.SubjectRefPro?.libelleProfession,
        specialty: userInfo.SubjectRefPro?.codeSpecialite,
        specialtyLabel: userInfo.SubjectRefPro?.libelleSpecialite,
        exerciseMode: userInfo.SubjectRefPro?.codeModeExercice,
        structures: this.extractStructures(userInfo)
      };
    } catch (error) {
      logger.error('Erreur récupération userinfo PSC:', error.response?.data || error.message);
      throw new Error('Impossible de récupérer les informations utilisateur');
    }
  }

  /**
   * Vérifie et décode un ID token
   */
  async verifyIdToken(idToken) {
    return new Promise((resolve, reject) => {
      const getKey = (header, callback) => {
        this.jwksClient.getSigningKey(header.kid, (err, key) => {
          if (err) return callback(err);
          callback(null, key.getPublicKey());
        });
      };

      jwt.verify(idToken, getKey, {
        algorithms: ['RS256'],
        issuer: process.env.PSC_ISSUER || 'https://auth.esw.esante.gouv.fr/auth/realms/esante-wallet',
        audience: this.config.clientId
      }, (err, decoded) => {
        if (err) {
          logger.error('Erreur vérification ID token:', err.message);
          return reject(new Error('Token ID invalide'));
        }
        resolve(decoded);
      });
    });
  }

  /**
   * Déconnexion PSC
   */
  async logout(idToken, postLogoutRedirectUri = null) {
    const params = new URLSearchParams({
      id_token_hint: idToken,
      client_id: this.config.clientId
    });

    if (postLogoutRedirectUri) {
      params.append('post_logout_redirect_uri', postLogoutRedirectUri);
    }

    return `${this.config.logoutUrl}?${params.toString()}`;
  }

  /**
   * Trouve ou crée un utilisateur depuis les données PSC
   */
  async findOrCreateUser(userInfo) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Recherche par subject PSC
      let result = await client.query(
        'SELECT * FROM users WHERE psc_subject = $1',
        [userInfo.pscSubject]
      );

      if (result.rows.length > 0) {
        // Mise à jour des infos
        const user = result.rows[0];
        await client.query(
          `UPDATE users SET
            rpps_id = COALESCE($1, rpps_id),
            adeli_id = COALESCE($2, adeli_id),
            first_name = COALESCE($3, first_name),
            last_name = COALESCE($4, last_name),
            profession = COALESCE($5, profession),
            specialty = COALESCE($6, specialty),
            last_login = NOW(),
            updated_at = NOW()
          WHERE id = $7`,
          [
            userInfo.rppsId, userInfo.adeliId, userInfo.firstName,
            userInfo.lastName, userInfo.professionLabel, userInfo.specialtyLabel,
            user.id
          ]
        );

        await client.query('COMMIT');
        logger.auth('success', { userId: user.id, method: 'psc' });
        return { ...user, isNew: false };
      }

      // Recherche par RPPS/ADELI
      if (userInfo.rppsId || userInfo.adeliId) {
        result = await client.query(
          'SELECT * FROM users WHERE rpps_id = $1 OR adeli_id = $2',
          [userInfo.rppsId, userInfo.adeliId]
        );

        if (result.rows.length > 0) {
          const user = result.rows[0];
          await client.query(
            `UPDATE users SET psc_subject = $1, last_login = NOW(), updated_at = NOW() WHERE id = $2`,
            [userInfo.pscSubject, user.id]
          );
          await client.query('COMMIT');
          return { ...user, isNew: false };
        }
      }

      // Création d'un nouvel utilisateur
      result = await client.query(
        `INSERT INTO users (
          psc_subject, rpps_id, adeli_id, email, first_name, last_name,
          profession, specialty, status, last_login, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active', NOW(), NOW())
        RETURNING *`,
        [
          userInfo.pscSubject, userInfo.rppsId, userInfo.adeliId,
          userInfo.email, userInfo.firstName, userInfo.lastName,
          userInfo.professionLabel, userInfo.specialtyLabel
        ]
      );

      await client.query('COMMIT');
      
      const newUser = result.rows[0];
      logger.auth('success', { userId: newUser.id, method: 'psc', isNew: true });
      
      return { ...newUser, isNew: true };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Stocke les tokens PSC dans Redis
   */
  async storeTokens(userId, tokens) {
    const key = `psc:tokens:${userId}`;
    await redisClient.set(key, JSON.stringify(tokens), 'EX', tokens.expiresIn || 3600);
  }

  /**
   * Récupère les tokens PSC depuis Redis
   */
  async getStoredTokens(userId) {
    const key = `psc:tokens:${userId}`;
    const data = await redisClient.get(key);
    return data ? JSON.parse(data) : null;
  }

  // Helpers d'extraction
  extractRPPS(userInfo) {
    const refPro = userInfo.SubjectRefPro;
    if (refPro?.identifiantPP?.startsWith('8')) return refPro.identifiantPP;
    if (refPro?.exercices) {
      for (const ex of refPro.exercices) {
        if (ex.identifiantPP?.startsWith('8')) return ex.identifiantPP;
      }
    }
    return null;
  }

  extractAdeli(userInfo) {
    const refPro = userInfo.SubjectRefPro;
    if (refPro?.identifiantPP?.startsWith('0')) return refPro.identifiantPP;
    return null;
  }

  extractStructures(userInfo) {
    if (!userInfo.SubjectRefPro?.exercices) return [];
    return userInfo.SubjectRefPro.exercices.map(ex => ({
      siret: ex.siret,
      finess: ex.idFiness,
      name: ex.raisonSociale,
      role: ex.fonction
    }));
  }
}

module.exports = new PSCService();