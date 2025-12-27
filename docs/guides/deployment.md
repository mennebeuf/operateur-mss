# Guide de Déploiement - Opérateur MSSanté

## Table des matières

1. [Prérequis au déploiement](#prérequis-au-déploiement)
2. [Environnements](#environnements)
3. [Checklist pré-déploiement](#checklist-pré-déploiement)
4. [Scripts de déploiement](#scripts-de-déploiement)
5. [Déploiement en environnement de test](#déploiement-en-environnement-de-test)
6. [Déploiement en production](#déploiement-en-production)
7. [Stratégies de déploiement](#stratégies-de-déploiement)
8. [Validation post-déploiement](#validation-post-déploiement)
9. [Rollback et récupération](#rollback-et-récupération)
10. [Monitoring continu](#monitoring-continu)
11. [Maintenance et mises à jour](#maintenance-et-mises-à-jour)

---

## Prérequis au déploiement

### 1. Validation technique

Avant tout déploiement, vérifier que :

- ✅ Tous les tests unitaires passent (>80% de couverture)
- ✅ Tests d'intégration validés
- ✅ Tests de charge effectués
- ✅ Audit de sécurité complété
- ✅ Documentation à jour
- ✅ Certificats IGC Santé installés et valides
- ✅ Sauvegardes configurées et testées

### 2. Validation ANS

Pour le déploiement en production :

- ✅ Validation ANS reçue (conformité Référentiel #1 v1.6.0)
- ✅ Certificats de production obtenus
- ✅ Domaine(s) MSSanté validé(s)
- ✅ Inscription sur la liste blanche des opérateurs
- ✅ Rapport de tests approuvé

### 3. Infrastructure

- ✅ Serveur(s) provisionné(s) et configuré(s)
- ✅ DNS correctement configuré
- ✅ Firewall configuré (ports ouverts)
- ✅ Certificats SSL/TLS installés
- ✅ Stockage suffisant (au moins 200 GB)
- ✅ Backups configurés
- ✅ Monitoring en place

---

## Environnements

### Architecture des environnements
```
┌─────────────────────────────────────────────────────┐
│                  DÉVELOPPEMENT                      │
│  - Tests unitaires                                  │
│  - Développement de fonctionnalités                │
│  - Certificats auto-signés                          │
│  URL: http://localhost:3000                         │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│                    STAGING                          │
│  - Tests d'intégration                              │
│  - Tests de charge                                  │
│  - Certificats IGC Santé TEST                       │
│  URL: https://staging.votre-domaine.mssante.fr     │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│               ENVIRONNEMENT TEST ANS                │
│  - Tests de conformité                              │
│  - Validation inter-opérateurs                      │
│  - Outil de test ANS                                │
│  URL: https://test-ans.votre-domaine.mssante.fr   │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│                   PRODUCTION                        │
│  - Service en conditions réelles                    │
│  - Certificats IGC Santé PRODUCTION                 │
│  - Monitoring 24/7                                  │
│  URL: https://votre-domaine.mssante.fr            │
└─────────────────────────────────────────────────────┘
```

### Configuration par environnement

| Paramètre | Développement | Staging | Test ANS | Production |
|-----------|---------------|---------|----------|------------|
| Certificats | Auto-signés | Test IGC | Test IGC | Prod IGC |
| Base de données | SQLite/Docker | PostgreSQL | PostgreSQL | PostgreSQL HA |
| Redis | Local | Single | Single | Cluster |
| Logs | Console | Fichiers | Centralisés | ELK Stack |
| Monitoring | Basique | Prometheus | Complet | Complet + Alertes |
| Backups | Non | Quotidien | Quotidien | Temps réel |
| SSL/TLS | HTTP | HTTPS | HTTPS | HTTPS |

---

## Checklist pré-déploiement

### Checklist technique
```bash
# 1. Vérifier la version
git describe --tags
# Attendu: v1.2.3

# 2. Tester la build
docker compose build
# Aucune erreur attendue

# 3. Vérifier les tests
npm test
# Tous les tests doivent passer

# 4. Vérifier les variables d'environnement
./scripts/check-env.sh
# Toutes les variables requises doivent être définies

# 5. Vérifier les certificats
openssl x509 -in config/certificates/server/server.crt -noout -dates
# Vérifier les dates de validité

# 6. Tester la connexion base de données
docker compose exec postgres psql -U mssante -c "SELECT 1"
# Résultat: 1

# 7. Vérifier l'espace disque
df -h
# Au moins 50 GB disponibles

# 8. Vérifier les ports
netstat -tulpn | grep -E ':(80|443|25|587|143)'
# Aucun conflit de ports
```

### Checklist sécurité

- [ ] Mots de passe forts générés pour tous les services
- [ ] Clés SSH configurées (pas de mot de passe root)
- [ ] Firewall activé et configuré
- [ ] Fail2ban installé et configuré
- [ ] TLS 1.2+ obligatoire (TLS 1.0/1.1 désactivés)
- [ ] Suites de chiffrement conformes ANSSI
- [ ] Certificats IGC Santé valides
- [ ] Pas de données sensibles dans les logs
- [ ] Audit de sécurité effectué
- [ ] Plan de réponse aux incidents documenté

### Checklist opérationnelle

- [ ] Documentation technique complète
- [ ] Runbooks de support créés
- [ ] Contacts d'escalade définis
- [ ] Backups testés et validés
- [ ] Monitoring configuré avec alertes
- [ ] Procédure de rollback testée
- [ ] Équipe de support prévenue
- [ ] Fenêtre de maintenance communiquée
- [ ] Plan de communication préparé

---

## Scripts de déploiement

> **À insérer après la section "Checklist pré-déploiement" et avant "Déploiement en environnement de test"**

Le projet fournit trois scripts de déploiement dans `scripts/deploy/` :

| Script | Description | Environnement |
|--------|-------------|---------------|
| `deploy.sh` | Déploiement générique | dev, staging, production |
| `deploy-production.sh` | Déploiement sécurisé avec backup | production |
| `rollback.sh` | Retour à une version antérieure | tous |

### Installation

```bash
# Rendre les scripts exécutables
chmod +x scripts/deploy/deploy.sh
chmod +x scripts/deploy/deploy-production.sh
chmod +x scripts/deploy/rollback.sh
```

---

### deploy.sh - Déploiement générique

Script polyvalent pour tous les environnements.

#### Usage

```bash
./scripts/deploy/deploy.sh [environnement]
```

#### Paramètres

| Paramètre | Description | Valeurs possibles | Défaut |
|-----------|-------------|-------------------|--------|
| `environnement` | Environnement cible | `dev`, `staging`, `production` | `dev` |

#### Exemples

```bash
# Déploiement développement
./scripts/deploy/deploy.sh dev

# Déploiement staging
./scripts/deploy/deploy.sh staging

# Déploiement production (préférer deploy-production.sh)
./scripts/deploy/deploy.sh production
```

#### Étapes exécutées

1. Validation de l'environnement
2. Vérifications préalables (Docker, Git, .env)
3. Pull du code (sauf en dev)
4. Build des images Docker
5. Arrêt des services actuels
6. Démarrage des nouveaux services
7. Exécution des migrations
8. Health checks
9. Tests de fumée
10. Nettoyage

#### Comportement par environnement

| Aspect | dev | staging | production |
|--------|-----|---------|------------|
| Git pull | Non | Oui | Oui |
| Build cache | Oui | Oui | Non |
| Vérif. commits | Non | Oui | Oui |

---

### deploy-production.sh - Déploiement production

Script sécurisé avec backup automatique et rollback en cas d'échec.

#### Usage

```bash
./scripts/deploy/deploy-production.sh
```

> ⚠️ **Ce script ne prend aucun paramètre** - il est exclusivement destiné à la production.

#### Prérequis

- `NODE_ENV=production` dans le fichier `.env`
- Certificats SSL valides (expiration > 7 jours)
- Espace disque disponible > 10 GB
- Aucun changement Git non commité

#### Sécurités intégrées

| Sécurité | Description |
|----------|-------------|
| **Confirmation** | Requiert de taper `DEPLOY` pour continuer |
| **Backup automatique** | PostgreSQL, Redis, configurations sauvegardés |
| **Mode maintenance** | Activé automatiquement pendant le déploiement |
| **Rollback automatique** | Déclenché en cas d'échec à n'importe quelle étape |
| **Vérification SSL** | Alerte si certificat expire dans < 30 jours |

#### Étapes détaillées

```
 1. Vérifications préalables
    ├── Permissions utilisateur
    ├── Fichier .env présent
    ├── NODE_ENV = production
    ├── Validité certificats SSL
    ├── Espace disque suffisant
    └── Pas de changements Git non commités

 2. Confirmation interactive (taper "DEPLOY")

 3. Backup pré-déploiement
    ├── PostgreSQL → database.sql.gz
    ├── Redis → redis.rdb
    └── Configurations → config.tar.gz

 4. Activation mode maintenance

 5. Arrêt des services (docker compose down)

 6. Mise à jour du code (git pull)

 7. Build des images (--no-cache)

 8. Démarrage des services

 9. Exécution des migrations

10. Tests de fumée
    ├── API health check
    ├── SMTP (port 587)
    ├── IMAP (port 143)
    ├── PostgreSQL
    └── Redis

11. Désactivation mode maintenance

12. Nettoyage et génération rapport
```

#### Structure des backups

Les backups sont créés dans `/backup/deployments/[YYYYMMDD_HHMMSS]/` :

```
/backup/deployments/20250315_143022/
├── database.sql.gz       # Dump PostgreSQL compressé
├── redis.rdb             # Snapshot Redis
├── config.tar.gz         # Fichiers de configuration
├── version.txt           # Tag ou commit de la version
├── git-commit.txt        # Hash complet du commit
└── deployment-info.json  # Métadonnées du déploiement
```

#### Format du rapport (deployment-info.json)

```json
{
  "version": "v1.2.3",
  "date": "2025-03-15T14:30:22+01:00",
  "deployed_by": "admin",
  "hostname": "prod-server-01",
  "git_commit": "a1b2c3d4e5f6g7h8i9j0",
  "git_branch": "main",
  "backup_path": "/backup/deployments/20250315_143022",
  "status": "success"
}
```

---

### rollback.sh - Retour version précédente

Script pour revenir rapidement à une version antérieure.

#### Usage

```bash
# Rollback vers la dernière version stable (tag précédent)
./scripts/deploy/rollback.sh

# Rollback vers une version spécifique
./scripts/deploy/rollback.sh v1.2.3

# Lister les backups disponibles
./scripts/deploy/rollback.sh --list

# Rollback d'un service spécifique uniquement
./scripts/deploy/rollback.sh --service api v1.2.3

# Rollback sans confirmation (automatisation)
./scripts/deploy/rollback.sh --force v1.2.3
```

#### Options

| Option | Description |
|--------|-------------|
| `-h, --help` | Afficher l'aide |
| `-l, --list` | Lister les backups disponibles |
| `-f, --force` | Ne pas demander de confirmation |
| `--service <nom>` | Rollback d'un seul service |

#### Exemple de sortie --list

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📦 BACKUPS DISPONIBLES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

DATE                 VERSION         TAILLE     STATUT
────────────────────────────────────────────────────────
20250315_143022      v1.2.3          245M       ✅ Complet
20250314_092015      v1.2.2          238M       ✅ Complet
20250310_161530      v1.2.1          230M       ✅ Complet
20250305_080000      v1.2.0          225M       ⚠️ Partiel

Dernières versions Git:
  • v1.2.3
  • v1.2.2
  • v1.2.1
```

#### Étapes du rollback complet

1. Confirmation (sauf si `--force`)
2. Recherche du backup correspondant à la version
3. Activation du mode maintenance
4. Arrêt des services
5. Restauration du code via `git checkout`
6. Restauration de la base de données (si backup disponible)
7. Restauration de Redis (si backup disponible)
8. Rebuild des images Docker
9. Redémarrage des services
10. Désactivation du mode maintenance
11. Tests de validation

#### Rollback automatique

Le script `deploy-production.sh` appelle automatiquement `rollback.sh` en cas d'échec :

```bash
# Variable d'environnement utilisée pour le rollback automatique
ROLLBACK_AUTO=true ./scripts/deploy/rollback.sh
```

Dans ce mode, aucune confirmation n'est demandée.

---

### Intégration avec le Makefile

Les scripts sont également accessibles via le Makefile :

```bash
# Déploiement développement
make deploy-dev

# Déploiement production
make deploy-prod

# Vérifier la santé des services
make health
```

---

### Variables d'environnement

Les scripts utilisent les variables suivantes :

| Variable | Description | Défaut |
|----------|-------------|--------|
| `BACKUP_DIR` | Répertoire des backups | `/backup/deployments` |
| `NODE_ENV` | Environnement d'exécution | - |
| `LOG_FILE` | Fichier de log du déploiement | `/var/log/mssante/deploy-*.log` |

---

### Logs de déploiement

Les logs sont disponibles dans :

```bash
# Logs de déploiement
/var/log/mssante/deploy-YYYYMMDD_HHMMSS.log

# Logs de rollback
/var/log/mssante/rollback-YYYYMMDD_HHMMSS.log

# Consulter le dernier déploiement
cat /var/log/mssante/deploy-*.log | tail -100
```

---

### Dépannage des scripts

#### Erreur : "NODE_ENV doit être 'production'"

```bash
# Vérifier la variable
grep NODE_ENV .env

# Corriger
sed -i 's/NODE_ENV=.*/NODE_ENV=production/' .env
```

#### Erreur : "Espace disque insuffisant"

```bash
# Vérifier l'espace
df -h

# Nettoyer Docker
docker system prune -a -f

# Supprimer anciens backups
find /backup/deployments -maxdepth 1 -type d -mtime +7 -exec rm -rf {} \;
```

#### Erreur : "Health check échoué"

```bash
# Vérifier les logs du service
docker compose logs api --tail 50

# Vérifier manuellement
curl -v http://localhost:3000/health

# Redémarrer le service
docker compose restart api
```

#### Le rollback automatique ne fonctionne pas

```bash
# Vérifier que le script est exécutable
ls -la scripts/deploy/rollback.sh

# Exécuter manuellement
./scripts/deploy/rollback.sh --list
./scripts/deploy/rollback.sh v1.2.2
```

---

## Déploiement en environnement de test

### 1. Préparation
```bash
# Cloner le dépôt
git clone https://github.com/votre-org/mssante-operator.git
cd mssante-operator

# Checkout de la version de test
git checkout staging

# Copier la configuration de staging
cp .env.staging .env
```

### 2. Configuration
```bash
# Éditer les variables d'environnement
nano .env
```

**Variables critiques pour staging:**
```bash
# Environnement
NODE_ENV=staging
DOMAIN=staging.votre-domaine.mssante.fr

# Base de données
POSTGRES_HOST=postgres-staging
POSTGRES_DB=mssante_staging
POSTGRES_PASSWORD=<mot-de-passe-staging>

# Certificats
SSL_CERT_PATH=/etc/ssl/igc-sante-test/cert.pem
SSL_KEY_PATH=/etc/ssl/igc-sante-test/key.pem

# Pro Santé Connect (environnement de test)
PSC_AUTH_URL=https://auth.bas.esw.esante.gouv.fr/auth/realms/esante-wallet-test/protocol/openid-connect/auth
PSC_TOKEN_URL=https://auth.bas.esw.esante.gouv.fr/auth/realms/esante-wallet-test/protocol/openid-connect/token

# Annuaire (environnement de test)
ANNUAIRE_API_URL=https://annuaire.test.mssante.fr/api/v1

# Monitoring
LOG_LEVEL=debug
ENABLE_DEBUG_LOGS=true
```

### 3. Déploiement
```bash
# Build des images
docker compose -f docker-compose.yml -f docker-compose.staging.yml build

# Démarrage des services
docker compose -f docker-compose.yml -f docker-compose.staging.yml up -d

# Vérifier les logs
docker compose logs -f
```

### 4. Initialisation
```bash
# Exécuter les migrations
docker compose exec api npm run migrate

# Créer le super admin
docker compose exec api npm run create-admin

# Importer les données de test (optionnel)
docker compose exec api npm run seed:staging
```

### 5. Validation
```bash
# Health check
curl https://staging.votre-domaine.mssante.fr/health

# Test SMTP
telnet mail.staging.votre-domaine.mssante.fr 587

# Test IMAP
openssl s_client -connect mail.staging.votre-domaine.mssante.fr:143 -starttls imap

# Test API
curl -X POST https://api.staging.votre-domaine.mssante.fr/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@staging.mssante.fr","password":"password"}'
```

---

## Déploiement en production

### 1. Préparation finale

#### Backup complet avant déploiement
```bash
# Script de backup pré-production
./scripts/backup/pre-production-backup.sh

# Vérifier le backup
ls -lh /backup/pre-prod/
```

#### Annonce de maintenance

**Email type:**
```
Objet: Maintenance programmée - Opérateur MSSanté

Chers utilisateurs,

Une maintenance de notre plateforme MSSanté est programmée pour :
- Date: Dimanche 15 Mars 2025
- Horaire: 02h00 - 06h00 (heure de Paris)
- Durée estimée: 4 heures
- Impact: Interruption complète du service

Cette maintenance permettra de déployer de nouvelles fonctionnalités et 
améliorations de sécurité.

Nous vous remercions de votre compréhension.

L'équipe MSSanté
```

### 2. Script de déploiement production

**Fichier: `scripts/deploy/deploy-production.sh`**
```bash
#!/bin/bash
set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
BACKUP_DIR="/backup/deployments"
DATE=$(date +%Y%m%d_%H%M%S)
VERSION=$(git describe --tags)

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 DÉPLOIEMENT PRODUCTION"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Version: $VERSION"
echo "Date: $(date)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 1. Vérifications préalables
echo "📋 1. Vérifications préalables..."

if [ ! -f ".env" ]; then
    echo "❌ Fichier .env manquant!"
    exit 1
fi

if [ "$NODE_ENV" != "production" ]; then
    echo "❌ NODE_ENV doit être 'production'!"
    exit 1
fi

# Vérifier les certificats
if ! openssl x509 -checkend 2592000 -noout -in config/certificates/server/server.crt; then
    echo "⚠️  ATTENTION: Le certificat expire dans moins de 30 jours!"
    read -p "Continuer quand même? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# 2. Backup de l'état actuel
echo "💾 2. Sauvegarde de l'état actuel..."
mkdir -p "$BACKUP_DIR/$DATE"

# Backup des configurations
tar -czf "$BACKUP_DIR/$DATE/config.tar.gz" .env config/

# Backup de la base de données
docker compose exec -T postgres pg_dump -U mssante mssante | \
    gzip > "$BACKUP_DIR/$DATE/database.sql.gz"

# Backup Redis
docker compose exec -T redis redis-cli SAVE
cp data/redis/dump.rdb "$BACKUP_DIR/$DATE/redis.rdb"

echo "✅ Backups créés dans $BACKUP_DIR/$DATE"

# 3. Pull des dernières modifications
echo "📥 3. Récupération du code..."
git fetch --all --tags
git checkout "$VERSION"

# 4. Build des nouvelles images
echo "🔨 4. Construction des images..."
docker compose -f docker-compose.yml -f docker-compose.prod.yml build --no-cache

# 5. Arrêt des services (mode maintenance)
echo "🛑 5. Activation du mode maintenance..."
docker compose exec -T api node scripts/enable-maintenance-mode.js

# Attendre que les connexions actives se terminent
echo "⏳ Attente de la fin des connexions actives (30s)..."
sleep 30

# Arrêt progressif
docker compose stop api frontend

# 6. Migrations de base de données
echo "🗄️  6. Exécution des migrations..."
docker compose run --rm api npm run migrate

# 7. Démarrage des nouveaux services
echo "▶️  7. Démarrage des nouveaux services..."
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# 8. Vérification de santé
echo "🏥 8. Vérification de santé..."
for i in {1..30}; do
    if curl -f http://localhost:3000/health > /dev/null 2>&1; then
        echo "✅ API opérationnelle"
        break
    fi
    echo "⏳ Attente de l'API... ($i/30)"
    sleep 2
done

# Vérifier tous les services
SERVICES=("postgres" "redis" "api" "frontend" "postfix" "dovecot")
for service in "${SERVICES[@]}"; do
    if docker compose ps "$service" | grep -q "Up"; then
        echo "✅ $service: OK"
    else
        echo "❌ $service: ERREUR"
        exit 1
    fi
done

# 9. Tests de fumée
echo "🧪 9. Tests de fumée..."

# Test API
if ! curl -f https://api.votre-domaine.mssante.fr/health; then
    echo "❌ API Health check échoué!"
    exit 1
fi

# Test SMTP
if ! timeout 5 bash -c "</dev/tcp/mail.votre-domaine.mssante.fr/587"; then
    echo "❌ SMTP non accessible!"
    exit 1
fi

# Test IMAP
if ! timeout 5 bash -c "</dev/tcp/mail.votre-domaine.mssante.fr/143"; then
    echo "❌ IMAP non accessible!"
    exit 1
fi

echo "✅ Tous les tests de fumée passent"

# 10. Désactivation du mode maintenance
echo "🎉 10. Désactivation du mode maintenance..."
docker compose exec -T api node scripts/disable-maintenance-mode.js

# 11. Nettoyage
echo "🧹 11. Nettoyage..."
docker image prune -f
docker volume prune -f

# 12. Rapport de déploiement
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ DÉPLOIEMENT RÉUSSI"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Version déployée: $VERSION"
echo "Date: $(date)"
echo "Backup: $BACKUP_DIR/$DATE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Créer un tag de déploiement
cat > "$BACKUP_DIR/$DATE/deployment-info.json" << EOF
{
  "version": "$VERSION",
  "date": "$(date -Iseconds)",
  "deployed_by": "$(whoami)",
  "hostname": "$(hostname)",
  "git_commit": "$(git rev-parse HEAD)"
}
EOF

echo "📄 Rapport sauvegardé: $BACKUP_DIR/$DATE/deployment-info.json"
```

### 3. Exécution du déploiement
```bash
# Rendre le script exécutable
chmod +x scripts/deploy/deploy-production.sh

# Exécuter le déploiement
./scripts/deploy/deploy-production.sh
```

---

## Stratégies de déploiement

### 1. Blue-Green Deployment

Déploiement sans interruption de service.
```bash
#!/bin/bash
# scripts/deploy/blue-green.sh

# Configuration
BLUE_COMPOSE="docker-compose.blue.yml"
GREEN_COMPOSE="docker-compose.green.yml"

# Déterminer l'environnement actif
if docker compose -f $BLUE_COMPOSE ps | grep -q "Up"; then
    ACTIVE="blue"
    INACTIVE="green"
    INACTIVE_COMPOSE=$GREEN_COMPOSE
else
    ACTIVE="green"
    INACTIVE="blue"
    INACTIVE_COMPOSE=$BLUE_COMPOSE
fi

echo "🔵 Environnement actif: $ACTIVE"
echo "🟢 Déploiement vers: $INACTIVE"

# 1. Déployer sur l'environnement inactif
echo "📦 Déploiement sur $INACTIVE..."
docker compose -f $INACTIVE_COMPOSE build
docker compose -f $INACTIVE_COMPOSE up -d

# 2. Attendre que les services soient prêts
echo "⏳ Attente du démarrage..."
for i in {1..30}; do
    if curl -f http://localhost:3001/health > /dev/null 2>&1; then
        echo "✅ $INACTIVE prêt"
        break
    fi
    sleep 2
done

# 3. Tests sur l'environnement inactif
echo "🧪 Tests sur $INACTIVE..."
./scripts/test/smoke-tests.sh localhost:3001

# 4. Basculement du trafic
echo "🔄 Basculement du trafic..."
# Modifier Traefik/HAProxy pour pointer vers le nouvel environnement
docker compose exec traefik \
    curl -X PUT http://localhost:8080/api/http/services/$INACTIVE/loadBalancer

# 5. Vérification
sleep 10
echo "🏥 Vérification du trafic..."
curl https://votre-domaine.mssante.fr/health

# 6. Arrêt de l'ancien environnement
echo "🛑 Arrêt de $ACTIVE..."
docker compose -f "${ACTIVE}_COMPOSE" down

echo "✅ Déploiement Blue-Green terminé"
```

### 2. Rolling Update

Mise à jour progressive service par service.
```bash
#!/bin/bash
# scripts/deploy/rolling-update.sh

SERVICES=("api" "frontend")

for service in "${SERVICES[@]}"; do
    echo "📦 Mise à jour de $service..."
    
    # Nombre d'instances
    REPLICAS=$(docker compose ps $service | grep -c "Up")
    
    # Mise à jour une instance à la fois
    for i in $(seq 1 $REPLICAS); do
        echo "🔄 Instance $i/$REPLICAS..."
        
        # Scale down
        docker compose scale $service=$((REPLICAS - 1))
        
        # Rebuild
        docker compose build $service
        
        # Scale up avec nouvelle version
        docker compose up -d --no-deps --scale $service=$REPLICAS $service
        
        # Attendre la santé
        sleep 10
        
        # Health check
        if ! curl -f http://localhost:3000/health; then
            echo "❌ Health check échoué pour $service"
            exit 1
        fi
    done
    
    echo "✅ $service mis à jour"
done
```

### 3. Canary Deployment

Déploiement progressif sur un sous-ensemble d'utilisateurs.
```yaml
# docker-compose.canary.yml
version: '3.8'

services:
  api-stable:
    build: ./services/api
    deploy:
      replicas: 9
      labels:
        - "traefik.http.services.api.loadbalancer.server.weight=90"
  
  api-canary:
    build: ./services/api
    environment:
      - VERSION=canary
    deploy:
      replicas: 1
      labels:
        - "traefik.http.services.api.loadbalancer.server.weight=10"
```

**Monitoring du canary:**
```bash
# Surveiller les métriques du canary
watch -n 5 'curl -s http://localhost:9090/api/v1/query?query=rate(http_requests_total{version="canary"}[5m])'

# Si OK, augmenter progressivement le trafic
docker compose scale api-canary=3  # 30%
docker compose scale api-canary=5  # 50%
docker compose scale api-canary=10 # 100%

# Supprimer l'ancienne version
docker compose scale api-stable=0
```

---

## Validation post-déploiement

### 1. Tests automatisés

**Script de validation:**
```bash
#!/bin/bash
# scripts/test/post-deployment-tests.sh

set -e

BASE_URL="https://votre-domaine.mssante.fr"
API_URL="https://api.votre-domaine.mssante.fr"

echo "🧪 Tests post-déploiement"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Test 1: Health checks
echo "🏥 Test 1: Health checks..."
curl -f "$API_URL/health" || exit 1
echo "✅ API Health OK"

curl -f "$BASE_URL" || exit 1
echo "✅ Frontend OK"

# Test 2: Base de données
echo "🗄️  Test 2: Base de données..."
docker compose exec -T postgres psql -U mssante -c "SELECT 1" || exit 1
echo "✅ PostgreSQL OK"

# Test 3: Redis
echo "💾 Test 3: Redis..."
docker compose exec -T redis redis-cli PING || exit 1
echo "✅ Redis OK"

# Test 4: SMTP
echo "📧 Test 4: SMTP..."
timeout 5 bash -c "</dev/tcp/mail.votre-domaine.mssante.fr/587" || exit 1
echo "✅ SMTP OK"

# Test 5: IMAP
echo "📬 Test 5: IMAP..."
timeout 5 bash -c "</dev/tcp/mail.votre-domaine.mssante.fr/143" || exit 1
echo "✅ IMAP OK"

# Test 6: Certificats SSL
echo "🔒 Test 6: Certificats SSL..."
echo | openssl s_client -connect votre-domaine.mssante.fr:443 -servername votre-domaine.mssante.fr 2>/dev/null | openssl x509 -noout -dates
echo "✅ Certificats OK"

# Test 7: Authentification
echo "🔐 Test 7: Authentification..."
TOKEN=$(curl -s -X POST "$API_URL/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@votre-domaine.mssante.fr","password":"'"$ADMIN_PASSWORD"'"}' \
  | jq -r '.data.token')

if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
    echo "❌ Authentification échouée"
    exit 1
fi
echo "✅ Authentification OK"

# Test 8: API endpoints
echo "📡 Test 8: API endpoints..."
curl -f -H "Authorization: Bearer $TOKEN" "$API_URL/api/v1/mailboxes" || exit 1
echo "✅ API endpoints OK"

# Test 9: Monitoring
echo "📊 Test 9: Monitoring..."
curl -f "http://localhost:9090/-/healthy" || exit 1
echo "✅ Prometheus OK"

curl -f "http://localhost:3001/api/health" || exit 1
echo "✅ Grafana OK"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Tous les tests passent"
```

### 2. Tests manuels

**Checklist de validation:**

- [ ] Connexion à l'interface web
- [ ] Création d'une BAL de test
- [ ] Envoi d'un email test
- [ ] Réception d'un email test
- [ ] Authentification PSC fonctionnelle
- [ ] Dashboard administrateur accessible
- [ ] Statistiques affichées correctement
- [ ] Logs disponibles et lisibles
- [ ] Alertes fonctionnelles
- [ ] Backups automatiques actifs

### 3. Tests de charge
```bash
# Test de charge avec k6
k6 run --vus 100 --duration 5m tests/load/api-load-test.js

# Test de charge SMTP
./tests/load/smtp-load-test.sh 1000
```

### 4. Rapport de déploiement

**Générer le rapport:**
```bash
#!/bin/bash
# scripts/deploy/generate-report.sh

REPORT_DIR="reports/deployments"
DATE=$(date +%Y%m%d_%H%M%S)
VERSION=$(git describe --tags)

mkdir -p "$REPORT_DIR"

cat > "$REPORT_DIR/deployment-$DATE.md" << EOF
# Rapport de Déploiement

## Informations générales

- **Date:** $(date)
- **Version:** $VERSION
- **Déployé par:** $(whoami)
- **Environnement:** Production

## Services déployés

$(docker compose ps --format table)

## Tests post-déploiement

$(./scripts/test/post-deployment-tests.sh)

## Métriques

### Performance API
- Temps de réponse moyen: $(curl -s localhost:9090/api/v1/query?query=rate(http_request_duration_seconds_sum[5m])/rate(http_request_duration_seconds_count[5m]) | jq -r '.data.result[0].value[1]')ms

### Utilisation ressources
- CPU: $(docker stats --no-stream --format "{{.CPUPerc}}" | head -1)
- RAM: $(docker stats --no-stream --format "{{.MemUsage}}" | head -1)

## Issues connues

- Aucune

## Actions de suivi

- [ ] Surveiller les logs pendant 24h
- [ ] Vérifier les métriques
- [ ] Valider avec les utilisateurs pilotes
EOF

echo "📄 Rapport généré: $REPORT_DIR/deployment-$DATE.md"
```

---

## Rollback et récupération

### 1. Procédure de rollback rapide
```bash
#!/bin/bash
# scripts/deploy/rollback.sh

set -e

echo "⚠️  ROLLBACK EN COURS"

# 1. Identifier la dernière version stable
LAST_STABLE=$(git describe --tags --abbrev=0 HEAD^)
echo "📌 Dernière version stable: $LAST_STABLE"

# 2. Confirmation
read -p "Confirmer le rollback vers $LAST_STABLE? (yes/NO) " -r
if [ "$REPLY" != "yes" ]; then
    echo "❌ Rollback annulé"
    exit 1
fi

# 3. Activer le mode maintenance
echo "🛑 Activation du mode maintenance..."
docker compose exec -T api node scripts/enable-maintenance-mode.js

# 4. Arrêter les services actuels
echo "🛑 Arrêt des services..."
docker compose down

# 5. Restaurer le code
echo "📥 Restauration du code..."
git checkout "$LAST_STABLE"

# 6. Restaurer la base de données
echo "🗄️  Restauration de la base de données..."
LAST_BACKUP=$(ls -t /backup/deployments/*/database.sql.gz | head -1)
gunzip -c "$LAST_BACKUP" | docker compose exec -T postgres psql -U mssante mssante

# 7. Rebuild et restart
echo "🔨 Rebuild..."
docker compose build

echo "▶️  Redémarrage..."
docker compose up -d

# 8. Attendre le démarrage
echo "⏳ Attente du démarrage..."
for i in {1..30}; do
    if curl -f http://localhost:3000/health > /dev/null 2>&1; then
        break
    fi
    sleep 2
done

# 9. Désactiver le mode maintenance
echo "✅ Désactivation du mode maintenance..."
docker compose exec -T api node scripts/disable-maintenance-mode.js

# 10. Validation
echo "🧪 Validation..."
./scripts/test/post-deployment-tests.sh

echo "✅ Rollback terminé vers $LAST_STABLE"
```

### 2. Rollback partiel (service spécifique)
```bash
#!/bin/bash
# scripts/deploy/rollback-service.sh

SERVICE=$1
VERSION=$2

if [ -z "$SERVICE" ] || [ -z "$VERSION" ]; then
    echo "Usage: $0 <service> <version>"
    exit 1
fi

echo "🔄 Rollback de $SERVICE vers $VERSION"

# Arrêter le service
docker compose stop "$SERVICE"

# Checkout de la version
git checkout "$VERSION" -- "services/$SERVICE"

# Rebuild
docker compose build "$SERVICE"

# Restart
docker compose up -d "$SERVICE"

echo "✅ Rollback de $SERVICE terminé"
```

### 3. Plan de récupération d'urgence

**En cas de panne critique:**
```bash
#!/bin/bash
# scripts/disaster-recovery.sh

echo "🚨 PLAN DE RÉCUPÉRATION D'URGENCE"

# 1. Arrêter tous les services
docker compose down

# 2. Restaurer depuis le dernier backup
BACKUP_DATE="20250315_020000"  # À adapter
BACKUP_DIR="/backup/deployments/$BACKUP_DATE"

# 3. Restaurer les configurations
tar -xzf "$BACKUP_DIR/config.tar.gz"

# 4. Restaurer la base de données
gunzip -c "$BACKUP_DIR/database.sql.gz" | \
    docker compose exec -T postgres psql -U mssante mssante

# 5. Restaurer Redis
cp "$BACKUP_DIR/redis.rdb" data/redis/dump.rdb

# 6. Redémarrer
docker compose up -d

echo "✅ Récupération terminée"
```

---

## Monitoring continu

### 1. Tableaux de bord Grafana

**Dashboards critiques:**

1. **Vue d'ensemble système**
   - CPU, RAM, Disque
   - Nombre de services up/down
   - Alertes actives

2. **Performance applicative**
   - Temps de réponse API
   - Throughput (req/s)
   - Taux d'erreur

3. **Services mail**
   - Messages envoyés/reçus
   - Queue size
   - Taux de delivery

4. **Base de données**
   - Connexions actives
   - Temps de requête
   - Taille de la base

### 2. Alertes critiques

**Configuration AlertManager:**
```yaml
# config/prometheus/alertmanager.yml
global:
  resolve_timeout: 5m

route:
  group_by: ['alertname', 'severity']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 12h
  receiver: 'team-mssante'
  
  routes:
    - match:
        severity: critical
      receiver: 'pagerduty'
      continue: true
    
    - match:
        severity: warning
      receiver: 'slack'

receivers:
  - name: 'team-mssante'
    email_configs:
      - to: 'ops@votre-domaine.fr'
        from: 'alerting@votre-domaine.fr'
        smarthost: 'smtp.votre-domaine.fr:587'
  
  - name: 'pagerduty'
    pagerduty_configs:
      - service_key: '<your-pagerduty-key>'
  
  - name: 'slack'
    slack_configs:
      - api_url: '<your-slack-webhook>'
        channel: '#mssante-alerts'
```

### 3. Health checks automatiques
```bash
#!/bin/bash
# scripts/monitoring/health-check.sh

# Exécuté toutes les 5 minutes via cron

STATUS_FILE="/var/log/mssante/health-status.json"
ALERT_THRESHOLD=3

check_service() {
    local service=$1
    local url=$2
    
    if curl -f -s --max-time 5 "$url" > /dev/null; then
        echo "$service: OK"
        return 0
    else
        echo "$service: ERREUR"
        return 1
    fi
}

# Vérifications
ERRORS=0

check_service "API" "http://localhost:3000/health" || ((ERRORS++))
check_service "Frontend" "http://localhost:80" || ((ERRORS++))
check_service "SMTP" "telnet://localhost:587" || ((ERRORS++))
check_service "IMAP" "telnet://localhost:143" || ((ERRORS++))

# Enregistrer le statut
cat > "$STATUS_FILE" << EOF
{
  "timestamp": "$(date -Iseconds)",
  "errors": $ERRORS,
  "status": "$([ $ERRORS -eq 0 ] && echo 'healthy' || echo 'degraded')"
}
EOF

# Alerter si nécessaire
if [ $ERRORS -ge $ALERT_THRESHOLD ]; then
    echo "⚠️ $ERRORS services en erreur - Alerte envoyée"
    curl -X POST http://alertmanager:9093/api/v1/alerts \
        -d "[{\"labels\":{\"alertname\":\"ServiceDown\",\"severity\":\"critical\"}}]"
fi
```

---

## Maintenance et mises à jour

### 1. Fenêtre de maintenance

**Planification:**

- **Fréquence:** Mensuelle (1er dimanche du mois)
- **Horaire:** 02h00 - 06h00 (faible trafic)
- **Durée:** Maximum 4 heures
- **Communication:** 7 jours à l'avance

**Checklist de maintenance:**
```bash
#!/bin/bash
# scripts/maintenance/monthly-maintenance.sh

echo "🔧 MAINTENANCE MENSUELLE"

# 1. Mises à jour de sécurité
echo "🔒 Mises à jour de sécurité..."
apt update && apt upgrade -y

# 2. Rotation des logs
echo "📜 Rotation des logs..."
logrotate -f /etc/logrotate.d/mssante

# 3. Nettoyage Docker
echo "🧹 Nettoyage Docker..."
docker system prune -f
docker volume prune -f

# 4. Optimisation PostgreSQL
echo "🗄️  Optimisation PostgreSQL..."
docker compose exec postgres vacuumdb -U mssante -d mssante --analyze --verbose

# 5. Vérification des certificats
echo "🔐 Vérification des certificats..."
./scripts/certificates/check-expiry.sh

# 6. Test des backups
echo "💾 Test des backups..."
./scripts/backup/test-restore.sh

# 7. Mise à jour des dépendances
echo "📦 Mise à jour des dépendances..."
cd services/api && npm audit fix
cd ../frontend && npm audit fix

# 8. Rapport
echo "📊 Génération du rapport..."
./scripts/monitoring/generate-monthly-report.sh

echo "✅ Maintenance terminée"
```

### 2. Mise à jour des certificats
```bash
#!/bin/bash
# scripts/certificates/renew-cert.sh

DOMAIN=$1

if [ -z "$DOMAIN" ]; then
    echo "Usage: $0 <domain>"
    exit 1
fi

echo "🔐 Renouvellement du certificat pour $DOMAIN"

# 1. Commander le nouveau certificat auprès de l'IGC Santé
echo "📝 Commande du certificat..."
# (Processus spécifique à votre AC IGC Santé)

# 2. Sauvegarder l'ancien certificat
echo "💾 Sauvegarde de l'ancien certificat..."
cp "config/certificates/domains/$DOMAIN/cert.pem" \
   "config/certificates/domains/$DOMAIN/cert.pem.bak.$(date +%Y%m%d)"

# 3. Installer le nouveau certificat
echo "📥 Installation du nouveau certificat..."
cp "/path/to/new/cert.pem" "config/certificates/domains/$DOMAIN/cert.pem"
cp "/path/to/new/key.pem" "config/certificates/domains/$DOMAIN/key.pem"

# 4. Vérifier le certificat
echo "✅ Vérification..."
openssl x509 -in "config/certificates/domains/$DOMAIN/cert.pem" -text -noout

# 5. Recharger les services
echo "🔄 Rechargement des services..."
docker compose exec postfix postfix reload
docker compose exec dovecot doveadm reload
docker compose restart traefik

echo "✅ Certificat renouvelé pour $DOMAIN"
```

### 3. Monitoring des performances

**Rapport hebdomadaire automatique:**
```bash
#!/bin/bash
# scripts/monitoring/weekly-report.sh

REPORT_FILE="reports/weekly-$(date +%Y%W).md"

cat > "$REPORT_FILE" << EOF
# Rapport Hebdomadaire - Semaine $(date +%W/%Y)

## Disponibilité

- Uptime global: $(uptime -p)
- Incidents: $(grep -c "ERROR" /var/log/mssante/*.log || echo 0)
- Maintenances: 0

## Performance

### API
- Temps de réponse moyen: $(query_prometheus 'avg(http_request_duration_seconds)')ms
- Requêtes/seconde: $(query_prometheus 'rate(http_requests_total[7d])')
- Taux d'erreur: $(query_prometheus 'rate(http_requests_total{status=~"5.."}[7d])')%

### Mail
- Messages envoyés: $(query_prometheus 'increase(postfix_sent_total[7d])')
- Messages reçus: $(query_prometheus 'increase(postfix_received_total[7d])')
- Bounce rate: $(query_prometheus 'rate(postfix_bounced_total[7d])')%

## Ressources

- CPU moyen: $(query_prometheus 'avg(node_cpu_usage[7d])')%
- RAM utilisée: $(query_prometheus 'avg(node_memory_usage[7d])')%
- Disque utilisé: $(query_prometheus 'node_filesystem_usage')%

## Actions requises

- [ ] Aucune

---
Généré le $(date)
EOF

echo "📊 Rapport généré: $REPORT_FILE"

# Envoyer par email
mail -s "Rapport Hebdomadaire MSSanté" ops@votre-domaine.fr < "$REPORT_FILE"
```

---

## Conclusion

Ce guide de déploiement fournit toutes les procédures nécessaires pour déployer et maintenir votre plateforme MSSanté en production de manière sûre et contrôlée.

**Points clés à retenir:**

1. ✅ Toujours faire un backup complet avant déploiement
2. ✅ Tester en staging avant la production
3. ✅ Avoir une procédure de rollback testée
4. ✅ Monitorer activement pendant et après le déploiement
5. ✅ Communiquer avec les utilisateurs
6. ✅ Documenter chaque déploiement

**Ressources complémentaires:**

- [Guide d'installation](installation.md)
- [Guide de configuration](configuration.md)
- [Guide de troubleshooting](troubleshooting.md)
- [Documentation API](../api/swagger.yaml)

**Support:**

En cas de problème pendant un déploiement, contactez:
- Email: ops@votre-domaine.fr
- Slack: #mssante-ops
- Téléphone d'astreinte: +33 X XX XX XX XX

---

## Historique des modifications

| Date       | Version    | Auteur            | Description       |
|------------|------------|-------------------|-------------------|
| 2025-12-28 | 1.0.0      | Antoine MENNEBEUF | Création initiale |
