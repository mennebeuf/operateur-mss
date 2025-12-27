-- Seed 004: Statistiques de développement
-- Description: Données statistiques historiques pour tests et dashboards

-- Générer des statistiques pour les 90 derniers jours
DO $$
DECLARE
    mailbox RECORD;
    current_date DATE;
    days_back INTEGER;
    random_sent INTEGER;
    random_received INTEGER;
    random_storage INTEGER;
    random_connections INTEGER;
BEGIN
    -- Pour chaque boîte aux lettres active
    FOR mailbox IN 
        SELECT id FROM mailboxes WHERE status = 'active'
    LOOP
        -- Générer 90 jours d'historique
        FOR days_back IN 0..89 LOOP
            current_date := CURRENT_DATE - days_back;
            
            -- Générer des valeurs aléatoires réalistes
            random_sent := floor(random() * 20)::INTEGER;
            random_received := floor(random() * 30)::INTEGER;
            random_storage := floor(random() * 100 + 50)::INTEGER;
            random_connections := floor(random() * 10 + 1)::INTEGER;
            
            INSERT INTO statistics (
                date,
                mailbox_id,
                messages_sent,
                messages_received,
                storage_used_mb,
                connections_count
            ) VALUES (
                current_date,
                mailbox.id,
                random_sent,
                random_received,
                random_storage,
                random_connections
            )
            ON CONFLICT (date, mailbox_id) DO NOTHING;
        END LOOP;
    END LOOP;
END $$;

-- Mettre à jour les statistiques de domain_usage
DO $$
DECLARE
    domain RECORD;
    current_date DATE;
    days_back INTEGER;
BEGIN
    FOR domain IN 
        SELECT id FROM domains WHERE status = 'active'
    LOOP
        FOR days_back IN 0..89 LOOP
            current_date := CURRENT_DATE - days_back;
            
            INSERT INTO domain_usage (
                domain_id,
                date,
                mailboxes_count,
                storage_used_mb,
                messages_sent,
                messages_received
            )
            SELECT 
                domain.id,
                current_date,
                COUNT(DISTINCT m.id),
                COALESCE(SUM(s.storage_used_mb), 0),
                COALESCE(SUM(s.messages_sent), 0),
                COALESCE(SUM(s.messages_received), 0)
            FROM mailboxes m
            LEFT JOIN statistics s ON m.id = s.mailbox_id AND s.date = current_date
            WHERE m.domain_id = domain.id AND m.status = 'active'
            ON CONFLICT (domain_id, date) DO UPDATE SET
                mailboxes_count = EXCLUDED.mailboxes_count,
                storage_used_mb = EXCLUDED.storage_used_mb,
                messages_sent = EXCLUDED.messages_sent,
                messages_received = EXCLUDED.messages_received;
        END LOOP;
    END LOOP;
END $$;

-- Générer quelques événements système
INSERT INTO system_events (timestamp, event_type, severity, component, message, details)
VALUES
    (CURRENT_TIMESTAMP - INTERVAL '2 days', 'certificate_expiring', 'warning', 'certificate_manager', 
     'Certificat expirant dans 30 jours', '{"domain": "hopital-paris.mssante.fr", "days_remaining": 30}'),
    (CURRENT_TIMESTAMP - INTERVAL '1 day', 'quota_warning', 'warning', 'storage_manager',
     'Quota de stockage à 80%', '{"domain": "clinique-lyon.mssante.fr", "usage_percent": 80}'),
    (CURRENT_TIMESTAMP - INTERVAL '5 hours', 'smtp_error', 'error', 'postfix',
     'Échec d''envoi de message', '{"error": "Connection timeout", "recipient": "test@example.com"}'),
    (CURRENT_TIMESTAMP - INTERVAL '3 hours', 'backup_success', 'info', 'backup_manager',
     'Sauvegarde quotidienne réussie', '{"size_mb": 2048, "duration_seconds": 120}'),
    (CURRENT_TIMESTAMP - INTERVAL '1 hour', 'login_success', 'info', 'authentication',
     'Connexion utilisateur réussie', '{"user": "jean.martin@hopital-paris.mssante.fr"}');

-- Générer des métriques horaires pour les dernières 48 heures
DO $$
DECLARE
    mailbox RECORD;
    current_hour TIMESTAMP;
    hours_back INTEGER;
