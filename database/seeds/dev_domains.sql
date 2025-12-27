-- Seed 002: Domaines de développement
-- Description: Établissements de santé de test

-- Domaine 1: Hôpital de Paris
INSERT INTO domains (
    domain_name,
    finess_juridique,
    organization_name,
    organization_type,
    status,
    settings,
    quotas
) VALUES (
    'hopital-paris.mssante.fr',
    '750000001',
    'Hôpital de Paris - CHU',
    'hospital',
    'active',
    '{"smtp_relay": "smtp.hopital-paris.mssante.fr", "max_message_size_mb": 50}',
    '{"max_mailboxes": 500, "max_storage_gb": 1000}'
) RETURNING id;

-- Récupérer l'ID du domaine Hôpital de Paris
DO $$
DECLARE
    domain_hopital_paris UUID;
    domain_clinique_lyon UUID;
    domain_labo_lille UUID;
    domain_cabinet_marseille UUID;
    domain_pharmacie_paris UUID;
BEGIN
    -- Hôpital Paris
    SELECT id INTO domain_hopital_paris FROM domains WHERE domain_name = 'hopital-paris.mssante.fr';
    
    -- Attribuer les utilisateurs au domaine Hôpital Paris
    UPDATE users SET domain_id = domain_hopital_paris 
    WHERE rpps_id IN ('10001234567', '10001234568', '10006789012')
    OR adeli_id = '750123456';
    
    -- Créer un admin de domaine pour Hôpital Paris
    INSERT INTO users (
        rpps_id, first_name, last_name, email, profession, status, role_id, domain_id
    ) VALUES (
        '10010000001', 'Thomas', 'Administrateur', 'thomas.admin@hopital-paris.mssante.fr',
        'Administrateur système', 'active',
        (SELECT id FROM roles WHERE name = 'domain_admin'),
        domain_hopital_paris
    );
    
    INSERT INTO domain_admins (domain_id, user_id, role)
    VALUES (
        domain_hopital_paris,
        (SELECT id FROM users WHERE rpps_id = '10010000001'),
        'admin'
    );
END $$;

-- Domaine 2: Clinique de Lyon
INSERT INTO domains (
    domain_name,
    finess_juridique,
    organization_name,
    organization_type,
    status,
    settings,
    quotas
) VALUES (
    'clinique-lyon.mssante.fr',
    '690000002',
    'Clinique Saint-Jean Lyon',
    'clinic',
    'active',
    '{"smtp_relay": "smtp.clinique-lyon.mssante.fr", "max_message_size_mb": 30}',
    '{"max_mailboxes": 200, "max_storage_gb": 500}'
);

DO $$
DECLARE
    domain_clinique_lyon UUID;
BEGIN
    SELECT id INTO domain_clinique_lyon FROM domains WHERE domain_name = 'clinique-lyon.mssante.fr';
    
    -- Attribuer les utilisateurs
    UPDATE users SET domain_id = domain_clinique_lyon 
    WHERE rpps_id = '10005678901' OR adeli_id = '690234567';
    
    -- Admin de domaine
    INSERT INTO users (
        rpps_id, first_name, last_name, email, profession, status, role_id, domain_id
    ) VALUES (
        '10010000002', 'Sylvie', 'Administrateur', 'sylvie.admin@clinique-lyon.mssante.fr',
        'Directeur des systèmes d''information', 'active',
        (SELECT id FROM roles WHERE name = 'domain_admin'),
        domain_clinique_lyon
    );
    
    INSERT INTO domain_admins (domain_id, user_id, role)
    VALUES (
        domain_clinique_lyon,
        (SELECT id FROM users WHERE rpps_id = '10010000002'),
        'admin'
    );
END $$;

-- Domaine 3: Laboratoire de Lille
INSERT INTO domains (
    domain_name,
    finess_juridique,
    organization_name,
    organization_type,
    status,
    settings,
    quotas
) VALUES (
    'laboratoire-lille.mssante.fr',
    '590000003',
    'Laboratoire BioMed Lille',
    'lab',
    'active',
    '{"smtp_relay": "smtp.laboratoire-lille.mssante.fr", "max_message_size_mb": 20}',
    '{"max_mailboxes": 50, "max_storage_gb": 200}'
);

DO $$
DECLARE
    domain_labo_lille UUID;
