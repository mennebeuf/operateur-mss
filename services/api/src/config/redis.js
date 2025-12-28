// services/api/src/config/redis.js
const { createClient } = require('redis');
const logger = require('../utils/logger');

// Configuration Redis
const redisConfig = {
  socket: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    connectTimeout: parseInt(process.env.REDIS_CONNECT_TIMEOUT || '5000'),
    reconnectStrategy: (retries) => {
      if (retries > 10) {
        logger.error('Trop de tentatives de reconnexion Redis, abandon');
        return new Error('Reconnexion Redis abandonnée');
      }
      const delay = Math.min(retries * 500, 3000);
      logger.warn(`Reconnexion Redis dans ${delay}ms (tentative ${retries})`);
      return delay;
    }
  },
  password: process.env.REDIS_PASSWORD || undefined,
  database: parseInt(process.env.REDIS_DB || '0')
};

// Client Redis principal
let client = null;
// Client pour les subscriptions (pub/sub)
let subscriber = null;

/**
 * Créer et configurer un client Redis
 */
const createRedisClient = (name = 'main') => {
  const redisClient = createClient(redisConfig);

  redisClient.on('error', (err) => {
    logger.error(`Erreur Redis (${name})`, { error: err.message });
  });

  redisClient.on('connect', () => {
    logger.debug(`Client Redis (${name}) connecté`);
  });

  redisClient.on('ready', () => {
    logger.info(`✅ Client Redis (${name}) prêt`, {
      host: redisConfig.socket.host,
      port: redisConfig.socket.port
    });
  });

  redisClient.on('reconnecting', () => {
    logger.warn(`Reconnexion Redis (${name}) en cours...`);
  });

  redisClient.on('end', () => {
    logger.info(`Client Redis (${name}) déconnecté`);
  });

  return redisClient;
};

/**
 * Connexion à Redis avec retry
 */
const connectRedis = async (maxRetries = 5, delay = 3000) => {
  client = createRedisClient('main');
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await client.connect();
      const pong = await client.ping();
      if (pong === 'PONG') {
        logger.info('✅ Connexion Redis établie');
        return client;
      }
    } catch (error) {
      logger.warn(`Tentative ${attempt}/${maxRetries} de connexion à Redis échouée`, {
        error: error.message
      });
      
      if (attempt === maxRetries) {
        logger.error('❌ Impossible de se connecter à Redis après plusieurs tentatives');
        throw error;
      }
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};

/**
 * Obtenir le client Redis principal
 */
const getClient = () => {
  if (!client || !client.isReady) {
    throw new Error('Client Redis non connecté');
  }
  return client;
};

/**
 * Obtenir un client pour les subscriptions
 */
const getSubscriber = async () => {
  if (!subscriber) {
    subscriber = createRedisClient('subscriber');
    await subscriber.connect();
  }
  return subscriber;
};

// ============================================
// Helpers pour le cache
// ============================================

/**
 * Mettre en cache une valeur
 */
const setCache = async (key, value, ttl = null) => {
  const redis = getClient();
  const serialized = JSON.stringify(value);
  
  if (ttl) {
    await redis.setEx(key, ttl, serialized);
  } else {
    await redis.set(key, serialized);
  }
  
  logger.debug('Cache set', { key, ttl });
};

/**
 * Récupérer une valeur du cache
 */
const getCache = async (key) => {
  const redis = getClient();
  const value = await redis.get(key);
  
  if (value) {
    logger.debug('Cache hit', { key });
    return JSON.parse(value);
  }
  
  logger.debug('Cache miss', { key });
  return null;
};

/**
 * Supprimer une valeur du cache
 */
const delCache = async (key) => {
  const redis = getClient();
  await redis.del(key);
  logger.debug('Cache deleted', { key });
};

/**
 * Supprimer les clés correspondant à un pattern
 */
const delCachePattern = async (pattern) => {
  const redis = getClient();
  const keys = await redis.keys(pattern);
  
  if (keys.length > 0) {
    await redis.del(keys);
    logger.debug('Cache pattern deleted', { pattern, count: keys.length });
  }
};

