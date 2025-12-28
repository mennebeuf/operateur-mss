// services/api/src/config/psc.js
// Configuration Pro Santé Connect (OAuth 2.0)
const axios = require('axios');
const crypto = require('crypto');
const logger = require('../utils/logger');

// ============================================
// Configuration PSC
// ============================================

const pscConfig = {
  // Identifiants client
  clientId: process.env.PSC_CLIENT_ID,
  clientSecret: process.env.PSC_CLIENT_SECRET,
  
  // URLs Pro Santé Connect
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
  
  // URL de redirection après authentification
  redirectUri: process.env.PSC_REDIRECT_URI,
  
  // Scopes demandés
  scopes: (process.env.PSC_SCOPES || 'openid email profile scope_all').split(' '),
  
  // Timeouts
  timeout: parseInt(process.env.PSC_TIMEOUT || '10000')
};

// Instance Axios dédiée à PSC
const pscClient = axios.create({
  timeout: pscConfig.timeout,
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Accept': 'application/json'
  }
});

// ============================================
// Fonctions utilitaires
// ============================================

/**
 * Générer un state aléatoire pour la protection CSRF
 * @returns {string} State encodé en base64url
 */
const generateState = () => {
  return crypto.randomBytes(32).toString('base64url');
};

/**
 * Générer un code verifier pour PKCE
 * @returns {string} Code verifier
 */
const generateCodeVerifier = () => {
  return crypto.randomBytes(32).toString('base64url');
};

/**
 * Générer le code challenge à partir du verifier (PKCE S256)
 * @param {string} verifier - Code verifier
 * @returns {string} Code challenge
 */
const generateCodeChallenge = (verifier) => {
  return crypto
    .createHash('sha256')
    .update(verifier)
    .digest('base64url');
};

// ============================================
// Fonctions principales OAuth2
// ============================================

/**
 * Construire l'URL d'autorisation PSC
 * @param {string} state - State pour protection CSRF
 * @param {string} codeChallenge - Code challenge PKCE (optionnel)
 * @param {string} nonce - Nonce pour OpenID Connect (optionnel)
 * @returns {string} URL d'autorisation complète
 */
const getAuthorizationUrl = (state, codeChallenge = null, nonce = null) => {
  const params = new URLSearchParams({
    client_id: pscConfig.clientId,
    response_type: 'code',
    redirect_uri: pscConfig.redirectUri,
    scope: pscConfig.scopes.join(' '),
    state
  });
  
  // PKCE (recommandé)
  if (codeChallenge) {
    params.append('code_challenge', codeChallenge);
    params.append('code_challenge_method', 'S256');
  }
  
  // Nonce pour OpenID Connect
  if (nonce) {
    params.append('nonce', nonce);
  }
  
  const url = `${pscConfig.authorizationUrl}?${params.toString()}`;
  logger.debug('URL d\'autorisation PSC générée', { state });
  
  return url;
};

/**
 * Échanger le code d'autorisation contre des tokens
 * @param {string} code - Code d'autorisation reçu
 * @param {string} codeVerifier - Code verifier PKCE (si utilisé)
 * @returns {Promise<Object>} Tokens (access_token, refresh_token, id_token, expires_in)
 */
const exchangeCodeForTokens = async (code, codeVerifier = null) => {
  try {
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: pscConfig.clientId,
      client_secret: pscConfig.clientSecret,
      code,
      redirect_uri: pscConfig.redirectUri
    });
    
    // PKCE
    if (codeVerifier) {
      params.append('code_verifier', codeVerifier);
    }
    
    const response = await pscClient.post(pscConfig.tokenUrl, params.toString());
    
    logger.info('Tokens PSC obtenus avec succès');
    
    return {
      accessToken: response.data.access_token,
      refreshToken: response.data.refresh_token,
      idToken: response.data.id_token,
      expiresIn: response.data.expires_in,
      tokenType: response.data.token_type,
      scope: response.data.scope
    };
  } catch (error) {
    logger.error('Erreur lors de l\'échange du code PSC', {
      error: error.response?.data?.error_description || error.message,
      status: error.response?.status
    });
    throw new Error(`Échec de l'échange du code: ${error.response?.data?.error_description || error.message}`);
  }
};

/**
 * Rafraîchir un access token expiré
 * @param {string} refreshToken - Refresh token
 * @returns {Promise<Object>} Nouveaux tokens
 */
const refreshAccessToken = async (refreshToken) => {
  try {
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: pscConfig.clientId,
      client_secret: pscConfig.clientSecret,
      refresh_token: refreshToken
    });
    
    const response = await pscClient.post(pscConfig.tokenUrl, params.toString());
    
    logger.debug('Token PSC rafraîchi avec succès');
    
    return {
      accessToken: response.data.access_token,
      refreshToken: response.data.refresh_token || refreshToken,
      idToken: response.data.id_token,
      expiresIn: response.data.expires_in
    };
  } catch (error) {
    logger.error('Erreur lors du rafraîchissement du token PSC', {
      error: error.response?.data?.error_description || error.message
    });
    throw new Error(`Échec du rafraîchissement: ${error.response?.data?.error_description || error.message}`);
  }
};

