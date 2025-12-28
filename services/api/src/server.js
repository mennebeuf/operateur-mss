/**
 * MSSanté API - Server Entry Point
 * Point d'entrée du serveur Express
 * 
 * Ce fichier gère le démarrage du serveur HTTP et la gestion
 * du cycle de vie de l'application (graceful shutdown)
 */

const http = require('http');
const app = require('./app');
const logger = require('./utils/logger');
const { connectDB, closeDB } = require('./config/database');
const { connectRedis, closeRedis } = require('./config/redis');

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

// Création du serveur HTTP
const server = http.createServer(app);

// Gestion des connexions actives pour graceful shutdown
let connections = new Set();

server.on('connection', (conn) => {
  connections.add(conn);
  conn.on('close', () => connections.delete(conn));
});

/**
 * Démarrage du serveur
 */
const start = async () => {
  try {
    logger.info('🚀 Démarrage du serveur MSSanté API...');
    
    // Connexion à PostgreSQL
    logger.info('📦 Connexion à PostgreSQL...');
    await connectDB();
    logger.info('✅ PostgreSQL connecté');
    
    // Connexion à Redis
    logger.info('📦 Connexion à Redis...');
    await connectRedis();
    logger.info('✅ Redis connecté');
    
    // Démarrage du serveur HTTP
    server.listen(PORT, HOST, () => {
      logger.info(`✅ Serveur démarré sur http://${HOST}:${PORT}`);
      logger.info(`📋 Environnement: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`📋 API Version: v1`);
      
      if (process.env.NODE_ENV === 'development') {
        logger.info(`📖 Documentation: http://${HOST}:${PORT}/api/v1/docs`);
      }
    });
    
  } catch (error) {
    logger.error('❌ Erreur au démarrage:', error);
    process.exit(1);
  }
};

/**
 * Arrêt gracieux du serveur
 */
const shutdown = async (signal) => {
  logger.info(`\n⚠️  Signal ${signal} reçu. Arrêt gracieux en cours...`);
  
  // Arrêter d'accepter de nouvelles connexions
  server.close(async () => {
    logger.info('🔌 Serveur HTTP fermé');
    
    try {
      // Fermer les connexions existantes
      for (const conn of connections) {
        conn.destroy();
      }
      
      // Fermer la connexion Redis
      await closeRedis();
      logger.info('🔌 Connexion Redis fermée');
      
      // Fermer la connexion PostgreSQL
      await closeDB();
      logger.info('🔌 Connexion PostgreSQL fermée');
      
      logger.info('✅ Arrêt gracieux terminé');
      process.exit(0);
      
    } catch (error) {
      logger.error('❌ Erreur lors de l\'arrêt gracieux:', error);
      process.exit(1);
    }
  });
  
  // Force l'arrêt après 30 secondes
  setTimeout(() => {
    logger.error('⏰ Timeout: arrêt forcé après 30s');
    process.exit(1);
  }, 30000);
};

// Gestion des signaux d'arrêt
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Gestion des erreurs non capturées
process.on('uncaughtException', (error) => {
  logger.error('❌ Uncaught Exception:', error);
  shutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  shutdown('unhandledRejection');
});

// Démarrage
start();

module.exports = server;