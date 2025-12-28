// services/api/src/utils/index.js

/**
 * Point d'entrée pour les utilitaires
 * Permet d'importer tous les utils depuis un seul fichier
 * 
 * Usage:
 * const { logger, smtp, crypto, validators, helpers } = require('./utils');
 * 
 * ou:
 * const logger = require('./utils/logger');
 */

const logger = require('./logger');
const smtp = require('./smtp');
const crypto = require('./crypto');
const { PATTERNS, schemas, validators, Joi } = require('./validators');
const helpers = require('./helpers');

module.exports = {
  // Logger Winston
  logger,
  
  // Client SMTP
  smtp,
  
  // Utilitaires cryptographiques
  crypto,
  
  // Validation
  PATTERNS,
  schemas,
  validators,
  Joi,
  
  // Helpers généraux
  helpers,
  
  // Re-export des fonctions helpers les plus utilisées
  ...helpers
};