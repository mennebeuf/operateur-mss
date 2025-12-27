# Panneau d'Administration MSSanté

## Vue d'ensemble

Le panneau d'administration permet de gérer l'ensemble de la plateforme opérateur MSSanté avec 3 niveaux d'accès :

```
┌─────────────────────────────────────────────────────────┐
│              Super Admin (Opérateur)                    │
│  - Gestion de tous les domaines                         │
│  - Gestion globale des utilisateurs                     │
│  - Configuration plateforme                             │
│  - Monitoring & statistiques globales                   │
│  - Gestion certificats                                  │
│  - Indicateurs ANS                                      │
└─────────────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────┐
│           Admin Domaine (Établissement)                 │
│  - Gestion des BAL de son domaine                       │
│  - Gestion des utilisateurs de son domaine              │
│  - Statistiques de son domaine                          │
│  - Paramètres du domaine                                │
└─────────────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────┐
│              Utilisateur Standard                       │
│  - Gestion de ses propres BAL                           │
│  - Webmail                                              │
│  - Paramètres personnels                                │
└─────────────────────────────────────────────────────────┘
```

Le document couvre :

🔐 **Système de Permissions (Backend)**

✅ 3 niveaux de rôles

- Utilisateur : Accès basique (ses BAL, webmail)
- Admin Domaine : Gestion d'un établissement
- Super Admin : Gestion de toute la plateforme

✅ Gestion granulaire des permissions

- Modèle Role-Based Access Control (RBAC)
- Permissions par ressource (mailbox, user, domain, certificate, etc.)
- Middleware de vérification (requirePermission, requireSuperAdmin, requireDomainAdmin)

✅ Tables SQL complètes

- roles, permissions, role_permissions
- Attribution flexible des permissions

🎨 **Interface Frontend (React)**

✅ Layout Admin professionnel

- Sidebar responsive avec menu contextuel
- Navigation adaptée selon le rôle
- Top bar avec notifications et quick actions

✅ Dashboard Super Admin

- Statistiques globales en temps réel
- Graphiques d'évolution
- Alertes (certificats expirant, erreurs, etc.)
- Activité récente
- Actions rapides

✅ Gestion des Domaines

- Liste complète avec filtres et recherche
- Visualisation des quotas (BAL, stockage)
- Actions : activer, suspendre, éditer
- Indicateurs visuels de santé

📋 Modules d'administration

Le panneau comprend :

- Domaines : Création, gestion, quotas
- Utilisateurs : Tous les utilisateurs ou par domaine
- BAL : Vue globale ou par domaine
- Certificats : Installation, renouvellement, alertes
- Annuaire : Publications, CR, indicateurs ANS
- Statistiques : Globales et par domaine
- Monitoring : Santé de la plateforme
- Audit & Logs : Traçabilité complète
- Paramètres : Configuration plateforme

Architecture des rôles :

```
Super Admin → Gestion complète plateforme
     ↓
Admin Domaine → Gestion établissement
     ↓
Utilisateur → Ses BAL + Webmail
```

---

## 1. Backend - Système de Rôles et Permissions

### 1.1 Modèle de données des rôles