// ============================================
// Helpers pour les sessions
// ============================================

const SESSION_PREFIX = 'session:';
const SESSION_TTL = parseInt(process.env.SESSION_TTL || '86400'); // 24h

/**
 * Stocker une session
 */
const setSession = async (sessionId, data) => {
  await setCache(`${SESSION_PREFIX}${sessionId}`, data, SESSION_TTL);
};

/**
 * Récupérer une session
 */
const getSession = async (sessionId) => {
  return getCache(`${SESSION_PREFIX}${sessionId}`);
};

/**
 * Supprimer une session
 */
const delSession = async (sessionId) => {
  await delCache(`${SESSION_PREFIX}${sessionId}`);
};

/**
 * Prolonger la durée d'une session
 */
const touchSession = async (sessionId) => {
  const redis = getClient();
  await redis.expire(`${SESSION_PREFIX}${sessionId}`, SESSION_TTL);
};

// ============================================
// Helpers pour le rate limiting
// ============================================

const RATE_LIMIT_PREFIX = 'ratelimit:';

/**
 * Incrémenter et vérifier le rate limit
 */
const checkRateLimit = async (identifier, maxRequests, windowSeconds) => {
  const redis = getClient();
  const key = `${RATE_LIMIT_PREFIX}${identifier}`;
  
  const multi = redis.multi();
  multi.incr(key);
  multi.ttl(key);
  
  const [count, ttl] = await multi.exec();
  
  if (ttl === -1) {
    await redis.expire(key, windowSeconds);
  }
  
  const allowed = count <= maxRequests;
  const remaining = Math.max(0, maxRequests - count);
  const resetAt = Date.now() + (ttl > 0 ? ttl * 1000 : windowSeconds * 1000);
  
  return { allowed, remaining, resetAt, count };
};

// ============================================
// Helpers pour tokens PSC
// ============================================

const TOKEN_PREFIX = 'psc_token:';
const REFRESH_TOKEN_PREFIX = 'psc_refresh:';

/**
 * Stocker un token PSC
 */
const storePSCToken = async (userId, tokens) => {
  const redis = getClient();
  await redis.setEx(
    `${TOKEN_PREFIX}${userId}`,
    tokens.expiresIn || 3600,
    JSON.stringify(tokens)
  );
  
  if (tokens.refreshToken) {
    await redis.setEx(
      `${REFRESH_TOKEN_PREFIX}${userId}`,
      604800, // 7 jours
      tokens.refreshToken
    );
  }
};

/**
 * Récupérer un token PSC
 */
const getPSCToken = async (userId) => {
  const redis = getClient();
  const token = await redis.get(`${TOKEN_PREFIX}${userId}`);
  return token ? JSON.parse(token) : null;
};

/**
 * Récupérer un refresh token PSC
 */
const getPSCRefreshToken = async (userId) => {
  const redis = getClient();
  return redis.get(`${REFRESH_TOKEN_PREFIX}${userId}`);
};

/**
 * Supprimer les tokens PSC d'un utilisateur
 */
const deletePSCTokens = async (userId) => {
  const redis = getClient();
  await redis.del(`${TOKEN_PREFIX}${userId}`);
  await redis.del(`${REFRESH_TOKEN_PREFIX}${userId}`);
};

// ============================================
// Fermeture des connexions
// ============================================

const closeRedis = async () => {
  try {
    if (subscriber && subscriber.isReady) {
      await subscriber.quit();
    }
    if (client && client.isReady) {
      await client.quit();
    }
    logger.info('Connexions Redis fermées');
  } catch (error) {
    logger.error('Erreur lors de la fermeture des connexions Redis', { error: error.message });
    throw error;
  }
};

module.exports = {
  connectRedis,
  getClient,
  getSubscriber,
  // Cache
  setCache,
  getCache,
  delCache,
  delCachePattern,
  // Sessions
  setSession,
  getSession,
  delSession,
  touchSession,
  // Rate limiting
  checkRateLimit,
  // Tokens PSC
  storePSCToken,
  getPSCToken,
  getPSCRefreshToken,
  deletePSCTokens,
  // Fermeture
  closeRedis
};