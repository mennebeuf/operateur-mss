-- Migration 002: Système de rôles et permissions
-- Description: Gestion des droits d'accès pour utilisateurs, admins domaine et super admins

-- Table des rôles
CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) UNIQUE NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    level INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_role_level CHECK (level IN (1, 2, 3))
);

-- Table des permissions
CREATE TABLE permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    resource VARCHAR(50) NOT NULL,
    action VARCHAR(50) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table de liaison rôles <-> permissions
CREATE TABLE role_permissions (
    role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
    permission_id UUID REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

-- Ajout des colonnes role dans users
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

-- Mailboxes
INSERT INTO permissions (name, resource, action, description) VALUES
('mailbox.create', 'mailbox', 'create', 'Créer une BAL'),
('mailbox.read', 'mailbox', 'read', 'Consulter les BAL'),
('mailbox.update', 'mailbox', 'update', 'Modifier une BAL'),
('mailbox.delete', 'mailbox', 'delete', 'Supprimer une BAL'),
('mailbox.manage_all', 'mailbox', 'manage', 'Gérer toutes les BAL');

-- Users
INSERT INTO permissions (name, resource, action, description) VALUES
('user.create', 'user', 'create', 'Créer un utilisateur'),
('user.read', 'user', 'read', 'Consulter les utilisateurs'),
('user.update', 'user', 'update', 'Modifier un utilisateur'),
('user.delete', 'user', 'delete', 'Supprimer un utilisateur'),
('user.manage_all', 'user', 'manage', 'Gérer tous les utilisateurs');

-- Domains
INSERT INTO permissions (name, resource, action, description) VALUES
('domain.create', 'domain', 'create', 'Créer un domaine'),
('domain.read', 'domain', 'read', 'Consulter les domaines'),
('domain.update', 'domain', 'update', 'Modifier un domaine'),
('domain.delete', 'domain', 'delete', 'Supprimer un domaine'),
('domain.manage_all', 'domain', 'manage', 'Gérer tous les domaines');

-- Certificates
INSERT INTO permissions (name, resource, action, description) VALUES
('certificate.create', 'certificate', 'create', 'Installer des certificats'),
('certificate.read', 'certificate', 'read', 'Consulter les certificats'),
('certificate.update', 'certificate', 'update', 'Renouveler des certificats'),
('certificate.delete', 'certificate', 'delete', 'Supprimer des certificats');

-- Statistics
INSERT INTO permissions (name, resource, action, description) VALUES
('stats.read_own', 'stats', 'read', 'Consulter ses propres stats'),
('stats.read_domain', 'stats', 'read', 'Consulter les stats du domaine'),
('stats.read_all', 'stats', 'read', 'Consulter toutes les stats');

-- Annuaire
INSERT INTO permissions (name, resource, action, description) VALUES
('annuaire.manage', 'annuaire', 'manage', 'Gérer l''annuaire et les indicateurs');

-- Settings
INSERT INTO permissions (name, resource, action, description) VALUES
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

-- Commentaires
COMMENT ON TABLE roles IS 'Rôles système : user, domain_admin, super_admin';
COMMENT ON TABLE permissions IS 'Permissions granulaires par ressource et action';
COMMENT ON TABLE role_permissions IS 'Association rôles-permissions';