```sql
-- Table des rôles
CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) UNIQUE NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    level INTEGER NOT NULL, -- 1=user, 2=domain_admin, 3=super_admin
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_role_level CHECK (level IN (1, 2, 3))
);

-- Table des permissions
CREATE TABLE permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    resource VARCHAR(50) NOT NULL, -- mailbox, user, domain, certificate, etc.
    action VARCHAR(50) NOT NULL,   -- create, read, update, delete, manage
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table de liaison rôles <-> permissions
CREATE TABLE role_permissions (
    role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
    permission_id UUID REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

-- Ajout du rôle à la table users
ALTER TABLE users ADD COLUMN role_id UUID REFERENCES roles(id);
ALTER TABLE users ADD COLUMN is_super_admin BOOLEAN DEFAULT FALSE;

-- Index
CREATE INDEX idx_users_role ON users(role_id);
CREATE INDEX idx_users_super_admin ON users(is_super_admin);

-- Insertion des rôles de base
INSERT INTO roles (name, display_name, description, level) VALUES
('user', 'Utilisateur', 'Utilisateur standard avec accès basique', 1),
('domain_admin', 'Administrateur Domaine', 'Administrateur d''un établissement/domaine', 2),
('super_admin', 'Super Administrateur', 'Administrateur plateforme opérateur', 3);

-- Insertion des permissions
INSERT INTO permissions (name, resource, action, description) VALUES
-- Mailboxes
('mailbox.create', 'mailbox', 'create', 'Créer une BAL'),
('mailbox.read', 'mailbox', 'read', 'Consulter les BAL'),
('mailbox.update', 'mailbox', 'update', 'Modifier une BAL'),
('mailbox.delete', 'mailbox', 'delete', 'Supprimer une BAL'),
('mailbox.manage_all', 'mailbox', 'manage', 'Gérer toutes les BAL'),

-- Users
('user.create', 'user', 'create', 'Créer un utilisateur'),
('user.read', 'user', 'read', 'Consulter les utilisateurs'),
('user.update', 'user', 'update', 'Modifier un utilisateur'),
('user.delete', 'user', 'delete', 'Supprimer un utilisateur'),
('user.manage_all', 'user', 'manage', 'Gérer tous les utilisateurs'),

-- Domains
('domain.create', 'domain', 'create', 'Créer un domaine'),
('domain.read', 'domain', 'read', 'Consulter les domaines'),
('domain.update', 'domain', 'update', 'Modifier un domaine'),
('domain.delete', 'domain', 'delete', 'Supprimer un domaine'),
('domain.manage_all', 'domain', 'manage', 'Gérer tous les domaines'),

-- Certificates
('certificate.create', 'certificate', 'create', 'Installer des certificats'),
('certificate.read', 'certificate', 'read', 'Consulter les certificats'),
('certificate.update', 'certificate', 'update', 'Renouveler des certificats'),
('certificate.delete', 'certificate', 'delete', 'Supprimer des certificats'),

-- Statistics
('stats.read_own', 'stats', 'read', 'Consulter ses propres stats'),
('stats.read_domain', 'stats', 'read', 'Consulter les stats du domaine'),
('stats.read_all', 'stats', 'read', 'Consulter toutes les stats'),

-- Annuaire
('annuaire.manage', 'annuaire', 'manage', 'Gérer l''annuaire et les indicateurs'),

-- Settings
('settings.read', 'settings', 'read', 'Consulter les paramètres'),
('settings.update', 'settings', 'update', 'Modifier les paramètres');

-- Attribution des permissions aux rôles
-- User (basique)
INSERT INTO role_permissions (role_id, permission_id)
SELECT 
    (SELECT id FROM roles WHERE name = 'user'),
    id
FROM permissions
WHERE name IN (
    'mailbox.read',
    'user.read',
    'stats.read_own',
    'settings.read'
);

-- Domain Admin
INSERT INTO role_permissions (role_id, permission_id)
SELECT 
    (SELECT id FROM roles WHERE name = 'domain_admin'),
    id
FROM permissions
WHERE name IN (
    'mailbox.create', 'mailbox.read', 'mailbox.update', 'mailbox.delete',
    'user.create', 'user.read', 'user.update', 'user.delete',
    'domain.read', 'domain.update',
    'certificate.create', 'certificate.read', 'certificate.update',
    'stats.read_domain',
    'settings.read', 'settings.update'
);

-- Super Admin (tous les droits)
INSERT INTO role_permissions (role_id, permission_id)
SELECT 
    (SELECT id FROM roles WHERE name = 'super_admin'),
    id
FROM permissions;
```

### 1.2 Middleware de vérification des permissions