BEGIN
    SELECT id INTO domain_labo_lille FROM domains WHERE domain_name = 'laboratoire-lille.mssante.fr';
    
    -- Attribuer les utilisateurs
    UPDATE users SET domain_id = domain_labo_lille 
    WHERE rpps_id = '10003456789';
    
    -- Admin de domaine
    INSERT INTO users (
        rpps_id, first_name, last_name, email, profession, status, role_id, domain_id
    ) VALUES (
        '10010000003', 'Marc', 'Administrateur', 'marc.admin@laboratoire-lille.mssante.fr',
        'Responsable informatique', 'active',
        (SELECT id FROM roles WHERE name = 'domain_admin'),
        domain_labo_lille
    );
    
    INSERT INTO domain_admins (domain_id, user_id, role)
    VALUES (
        domain_labo_lille,
        (SELECT id FROM users WHERE rpps_id = '10010000003'),
        'admin'
    );
END $$;

-- Domaine 4: Cabinet médical Marseille
INSERT INTO domains (
    domain_name,
    finess_juridique,
    organization_name,
    organization_type,
    status,
    settings,
    quotas
) VALUES (
    'cabinet-marseille.mssante.fr',
    '130000004',
    'Cabinet Dr. Petit - Marseille',
    'private_practice',
    'active',
    '{"smtp_relay": "smtp.cabinet-marseille.mssante.fr", "max_message_size_mb": 20}',
    '{"max_mailboxes": 10, "max_storage_gb": 50}'
);

DO $$
DECLARE
    domain_cabinet_marseille UUID;
BEGIN
    SELECT id INTO domain_cabinet_marseille FROM domains WHERE domain_name = 'cabinet-marseille.mssante.fr';
    
    -- Attribuer les utilisateurs
    UPDATE users SET domain_id = domain_cabinet_marseille 
    WHERE rpps_id = '10004567890';
    
    -- Le médecin est aussi admin de son propre cabinet
    UPDATE users SET role_id = (SELECT id FROM roles WHERE name = 'domain_admin')
    WHERE rpps_id = '10004567890';
    
    INSERT INTO domain_admins (domain_id, user_id, role)
    VALUES (
        domain_cabinet_marseille,
        (SELECT id FROM users WHERE rpps_id = '10004567890'),
        'admin'
    );
END $$;

-- Domaine 5: Pharmacie Paris
INSERT INTO domains (
    domain_name,
    finess_juridique,
    organization_name,
    organization_type,
    status,
    settings,
    quotas
) VALUES (
    'pharmacie-paris.mssante.fr',
    '750000005',
    'Pharmacie Leroy - Paris',
    'private_practice',
    'active',
    '{"smtp_relay": "smtp.pharmacie-paris.mssante.fr", "max_message_size_mb": 15}',
    '{"max_mailboxes": 5, "max_storage_gb": 25}'
);

DO $$
DECLARE
    domain_pharmacie_paris UUID;
BEGIN
    SELECT id INTO domain_pharmacie_paris FROM domains WHERE domain_name = 'pharmacie-paris.mssante.fr';
    
    -- Attribuer les utilisateurs
    UPDATE users SET domain_id = domain_pharmacie_paris 
    WHERE rpps_id = '10002345678';
    
    -- Le pharmacien est aussi admin de sa pharmacie
    UPDATE users SET role_id = (SELECT id FROM roles WHERE name = 'domain_admin')
    WHERE rpps_id = '10002345678';
    
    INSERT INTO domain_admins (domain_id, user_id, role)
    VALUES (
        domain_pharmacie_paris,
        (SELECT id FROM users WHERE rpps_id = '10002345678'),
        'admin'
    );
END $$;

-- Domaine 6: En attente d'activation (pour tester workflow d'activation)
INSERT INTO domains (
    domain_name,
    finess_juridique,
    organization_name,
    organization_type,
    status,
    settings,
    quotas
) VALUES (
    'hopital-bordeaux.mssante.fr',
    '330000006',
    'CHU Bordeaux',
    'hospital',
    'pending',
    '{}',
    '{"max_mailboxes": 300, "max_storage_gb": 750}'
);

-- Domaine 7: Suspendu (pour tester l'état suspendu)
INSERT INTO domains (
    domain_name,
    finess_juridique,
    organization_name,
    organization_type,
    status,
    settings,
    quotas
) VALUES (
    'clinique-test-suspended.mssante.fr',
    '130000007',
    'Clinique Test (Suspendue)',
    'clinic',
    'suspended',
    '{}',
    '{"max_mailboxes": 50, "max_storage_gb": 100}'
);

-- Commentaire
SELECT 'dev_domains.sql: Domaines de test créés avec succès' as message;
SELECT COUNT(*) || ' domaines insérés' as count FROM domains;
SELECT COUNT(*) || ' administrateurs de domaine créés' as count FROM domain_admins;