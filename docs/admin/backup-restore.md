# Guide de Sauvegarde et Restauration

Ce guide détaille les procédures de sauvegarde et de restauration de la plateforme MSSanté Opérateur.

## Table des matières

1. [Vue d'ensemble](#vue-densemble)
2. [Script de sauvegarde (backup.sh)](#script-de-sauvegarde)
3. [Script de restauration (restore.sh)](#script-de-restauration)
4. [Planification automatique](#planification-automatique)
5. [Stockage distant](#stockage-distant)
6. [Chiffrement](#chiffrement)
7. [Bonnes pratiques](#bonnes-pratiques)
8. [Dépannage](#dépannage)

---

## Vue d'ensemble

### Composants sauvegardés

| Composant | Description | Criticité |
|-----------|-------------|-----------|
| **PostgreSQL** | Base de données principale (utilisateurs, BAL, logs) | 🔴 Critique |
| **Redis** | Cache et sessions | 🟡 Important |
| **Mails** | Boîtes aux lettres (maildir) | 🔴 Critique |
| **Configuration** | .env, docker-compose.yml, config/ | 🟡 Important |
| **Certificats** | Certificats SSL/TLS et IGC Santé | 🔴 Critique |

### Objectifs de récupération

| Métrique | Objectif | Description |
|----------|----------|-------------|
| **RPO** (Recovery Point Objective) | 15 minutes | Perte de données maximale acceptable |
| **RTO** (Recovery Time Objective) | 4 heures | Temps de restauration maximal |

### Emplacement des scripts

```
scripts/backup/
├── backup.sh      # Script de sauvegarde
└── restore.sh     # Script de restauration
```

---

## Script de sauvegarde

**Chemin:** `scripts/backup/backup.sh`

### Description

Le script `backup.sh` effectue une sauvegarde complète ou partielle de tous les composants de la plateforme. Il supporte le chiffrement, la compression, la rotation automatique et la synchronisation vers un stockage distant.

### Fonctionnalités

- ✅ Sauvegarde PostgreSQL (format custom compressé)
- ✅ Sauvegarde Redis (RDB + AOF)
- ✅ Sauvegarde des mails (tar.gz)
- ✅ Sauvegarde de la configuration
- ✅ Sauvegarde des certificats
- ✅ Chiffrement GPG optionnel
- ✅ Rotation automatique des anciens backups
- ✅ Synchronisation vers S3/rclone
- ✅ Notifications (Slack, email)
- ✅ Mode dry-run pour simulation
- ✅ Manifest JSON avec métadonnées

### Utilisation de base

```bash
# Rendre le script exécutable
chmod +x scripts/backup/backup.sh

# Sauvegarde complète
./scripts/backup/backup.sh

# Sauvegarde en mode verbeux
./scripts/backup/backup.sh --verbose

# Simulation sans exécution
./scripts/backup/backup.sh --dry-run
```

### Options disponibles

| Option | Description | Exemple |
|--------|-------------|---------|
| `--type TYPE` | Type: `full` ou `incremental` | `--type incremental` |
| `--encrypt` | Activer le chiffrement GPG | `--encrypt` |
| `--gpg-recipient ID` | Destinataire GPG | `--gpg-recipient admin@example.com` |
| `--sync-remote` | Activer la sync distante | `--sync-remote` |
| `--remote-dest URL` | Destination distante | `--remote-dest s3://bucket/backups` |
| `--retention DAYS` | Jours de rétention | `--retention 60` |
| `--compress-level N` | Niveau gzip (1-9) | `--compress-level 9` |
| `--no-postgres` | Ignorer PostgreSQL | |
| `--no-redis` | Ignorer Redis | |
| `--no-mail` | Ignorer les mails | |
| `--no-config` | Ignorer la configuration | |
| `--no-certs` | Ignorer les certificats | |
| `--dry-run` | Mode simulation | |
| `-v, --verbose` | Mode verbeux | |
| `-q, --quiet` | Mode silencieux | |

### Exemples d'utilisation

```bash
# Sauvegarde complète standard
./scripts/backup/backup.sh

# Sauvegarde avec chiffrement GPG
./scripts/backup/backup.sh --encrypt --gpg-recipient backup@example.com

# Sauvegarde et synchronisation vers S3
./scripts/backup/backup.sh --sync-remote --remote-dest s3://my-bucket/mssante/

# Sauvegarde incrémentielle des mails uniquement
./scripts/backup/backup.sh --type incremental --no-postgres --no-redis --no-config --no-certs

# Sauvegarde PostgreSQL uniquement
./scripts/backup/backup.sh --no-redis --no-mail --no-config --no-certs

# Sauvegarde avec rétention de 60 jours
./scripts/backup/backup.sh --retention 60

# Mode silencieux (pour cron)
./scripts/backup/backup.sh --quiet
```

### Variables d'environnement

Le script peut être configuré via des variables d'environnement :

```bash
# Répertoire de stockage des backups
export BACKUP_ROOT="/data/backups"

# Rétention
export RETENTION_DAYS=30
export RETENTION_WEEKLY=12
export RETENTION_MONTHLY=12

# Chiffrement
export ENCRYPT_BACKUP=true
export GPG_RECIPIENT="backup@example.com"

# Synchronisation distante
export SYNC_REMOTE=true
export REMOTE_DESTINATION="s3://bucket/backups"

# Notifications
export SLACK_WEBHOOK_URL="https://hooks.slack.com/services/xxx"
export ALERT_EMAIL="admin@example.com"
```

### Structure des sauvegardes

```
data/backups/
├── 20240315_020000/
│   ├── manifest.json
│   ├── postgresql_20240315_020000.dump.gz
│   ├── postgresql_roles_20240315_020000.sql.gz
│   ├── redis_20240315_020000.rdb.gz
│   ├── mail_20240315_020000.tar.gz
│   ├── config_20240315_020000.tar.gz
│   └── certificates_20240315_020000.tar.gz
├── 20240316_020000/
│   └── ...
└── backup.log
```

### Manifest JSON

Chaque sauvegarde contient un fichier `manifest.json` :

```json
{
    "backup": {
        "id": "20240315_020000",
        "type": "full",
        "date": "2024-03-15T02:00:00+01:00",
        "duration_seconds": 245,
        "size_bytes": 1073741824,
        "encrypted": false,
        "errors": 0
    },
    "components": {
        "postgresql": true,
        "redis": true,
        "mail": true,
        "config": true,
        "certificates": true
    },
    "system": {
        "hostname": "mssante-prod-01",
        "os": "Ubuntu 22.04.3 LTS",
        "docker_version": "24.0.7"
    },
    "application": {
        "version": "v1.2.3",
        "commit": "abc1234"
    }
}
```

---

## Script de restauration

**Chemin:** `scripts/backup/restore.sh`

### Description

Le script `restore.sh` permet de restaurer tout ou partie d'une sauvegarde. Il crée automatiquement un backup de sécurité avant d'écraser les données existantes.

### Fonctionnalités

- ✅ Restauration sélective des composants
- ✅ Analyse automatique du backup
- ✅ Backup de sécurité avant restauration
- ✅ Déchiffrement GPG
- ✅ Vérification des certificats (expiration)
- ✅ Redémarrage automatique des services
- ✅ Mode dry-run pour simulation

### Utilisation de base

```bash
# Rendre le script exécutable
chmod +x scripts/backup/restore.sh

# Restauration depuis un répertoire
./scripts/backup/restore.sh /data/backups/20240315_020000

# Restauration depuis une archive
./scripts/backup/restore.sh /data/backups/mssante_backup.tar.gz

# Simulation
./scripts/backup/restore.sh --dry-run /data/backups/20240315_020000
```

### Options disponibles

| Option | Description | Exemple |
|--------|-------------|---------|
| `--decrypt` | Déchiffrer les fichiers GPG | `--decrypt` |
| `--gpg-passphrase PWD` | Passphrase GPG | `--gpg-passphrase "secret"` |
| `--no-postgres` | Ne pas restaurer PostgreSQL | |
| `--no-redis` | Ne pas restaurer Redis | |
| `--no-mail` | Ne pas restaurer les mails | |
| `--no-config` | Ne pas restaurer la config | |
| `--no-certs` | Ne pas restaurer les certificats | |
| `--no-stop` | Ne pas arrêter les services | |
| `--no-start` | Ne pas redémarrer les services | |
| `-f, --force` | Forcer (écraser .env) | |
| `--dry-run` | Mode simulation | |
| `-v, --verbose` | Mode verbeux | |
| `-y, --yes` | Ignorer les confirmations | |

### Exemples d'utilisation

```bash
# Restauration complète
./scripts/backup/restore.sh /data/backups/20240315_020000

# Restauration PostgreSQL uniquement
./scripts/backup/restore.sh --no-redis --no-mail --no-config --no-certs /data/backups/20240315_020000

# Restauration des mails uniquement
./scripts/backup/restore.sh --no-postgres --no-redis --no-config --no-certs /data/backups/20240315_020000

# Restauration avec déchiffrement
./scripts/backup/restore.sh --decrypt /data/backups/20240315_020000

# Restauration forcée sans confirmation
./scripts/backup/restore.sh --force --yes /data/backups/20240315_020000

# Restauration sans redémarrage des services
./scripts/backup/restore.sh --no-start /data/backups/20240315_020000

# Simulation complète
./scripts/backup/restore.sh --dry-run --verbose /data/backups/20240315_020000
```

### Processus de restauration

1. **Analyse** : Lecture du manifest et détection des composants
2. **Confirmation** : Demande de confirmation utilisateur
3. **Arrêt des services** : API, frontend, mail
4. **Backup de sécurité** : Sauvegarde des données actuelles
5. **Restauration** : PostgreSQL → Redis → Mails → Config → Certificats
6. **Redémarrage** : Tous les services
7. **Vérification** : Health checks

### Backup de sécurité

Avant chaque restauration, un backup de sécurité est créé :

```
data/backups/pre_restore_20240320_143000/
├── postgres_safety.dump.gz
├── redis_safety.rdb
├── mail_safety.tar.gz
└── .env.safety
```

---

## Planification automatique

### Configuration cron

Ajoutez les lignes suivantes à votre crontab :

```bash
# Éditer le crontab
crontab -e
```

```cron
# Sauvegarde complète quotidienne à 2h du matin
0 2 * * * /opt/mssante/scripts/backup/backup.sh --quiet >> /var/log/mssante-backup.log 2>&1

# Sauvegarde incrémentielle des mails toutes les 6h
0 */6 * * * /opt/mssante/scripts/backup/backup.sh --type incremental --no-postgres --no-redis --no-config --no-certs --quiet >> /var/log/mssante-backup.log 2>&1

# Sauvegarde hebdomadaire avec sync S3 le dimanche à 3h
0 3 * * 0 /opt/mssante/scripts/backup/backup.sh --sync-remote --remote-dest s3://bucket/weekly --quiet >> /var/log/mssante-backup.log 2>&1

# Nettoyage des logs de backup tous les mois
0 4 1 * * find /var/log -name "mssante-backup*.log" -mtime +30 -delete
```

### Rotation des logs

Créez le fichier `/etc/logrotate.d/mssante-backup` :

```
/var/log/mssante-backup.log {
    weekly
    rotate 12
    compress
    delaycompress
    missingok
    notifempty
    create 640 root root
}
```

---

## Stockage distant

### Configuration AWS S3

```bash
# Installer AWS CLI
apt install awscli

# Configurer les credentials
aws configure
# AWS Access Key ID: AKIA...
# AWS Secret Access Key: ...
# Default region name: eu-west-3
# Default output format: json

# Tester
aws s3 ls s3://your-bucket/
```

Utilisation :
```bash
./scripts/backup/backup.sh --sync-remote --remote-dest s3://your-bucket/mssante/
```

### Configuration rclone

```bash
# Installer rclone
curl https://rclone.org/install.sh | sudo bash

# Configurer
rclone config
# Suivre l'assistant pour configurer votre remote (S3, GCS, Azure, etc.)

# Tester
rclone ls myremote:bucket/
```

Utilisation :
```bash
./scripts/backup/backup.sh --sync-remote --remote-dest myremote:bucket/mssante/
```

### Configuration SFTP

Avec rclone :
```bash
rclone config
# Type: sftp
# Host: backup-server.example.com
# User: backup
# Key file: /root/.ssh/backup_key
```

---

## Chiffrement

### Configuration GPG

```bash
# Générer une clé GPG pour les backups
gpg --full-generate-key
# Choisir: RSA and RSA, 4096 bits, n'expire pas

# Lister les clés
gpg --list-keys

# Exporter la clé publique (pour restauration sur autre serveur)
gpg --export --armor backup@example.com > backup-public.key

# Exporter la clé privée (à stocker en sécurité!)
gpg --export-secret-keys --armor backup@example.com > backup-private.key
```

### Sauvegarde avec chiffrement

```bash
./scripts/backup/backup.sh --encrypt --gpg-recipient backup@example.com
```

### Restauration avec déchiffrement

```bash
# Interactif (demande la passphrase)
./scripts/backup/restore.sh --decrypt /data/backups/20240315_020000

# Non-interactif
./scripts/backup/restore.sh --decrypt --gpg-passphrase "your-passphrase" /data/backups/20240315_020000
```

### Importer une clé sur un nouveau serveur

```bash
# Importer la clé privée
gpg --import backup-private.key

# Faire confiance à la clé
gpg --edit-key backup@example.com
> trust
> 5 (ultimate trust)
> quit
```

---

## Bonnes pratiques

### Stratégie de sauvegarde recommandée

| Fréquence | Type | Rétention | Stockage |
|-----------|------|-----------|----------|
| Toutes les 6h | Incrémentiel (mails) | 7 jours | Local |
| Quotidien | Complet | 30 jours | Local + S3 |
| Hebdomadaire | Complet + chiffré | 12 semaines | S3 (IA) |
| Mensuel | Complet + chiffré | 12 mois | S3 Glacier |

### Checklist de vérification

- [ ] **Tester la restauration régulièrement** (au moins mensuel)
- [ ] **Vérifier les notifications** de succès/échec
- [ ] **Monitorer l'espace disque** des backups
- [ ] **Vérifier les dates d'expiration** des certificats dans les backups
- [ ] **Stocker les clés GPG** dans un endroit sécurisé séparé
- [ ] **Documenter la procédure** de restauration d'urgence

### Test de restauration

Procédure de test mensuelle :

```bash
# 1. Créer un environnement de test
mkdir -p /tmp/restore-test
cd /tmp/restore-test

# 2. Copier le dernier backup
cp -r /data/backups/$(ls -t /data/backups | head -1) .

# 3. Simuler la restauration
./scripts/backup/restore.sh --dry-run --verbose ./$(ls -t | head -1)

# 4. Si OK, tester sur un environnement de staging
```

---

## Dépannage

### Erreur : "PostgreSQL n'est pas accessible"

```bash
# Vérifier que PostgreSQL est démarré
docker compose ps postgres

# Démarrer si nécessaire
docker compose up -d postgres

# Attendre et réessayer
sleep 10
./scripts/backup/backup.sh
```

### Erreur : "Espace disque insuffisant"

```bash
# Vérifier l'espace
df -h /data/backups

# Nettoyer les anciens backups manuellement
find /data/backups -maxdepth 1 -type d -mtime +7 -exec rm -rf {} \;

# Réessayer
./scripts/backup/backup.sh
```

### Erreur : "GPG: No public key"

```bash
# Vérifier que la clé existe
gpg --list-keys backup@example.com

# Si manquante, importer
gpg --import /path/to/backup-public.key
```

### Erreur : "Archive corrompue"

```bash
# Tester l'intégrité
gzip -t /data/backups/20240315_020000/postgresql_*.dump.gz

# Si corrompu, utiliser un backup plus ancien
./scripts/backup/restore.sh /data/backups/20240314_020000
```

### Restauration partielle après échec

```bash
# Si la restauration échoue en cours de route,
# restaurer depuis le backup de sécurité
./scripts/backup/restore.sh /data/backups/pre_restore_*/
```

### Mode debug

```bash
# Exécuter avec trace bash
bash -x ./scripts/backup/backup.sh --verbose

# Consulter les logs
tail -f /data/backups/backup.log
tail -f /data/backups/restore.log
```

---

## Références

- [Documentation PostgreSQL - pg_dump](https://www.postgresql.org/docs/current/app-pgdump.html)
- [Documentation Redis - Persistence](https://redis.io/docs/management/persistence/)
- [GPG - GNU Privacy Guard](https://gnupg.org/documentation/)
- [rclone - Documentation](https://rclone.org/docs/)
- [AWS S3 - CLI Reference](https://docs.aws.amazon.com/cli/latest/reference/s3/)

---

**Dernière mise à jour :** Décembre 2024  
**Version :** 1.0