```javascript
// services/api/src/middleware/permissions.js
const pool = require('../config/database');

/**
 * Vérifier si l'utilisateur a une permission
 */
async function checkPermission(userId, permissionName) {
  const { rows } = await pool.query(`
    SELECT EXISTS (
      SELECT 1
      FROM users u
      JOIN roles r ON u.role_id = r.id
      JOIN role_permissions rp ON r.id = rp.role_id
      JOIN permissions p ON rp.permission_id = p.id
      WHERE u.id = $1
      AND p.name = $2
    ) as has_permission
  `, [userId, permissionName]);
  
  return rows[0].has_permission;
}

/**
 * Vérifier si l'utilisateur est super admin
 */
async function isSuperAdmin(userId) {
  const { rows } = await pool.query(
    'SELECT is_super_admin FROM users WHERE id = $1',
    [userId]
  );
  
  return rows[0]?.is_super_admin || false;
}

/**
 * Vérifier si l'utilisateur est admin du domaine
 */
async function isDomainAdmin(userId, domainId) {
  const { rows } = await pool.query(`
    SELECT EXISTS (
      SELECT 1
      FROM domain_admins
      WHERE user_id = $1
      AND domain_id = $2
    ) as is_admin
  `, [userId, domainId]);
  
  return rows[0].is_admin;
}

/**
 * Middleware pour exiger une permission
 */
const requirePermission = (permissionName) => {
  return async (req, res, next) => {
    try {
      const hasPermission = await checkPermission(req.user.id, permissionName);
      
      if (!hasPermission) {
        return res.status(403).json({ 
          error: 'Permission refusée',
          required: permissionName
        });
      }
      
      next();
    } catch (error) {
      console.error('Erreur vérification permission:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  };
};

/**
 * Middleware pour exiger super admin
 */
const requireSuperAdmin = async (req, res, next) => {
  try {
    const isSuperAdminUser = await isSuperAdmin(req.user.id);
    
    if (!isSuperAdminUser) {
      return res.status(403).json({ 
        error: 'Accès réservé aux super administrateurs' 
      });
    }
    
    next();
  } catch (error) {
    console.error('Erreur vérification super admin:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

/**
 * Middleware pour exiger admin du domaine
 */
const requireDomainAdmin = async (req, res, next) => {
  try {
    const domainId = req.domain?.id || req.params.domainId;
    
    if (!domainId) {
      return res.status(400).json({ error: 'Domaine non spécifié' });
    }
    
    // Super admin a tous les droits
    const isSuperAdminUser = await isSuperAdmin(req.user.id);
    if (isSuperAdminUser) {
      return next();
    }
    
    // Vérifier admin du domaine
    const isAdmin = await isDomainAdmin(req.user.id, domainId);
    
    if (!isAdmin) {
      return res.status(403).json({ 
        error: 'Accès réservé aux administrateurs du domaine' 
      });
    }
    
    next();
  } catch (error) {
    console.error('Erreur vérification admin domaine:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

module.exports = {
  checkPermission,
  isSuperAdmin,
  isDomainAdmin,
  requirePermission,
  requireSuperAdmin,
  requireDomainAdmin
};
```

### 1.3 Routes d'administration

```javascript
// services/api/src/routes/admin/index.js
const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middleware/auth');
const { requireSuperAdmin } = require('../../middleware/permissions');

// Toutes les routes admin nécessitent l'authentification
router.use(authenticate);

// Routes super admin
router.use('/domains', require('./domains'));
router.use('/users', require('./users'));
router.use('/certificates', require('./certificates'));
router.use('/statistics', require('./statistics'));
router.use('/settings', require('./settings'));
router.use('/annuaire', require('./annuaire'));
router.use('/monitoring', require('./monitoring'));
router.use('/audit', require('./audit'));

module.exports = router;
```

---

## 2. Frontend - Structure de l'interface Admin

### 2.1 Layout Admin

