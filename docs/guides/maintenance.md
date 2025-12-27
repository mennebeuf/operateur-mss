# Guide de Maintenance - Opérateur MSSanté

Ce guide documente les scripts et procédures de maintenance pour la plateforme MSSanté.

---

## Table des matières

1. [Vue d'ensemble](#vue-densemble)
2. [Scripts de maintenance](#scripts-de-maintenance)
   - [cleanup-logs.sh](#cleanup-logssh---nettoyage-des-logs)
   - [check-health.sh](#check-healthsh---vérification-de-santé)
3. [Planification automatique](#planification-automatique)
4. [Procédures de maintenance](#procédures-de-maintenance)
5. [Dépannage](#dépannage)

---

## Vue d'ensemble

Les scripts de maintenance se trouvent dans le répertoire `scripts/maintenance/` et permettent d'automatiser les tâches récurrentes essentielles au bon fonctionnement de la plateforme.

```
scripts/maintenance/
├── cleanup-logs.sh    # Nettoyage et rotation des logs
├── check-health.sh    # Vérification de santé des services
└── monthly-maintenance.sh  # Maintenance mensuelle complète
```

### Prérequis

- Bash 4.0+
- Docker et Docker Compose
- Accès root ou sudo pour certaines opérations
- Outils : `curl`, `nc` (netcat), `openssl`, `gzip`

---

## Scripts de maintenance

### cleanup-logs.sh - Nettoyage des logs

Script de nettoyage automatique des fichiers de logs avec compression et archivage.

#### Emplacement

```
scripts/maintenance/cleanup-logs.sh
```

#### Utilisation

```bash
# Exécution standard (avec confirmation)
./scripts/maintenance/cleanup-logs.sh

# Mode simulation (aucune modification)
./scripts/maintenance/cleanup-logs.sh --dry-run

# Sans confirmation interactive
./scripts/maintenance/cleanup-logs.sh --force

# Mode verbeux
./scripts/maintenance/cleanup-logs.sh --verbose

# Afficher l'aide
./scripts/maintenance/cleanup-logs.sh --help
```

#### Options

| Option | Description |
|--------|-------------|
| `--dry-run` | Simule les actions sans les exécuter |
| `--force` | Exécute sans demander de confirmation |
| `--verbose` | Affiche les détails de chaque opération |
| `-h, --help` | Affiche l'aide |

#### Configuration

Les paramètres de rétention sont configurables via des variables au début du script ou par variables d'environnement :

| Variable | Défaut | Description |
|----------|--------|-------------|
| `LOG_DIR` | `/var/log/mssante` | Répertoire des logs système |
| `DATA_LOG_DIR` | `./data/logs` | Répertoire des logs applicatifs |
| `ARCHIVE_DIR` | `./data/logs/archives` | Répertoire des archives |
| `RETENTION_LOGS` | 30 jours | Rétention des logs applicatifs |
| `RETENTION_ACCESS` | 90 jours | Rétention des logs d'accès/audit |
| `RETENTION_MAIL` | 60 jours | Rétention des logs mail |
| `RETENTION_ARCHIVES` | 180 jours | Rétention des archives compressées |
| `RETENTION_DOCKER` | 7 jours | Rétention des logs Docker |

#### Fonctionnalités

1. **Nettoyage par catégorie** :
   - Logs applicatifs (`*.log`, `app-*.log`)
   - Logs d'accès et d'audit
   - Logs mail (Postfix/Dovecot)
   - Logs Docker (truncate des logs volumineux)
   - Archives anciennes

2. **Compression automatique** :
   - Compresse les fichiers `.log.*` de plus d'1 jour
   - Utilise gzip avec compression maximale (`-9`)

3. **Intégration logrotate** :
   - Exécute logrotate si configuré (`/etc/logrotate.d/mssante`)

4. **Rapport de nettoyage** :
   - Affiche l'espace libéré
   - Vérifie l'utilisation disque

#### Exemple de sortie

```
╔═══════════════════════════════════════════════════════════════╗
║          🧹 NETTOYAGE DES LOGS MSSANTÉ                       ║
╚═══════════════════════════════════════════════════════════════╝

[INFO] 🧹 Nettoyage des logs applicatifs (>30 jours)...
[OK] Logs applicatifs: 45 fichiers supprimés
[INFO] 🔐 Nettoyage des logs d'accès (>90 jours)...
[OK] Logs d'accès: 12 fichiers supprimés
[INFO] 📧 Nettoyage des logs mail (>60 jours)...
[OK] Logs mail: 8 fichiers supprimés
[INFO] 🗜️ Compression des logs anciens (>1 jour)...
[OK] Fichiers compressés: 23

═══════════════════════════════════════════════════════════════
📊 RAPPORT DE NETTOYAGE - 2025-01-15 03:00:02
═══════════════════════════════════════════════════════════════

  Taille avant:     2.4 GB
  Taille après:     1.1 GB
  Espace libéré:    1.3 GB

  [OK] Utilisation disque: 45%

═══════════════════════════════════════════════════════════════
```

---

### check-health.sh - Vérification de santé

Script de vérification de l'état de santé de tous les services de la plateforme.

#### Emplacement

```
scripts/maintenance/check-health.sh
```

#### Utilisation

```bash
# Vérification standard
./scripts/maintenance/check-health.sh

# Mode verbeux
./scripts/maintenance/check-health.sh --verbose

# Sortie JSON uniquement
./scripts/maintenance/check-health.sh --json

# Sans envoi d'alertes
./scripts/maintenance/check-health.sh --no-alerts

# Sans vérification des certificats
./scripts/maintenance/check-health.sh --no-certs

# Afficher l'aide
./scripts/maintenance/check-health.sh --help
```

#### Options

| Option | Description |
|--------|-------------|
| `--verbose` | Affiche les détails de chaque vérification |
| `--json` | Sortie au format JSON uniquement |
| `--no-alerts` | Désactive l'envoi d'alertes |
| `--no-certs` | Ne vérifie pas les certificats SSL |
| `-h, --help` | Affiche l'aide |

#### Configuration

Variables d'environnement pour personnaliser les endpoints :

| Variable | Défaut | Description |
|----------|--------|-------------|
| `API_URL` | `http://localhost:3000` | URL de l'API |
| `FRONTEND_URL` | `http://localhost:80` | URL du frontend |
| `SMTP_HOST` | `localhost` | Hôte SMTP |
| `SMTP_PORT` | `587` | Port SMTP |
| `IMAP_HOST` | `localhost` | Hôte IMAP |
| `IMAP_PORT` | `143` | Port IMAP |
| `POSTGRES_HOST` | `localhost` | Hôte PostgreSQL |
| `POSTGRES_PORT` | `5432` | Port PostgreSQL |
| `REDIS_HOST` | `localhost` | Hôte Redis |
| `REDIS_PORT` | `6379` | Port Redis |
| `ALERTMANAGER_URL` | `http://alertmanager:9093` | URL AlertManager |
| `TIMEOUT` | `5` | Timeout des vérifications (secondes) |
| `ALERT_THRESHOLD` | `3` | Seuil d'erreurs pour alerter |

Seuils système :

| Variable | Défaut | Description |
|----------|--------|-------------|
| `DISK_THRESHOLD` | `85` | Seuil d'alerte disque (%) |
| `MEMORY_THRESHOLD` | `90` | Seuil d'alerte mémoire (%) |
| `CPU_THRESHOLD` | `90` | Seuil d'alerte CPU (%) |
| `CERT_EXPIRY_DAYS` | `30` | Alerte expiration certificat (jours) |

#### Services vérifiés

1. **Services applicatifs** :
   - API (endpoint `/health`)
   - Frontend (HTTP 200)

2. **Services mail** :
   - SMTP (port 587)
   - IMAP (port 143)

3. **Base de données et cache** :
   - PostgreSQL (port 5432 + `pg_isready`)
   - Redis (commande PING)

4. **Conteneurs Docker** :
   - postgres, redis, api, frontend, postfix, dovecot

5. **Ressources système** :
   - Utilisation disque
   - Utilisation mémoire
   - Charge CPU

6. **Certificats SSL** :
   - Vérification de la date d'expiration
   - Alerte si expiration < 30 jours

#### Fichiers générés

| Fichier | Description |
|---------|-------------|
| `/var/log/mssante/health-status.json` | Dernier statut au format JSON |
| `/var/log/mssante/health-history.log` | Historique des vérifications |

#### Format du fichier de statut

```json
{
  "timestamp": "2025-01-15T10:30:00+01:00",
  "status": "healthy",
  "checks": {
    "total": 12,
    "passed": 12,
    "failed": 0,
    "warnings": 0
  },
  "errors": []
}
```

#### Codes de sortie

| Code | Signification |
|------|---------------|
| `0` | Tous les services sont opérationnels |
| `1` | Un ou plusieurs services sont en erreur |
| `2` | Erreur de configuration |

#### Exemple de sortie

```
╔═══════════════════════════════════════════════════════════════╗
║          🏥 HEALTH CHECK MSSANTÉ                             ║
╠═══════════════════════════════════════════════════════════════╣
║  2025-01-15 10:30:00                                         ║
╚═══════════════════════════════════════════════════════════════╝

📡 Services applicatifs
───────────────────────────────────────────────────────────────
  ✓ API: Opérationnelle (HTTP 200)
  ✓ Frontend: Opérationnel (HTTP 200)

📧 Services mail
───────────────────────────────────────────────────────────────
  ✓ SMTP: Port 587 accessible
  ✓ IMAP: Port 143 accessible

🗄️ Base de données et cache
───────────────────────────────────────────────────────────────
  ✓ PostgreSQL: Opérationnel et prêt
  ✓ Redis: Opérationnel (PONG reçu)

🐳 Conteneurs Docker
───────────────────────────────────────────────────────────────
  ✓ Docker: Tous les conteneurs sont actifs

💻 Ressources système
───────────────────────────────────────────────────────────────
  ✓ Disque: Utilisation: 45%
  ✓ Mémoire: Utilisation: 62%
  ✓ CPU: Charge: 0.85 (21%)

🔐 Certificats SSL
───────────────────────────────────────────────────────────────
  ✓ Certificats: Tous les certificats sont valides

═══════════════════════════════════════════════════════════════
📊 RÉSUMÉ
═══════════════════════════════════════════════════════════════

  Total des vérifications:  12
  ✓ Réussies:               12
  ⚠ Avertissements:         0
  ✗ Échouées:               0

  Statut: OPÉRATIONNEL

═══════════════════════════════════════════════════════════════
```

#### Sortie JSON

```bash
./scripts/maintenance/check-health.sh --json
```

```json
{
  "timestamp": "2025-01-15T10:30:00+01:00",
  "status": "healthy",
  "checks": {
    "total": 12,
    "passed": 12,
    "failed": 0,
    "warnings": 0
  },
  "services": {
    "API": "OK",
    "Frontend": "OK",
    "SMTP": "OK",
    "IMAP": "OK",
    "PostgreSQL": "OK",
    "Redis": "OK",
    "Docker": "OK",
    "Disque": "OK",
    "Mémoire": "OK",
    "CPU": "OK",
    "Certificats": "OK"
  },
  "errors": []
}
```

---

## Planification automatique

### Configuration cron recommandée

Éditer la crontab :

```bash
sudo crontab -e
```

Ajouter les entrées suivantes :

```cron
# ═══════════════════════════════════════════════════════════════
# MAINTENANCE MSSANTÉ
# ═══════════════════════════════════════════════════════════════

# Health check toutes les 5 minutes
*/5 * * * * /opt/mssante/scripts/maintenance/check-health.sh >> /var/log/mssante/health-check.log 2>&1

# Nettoyage des logs quotidien à 3h00
0 3 * * * /opt/mssante/scripts/maintenance/cleanup-logs.sh --force >> /var/log/mssante/cleanup.log 2>&1

# Maintenance mensuelle complète (1er dimanche du mois à 2h00)
0 2 1-7 * 0 /opt/mssante/scripts/maintenance/monthly-maintenance.sh >> /var/log/mssante/monthly-maintenance.log 2>&1

# Backup quotidien à 2h00
0 2 * * * /opt/mssante/scripts/backup/backup.sh >> /var/log/mssante/backup.log 2>&1
```

### Vérification de la configuration

```bash
# Lister les tâches cron
sudo crontab -l

# Vérifier les logs
tail -f /var/log/mssante/health-check.log
tail -f /var/log/mssante/cleanup.log
```

---

## Procédures de maintenance

### Maintenance quotidienne (automatique)

| Heure | Tâche | Script |
|-------|-------|--------|
| */5 min | Health check | `check-health.sh` |
| 02:00 | Backup | `backup.sh` |
| 03:00 | Nettoyage logs | `cleanup-logs.sh` |

### Maintenance hebdomadaire

- Vérifier les rapports de health check
- Analyser les tendances d'utilisation disque
- Vérifier les alertes en attente

### Maintenance mensuelle

Exécutée automatiquement par `monthly-maintenance.sh` :

1. Mises à jour de sécurité système
2. Rotation forcée des logs
3. Nettoyage Docker (images/volumes orphelins)
4. Optimisation PostgreSQL (VACUUM ANALYZE)
5. Vérification des certificats
6. Test de restauration de backup
7. Mise à jour des dépendances npm
8. Génération du rapport mensuel

```bash
# Exécution manuelle
./scripts/maintenance/monthly-maintenance.sh
```

---

## Dépannage

### Le script cleanup-logs.sh ne supprime pas les fichiers

**Causes possibles** :
- Mode `--dry-run` activé
- Permissions insuffisantes
- Répertoires inexistants

**Solution** :
```bash
# Vérifier les permissions
ls -la /var/log/mssante/
ls -la ./data/logs/

# Exécuter avec sudo si nécessaire
sudo ./scripts/maintenance/cleanup-logs.sh --verbose
```

### Le health check échoue sur un service

**Diagnostic** :
```bash
# Vérifier le statut Docker
docker compose ps

# Vérifier les logs du service
docker compose logs <service>

# Tester manuellement
curl -v http://localhost:3000/health
```

### Les alertes ne sont pas envoyées

**Vérifier** :
1. AlertManager est accessible :
   ```bash
   curl http://alertmanager:9093/api/v1/status
   ```
2. Le seuil d'alerte n'est pas atteint (`ALERT_THRESHOLD`)
3. L'option `--no-alerts` n'est pas activée

### Logs de debug

Activer le mode verbose pour plus de détails :

```bash
./scripts/maintenance/check-health.sh --verbose 2>&1 | tee /tmp/health-debug.log
./scripts/maintenance/cleanup-logs.sh --verbose --dry-run 2>&1 | tee /tmp/cleanup-debug.log
```

---

## Voir aussi

- [Guide de déploiement](deployment.md)
- [Guide de configuration](configuration.md)
- [Troubleshooting](troubleshooting.md)
- [Backup et restauration](../admin/backup-restore.md)
