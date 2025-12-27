-- Script global pour exécuter tous les seeds
-- Usage: psql -U mssante -d mssante -f database/seeds/_seed_all.sql

\echo '========================================='
\echo 'DÉBUT DU SEEDING DE LA BASE DE DONNÉES'
\echo '========================================='
\echo ''

\echo '1. Création des utilisateurs...'
\i database/seeds/dev_users.sql
\echo ''

\echo '2. Création des domaines...'
\i database/seeds/dev_domains.sql
\echo ''

\echo '3. Création des boîtes aux lettres...'
\i database/seeds/dev_mailboxes.sql
\echo ''

\echo '4. Génération des statistiques...'
\i database/seeds/dev_statistics.sql
\echo ''

\echo '========================================='
\echo 'RÉCAPITULATIF'
\echo '========================================='

SELECT 'Utilisateurs: ' || COUNT(*) FROM users;
SELECT 'Domaines: ' || COUNT(*) FROM domains;
SELECT 'Boîtes aux lettres: ' || COUNT(*) FROM mailboxes;
SELECT 'Délégations: ' || COUNT(*) FROM mailbox_delegations;
SELECT 'Statistiques (jours): ' || COUNT(DISTINCT date) FROM statistics;
SELECT 'Événements système: ' || COUNT(*) FROM system_events;

\echo ''
\echo '========================================='
\echo 'SEEDING TERMINÉ AVEC SUCCÈS !'
\echo '========================================='