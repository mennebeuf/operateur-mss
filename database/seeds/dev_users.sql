-- Seed 001: Utilisateurs de développement
-- Description: Utilisateurs de test pour chaque rôle

-- Super Admin principal
INSERT INTO users (
    rpps_id, 
    first_name, 
    last_name, 
    email, 
    profession, 
    specialty, 
    status,
    role_id,
    is_super_admin
) VALUES (
    '10000000001',
    'Admin',
    'Plateforme',
    'admin@mssante-operator.fr',
    'Administrateur',
    'Gestion plateforme',
    'active',
    (SELECT id FROM roles WHERE name = 'super_admin'),
    true
);

-- Super Admin secondaire
INSERT INTO users (
    rpps_id, 
    first_name, 
    last_name, 
    email, 
    profession, 
    specialty, 
    status,
    role_id,
    is_super_admin
) VALUES (
    '10000000002',
    'Marie',
    'Dupont',
    'marie.dupont@mssante-operator.fr',
    'Administrateur',
    'Support technique',
    'active',
    (SELECT id FROM roles WHERE name = 'super_admin'),
    true
);

-- Médecin utilisateur standard
INSERT INTO users (
    rpps_id, 
    first_name, 
    last_name, 
    email, 
    profession, 
    specialty, 
    status,
    role_id
) VALUES (
    '10001234567',
    'Jean',
    'Martin',
    'jean.martin@hopital-paris.mssante.fr',
    'Médecin',
    'Cardiologie',
    'active',
    (SELECT id FROM roles WHERE name = 'user')
);

-- Médecin utilisateur standard 2
INSERT INTO users (
    rpps_id, 
    first_name, 
    last_name, 
    email, 
    profession, 
    specialty, 
    status,
    role_id
) VALUES (
    '10001234568',
    'Sophie',
    'Bernard',
    'sophie.bernard@hopital-paris.mssante.fr',
    'Médecin',
    'Pédiatrie',
    'active',
    (SELECT id FROM roles WHERE name = 'user')
);

-- Infirmière
INSERT INTO users (
    adeli_id,
    rpps_id,
    first_name, 
    last_name, 
    email, 
    profession, 
    status,
    role_id
) VALUES (
    '750123456',
    '80001234567',
    'Claire',
    'Dubois',
    'claire.dubois@hopital-paris.mssante.fr',
    'Infirmier',
    'active',
    (SELECT id FROM roles WHERE name = 'user')
);

-- Pharmacien
INSERT INTO users (
    rpps_id, 
    first_name, 
    last_name, 
    email, 
    profession, 
    specialty, 
    status,
    role_id
) VALUES (
    '10002345678',
    'Pierre',
    'Leroy',
    'pierre.leroy@pharmacie-paris.mssante.fr',
    'Pharmacien',
    'Officine',
    'active',
    (SELECT id FROM roles WHERE name = 'user')
);

-- Biologiste
INSERT INTO users (
    rpps_id, 
    first_name, 
    last_name, 
    email, 
    profession, 
    specialty, 
    status,
    role_id
) VALUES (
    '10003456789',
    'Antoine',
    'Moreau',
    'antoine.moreau@laboratoire-lille.mssante.fr',
    'Biologiste médical',
    'Biologie médicale',
    'active',
    (SELECT id FROM roles WHERE name = 'user')
);

-- Médecin généraliste (cabinet privé)
INSERT INTO users (
    rpps_id, 
    first_name, 
    last_name, 
    email, 
    profession, 
    specialty, 
    status,
    role_id
) VALUES (
    '10004567890',
    'Isabelle',
    'Petit',
    'isabelle.petit@cabinet-marseille.mssante.fr',
    'Médecin',
    'Médecine générale',
    'active',
    (SELECT id FROM roles WHERE name = 'user')
);

-- Radiologue
INSERT INTO users (
    rpps_id, 
    first_name, 
    last_name, 
    email, 
    profession, 
    specialty, 
    status,
    role_id
) VALUES (
    '10005678901',
    'Laurent',
    'Rousseau',
    'laurent.rousseau@clinique-lyon.mssante.fr',
    'Médecin',
    'Radiologie',
    'active',
    (SELECT id FROM roles WHERE name = 'user')
);

-- Kinésithérapeute
INSERT INTO users (
    adeli_id,
    rpps_id,
    first_name, 
    last_name, 
    email, 
    profession, 
    status,
    role_id
) VALUES (
    '690234567',
    '80002345678',
    'Nathalie',
    'Simon',
    'nathalie.simon@cabinet-lyon.mssante.fr',
    'Masseur-kinésithérapeute',
    'active',
    (SELECT id FROM roles WHERE name = 'user')
);

-- Sage-femme
INSERT INTO users (
    rpps_id, 
    first_name, 
    last_name, 
    email, 
    profession, 
    status,
    role_id
) VALUES (
    '10006789012',
    'Émilie',
    'Laurent',
    'emilie.laurent@hopital-paris.mssante.fr',
    'Sage-femme',
    'active',
    (SELECT id FROM roles WHERE name = 'user')
);

-- Commentaire
SELECT 'dev_users.sql: Utilisateurs de test créés avec succès' as message;
SELECT COUNT(*) || ' utilisateurs insérés' as count FROM users;