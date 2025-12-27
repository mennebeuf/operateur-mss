-- Migration 003: Architecture multi-domaines
-- Description: Support multi-établissements avec isolation des données par domaine

-- Table des domaines (tenants)
CREATE TABLE domains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain_name VARCHAR(255) UNIQUE NOT NULL,
    finess_juridique VARCHAR(20) NOT NULL,
    organization_name VARCHAR(255) NOT NULL,
    organization_type VARCHAR(50),
    status VARCHAR(20) DEFAULT 'pending',
    certificate_serial VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    activated_at TIMESTAMP,
    suspended_at TIMESTAMP,
    settings JSONB DEFAULT '{}',
    quotas JSONB DEFAULT '{"max_mailboxes": 100, "max_storage_gb": 100}',
    CONSTRAINT chk_domain_status CHECK (status IN ('pending', 'active', 'suspended', 'deleted')),
    CONSTRAINT chk_org_type CHECK (organization_type IN ('hospital', 'clinic', 'lab', 'private_practice', 'health_center', 'other'))
);

-- Index sur domains
CREATE INDEX idx_domains_name ON domains(domain_name);
CREATE INDEX idx_domains_finess ON domains(finess_juridique);
CREATE INDEX idx_domains_status ON domains(status);

-- Table des administrateurs de domaine
CREATE TABLE domain_admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain_id UUID REFERENCES domains(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) DEFAULT 'admin',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_admin_role CHECK (role IN ('admin', 'super_admin', 'billing')),
    UNIQUE(domain_id, user_id)
);

-- Index sur domain_admins
CREATE INDEX idx_domain_admins_domain ON domain_admins(domain_id);
CREATE INDEX idx_domain_admins_user ON domain_admins(user_id);

-- Ajout domain_id dans users
ALTER TABLE users ADD COLUMN domain_id UUID REFERENCES domains(id);
CREATE INDEX idx_users_domain ON users(domain_id);

-- Ajout domain_id dans mailboxes
ALTER TABLE mailboxes ADD COLUMN domain_id UUID REFERENCES domains(id);
CREATE INDEX idx_mailboxes_domain ON mailboxes(domain_id);

-- Contrainte: email doit correspondre au domaine
ALTER TABLE mailboxes ADD CONSTRAINT chk_email_domain 
    CHECK (email LIKE '%@' || (SELECT domain_name FROM domains WHERE id = domain_id));

-- Table des quotas par domaine
CREATE TABLE domain_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain_id UUID REFERENCES domains(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    mailboxes_count INTEGER DEFAULT 0,
    storage_used_mb BIGINT DEFAULT 0,
    messages_sent INTEGER DEFAULT 0,
    messages_received INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(domain_id, date)
);

-- Index sur domain_usage
CREATE INDEX idx_domain_usage_domain ON domain_usage(domain_id);
CREATE INDEX idx_domain_usage_date ON domain_usage(date DESC);

-- Vue des statistiques par domaine
CREATE VIEW domain_stats AS
SELECT 
    d.id,
    d.domain_name,
    d.organization_name,
    d.status,
    COUNT(DISTINCT m.id) as mailboxes_count,
    COUNT(DISTINCT u.id) as users_count,
    COALESCE(SUM(s.storage_used_mb), 0) as total_storage_mb,
    d.quotas->>'max_mailboxes' as quota_mailboxes,
    d.quotas->>'max_storage_gb' as quota_storage_gb
FROM domains d
LEFT JOIN mailboxes m ON d.id = m.domain_id AND m.status = 'active'
LEFT JOIN users u ON d.id = u.domain_id AND u.status = 'active'
LEFT JOIN statistics s ON m.id = s.mailbox_id AND s.date = CURRENT_DATE
GROUP BY d.id, d.domain_name, d.organization_name, d.status, d.quotas;

-- Commentaires
COMMENT ON TABLE domains IS 'Domaines/établissements hébergés par l''opérateur';
COMMENT ON TABLE domain_admins IS 'Administrateurs par domaine';
COMMENT ON TABLE domain_usage IS 'Usage quotidien par domaine pour facturation';