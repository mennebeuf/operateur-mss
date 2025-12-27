-- Migration 004: Intégration annuaire ANS
-- Description: Suivi des publications dans l'annuaire MSSanté

-- Table pour tracer les publications dans l'annuaire
CREATE TABLE annuaire_publications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mailbox_id UUID REFERENCES mailboxes(id) ON DELETE CASCADE,
    publication_id VARCHAR(255),
    operation VARCHAR(20) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    request_payload JSONB,
    response_data JSONB,
    error_message TEXT,
    attempted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    success_at TIMESTAMP,
    CONSTRAINT chk_operation CHECK (operation IN ('CREATE', 'UPDATE', 'DELETE')),
    CONSTRAINT chk_status CHECK (status IN ('pending', 'success', 'error', 'retry'))
);

-- Index sur annuaire_publications
CREATE INDEX idx_annuaire_publications_mailbox ON annuaire_publications(mailbox_id);
CREATE INDEX idx_annuaire_publications_status ON annuaire_publications(status);
CREATE INDEX idx_annuaire_publications_date ON annuaire_publications(attempted_at DESC);

-- Table des rapports de conformité mensuels
CREATE TABLE conformity_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    year INTEGER NOT NULL,
    month INTEGER NOT NULL,
    report_number VARCHAR(50),
    submission_date TIMESTAMP,
    status VARCHAR(20) DEFAULT 'draft',
    data JSONB,
    ans_response JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    submitted_at TIMESTAMP,
    CONSTRAINT chk_month CHECK (month >= 1 AND month <= 12),
    CONSTRAINT chk_report_status CHECK (status IN ('draft', 'submitted', 'validated', 'rejected')),
    UNIQUE(year, month)
);

-- Index sur conformity_reports
CREATE INDEX idx_conformity_reports_date ON conformity_reports(year, month);
CREATE INDEX idx_conformity_reports_status ON conformity_reports(status);

-- Table des indicateurs mensuels
CREATE TABLE monthly_indicators (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    year INTEGER NOT NULL,
    month INTEGER NOT NULL,
    domain_id UUID REFERENCES domains(id),
    
    -- Volumétrie BAL
    bal_personal_count INTEGER DEFAULT 0,
    bal_organizational_count INTEGER DEFAULT 0,
    bal_applicative_count INTEGER DEFAULT 0,
    bal_created_count INTEGER DEFAULT 0,
    bal_deleted_count INTEGER DEFAULT 0,
    bal_hidden_count INTEGER DEFAULT 0,
    
    -- Activité
    messages_sent INTEGER DEFAULT 0,
    messages_received INTEGER DEFAULT 0,
    data_volume_mb BIGINT DEFAULT 0,
    
    -- Disponibilité
    uptime_percentage DECIMAL(5,2) DEFAULT 100.00,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_month CHECK (month >= 1 AND month <= 12),
    UNIQUE(year, month, domain_id)
);

-- Index sur monthly_indicators
CREATE INDEX idx_monthly_indicators_date ON monthly_indicators(year, month);
CREATE INDEX idx_monthly_indicators_domain ON monthly_indicators(domain_id);

-- Vue pour agrégation des indicateurs
CREATE VIEW monthly_indicators_summary AS
SELECT 
    year,
    month,
    SUM(bal_personal_count) as total_bal_personal,
    SUM(bal_organizational_count) as total_bal_organizational,
    SUM(bal_applicative_count) as total_bal_applicative,
    SUM(bal_created_count) as total_created,
    SUM(bal_deleted_count) as total_deleted,
    SUM(messages_sent) as total_sent,
    SUM(messages_received) as total_received,
    SUM(data_volume_mb) as total_data_mb,
    AVG(uptime_percentage) as avg_uptime
FROM monthly_indicators
GROUP BY year, month
ORDER BY year DESC, month DESC;

-- Fonction pour calculer les indicateurs mensuels
CREATE OR REPLACE FUNCTION calculate_monthly_indicators(
    p_year INTEGER,
    p_month INTEGER,
    p_domain_id UUID DEFAULT NULL
)
RETURNS void AS $$
DECLARE
    start_date DATE;
    end_date DATE;
BEGIN
    start_date := make_date(p_year, p_month, 1);
    end_date := (start_date + INTERVAL '1 month')::DATE;
    
    INSERT INTO monthly_indicators (
        year, month, domain_id,
        bal_personal_count, bal_organizational_count, bal_applicative_count,
        bal_created_count, bal_deleted_count, bal_hidden_count,
        messages_sent, messages_received, data_volume_mb
    )
    SELECT 
        p_year,
        p_month,
        COALESCE(p_domain_id, d.id),
        COUNT(*) FILTER (WHERE m.type = 'personal' AND m.status = 'active') as personal,
        COUNT(*) FILTER (WHERE m.type = 'organizational' AND m.status = 'active') as organizational,
        COUNT(*) FILTER (WHERE m.type = 'applicative' AND m.status = 'active') as applicative,
        COUNT(*) FILTER (WHERE m.created_at >= start_date AND m.created_at < end_date) as created,
        COUNT(*) FILTER (WHERE m.status = 'deleted' AND m.updated_at >= start_date AND m.updated_at < end_date) as deleted,
        COUNT(*) FILTER (WHERE m.hide_from_directory = true) as hidden,
        COALESCE(SUM(s.messages_sent), 0) as sent,
        COALESCE(SUM(s.messages_received), 0) as received,
        COALESCE(SUM(s.storage_used_mb), 0) as storage
    FROM mailboxes m
    LEFT JOIN statistics s ON m.id = s.mailbox_id 
        AND s.date >= start_date 
        AND s.date < end_date
    LEFT JOIN domains d ON m.domain_id = d.id
    WHERE (p_domain_id IS NULL OR m.domain_id = p_domain_id)
    GROUP BY d.id
    ON CONFLICT (year, month, domain_id) 
    DO UPDATE SET
        bal_personal_count = EXCLUDED.bal_personal_count,
        bal_organizational_count = EXCLUDED.bal_organizational_count,
        bal_applicative_count = EXCLUDED.bal_applicative_count,
        bal_created_count = EXCLUDED.bal_created_count,
        bal_deleted_count = EXCLUDED.bal_deleted_count,
        bal_hidden_count = EXCLUDED.bal_hidden_count,
        messages_sent = EXCLUDED.messages_sent,
        messages_received = EXCLUDED.messages_received,
        data_volume_mb = EXCLUDED.data_volume_mb;
END;
$$ LANGUAGE plpgsql;

-- Commentaires
COMMENT ON TABLE annuaire_publications IS 'Historique des publications dans l''annuaire ANS';
COMMENT ON TABLE conformity_reports IS 'Rapports de conformité mensuels pour l''ANS';
COMMENT ON TABLE monthly_indicators IS 'Indicateurs mensuels requis par l''ANS';
COMMENT ON FUNCTION calculate_monthly_indicators IS 'Calcule les indicateurs mensuels pour un mois donné';