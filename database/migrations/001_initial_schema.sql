-- Migration 001: Schéma initial
-- Description: Tables principales pour utilisateurs, boîtes aux lettres, certificats, audit et statistiques

-- Extensions PostgreSQL
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Table des utilisateurs
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rpps_id VARCHAR(20) UNIQUE,
    adeli_id VARCHAR(20),
    psc_subject VARCHAR(255) UNIQUE,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    email VARCHAR(255) UNIQUE,
    profession VARCHAR(100),
    specialty VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP,
    status VARCHAR(20) DEFAULT 'active',
    CONSTRAINT chk_status CHECK (status IN ('active', 'suspended', 'deleted'))
);

-- Index sur users
CREATE INDEX idx_users_rpps ON users(rpps_id);
CREATE INDEX idx_users_psc ON users(psc_subject);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_email ON users(email);

-- Table des boîtes aux lettres
CREATE TABLE mailboxes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    type VARCHAR(20) NOT NULL,
    owner_id UUID REFERENCES users(id),
    finess_id VARCHAR(20),
    organization_name VARCHAR(255),
    service_name VARCHAR(255),
    application_name VARCHAR(255),
    status VARCHAR(20) DEFAULT 'pending',
    hide_from_directory BOOLEAN DEFAULT FALSE,
    quota_mb INTEGER DEFAULT 1024,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    activated_at TIMESTAMP,
    last_activity TIMESTAMP,
    CONSTRAINT chk_type CHECK (type IN ('personal', 'organizational', 'applicative')),
    CONSTRAINT chk_mailbox_status CHECK (status IN ('pending', 'active', 'suspended', 'deleted'))
);

-- Index sur mailboxes
CREATE INDEX idx_mailboxes_email ON mailboxes(email);
CREATE INDEX idx_mailboxes_owner ON mailboxes(owner_id);
CREATE INDEX idx_mailboxes_type ON mailboxes(type);
CREATE INDEX idx_mailboxes_status ON mailboxes(status);
CREATE INDEX idx_mailboxes_finess ON mailboxes(finess_id);

-- Table des délégations (pour BAL organisationnelles)
CREATE TABLE mailbox_delegations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mailbox_id UUID REFERENCES mailboxes(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL,
    granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    granted_by UUID REFERENCES users(id),
    expires_at TIMESTAMP,
    CONSTRAINT chk_role CHECK (role IN ('read', 'write', 'manage', 'admin')),
    UNIQUE(mailbox_id, user_id)
);

-- Index sur mailbox_delegations
CREATE INDEX idx_delegations_mailbox ON mailbox_delegations(mailbox_id);
CREATE INDEX idx_delegations_user ON mailbox_delegations(user_id);

-- Table des certificats
CREATE TABLE certificates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mailbox_id UUID REFERENCES mailboxes(id),
    type VARCHAR(20) NOT NULL,
    subject VARCHAR(500),
    issuer VARCHAR(500),
    serial_number VARCHAR(100) UNIQUE,
    certificate_pem TEXT NOT NULL,
    private_key_pem TEXT, -- Chiffré
    issued_at TIMESTAMP NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    revoked_at TIMESTAMP,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_cert_type CHECK (type IN ('SERV_SSL', 'ORG_AUTH_CLI', 'ORG_SIGN', 'ORG_CONF')),
    CONSTRAINT chk_cert_status CHECK (status IN ('active', 'expired', 'revoked'))
);

-- Index sur certificates
CREATE INDEX idx_certificates_mailbox ON certificates(mailbox_id);
CREATE INDEX idx_certificates_serial ON certificates(serial_number);
CREATE INDEX idx_certificates_expires ON certificates(expires_at);
CREATE INDEX idx_certificates_status ON certificates(status);

-- Table des journaux d'audit
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    user_id UUID REFERENCES users(id),
    mailbox_id UUID REFERENCES mailboxes(id),
    action VARCHAR(50) NOT NULL,
    resource_type VARCHAR(50),
    resource_id VARCHAR(255),
    ip_address INET,
    user_agent TEXT,
    status VARCHAR(20),
    details JSONB,
    anonymized BOOLEAN DEFAULT FALSE
);

-- Index sur audit_logs
CREATE INDEX idx_audit_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX idx_audit_user ON audit_logs(user_id);
CREATE INDEX idx_audit_mailbox ON audit_logs(mailbox_id);
CREATE INDEX idx_audit_action ON audit_logs(action);

-- Table des statistiques
CREATE TABLE statistics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    mailbox_id UUID REFERENCES mailboxes(id),
    messages_sent INTEGER DEFAULT 0,
    messages_received INTEGER DEFAULT 0,
    storage_used_mb INTEGER DEFAULT 0,
    connections_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(date, mailbox_id)
);

-- Index sur statistics
CREATE INDEX idx_statistics_date ON statistics(date DESC);
CREATE INDEX idx_statistics_mailbox ON statistics(mailbox_id);

-- Table des sessions (pour cache)
CREATE TABLE sessions (
    id VARCHAR(255) PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    data JSONB,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index sur sessions
CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);

-- Fonction pour mise à jour automatique du timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers pour updated_at
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_mailboxes_updated_at 
    BEFORE UPDATE ON mailboxes
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Vues utiles

-- Vue des BAL actives
CREATE VIEW active_mailboxes AS
SELECT 
    m.*,
    u.first_name,
    u.last_name,
    u.rpps_id,
    COUNT(DISTINCT md.user_id) as delegation_count
FROM mailboxes m
LEFT JOIN users u ON m.owner_id = u.id
LEFT JOIN mailbox_delegations md ON m.id = md.mailbox_id
WHERE m.status = 'active'
GROUP BY m.id, u.id;

-- Vue des certificats expirant bientôt
CREATE VIEW expiring_certificates AS
SELECT 
    c.*,
    m.email,
    (c.expires_at - CURRENT_TIMESTAMP) as time_remaining
FROM certificates c
JOIN mailboxes m ON c.mailbox_id = m.id
WHERE c.status = 'active'
AND c.expires_at < CURRENT_TIMESTAMP + INTERVAL '90 days'
ORDER BY c.expires_at;

-- Vue des statistiques quotidiennes
CREATE VIEW daily_statistics AS
SELECT 
    date,
    SUM(messages_sent) as total_sent,
    SUM(messages_received) as total_received,
    SUM(storage_used_mb) as total_storage_mb,
    COUNT(DISTINCT mailbox_id) as active_mailboxes
FROM statistics
GROUP BY date
ORDER BY date DESC;

-- Commentaires sur les tables
COMMENT ON TABLE users IS 'Utilisateurs du système avec authentification Pro Santé Connect';
COMMENT ON TABLE mailboxes IS 'Boîtes aux lettres MSSanté (personnelles, organisationnelles, applicatives)';
COMMENT ON TABLE mailbox_delegations IS 'Délégations d''accès aux boîtes organisationnelles';
COMMENT ON TABLE certificates IS 'Certificats IGC-Santé pour les boîtes aux lettres';
COMMENT ON TABLE audit_logs IS 'Journalisation des actions pour conformité et traçabilité';
COMMENT ON TABLE statistics IS 'Statistiques d''usage par boîte aux lettres';