```jsx
// services/frontend/src/layouts/AdminLayout.jsx
import React, { useState, useEffect } from 'react';
import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const AdminLayout = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  
  // Vérifier les permissions
  useEffect(() => {
    if (!user || (!user.is_super_admin && user.role !== 'domain_admin')) {
      navigate('/');
    }
  }, [user, navigate]);
  
  const menuItems = [
    // Super Admin uniquement
    ...(user?.is_super_admin ? [
      {
        section: 'Gestion Plateforme',
        items: [
          { icon: '🏢', label: 'Domaines', path: '/admin/domains' },
          { icon: '👥', label: 'Tous les utilisateurs', path: '/admin/users' },
          { icon: '🔐', label: 'Certificats', path: '/admin/certificates' },
          { icon: '⚙️', label: 'Configuration', path: '/admin/settings' },
        ]
      },
      {
        section: 'Annuaire & Indicateurs',
        items: [
          { icon: '📖', label: 'Annuaire National', path: '/admin/annuaire' },
          { icon: '📊', label: 'Indicateurs ANS', path: '/admin/indicators' },
          { icon: '📋', label: 'Comptes Rendus', path: '/admin/reports' },
        ]
      },
      {
        section: 'Supervision',
        items: [
          { icon: '📈', label: 'Statistiques Globales', path: '/admin/statistics' },
          { icon: '🖥️', label: 'Monitoring', path: '/admin/monitoring' },
          { icon: '🔍', label: 'Audit & Logs', path: '/admin/audit' },
        ]
      }
    ] : []),
    
    // Admin Domaine
    ...(user?.role === 'domain_admin' ? [
      {
        section: 'Mon Domaine',
        items: [
          { icon: '📬', label: 'BAL du domaine', path: '/admin/mailboxes' },
          { icon: '👥', label: 'Utilisateurs', path: '/admin/domain-users' },
          { icon: '📊', label: 'Statistiques', path: '/admin/domain-stats' },
          { icon: '⚙️', label: 'Paramètres', path: '/admin/domain-settings' },
        ]
      }
    ] : [])
  ];
  
  const isActive = (path) => location.pathname === path;
  
  return (
    <div className="min-h-screen flex bg-gray-100">
      {/* Sidebar */}
      <aside
        className={`bg-gray-900 text-white transition-all duration-300 ${
          sidebarOpen ? 'w-64' : 'w-20'
        }`}
      >
        {/* Logo */}
        <div className="p-4 border-b border-gray-700">
          <div className="flex items-center justify-between">
            {sidebarOpen && (
              <h1 className="text-xl font-bold">Admin MSSanté</h1>
            )}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-gray-800 rounded"
            >
              {sidebarOpen ? '◀' : '▶'}
            </button>
          </div>
        </div>
        
        {/* Menu */}
        <nav className="p-4 space-y-6">
          {menuItems.map((section, index) => (
            <div key={index}>
              {sidebarOpen && (
                <div className="text-xs uppercase text-gray-400 mb-2">
                  {section.section}
                </div>
              )}
              <div className="space-y-1">
                {section.items.map((item, itemIndex) => (
                  <Link
                    key={itemIndex}
                    to={item.path}
                    className={`flex items-center gap-3 px-3 py-2 rounded transition ${
                      isActive(item.path)
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-300 hover:bg-gray-800'
                    }`}
                  >
                    <span className="text-xl">{item.icon}</span>
                    {sidebarOpen && (
                      <span className="text-sm">{item.label}</span>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </nav>
        
        {/* User info */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-700">
          {sidebarOpen ? (
            <div>
              <div className="text-sm font-medium">{user?.first_name} {user?.last_name}</div>
              <div className="text-xs text-gray-400">{user?.email}</div>
              <button
                onClick={logout}
                className="mt-2 w-full text-left text-sm text-red-400 hover:text-red-300"
              >
                🚪 Déconnexion
              </button>
            </div>
          ) : (
            <button
              onClick={logout}
              className="w-full text-center text-xl"
              title="Déconnexion"
            >
              🚪
            </button>
          )}
        </div>
      </aside>
      
      {/* Main content */}
      <div className="flex-1 flex flex-col">
        {/* Top bar */}
        <header className="bg-white shadow-sm">
          <div className="px-6 py-4 flex justify-between items-center">
            <div className="flex items-center gap-4">
              <h2 className="text-2xl font-bold text-gray-800">
                {location.pathname.split('/').pop().charAt(0).toUpperCase() + 
                 location.pathname.split('/').pop().slice(1)}
              </h2>
              {user?.is_super_admin && (
                <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs font-semibold rounded">
                  SUPER ADMIN
                </span>
              )}
            </div>
            
            <div className="flex items-center gap-4">
              {/* Notifications */}
              <button className="relative p-2 hover:bg-gray-100 rounded">
                <span className="text-xl">🔔</span>
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
              </button>
              
              {/* Quick actions */}
              <Link
                to="/webmail"
                className="px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                📧 Webmail
              </Link>
            </div>
          </div>
        </header>
        
        {/* Content */}
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
```

### 2.2 Dashboard Super Admin

