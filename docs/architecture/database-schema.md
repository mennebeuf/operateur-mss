# Schéma de Base de Données - Opérateur MSSanté

## Table des matières

- [Vue d'ensemble](#vue-densemble)
- [Diagramme ER](#diagramme-er)
- [Tables Principales](#tables-principales)
- [Tables de Sécurité](#tables-de-sécurité)
- [Tables Multi-tenant](#tables-multi-tenant)
- [Tables d'Annuaire](#tables-dannuaire)
- [Tables de Statistiques](#tables-de-statistiques)
- [Tables d'Audit](#tables-daudit)
- [Index et Performances](#index-et-performances)
- [Contraintes et Triggers](#contraintes-et-triggers)
- [Vues Matérialisées](#vues-matérialisées)
- [Partitionnement](#partitionnement)
- [Migrations](#migrations)

---

## Vue d'ensemble

### Technologie

- **SGBD** : PostgreSQL 15+
- **Extensions** : uuid-ossp, pg_trgm, pgcrypto
- **Encodage** : UTF-8
- **Collation** : fr_FR.UTF-8

### Principes de Conception

1. **Normalisation** : 3NF pour éviter la redondance
2. **UUID** : Clés primaires universellement uniques
3. **Soft Delete** : Status au lieu de suppression physique
4. **Audit Trail** : created_at, updated_at sur toutes les tables
5. **JSONB** : Pour données semi-structurées (settings, quotas)
6. **Partitionnement** : Pour tables volumineuses (logs, stats)

### Statistiques Estimées

| Table | Lignes estimées | Croissance |
|-------|-----------------|------------|
| users | 10 000 | +100/mois |
| domains | 100 | +5/mois |
| mailboxes | 50 000 | +500/mois |
| audit_logs | 10M+ | +50k/jour |
| statistics | 500k | +1k/jour |
| annuaire_publications | 100k | +1k/mois |

---

## Diagramme ER

### Relations principales

```
┌─────────────┐         ┌──────────────┐
│   roles     │◄────────│ role_perms   │
│             │    n:m  │              │
└──────┬──────┘         └──────┬───────┘
       │                       │
       │ 1:n                   │ n:1
       │                       │
┌──────▼──────┐         ┌──────▼────────┐
│   users     │         │ permissions   │
└──────┬──────┘         └───────────────┘
       │
       │ 1:n
       │
┌──────▼──────────┐
│   domains       │
└──────┬──────────┘
       │
       │ 1:n
       │
┌──────▼──────────┐         ┌──────────────────┐
│   mailboxes     │◄────────│ mailbox_delegs   │
└──────┬──────────┘    1:n  └──────────────────┘
       │
       │ 1:n
       │
┌──────▼──────────┐
│  statistics     │
└─────────────────┘
       │
       │ 1:n
       │
┌──────▼──────────┐
│   audit_logs    │
└─────────────────┘
```

---

## Tables Principales

### users

**Description** : Utilisateurs de la plateforme (professionnels de santé, admins)

```sql
CREATE TABLE users (
    -- Identifiant
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Identité
    rpps_id VARCHAR(20) UNIQUE,              -- N° RPPS (Répertoire Partagé des Professionnels de Santé)
    adeli_id VARCHAR(20),                     -- N° ADELI (pour professions non RPPS)
    psc_subject VARCHAR(255) UNIQUE,          -- Subject ID Pro Santé Connect
    
    -- Informations personnelles
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20),
    
    -- Professionnel
    profession VARCHAR(100),                  -- Ex: Médecin, Infirmière, Pharmacien
    specialty VARCHAR(100),                   -- Ex: Cardiologie, Radiologie
    
    -- Sécurité
    password_hash VARCHAR(255),               -- Bcrypt hash (optionnel si PSC uniquement)
    is_super_admin BOOLEAN DEFAULT FALSE,
    role_id UUID REFERENCES roles(id),
    
    -- Multi-tenant
    domain_id UUID REFERENCES domains(id),
    
    -- Préférences
    settings JSONB DEFAULT '{}',              -- Préférences utilisateur
    locale VARCHAR(10) DEFAULT 'fr_FR',
    timezone VARCHAR(50) DEFAULT 'Europe/Paris',
    
    -- Statut
    status VARCHAR(20) DEFAULT 'active',
    email_verified BOOLEAN DEFAULT FALSE,
    email_verified_at TIMESTAMP,
    
    -- Audit
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP,
    last_login_ip INET,
    
    -- Contraintes
    CONSTRAINT chk_users_status CHECK (status IN ('active', 'suspended', 'deleted')),
    CONSTRAINT chk_users_identifiant CHECK (
        rpps_id IS NOT NULL OR adeli_id IS NOT NULL OR psc_subject IS NOT NULL
    )
);

-- Index
CREATE INDEX idx_users_rpps ON users(rpps_id) WHERE rpps_id IS NOT NULL;
CREATE INDEX idx_users_adeli ON users(adeli_id) WHERE adeli_id IS NOT NULL;
CREATE INDEX idx_users_psc ON users(psc_subject) WHERE psc_subject IS NOT NULL;
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_domain ON users(domain_id);
CREATE INDEX idx_users_role ON users(role_id);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_super_admin ON users(is_super_admin) WHERE is_super_admin = TRUE;

-- Trigger pour updated_at
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Commentaires
COMMENT ON TABLE users IS 'Utilisateurs de la plateforme (professionnels et admins)';
COMMENT ON COLUMN users.rpps_id IS 'Numéro RPPS du professionnel de santé';
COMMENT ON COLUMN users.psc_subject IS 'Subject ID Pro Santé Connect (OAuth2)';
COMMENT ON COLUMN users.settings IS 'Préférences JSON: {theme, notifications, language}';
```

### domains

**Description** : Domaines hébergés (établissements de santé)

```sql
CREATE TABLE domains (
    -- Identifiant
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Domaine
    domain_name VARCHAR(255) UNIQUE NOT NULL,  -- Ex: hopital-paris.mssante.fr
    
    -- Organisation
    finess_juridique VARCHAR(20) NOT NULL,     -- FINESS Juridique (structure mère)
    finess_geographique VARCHAR(20),           -- FINESS Géographique (optionnel)
    organization_name VARCHAR(255) NOT NULL,   -- Ex: Hôpital de Paris
    organization_type VARCHAR(50),             -- hospital, clinic, lab, private_practice, health_center
    
    -- Contact
    contact_name VARCHAR(255),
    contact_email VARCHAR(255),
    contact_phone VARCHAR(20),
    
    -- Adresse
    address_line1 VARCHAR(255),
    address_line2 VARCHAR(255),
    postal_code VARCHAR(10),
    city VARCHAR(100),
    country VARCHAR(2) DEFAULT 'FR',
    
    -- Quotas
    quotas JSONB DEFAULT '{
        "max_mailboxes": 100,
        "max_storage_gb": 100,
        "max_message_size_mb": 25,
        "max_messages_per_day": 10000
    }',
    
    -- Certificats
    certificate_serial VARCHAR(100),           -- Serial du certificat IGC Santé
    certificate_expires_at TIMESTAMP,
    
    -- Paramètres
    settings JSONB DEFAULT '{
        "auto_publish_directory": true,
        "default_quota_per_mailbox_mb": 1024,
        "retention_days": 365
    }',
    
    -- Statut
    status VARCHAR(20) DEFAULT 'pending',
    activated_at TIMESTAMP,
    suspended_at TIMESTAMP,
    suspension_reason TEXT,
    
    -- Audit
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id),
    
    -- Contraintes
    CONSTRAINT chk_domains_status CHECK (status IN ('pending', 'active', 'suspended', 'deleted')),
    CONSTRAINT chk_domains_type CHECK (organization_type IN (
        'hospital', 'clinic', 'lab', 'private_practice', 'health_center', 'other'
    ))
);

-- Index
CREATE INDEX idx_domains_name ON domains(domain_name);
CREATE INDEX idx_domains_finess ON domains(finess_juridique);
CREATE INDEX idx_domains_status ON domains(status);
CREATE INDEX idx_domains_active ON domains(status) WHERE status = 'active';
CREATE INDEX idx_domains_cert_expires ON domains(certificate_expires_at);

-- Trigger
CREATE TRIGGER update_domains_updated_at
    BEFORE UPDATE ON domains
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE domains IS 'Domaines hébergés (établissements de santé)';
COMMENT ON COLUMN domains.quotas IS 'Quotas JSON: max_mailboxes, max_storage_gb, etc.';
COMMENT ON COLUMN domains.settings IS 'Paramètres JSON: auto_publish, retention, etc.';
```

### mailboxes

**Description** : Boîtes Aux Lettres (BAL) MSSanté

```sql
CREATE TABLE mailboxes (
    -- Identifiant
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Email
    email VARCHAR(255) UNIQUE NOT NULL,        -- Ex: jean.dupont@hopital-paris.mssante.fr
    
    -- Type
    type VARCHAR(20) NOT NULL,                 -- personal, organizational, applicative
    
    -- Propriété
    owner_id UUID REFERENCES users(id),        -- Titulaire (pour PERS et ORG)
    domain_id UUID REFERENCES domains(id) NOT NULL,
    
    -- Informations supplémentaires selon le type
    -- Pour BAL organisationnelles
    service_name VARCHAR(255),                 -- Ex: Secrétariat Cardiologie
    service_type VARCHAR(100),                 -- Ex: secretariat, urgences, laboratoire
    
    -- Pour BAL applicatives
    application_name VARCHAR(255),             -- Ex: DPI Hôpital
    application_type VARCHAR(100),             -- Ex: dpi, lis, pacs
    
    -- Configuration
    quota_mb INTEGER DEFAULT 1024,             -- Quota en MB
    max_message_size_mb INTEGER DEFAULT 25,
    
    -- Annuaire
    hide_from_directory BOOLEAN DEFAULT FALSE, -- Liste rouge
    publication_id VARCHAR(255),               -- ID retourné par l'Annuaire ANS
    published_at TIMESTAMP,
    unpublished_at TIMESTAMP,
    
    -- Statistiques
    storage_used_mb BIGINT DEFAULT 0,
    message_count INTEGER DEFAULT 0,
    last_activity TIMESTAMP,
    
    -- Statut
    status VARCHAR(20) DEFAULT 'pending',
    activated_at TIMESTAMP,
    suspended_at TIMESTAMP,
    suspension_reason TEXT,
    
    -- Audit
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id),
    
    -- Contraintes
    CONSTRAINT chk_mailboxes_type CHECK (type IN ('personal', 'organizational', 'applicative')),
    CONSTRAINT chk_mailboxes_status CHECK (status IN ('pending', 'active', 'suspended', 'deleted')),
    CONSTRAINT chk_mailboxes_email_domain CHECK (
        email LIKE '%@' || (SELECT domain_name FROM domains WHERE id = domain_id)
    ),
    CONSTRAINT chk_mailboxes_owner CHECK (
        (type IN ('personal', 'organizational') AND owner_id IS NOT NULL)
        OR (type = 'applicative' AND owner_id IS NULL)
    )
);

-- Index
CREATE INDEX idx_mailboxes_email ON mailboxes(email);
CREATE INDEX idx_mailboxes_owner ON mailboxes(owner_id);
CREATE INDEX idx_mailboxes_domain ON mailboxes(domain_id);
CREATE INDEX idx_mailboxes_type ON mailboxes(type);
CREATE INDEX idx_mailboxes_status ON mailboxes(status);
CREATE INDEX idx_mailboxes_active ON mailboxes(domain_id, status) WHERE status = 'active';
CREATE INDEX idx_mailboxes_directory ON mailboxes(hide_from_directory) WHERE hide_from_directory = FALSE;
CREATE INDEX idx_mailboxes_last_activity ON mailboxes(last_activity);

-- Index GIN pour recherche full-text
CREATE INDEX idx_mailboxes_search ON mailboxes USING GIN (
    to_tsvector('french', 
        COALESCE(email, '') || ' ' || 
        COALESCE(service_name, '') || ' ' ||
        COALESCE(application_name, '')
    )
);

-- Trigger
CREATE TRIGGER update_mailboxes_updated_at
    BEFORE UPDATE ON mailboxes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE mailboxes IS 'Boîtes Aux Lettres (BAL) MSSanté';
COMMENT ON COLUMN mailboxes.type IS 'personal = professionnel, organizational = service, applicative = système';
COMMENT ON COLUMN mailboxes.hide_from_directory IS 'Liste rouge: masquer de l''Annuaire National';
```

### mailbox_delegations

**Description** : Délégations d'accès aux BAL organisationnelles

```sql
CREATE TABLE mailbox_delegations (
    -- Identifiant
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Relation
    mailbox_id UUID REFERENCES mailboxes(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    -- Droits
    role VARCHAR(20) NOT NULL,                 -- read, write, manage, admin
    
    -- Permissions détaillées (optionnel, sinon par rôle)
    permissions JSONB DEFAULT NULL,            -- {read: true, send: true, delete: false}
    
    -- Validité
    granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    granted_by UUID REFERENCES users(id),
    expires_at TIMESTAMP,                      -- Optionnel: délégation temporaire
    revoked_at TIMESTAMP,
    revoked_by UUID REFERENCES users(id),
    
    -- Contraintes
    CONSTRAINT chk_delegation_role CHECK (role IN ('read', 'write', 'manage', 'admin')),
    CONSTRAINT uq_mailbox_user UNIQUE(mailbox_id, user_id)
);

-- Index
CREATE INDEX idx_delegations_mailbox ON mailbox_delegations(mailbox_id);
CREATE INDEX idx_delegations_user ON mailbox_delegations(user_id);
CREATE INDEX idx_delegations_active ON mailbox_delegations(mailbox_id, user_id) 
    WHERE revoked_at IS NULL AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP);

COMMENT ON TABLE mailbox_delegations IS 'Délégations d''accès aux BAL organisationnelles';
COMMENT ON COLUMN mailbox_delegations.role IS 'read = lecture seule, write = envoi, manage = gestion, admin = tous droits';
```

### certificates

**Description** : Certificats IGC Santé par domaine

```sql
CREATE TABLE certificates (
    -- Identifiant
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Domaine
    domain_id UUID REFERENCES domains(id),
    
    -- Type
    type VARCHAR(20) NOT NULL,                 -- SERV_SSL, ORG_AUTH_CLI, ORG_SIGN, ORG_CONF
    
    -- Informations certificat
    subject VARCHAR(500) NOT NULL,             -- CN, O, C
    issuer VARCHAR(500) NOT NULL,              -- IGC Santé
    serial_number VARCHAR(100) UNIQUE NOT NULL,
    
    -- Dates
    issued_at TIMESTAMP NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    revoked_at TIMESTAMP,
    
    -- Contenu (chiffré)
    certificate_pem TEXT NOT NULL,             -- Certificat public
    private_key_pem TEXT,                      -- Clé privée (chiffrée avec pgcrypto)
    chain_pem TEXT,                            -- Chaîne de certification
    
    -- Metadata
    fingerprint_sha256 VARCHAR(64),
    key_size INTEGER,                          -- Ex: 2048, 4096
    
    -- Statut
    status VARCHAR(20) DEFAULT 'active',
    
    -- Audit
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id),
    
    -- Contraintes
    CONSTRAINT chk_certificates_type CHECK (type IN (
        'SERV_SSL', 'ORG_AUTH_CLI', 'ORG_SIGN', 'ORG_CONF'
    )),
    CONSTRAINT chk_certificates_status CHECK (status IN ('active', 'expired', 'revoked'))
);

-- Index
CREATE INDEX idx_certificates_domain ON certificates(domain_id);
CREATE INDEX idx_certificates_serial ON certificates(serial_number);
CREATE INDEX idx_certificates_type ON certificates(type);
CREATE INDEX idx_certificates_expires ON certificates(expires_at);
CREATE INDEX idx_certificates_expiring_soon ON certificates(expires_at) 
    WHERE status = 'active' AND expires_at < CURRENT_TIMESTAMP + INTERVAL '90 days';

COMMENT ON TABLE certificates IS 'Certificats IGC Santé par domaine';
COMMENT ON COLUMN certificates.type IS 'SERV_SSL = serveur, ORG_AUTH_CLI = authentification client';
COMMENT ON COLUMN certificates.private_key_pem IS 'Clé privée chiffrée avec pgcrypto';
```

---

## Tables de Sécurité

### roles

**Description** : Rôles pour le contrôle d'accès (RBAC)

```sql
CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) UNIQUE NOT NULL,          -- user, domain_admin, super_admin
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    level INTEGER NOT NULL,                    -- 1=user, 2=domain_admin, 3=super_admin
    is_system BOOLEAN DEFAULT FALSE,           -- Rôle système (non supprimable)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT chk_role_level CHECK (level BETWEEN 1 AND 3)
);

CREATE INDEX idx_roles_name ON roles(name);
CREATE INDEX idx_roles_level ON roles(level);

COMMENT ON TABLE roles IS 'Rôles pour RBAC (Role-Based Access Control)';
```

### permissions

**Description** : Permissions granulaires

```sql
CREATE TABLE permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,         -- mailbox.create, user.delete, etc.
    resource VARCHAR(50) NOT NULL,             -- mailbox, user, domain, certificate
    action VARCHAR(50) NOT NULL,               -- create, read, update, delete, manage
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT uq_permission_resource_action UNIQUE(resource, action)
);

CREATE INDEX idx_permissions_resource ON permissions(resource);
CREATE INDEX idx_permissions_action ON permissions(action);

COMMENT ON TABLE permissions IS 'Permissions granulaires pour RBAC';
```

### role_permissions

**Description** : Liaison rôles ↔ permissions (n:m)

```sql
CREATE TABLE role_permissions (
    role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
    permission_id UUID REFERENCES permissions(id) ON DELETE CASCADE,
    granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (role_id, permission_id)
);

CREATE INDEX idx_role_permissions_role ON role_permissions(role_id);
CREATE INDEX idx_role_permissions_permission ON role_permissions(permission_id);

COMMENT ON TABLE role_permissions IS 'Liaison rôles ↔ permissions (many-to-many)';
```

### sessions

**Description** : Sessions utilisateurs (JWT tokens)

```sql
CREATE TABLE sessions (
    id VARCHAR(255) PRIMARY KEY,               -- JWT jti (unique identifier)
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL,           -- SHA256 du token
    ip_address INET,
    user_agent TEXT,
    data JSONB,                                -- Données de session supplémentaires
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);
CREATE INDEX idx_sessions_token ON sessions(token_hash);

-- Nettoyage automatique des sessions expirées
CREATE INDEX idx_sessions_cleanup ON sessions(expires_at) 
    WHERE expires_at < CURRENT_TIMESTAMP;

COMMENT ON TABLE sessions IS 'Sessions utilisateurs (tokens JWT)';
```

---

## Tables Multi-tenant

### domain_admins

**Description** : Administrateurs de domaines

```sql
CREATE TABLE domain_admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain_id UUID REFERENCES domains(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) DEFAULT 'admin',          -- admin, super_admin, billing
    granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    granted_by UUID REFERENCES users(id),
    
    CONSTRAINT chk_admin_role CHECK (role IN ('admin', 'super_admin', 'billing')),
    CONSTRAINT uq_domain_user UNIQUE(domain_id, user_id)
);

CREATE INDEX idx_domain_admins_domain ON domain_admins(domain_id);
CREATE INDEX idx_domain_admins_user ON domain_admins(user_id);

COMMENT ON TABLE domain_admins IS 'Administrateurs de domaines (multi-tenant)';
```

### domain_usage

**Description** : Utilisation quotidienne par domaine

```sql
CREATE TABLE domain_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain_id UUID REFERENCES domains(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    
    -- Volumétrie
    mailboxes_count INTEGER DEFAULT 0,
    storage_used_mb BIGINT DEFAULT 0,
    
    -- Activité
    messages_sent INTEGER DEFAULT 0,
    messages_received INTEGER DEFAULT 0,
    
    -- Connexions
    connections_count INTEGER DEFAULT 0,
    unique_users_count INTEGER DEFAULT 0,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT uq_domain_usage_date UNIQUE(domain_id, date)
);

CREATE INDEX idx_domain_usage_domain_date ON domain_usage(domain_id, date DESC);
CREATE INDEX idx_domain_usage_date ON domain_usage(date DESC);

COMMENT ON TABLE domain_usage IS 'Utilisation quotidienne par domaine';
```

---

## Tables d'Annuaire

### annuaire_publications

**Description** : Suivi des publications dans l'Annuaire National

```sql
CREATE TABLE annuaire_publications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mailbox_id UUID REFERENCES mailboxes(id) ON DELETE CASCADE,
    publication_id VARCHAR(255),               -- ID retourné par l'ANS
    
    -- Opération
    operation VARCHAR(20) NOT NULL,            -- CREATE, UPDATE, DELETE
    
    -- Requête
    request_payload JSONB NOT NULL,
    
    -- Réponse
    response_data JSONB,
    error_message TEXT,
    error_code VARCHAR(50),
    
    -- Statut
    status VARCHAR(20) DEFAULT 'pending',      -- pending, success, error, retry
    
    -- Dates
    attempted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    success_at TIMESTAMP,
    retry_count INTEGER DEFAULT 0,
    next_retry_at TIMESTAMP,
    
    CONSTRAINT chk_publication_operation CHECK (operation IN ('CREATE', 'UPDATE', 'DELETE')),
    CONSTRAINT chk_publication_status CHECK (status IN ('pending', 'success', 'error', 'retry'))
);

CREATE INDEX idx_annuaire_pubs_mailbox ON annuaire_publications(mailbox_id);
CREATE INDEX idx_annuaire_pubs_status ON annuaire_publications(status);
CREATE INDEX idx_annuaire_pubs_date ON annuaire_publications(attempted_at DESC);
CREATE INDEX idx_annuaire_pubs_retry ON annuaire_publications(status, next_retry_at) 
    WHERE status IN ('error', 'retry');

COMMENT ON TABLE annuaire_publications IS 'Suivi des publications dans l''Annuaire National ANS';
```

### monthly_indicators

**Description** : Indicateurs mensuels à soumettre à l'ANS

```sql
CREATE TABLE monthly_indicators (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    year INTEGER NOT NULL,
    month INTEGER NOT NULL,                    -- 1-12
    domain_id UUID REFERENCES domains(id),     -- NULL = global
    
    -- Volumétrie BAL
    bal_personal_count INTEGER DEFAULT 0,
    bal_organizational_count INTEGER DEFAULT 0,
    bal_applicative_count INTEGER DEFAULT 0,
    bal_created_count INTEGER DEFAULT 0,
    bal_deleted_count INTEGER DEFAULT 0,
    bal_liste_rouge_count INTEGER DEFAULT 0,
    
    -- Activité
    messages_sent INTEGER DEFAULT 0,
    messages_received INTEGER DEFAULT 0,
    data_volume_mb BIGINT DEFAULT 0,
    
    -- Disponibilité
    uptime_percentage DECIMAL(5,2),
    incidents_count INTEGER DEFAULT 0,
    
    -- Statut
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    submitted_at TIMESTAMP,
    submitted_by UUID REFERENCES users(id),
    
    CONSTRAINT uq_monthly_indicators UNIQUE(year, month, domain_id),
    CONSTRAINT chk_month CHECK (month BETWEEN 1 AND 12)
);

CREATE INDEX idx_monthly_indicators_date ON monthly_indicators(year DESC, month DESC);
CREATE INDEX idx_monthly_indicators_domain ON monthly_indicators(domain_id);
CREATE INDEX idx_monthly_indicators_submitted ON monthly_indicators(submitted_at);

COMMENT ON TABLE monthly_indicators IS 'Indicateurs mensuels à soumettre à l''ANS';
```

---

## Tables de Statistiques

### statistics

**Description** : Statistiques quotidiennes par BAL

```sql
CREATE TABLE statistics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    mailbox_id UUID REFERENCES mailboxes(id) ON DELETE CASCADE,
    
    -- Messages
    messages_sent INTEGER DEFAULT 0,
    messages_received INTEGER DEFAULT 0,
    
    -- Stockage
    storage_used_mb INTEGER DEFAULT 0,
    
    -- Connexions
    connections_count INTEGER DEFAULT 0,
    imap_connections INTEGER DEFAULT 0,
    smtp_connections INTEGER DEFAULT 0,
    
    -- Performance
    avg_response_time_ms INTEGER,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT uq_statistics_date_mailbox UNIQUE(date, mailbox_id)
);

CREATE INDEX idx_statistics_date ON statistics(date DESC);
CREATE INDEX idx_statistics_mailbox ON statistics(mailbox_id);
CREATE INDEX idx_statistics_mailbox_date ON statistics(mailbox_id, date DESC);

COMMENT ON TABLE statistics IS 'Statistiques quotidiennes par BAL';
```

---

## Tables d'Audit

### audit_logs

**Description** : Journalisation complète des actions (partitionnée par mois)

```sql
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Acteur
    user_id UUID REFERENCES users(id),
    user_email VARCHAR(255),                   -- Dénormalisé pour historique
    ip_address INET,
    user_agent TEXT,
    
    -- Action
    action VARCHAR(50) NOT NULL,               -- login, logout, create_mailbox, delete_user, etc.
    resource_type VARCHAR(50),                 -- mailbox, user, domain
    resource_id VARCHAR(255),
    
    -- Contexte
    domain_id UUID REFERENCES domains(id),
    
    -- Détails
    details JSONB,                             -- Données avant/après, paramètres
    
    -- Résultat
    status VARCHAR(20),                        -- success, error
    error_message TEXT,
    
    -- Conformité RGPD
    anonymized BOOLEAN DEFAULT FALSE,          -- Si utilisateur supprimé
    
    CONSTRAINT chk_audit_status CHECK (status IN ('success', 'error', 'warning'))
) PARTITION BY RANGE (timestamp);

-- Partitions mensuelles (créées dynamiquement)
CREATE TABLE audit_logs_2025_01 PARTITION OF audit_logs
    FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

CREATE TABLE audit_logs_2025_02 PARTITION OF audit_logs
    FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');

-- Index sur partitions
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_logs_domain ON audit_logs(domain_id);

-- Index GIN pour recherche dans JSONB
CREATE INDEX idx_audit_logs_details ON audit_logs USING GIN (details);

COMMENT ON TABLE audit_logs IS 'Journalisation complète des actions (partitionné par mois)';
```

---

## Index et Performances

### Stratégie d'indexation

```sql
-- Index composites pour requêtes fréquentes
CREATE INDEX idx_mailboxes_domain_status_type ON mailboxes(domain_id, status, type);
CREATE INDEX idx_users_domain_status ON users(domain_id, status) WHERE status = 'active';

-- Index partiels pour conditions fréquentes
CREATE INDEX idx_mailboxes_active_published ON mailboxes(domain_id) 
    WHERE status = 'active' AND hide_from_directory = FALSE;

-- Index GIN pour recherche full-text
CREATE INDEX idx_users_search ON users USING GIN (
    to_tsvector('french', 
        COALESCE(first_name, '') || ' ' || 
        COALESCE(last_name, '') || ' ' ||
        COALESCE(email, '')
    )
);

-- Index pour tri
CREATE INDEX idx_mailboxes_email_asc ON mailboxes(email ASC);
CREATE INDEX idx_users_last_name_asc ON users(last_name ASC, first_name ASC);
```

### Statistiques et analyse

```sql
-- Activer l'auto-vacuum agressif sur tables volumineuses
ALTER TABLE audit_logs SET (
    autovacuum_vacuum_scale_factor = 0.01,
    autovacuum_analyze_scale_factor = 0.01
);

-- Statistiques étendues
CREATE STATISTICS stats_mailboxes_domain_status ON domain_id, status FROM mailboxes;
CREATE STATISTICS stats_users_domain_role ON domain_id, role_id FROM users;
```

---

## Contraintes et Triggers

### Fonction de mise à jour timestamp

```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### Triggers de validation

```sql
-- Vérifier quota avant insertion BAL
CREATE OR REPLACE FUNCTION check_domain_quota()
RETURNS TRIGGER AS $$
DECLARE
    current_count INTEGER;
    max_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO current_count
    FROM mailboxes
    WHERE domain_id = NEW.domain_id AND status = 'active';
    
    SELECT (quotas->>'max_mailboxes')::INTEGER INTO max_count
    FROM domains
    WHERE id = NEW.domain_id;
    
    IF current_count >= max_count THEN
        RAISE EXCEPTION 'Quota de BAL atteint pour ce domaine (% / %)', current_count, max_count;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_mailbox_quota
    BEFORE INSERT ON mailboxes
    FOR EACH ROW
    EXECUTE FUNCTION check_domain_quota();
```

---

## Vues Matérialisées

### Vue des statistiques par domaine

```sql
CREATE MATERIALIZED VIEW mv_domain_stats AS
SELECT 
    d.id as domain_id,
    d.domain_name,
    d.organization_name,
    d.status,
    COUNT(DISTINCT m.id) FILTER (WHERE m.status = 'active') as mailboxes_count,
    COUNT(DISTINCT m.id) FILTER (WHERE m.type = 'personal') as personal_count,
    COUNT(DISTINCT m.id) FILTER (WHERE m.type = 'organizational') as organizational_count,
    COUNT(DISTINCT m.id) FILTER (WHERE m.type = 'applicative') as applicative_count,
    COUNT(DISTINCT u.id) FILTER (WHERE u.status = 'active') as users_count,
    COALESCE(SUM(m.storage_used_mb), 0) as total_storage_mb,
    MAX(m.last_activity) as last_activity
FROM domains d
LEFT JOIN mailboxes m ON d.id = m.domain_id
LEFT JOIN users u ON d.id = u.domain_id
GROUP BY d.id, d.domain_name, d.organization_name, d.status;

CREATE UNIQUE INDEX ON mv_domain_stats(domain_id);

-- Rafraîchissement automatique toutes les heures
CREATE OR REPLACE FUNCTION refresh_domain_stats()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_domain_stats;
END;
$$ LANGUAGE plpgsql;

-- Via pg_cron (extension)
-- SELECT cron.schedule('refresh-stats', '0 * * * *', 'SELECT refresh_domain_stats()');
```

---

## Partitionnement

### Stratégie de partitionnement

```sql
-- audit_logs : Partitionnement par RANGE (mois)
-- Automatiser la création des partitions futures

CREATE OR REPLACE FUNCTION create_audit_partition()
RETURNS void AS $$
DECLARE
    partition_name TEXT;
    start_date DATE;
    end_date DATE;
BEGIN
    start_date := date_trunc('month', CURRENT_DATE + INTERVAL '1 month');
    end_date := date_trunc('month', CURRENT_DATE + INTERVAL '2 months');
    partition_name := 'audit_logs_' || to_char(start_date, 'YYYY_MM');
    
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS %I PARTITION OF audit_logs
         FOR VALUES FROM (%L) TO (%L)',
        partition_name, start_date, end_date
    );
END;
$$ LANGUAGE plpgsql;

-- Appeler mensuellement via cron
-- SELECT cron.schedule('create-audit-partition', '0 0 15 * *', 'SELECT create_audit_partition()');
```

---

## Migrations

### Système de migrations

Les migrations sont gérées via des fichiers SQL numérotés dans `database/migrations/`.

**Exemple : 001_initial_schema.sql**

```sql
-- Migration: 001 - Schéma initial
-- Date: 2025-01-01

BEGIN;

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Tables (voir ci-dessus)
-- ...

-- Données initiales
INSERT INTO roles (name, display_name, description, level, is_system) VALUES
('user', 'Utilisateur', 'Utilisateur standard', 1, TRUE),
('domain_admin', 'Administrateur Domaine', 'Administrateur d''établissement', 2, TRUE),
('super_admin', 'Super Administrateur', 'Administrateur plateforme', 3, TRUE);

COMMIT;
```

### Rollback

**Exemple : 001_initial_schema_down.sql**

```sql
-- Rollback: 001
BEGIN;

DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS statistics CASCADE;
-- ...

DROP EXTENSION IF EXISTS "uuid-ossp";
DROP EXTENSION IF EXISTS "pg_trgm";
DROP EXTENSION IF EXISTS "pgcrypto";

COMMIT;
```

---

## Maintenance

### Requêtes d'administration

```sql
-- Taille des tables
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Index non utilisés
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan,
    pg_size_pretty(pg_relation_size(indexrelid)) as size
FROM pg_stat_user_indexes
WHERE idx_scan = 0
AND schemaname = 'public'
ORDER BY pg_relation_size(indexrelid) DESC;

-- Bloat des tables
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(bloat_size) as bloat_size,
    round(bloat_ratio::numeric, 2) as bloat_ratio
FROM (
    SELECT 
        schemaname,
        tablename,
        pg_total_relation_size(schemaname||'.'||tablename) * (1 - (fillfactor/100.0)) as bloat_size,
        (pg_total_relation_size(schemaname||'.'||tablename) * (1 - (fillfactor/100.0))) / 
        NULLIF(pg_total_relation_size(schemaname||'.'||tablename), 0) as bloat_ratio
    FROM pg_tables
    JOIN pg_class ON pg_class.relname = tablename
    WHERE schemaname = 'public'
    AND reloptions IS NOT NULL
) t
WHERE bloat_ratio > 0.2
ORDER BY bloat_size DESC;
```

---

## Conclusion

Ce schéma de base de données fournit :

✅ **Structure complète** pour un opérateur MSSanté  
✅ **Multi-tenant** avec isolation des domaines  
✅ **Sécurité** via RBAC et audit trail  
✅ **Performance** avec indexation optimisée  
✅ **Conformité** MSSanté et RGPD  
✅ **Scalabilité** via partitionnement  
✅ **Maintenabilité** avec vues et triggers  

---

## Historique des modifications

| Date       | Version    | Auteur            | Description       |
|------------|------------|-------------------|-------------------|
| 2025-12-28 | 1.0.0      | Antoine MENNEBEUF | Création initiale |
