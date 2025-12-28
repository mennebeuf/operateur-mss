// services/api/src/services/email/index.js

/**
 * Point d'entrée pour les services email (IMAP/SMTP)
 */

const imapService = require('./imapService');
const smtpService = require('./smtpService');

module.exports = {
  imapService,
  smtpService
};