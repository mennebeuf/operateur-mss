-- Migration 005: Tables de statistiques avancées
-- Description: Métriques détaillées pour monitoring et reporting

-- Table des métriques horaires
CREATE TABLE hourly_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMP NOT NULL,
    mailbox_id UUID REFERENCES mailboxes(id) ON DELETE CASCADE,
    domain_id UUID REFERENCES domains(id),
    
    -- Métriques SMTP
    smtp_connections INTEGER DEFAULT 0,
    smtp_messages_sent INTEGER DEFAULT 0,
    smtp_messages_received INTEGER DEFAULT 0,
    smtp_errors INTEGER DEFAULT 0,
    
    -- Métriques IMAP
    imap_connections INTEGER DEFAULT 0,
    imap_logins INTEGER DEFAULT 0,
    imap_errors INTEGER DEFAULT 0,
    
    -- Volume
    bytes_sent BIGINT DEFAULT 0,
    bytes_received BIGINT DEFAULT 0,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(timestamp, mailbox_id)
);

-- Index sur hourly_metrics
CREATE INDEX idx_hourly_metrics_timestamp ON hourly_metrics(timestamp DESC);
CREATE INDEX idx_hourly_metrics_mailbox ON hourly_metrics(mailbox_id);
CREATE INDEX idx_hourly_metrics_domain ON hourly_metrics(domain_id);

-- Partitionnement par mois pour performance
-- Note: À créer manuellement chaque mois ou via script automatique

-- Table des événements système
CREATE TABLE system_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    event_type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    component VARCHAR(50),
    message TEXT,
    details JSONB,
    resolved_at TIMESTAMP,
    CONSTRAINT chk_severity CHECK (severity IN ('info', 'warning', 'error', 'critical'))
);

-- Index sur system_events
CREATE INDEX idx_system_events_timestamp ON system_events(timestamp DESC);
CREATE INDEX idx_system_events_type ON system_events(event_type);
CREATE INDEX idx_system_events_severity ON system_events(severity);
CREATE INDEX idx_system_events_resolved ON system_events(resolved_at) WHERE resolved_at IS NULL;

-- Table des temps de réponse
CREATE TABLE response_times (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    endpoint VARCHAR(255),
    method VARCHAR(10),
    response_time_ms INTEGER,
    status_code INTEGER,
    user_id UUID REFERENCES users(id),
    domain_id UUID REFERENCES domains(id)
);

-- Index sur response_times
CREATE INDEX idx_response_times_timestamp ON response_times(timestamp DESC);
CREATE INDEX idx_response_times_endpoint ON response_times(endpoint);
CREATE INDEX idx_response_times_status ON response_times(status_code);

-- Vue des métriques quotidiennes agrégées
CREATE VIEW daily_metrics_summary AS
SELECT 
    DATE(timestamp) as date,
    domain_id,
    SUM(smtp_messages_sent) as total_sent,
    SUM(smtp_messages_received) as total_received,
    SUM(smtp_errors) as total_errors,
    SUM(smtp_connections) as total_connections,
    SUM(bytes_sent) as total_bytes_sent,
    SUM(bytes_received) as total_bytes_received,
    AVG(smtp_connections) as avg_connections_per_hour
FROM hourly_metrics
GROUP BY DATE(timestamp), domain_id
ORDER BY date DESC;

-- Vue de santé du système
CREATE VIEW system_health AS
SELECT 
    DATE(timestamp) as date,
    COUNT(*) FILTER (WHERE severity = 'critical') as critical_events,
    COUNT(*) FILTER (WHERE severity = 'error') as error_events,
    COUNT(*) FILTER (WHERE severity = 'warning') as warning_events,
    COUNT(*) FILTER (WHERE resolved_at IS NULL) as unresolved_events,
    AVG(EXTRACT(EPOCH FROM (resolved_at - timestamp))/60) as avg_resolution_time_minutes
FROM system_events
WHERE timestamp >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY DATE(timestamp)
ORDER BY date DESC;

-- Vue des performances API
CREATE VIEW api_performance AS
SELECT 
    endpoint,
    method,
    COUNT(*) as request_count,
    AVG(response_time_ms) as avg_response_ms,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY response_time_ms) as p50_response_ms,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY response_ms) as p95_response_ms,
    PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY response_time_ms) as p99_response_ms,
    COUNT(*) FILTER (WHERE status_code >= 400) as error_count,
    COUNT(*) FILTER (WHERE status_code >= 500) as server_error_count
FROM response_times
WHERE timestamp >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
GROUP BY endpoint, method
ORDER BY request_count DESC;

-- Fonction d'agrégation des métriques horaires vers quotidiennes
CREATE OR REPLACE FUNCTION aggregate_hourly_to_daily(p_date DATE)
RETURNS void AS $$
BEGIN
    INSERT INTO statistics (date, mailbox_id, messages_sent, messages_received, storage_used_mb, connections_count)
    SELECT 
        p_date,
        mailbox_id,
        SUM(smtp_messages_sent) as messages_sent,
        SUM(smtp_messages_received) as messages_received,
        MAX((bytes_sent + bytes_received) / 1024 / 1024) as storage_mb,
        SUM(smtp_connections + imap_connections) as connections
    FROM hourly_metrics
    WHERE DATE(timestamp) = p_date
    GROUP BY mailbox_id
    ON CONFLICT (date, mailbox_id) 
    DO UPDATE SET
        messages_sent = EXCLUDED.messages_sent,
        messages_received = EXCLUDED.messages_received,
        storage_used_mb = EXCLUDED.storage_used_mb,
        connections_count = EXCLUDED.connections_count;
END;
$$ LANGUAGE plpgsql;

-- Fonction de nettoyage des anciennes métriques
CREATE OR REPLACE FUNCTION cleanup_old_metrics(retention_days INTEGER DEFAULT 90)
RETURNS void AS $$
BEGIN
    -- Nettoyer les métriques horaires de plus de X jours
    DELETE FROM hourly_metrics 
    WHERE timestamp < CURRENT_TIMESTAMP - (retention_days || ' days')::INTERVAL;
    
    -- Nettoyer les temps de réponse de plus de X jours
    DELETE FROM response_times 
    WHERE timestamp < CURRENT_TIMESTAMP - (retention_days || ' days')::INTERVAL;
    
    -- Garder les événements résolus pendant X jours seulement
    DELETE FROM system_events 
    WHERE resolved_at IS NOT NULL 
    AND resolved_at < CURRENT_TIMESTAMP - (retention_days || ' days')::INTERVAL;
END;
$$ LANGUAGE plpgsql;

-- Commentaires
COMMENT ON TABLE hourly_metrics IS 'Métriques collectées toutes les heures pour chaque BAL';
COMMENT ON TABLE system_events IS 'Événements système (erreurs, warnings, incidents)';
COMMENT ON TABLE response_times IS 'Temps de réponse des endpoints API pour monitoring performance';
COMMENT ON FUNCTION aggregate_hourly_to_daily IS 'Agrège les métriques horaires en statistiques quotidiennes';
COMMENT ON FUNCTION cleanup_old_metrics IS 'Supprime les anciennes métriques selon la durée de rétention';