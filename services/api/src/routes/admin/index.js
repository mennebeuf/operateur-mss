// services/api/src/routes/admin/index.js
/**
 * Routes d'administration
 * Point d'entrée pour toutes les routes admin
 */

const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middleware/auth');
const { requireSuperAdmin, requireDomainAdmin } = require('../../middleware/permissions');

// Toutes les routes admin nécessitent l'authentification
router.use(authenticate);

// ============================================
// ROUTES SUPER ADMIN
// ============================================

// Gestion des domaines (Super Admin)
router.use('/domains', requireSuperAdmin, require('./domains'));

// Gestion globale des utilisateurs (Super Admin)
router.use('/users', requireSuperAdmin, require('./users'));

// Gestion globale des certificats (Super Admin)
router.use('/certificates', requireSuperAdmin, require('./certificates'));

// Configuration système (Super Admin)
router.use('/settings', requireSuperAdmin, require('./settings'));

// Monitoring système (Super Admin)
router.use('/monitoring', requireSuperAdmin, require('./monitoring'));

// ============================================
// ROUTES ADMIN DOMAINE
// ============================================

// Statistiques (Domain Admin ou Super Admin)
router.use('/statistics', requireDomainAdmin, require('./statistics'));

// Annuaire ANS - gestion avancée
router.use('/annuaire', requireDomainAdmin, require('./annuaire'));

// Audit - consultation avancée
router.use('/audit', requireDomainAdmin, require('./audit'));

module.exports = router;