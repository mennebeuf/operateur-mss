// services/api/src/services/index.js

/**
 * Point d'entrée pour tous les services
 * Permet d'importer tous les services depuis un seul fichier
 * 
 * Usage:
 * const { annuaireService, pscService, mailService } = require('./services');
 */

const annuaireService = require('./annuaire');
const pscService = require('./pscService');
const mailService = require('./mailService');
const certificateService = require('./certificateService');
const dnsService = require('./dnsService');
const indicatorsService = require('./indicatorsService');
const imapService = require('./email/imapService');
const smtpService = require('./email/smtpService');

module.exports = {
  annuaireService,
  pscService,
  mailService,
  certificateService,
  dnsService,
  indicatorsService,
  imapService,
  smtpService
};