BEGIN
    FOR mailbox IN 
        SELECT id, domain_id FROM mailboxes WHERE status = 'active' LIMIT 10
    LOOP
        FOR hours_back IN 0..47 LOOP
            current_hour := date_trunc('hour', CURRENT_TIMESTAMP) - (hours_back || ' hours')::INTERVAL;
            
            INSERT INTO hourly_metrics (
                timestamp,
                mailbox_id,
                domain_id,
                smtp_connections,
                smtp_messages_sent,
                smtp_messages_received,
                smtp_errors,
                imap_connections,
                imap_logins,
                imap_errors,
                bytes_sent,
                bytes_received
            ) VALUES (
                current_hour,
                mailbox.id,
                mailbox.domain_id,
                floor(random() * 5)::INTEGER,
                floor(random() * 3)::INTEGER,
                floor(random() * 5)::INTEGER,
                floor(random() * 1)::INTEGER,
                floor(random() * 10)::INTEGER,
                floor(random() * 8)::INTEGER,
                floor(random() * 1)::INTEGER,
                floor(random() * 1000000)::BIGINT,
                floor(random() * 2000000)::BIGINT
            )
            ON CONFLICT (timestamp, mailbox_id) DO NOTHING;
        END LOOP;
    END LOOP;
END $$;

-- Générer des temps de réponse API
DO $$
DECLARE
    endpoints TEXT[] := ARRAY['/api/v1/mailboxes', '/api/v1/users', '/api/v1/domains', '/api/v1/auth/login'];
    methods TEXT[] := ARRAY['GET', 'POST', 'PUT', 'DELETE'];
    endpoint TEXT;
    method TEXT;
    i INTEGER;
BEGIN
    FOR i IN 1..1000 LOOP
        endpoint := endpoints[1 + floor(random() * array_length(endpoints, 1))::INTEGER];
        method := methods[1 + floor(random() * array_length(methods, 1))::INTEGER];
        
        INSERT INTO response_times (
            timestamp,
            endpoint,
            method,
            response_time_ms,
            status_code
        ) VALUES (
            CURRENT_TIMESTAMP - (floor(random() * 86400)::INTEGER || ' seconds')::INTERVAL,
            endpoint,
            method,
            floor(random() * 500 + 50)::INTEGER,
            CASE 
                WHEN random() > 0.95 THEN 500
                WHEN random() > 0.90 THEN 404
                WHEN random() > 0.85 THEN 400
                ELSE 200
            END
        );
    END LOOP;
END $$;

-- Générer quelques logs d'audit
DO $$
DECLARE
    user RECORD;
    mailbox RECORD;
    actions TEXT[] := ARRAY['login', 'logout', 'create_mailbox', 'update_mailbox', 'send_message', 'read_message'];
    action TEXT;
    i INTEGER;
BEGIN
    FOR i IN 1..500 LOOP
        SELECT * INTO user FROM users ORDER BY random() LIMIT 1;
        SELECT * INTO mailbox FROM mailboxes WHERE owner_id = user.id ORDER BY random() LIMIT 1;
        action := actions[1 + floor(random() * array_length(actions, 1))::INTEGER];
        
        INSERT INTO audit_logs (
            timestamp,
            user_id,
            mailbox_id,
            action,
            resource_type,
            ip_address,
            status,
            details
        ) VALUES (
            CURRENT_TIMESTAMP - (floor(random() * 604800)::INTEGER || ' seconds')::INTERVAL,
            user.id,
            mailbox.id,
            action,
            'mailbox',
            ('192.168.' || floor(random() * 255)::TEXT || '.' || floor(random() * 255)::TEXT)::INET,
            'success',
            '{"user_agent": "Mozilla/5.0"}'::JSONB
        );
    END LOOP;
END $$;

-- Calculer les indicateurs mensuels pour les 3 derniers mois
SELECT calculate_monthly_indicators(
    EXTRACT(YEAR FROM CURRENT_DATE - INTERVAL '2 months')::INTEGER,
    EXTRACT(MONTH FROM CURRENT_DATE - INTERVAL '2 months')::INTEGER
);

SELECT calculate_monthly_indicators(
    EXTRACT(YEAR FROM CURRENT_DATE - INTERVAL '1 month')::INTEGER,
    EXTRACT(MONTH FROM CURRENT_DATE - INTERVAL '1 month')::INTEGER
);

SELECT calculate_monthly_indicators(
    EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER,
    EXTRACT(MONTH FROM CURRENT_DATE)::INTEGER
);

-- Commentaire final
SELECT 'dev_statistics.sql: Statistiques de test générées avec succès' as message;
SELECT 
    'Statistiques générées: ' || COUNT(*) || ' jours x ' || 
    (SELECT COUNT(*) FROM mailboxes WHERE status = 'active') || ' boîtes' as summary
FROM statistics;