```jsx
// services/frontend/src/pages/Admin/Dashboard.jsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const AdminDashboard = () => {
  const [stats, setStats] = useState(null);
  const [recentActivity, setRecentActivity] = useState([]);
  const [alerts, setAlerts] = useState([]);
  
  useEffect(() => {
    loadDashboardData();
  }, []);
  
  const loadDashboardData = async () => {
    try {
      const response = await fetch('/api/v1/admin/dashboard', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      setStats(data.stats);
      setRecentActivity(data.recentActivity);
      setAlerts(data.alerts);
    } catch (error) {
      console.error('Erreur chargement dashboard:', error);
    }
  };
  
  if (!stats) {
    return <div>Chargement...</div>;
  }
  
  return (
    <div className="space-y-6">
      {/* Alertes */}
      {alerts.length > 0 && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <span className="text-2xl">⚠️</span>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">
                {alerts.length} alerte(s) nécessitant votre attention
              </h3>
              <div className="mt-2 text-sm text-yellow-700">
                <ul className="list-disc pl-5 space-y-1">
                  {alerts.map((alert, index) => (
                    <li key={index}>{alert.message}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Statistiques principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Domaines actifs"
          value={stats.domains_count}
          icon="🏢"
          trend={stats.domains_trend}
          color="blue"
        />
        <StatCard
          title="BAL totales"
          value={stats.mailboxes_count}
          icon="📬"
          trend={stats.mailboxes_trend}
          color="green"
        />
        <StatCard
          title="Utilisateurs"
          value={stats.users_count}
          icon="👥"
          trend={stats.users_trend}
          color="purple"
        />
        <StatCard
          title="Messages (30j)"
          value={stats.messages_count}
          icon="📧"
          trend={stats.messages_trend}
          color="orange"
        />
      </div>
      
      {/* Graphiques */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Évolution mensuelle */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Évolution mensuelle</h3>
          {/* Graphique avec Recharts ou Chart.js */}
          <div className="h-64">
            {/* <LineChart data={stats.monthlyData} /> */}
            <div className="flex items-center justify-center h-full text-gray-400">
              Graphique à implémenter
            </div>
          </div>
        </div>
        
        {/* Répartition par type */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">BAL par type</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-blue-500 rounded"></div>
                <span>Personnelles</span>
              </div>
              <span className="font-semibold">{stats.bal_personal}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-500 rounded"></div>
                <span>Organisationnelles</span>
              </div>
              <span className="font-semibold">{stats.bal_organizational}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-purple-500 rounded"></div>
                <span>Applicatives</span>
              </div>
              <span className="font-semibold">{stats.bal_applicative}</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Activité récente et actions rapides */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Activité récente */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow">
          <div className="p-6 border-b">
            <h3 className="text-lg font-semibold">Activité récente</h3>
          </div>
          <div className="divide-y">
            {recentActivity.map((activity, index) => (
              <div key={index} className="p-4 hover:bg-gray-50">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{activity.icon}</span>
                  <div className="flex-1">
                    <div className="text-sm">{activity.message}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      {new Date(activity.timestamp).toLocaleString('fr-FR')}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Actions rapides */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b">
            <h3 className="text-lg font-semibold">Actions rapides</h3>
          </div>
          <div className="p-4 space-y-2">
            <Link
              to="/admin/domains/create"
              className="block px-4 py-3 bg-blue-50 text-blue-700 rounded hover:bg-blue-100 transition"
            >
              ➕ Nouveau domaine
            </Link>
            <Link
              to="/admin/users/create"
              className="block px-4 py-3 bg-green-50 text-green-700 rounded hover:bg-green-100 transition"
            >
              👤 Nouvel utilisateur
            </Link>
            <Link
              to="/admin/indicators"
              className="block px-4 py-3 bg-purple-50 text-purple-700 rounded hover:bg-purple-100 transition"
            >
              📊 Soumettre indicateurs
            </Link>
            <Link
              to="/admin/certificates"
              className="block px-4 py-3 bg-orange-50 text-orange-700 rounded hover:bg-orange-100 transition"
            >
              🔐 Gérer certificats
            </Link>
          </div>
        </div>
      </div>
      
      {/* Certificats expirant bientôt */}
      {stats.expiring_certificates?.length > 0 && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b">
            <h3 className="text-lg font-semibold">⚠️ Certificats expirant bientôt</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Domaine
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Expiration
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Jours restants
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {stats.expiring_certificates.map((cert, index) => (
                  <tr key={index}>
                    <td className="px-6 py-4 whitespace-nowrap">{cert.domain_name}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{cert.type}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {new Date(cert.expires_at).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${
                        cert.days_remaining < 30 
                          ? 'bg-red-100 text-red-800' 
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {cert.days_remaining} jours
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Link
                        to={`/admin/certificates/${cert.id}/renew`}
                        className="text-blue-600 hover:underline text-sm"
                      >
                        Renouveler
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

// Composant StatCard
const StatCard = ({ title, value, icon, trend, color }) => {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    orange: 'bg-orange-50 text-orange-600',
  };
  
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600 mb-1">{title}</p>
          <p className="text-3xl font-bold">{value.toLocaleString()}</p>
          {trend && (
            <p className={`text-sm mt-2 ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {trend >= 0 ? '↗' : '↘'} {Math.abs(trend)}% ce mois
            </p>
          )}
        </div>
        <div className={`text-4xl ${colorClasses[color]} p-4 rounded-lg`}>
          {icon}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
