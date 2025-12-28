// services/api/src/routes/index.js
/**
 * Point d'entrée des routes API
 * Centralise l'export de toutes les routes
 */

const auth = require('./auth');
const users = require('./users');
const mailboxes = require('./mailboxes');
const domains = require('./domains');
const certificates = require('./certificates');
const email = require('./email');
const annuaire = require('./annuaire');
const audit = require('./audit');
const admin = require('./admin');

module.exports = {
  auth,
  users,
  mailboxes,
  domains,
  certificates,
  email,
  annuaire,
  audit,
  admin
};