/**
 * Récupérer les informations utilisateur depuis PSC
 * @param {string} accessToken - Access token valide
 * @returns {Promise<Object>} Informations utilisateur PSC
 */
const getUserInfo = async (accessToken) => {
  try {
    const response = await pscClient.get(pscConfig.userInfoUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    const userInfo = response.data;
    
    logger.info('Informations utilisateur PSC récupérées', {
      sub: userInfo.sub,
      email: userInfo.email
    });
    
    // Normaliser les données PSC
    return {
      sub: userInfo.sub,
      // Identifiant national (RPPS, ADELI, etc.)
      nationalId: userInfo.SubjectNameID || userInfo.preferred_username,
      rpps: extractRPPS(userInfo),
      // Identité
      firstName: userInfo.given_name,
      lastName: userInfo.family_name,
      email: userInfo.email,
      // Organisation
      organization: userInfo.SubjectOrganization,
      organizationId: userInfo.SubjectOrganizationID,
      // Rôle/Profession
      roles: parseRoles(userInfo.SubjectRole),
      profession: extractProfession(userInfo.SubjectRole),
      // Données brutes
      raw: userInfo
    };
  } catch (error) {
    logger.error('Erreur lors de la récupération des infos utilisateur PSC', {
      error: error.response?.data?.error || error.message,
      status: error.response?.status
    });
    throw new Error(`Échec de récupération userinfo: ${error.message}`);
  }
};

/**
 * Valider un access token auprès de PSC
 * @param {string} accessToken - Access token à valider
 * @returns {Promise<boolean>} True si le token est valide
 */
const validateToken = async (accessToken) => {
  try {
    // Tenter de récupérer les infos utilisateur pour valider le token
    await getUserInfo(accessToken);
    return true;
  } catch (error) {
    logger.debug('Token PSC invalide ou expiré');
    return false;
  }
};

/**
 * Construire l'URL de déconnexion PSC
 * @param {string} idToken - ID token pour le logout hint
 * @param {string} postLogoutRedirectUri - URL de redirection après déconnexion
 * @returns {string} URL de déconnexion
 */
const getLogoutUrl = (idToken, postLogoutRedirectUri) => {
  const params = new URLSearchParams({
    client_id: pscConfig.clientId,
    post_logout_redirect_uri: postLogoutRedirectUri
  });
  
  if (idToken) {
    params.append('id_token_hint', idToken);
  }
  
  return `${pscConfig.logoutUrl}?${params.toString()}`;
};

// ============================================
// Fonctions utilitaires pour parser les données PSC
// ============================================

/**
 * Extraire le numéro RPPS des claims PSC
 * @param {Object} userInfo - Claims utilisateur
 * @returns {string|null} Numéro RPPS
 */
const extractRPPS = (userInfo) => {
  // Le RPPS peut être dans différents champs selon le contexte
  if (userInfo.SubjectNameID?.startsWith('8')) {
    return userInfo.SubjectNameID;
  }
  
  // Parfois dans le sub au format f:xxx:RPPS
  const subParts = userInfo.sub?.split(':');
  if (subParts?.length === 3 && subParts[2]?.match(/^\d{11}$/)) {
    return subParts[2];
  }
  
  return userInfo.rpps || null;
};

/**
 * Parser les rôles PSC (format "code^libellé")
 * @param {string|Array} subjectRole - Rôles bruts
 * @returns {Array<Object>} Rôles parsés
 */
const parseRoles = (subjectRole) => {
  if (!subjectRole) return [];
  
  const roles = Array.isArray(subjectRole) ? subjectRole : [subjectRole];
  
  return roles.map(role => {
    const [code, label] = role.split('^');
    return { code, label: label || code };
  });
};

/**
 * Extraire la profession principale
 * @param {string|Array} subjectRole - Rôles
 * @returns {string|null} Profession
 */
const extractProfession = (subjectRole) => {
  const roles = parseRoles(subjectRole);
  return roles[0]?.label || null;
};

// ============================================
// Vérification de la configuration
// ============================================

/**
 * Vérifier que la configuration PSC est complète
 * @throws {Error} Si la configuration est incomplète
 */
const validateConfig = () => {
  const required = ['clientId', 'clientSecret', 'redirectUri'];
  const missing = required.filter(key => !pscConfig[key]);
  
  if (missing.length > 0) {
    throw new Error(`Configuration PSC incomplète. Manquant: ${missing.join(', ')}`);
  }
  
  logger.info('✅ Configuration Pro Santé Connect validée', {
    clientId: pscConfig.clientId?.substring(0, 8) + '...',
    redirectUri: pscConfig.redirectUri
  });
};

// ============================================
// Export
// ============================================

module.exports = {
  // Configuration
  config: pscConfig,
  validateConfig,
  
  // Utilitaires
  generateState,
  generateCodeVerifier,
  generateCodeChallenge,
  
  // OAuth2 flow
  getAuthorizationUrl,
  exchangeCodeForTokens,
  refreshAccessToken,
  getUserInfo,
  validateToken,
  getLogoutUrl,
  
  // Helpers
  extractRPPS,
  parseRoles,
  extractProfession
};