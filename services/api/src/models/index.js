// services/api/src/models/index.js

const User = require('./User');
const Mailbox = require('./Mailbox');
const Domain = require('./Domain');
const Certificate = require('./Certificate');

module.exports = {
  User,
  Mailbox,
  Domain,
  Certificate
};