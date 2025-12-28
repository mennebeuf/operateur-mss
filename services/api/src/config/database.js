// services/api/src/config/database.js
const { Pool } = require('pg');
const logger = require('../utils/logger');

// Configuration du pool de connexions PostgreSQL
const poolConfig = {
  host: process.env.DB_HOST || process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || process.env.POSTGRES_PORT || '5432'),
  database: process.env.DB_NAME || process.env.POSTGRES_DB || 'mssante',
  user: process.env.DB_USER || process.env.POSTGRES_USER || 'mssante',
  password: process.env.DB_PASSWORD || process.env.POSTGRES_PASSWORD,
  
  // Configuration du pool
  max: parseInt(process.env.DB_POOL_MAX || '20'),
  idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'),
  connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '5000'),
  
  // SSL en production
  ssl: process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false',
    ca: process.env.DB_SSL_CA || undefined
  } : false
};

// Instance du pool
const pool = new Pool(poolConfig);

// Gestion des erreurs du pool
pool.on('error', (err, client) => {
  logger.error('Erreur inattendue sur le client PostgreSQL', { error: err.message });
});

pool.on('connect', (client) => {
  logger.debug('Nouvelle connexion PostgreSQL établie');
});

pool.on('remove', (client) => {
  logger.debug('Connexion PostgreSQL retirée du pool');
});

/**
 * Connexion à la base de données avec retry
 * @param {number} maxRetries - Nombre maximum de tentatives
 * @param {number} delay - Délai entre les tentatives (ms)
 */
const connectDB = async (maxRetries = 5, delay = 3000) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const client = await pool.connect();
      
      // Test de la connexion
      const result = await client.query('SELECT NOW() as now, current_database() as db');
      client.release();
      
      logger.info('✅ Connexion PostgreSQL établie', {
        database: result.rows[0].db,
        timestamp: result.rows[0].now,
        host: poolConfig.host,
        port: poolConfig.port
      });
      
      return true;
    } catch (error) {
      logger.warn(`Tentative ${attempt}/${maxRetries} de connexion à PostgreSQL échouée`, {
        error: error.message
      });
      
      if (attempt === maxRetries) {
        logger.error('❌ Impossible de se connecter à PostgreSQL après plusieurs tentatives');
        throw error;
      }
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};

/**
 * Exécuter une requête SQL
 * @param {string} text - Requête SQL
 * @param {Array} params - Paramètres de la requête
 * @returns {Promise<Object>} Résultat de la requête
 */
const query = async (text, params) => {
  const start = Date.now();
  
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    
    logger.debug('Requête SQL exécutée', {
      query: text.substring(0, 100),
      duration: `${duration}ms`,
      rows: result.rowCount
    });
    
    return result;
  } catch (error) {
    logger.error('Erreur lors de l\'exécution de la requête SQL', {
      query: text.substring(0, 100),
      error: error.message
    });
    throw error;
  }
};

/**
 * Obtenir un client du pool pour les transactions
 * @returns {Promise<Object>} Client PostgreSQL
 */
const getClient = async () => {
  const client = await pool.connect();
  
  // Wrapper pour libérer automatiquement en cas d'erreur
  const originalQuery = client.query.bind(client);
  const originalRelease = client.release.bind(client);
  
  // Timeout pour éviter les connexions zombies
  const timeout = setTimeout(() => {
    logger.warn('Client PostgreSQL maintenu trop longtemps, libération forcée');
    client.release();
  }, 30000);
  
  client.query = (...args) => originalQuery(...args);
  client.release = () => {
    clearTimeout(timeout);
    return originalRelease();
  };
  
  return client;
};

/**
 * Exécuter une transaction
 * @param {Function} callback - Fonction à exécuter dans la transaction
 * @returns {Promise<any>} Résultat de la transaction
 */
const transaction = async (callback) => {
  const client = await getClient();
  
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Fermer proprement le pool de connexions
 */
const closePool = async () => {
  try {
    await pool.end();
    logger.info('Pool de connexions PostgreSQL fermé');
  } catch (error) {
    logger.error('Erreur lors de la fermeture du pool PostgreSQL', { error: error.message });
    throw error;
  }
};

/**
 * Obtenir les statistiques du pool
 * @returns {Object} Statistiques du pool
 */
const getPoolStats = () => ({
  totalCount: pool.totalCount,
  idleCount: pool.idleCount,
  waitingCount: pool.waitingCount
});

module.exports = {
  pool,
  connectDB,
  query,
  getClient,
  transaction,
  closePool,
  getPoolStats
};