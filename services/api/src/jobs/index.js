/**
 * Point d'entrée des jobs asynchrones (cron)
 * Opérateur MSSanté
 */

const logger = require('../utils/logger');

// Import de tous les jobs cron
require('./annuaireRetry');
require('./annuaireBatch');
require('./generateIndicators');
require('./downloadReports');
require('./certificateMonitor');
require('./cleanupSessions');
require('./dailyStatistics');

logger.info('📋 Jobs cron initialisés');

/**
 * Liste des jobs et leur planification :
 * 
 * - annuaireRetry      : Toutes les heures (0 * * * *)
 *                        Retry des publications annuaire échouées
 * 
 * - annuaireBatch      : Tous les jours à 2h (0 2 * * *)
 *                        Génération et upload du flux annuaire quotidien
 * 
 * - generateIndicators : Le 1er de chaque mois à 3h (0 3 1 * *)
 *                        Génération des indicateurs mensuels ANS
 * 
 * - downloadReports    : Tous les jours à 8h (0 8 * * *)
 *                        Téléchargement des comptes rendus ANS
 * 
 * - certificateMonitor : Tous les jours à 6h (0 6 * * *)
 *                        Vérification des certificats expirant
 * 
 * - cleanupSessions    : Toutes les heures (0 * * * *)
 *                        Nettoyage des sessions expirées
 * 
 * - dailyStatistics    : Tous les jours à 1h (0 1 * * *)
 *                        Agrégation des statistiques quotidiennes
 */

module.exports = {
  // Exporter les jobs pour tests ou exécution manuelle si nécessaire
};