```

Je continue avec les autres pages d'administration dans le prochain message...

### 2.3 Gestion des Domaines

```jsx
// services/frontend/src/pages/Admin/Domains/DomainsList.jsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const DomainsList = () => {
  const [domains, setDomains] = useState([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    loadDomains();
  }, [filter]);
  
  const loadDomains = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/v1/admin/domains?status=${filter}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      setDomains(data);
    } catch (error) {
      console.error('Erreur chargement domaines:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const handleSuspend = async (domainId) => {
    if (!confirm('Suspendre ce domaine ?')) return;
    
    try {
      await fetch(`/api/v1/admin/domains/${domainId}/suspend`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      loadDomains();
    } catch (error) {
      alert('Erreur lors de la suspension');
    }
  };
  
  const handleActivate = async (domainId) => {
    try {
      await fetch(`/api/v1/admin/domains/${domainId}/activate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      loadDomains();
    } catch (error) {
      alert('Erreur lors de l\'activation');
    }
  };
  
  const filteredDomains = domains.filter(d => 
    d.domain_name.toLowerCase().includes(search.toLowerCase()) ||
    d.organization_name.toLowerCase().includes(search.toLowerCase())
  );
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Gestion des Domaines</h1>
          <p className="text-gray-600 mt-1">
            {domains.length} domaine(s) total
          </p>
        </div>
        <Link
          to="/admin/domains/create"
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          ➕ Nouveau domaine
        </Link>
      </div>
      
      {/* Filtres */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Rechercher un domaine..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full border rounded px-3 py-2"
            />
          </div>
          
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="border rounded px-3 py-2"
          >
            <option value="all">Tous les statuts</option>
            <option value="active">Actifs</option>
            <option value="pending">En attente</option>
            <option value="suspended">Suspendus</option>
          </select>
        </div>
      </div>
      
      {/* Liste */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Domaine
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Organisation
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  FINESS
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  BAL
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Utilisateurs
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Statut
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredDomains.map(domain => (
                <tr key={domain.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900">
                      {domain.domain_name}
                    </div>
                    <div className="text-xs text-gray-500">
                      Créé le {new Date(domain.created_at).toLocaleDateString('fr-FR')}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm">{domain.organization_name}</div>
                    <div className="text-xs text-gray-500">{domain.organization_type}</div>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    {domain.finess_juridique}
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm">
                      {domain.mailboxes_count} / {domain.quotas?.max_mailboxes || 'illimité'}
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                      <div
                        className="bg-blue-600 h-2 rounded-full"
                        style={{
                          width: `${(domain.mailboxes_count / (domain.quotas?.max_mailboxes || 100)) * 100}%`
                        }}
                      ></div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    {domain.users_count}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs font-semibold rounded ${
                      domain.status === 'active' 
                        ? 'bg-green-100 text-green-800'
                        : domain.status === 'suspended'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {domain.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      <Link
                        to={`/admin/domains/${domain.id}`}
                        className="text-blue-600 hover:underline text-sm"
                      >
                        Voir
                      </Link>
                      <Link
                        to={`/admin/domains/${domain.id}/edit`}
                        className="text-gray-600 hover:underline text-sm"
                      >
                        Éditer
                      </Link>
                      {domain.status === 'active' ? (
                        <button
                          onClick={() => handleSuspend(domain.id)}
                          className="text-red-600 hover:underline text-sm"
                        >
                          Suspendre
                        </button>
                      ) : domain.status === 'suspended' ? (
                        <button
                          onClick={() => handleActivate(domain.id)}
                          className="text-green-600 hover:underline text-sm"
                        >
                          Activer
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default DomainsList;
```

Voilà un panneau d'administration complet pour MSSanté ! 🎛️

Le document contient :
- Système de rôles et permissions (3 niveaux)
- Middleware de sécurité
- Layout admin avec sidebar
- Dashboard avec statistiques
- Gestion des domaines
- Et bien plus...

Besoin de détails sur d'autres sections (gestion des utilisateurs, certificats, monitoring, etc.) ?