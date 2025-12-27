# Guide d'Installation - Opérateur MSSanté

## Table des matières

1. [Prérequis](#prérequis)
2. [Préparation de l'environnement](#préparation-de-lenvironnement)
3. [Installation des dépendances](#installation-des-dépendances)
4. [Configuration initiale](#configuration-initiale)
5. [Déploiement avec Docker](#déploiement-avec-docker)
6. [Configuration des services](#configuration-des-services)
7. [Vérification de l'installation](#vérification-de-linstallation)
8. [Dépannage](#dépannage)

---

## Prérequis

### Matériel recommandé

#### Environnement de développement
- **CPU:** 4 cores minimum
- **RAM:** 8 GB minimum
- **Disque:** 50 GB SSD
- **Réseau:** 10 Mbps

#### Environnement de production
- **CPU:** 8+ cores (16 recommandé)
- **RAM:** 16+ GB (32 GB recommandé)
- **Disque:** 200+ GB SSD (RAID 10 recommandé)
- **Réseau:** 100+ Mbps (1 Gbps recommandé)
- **Backup:** Solution de sauvegarde automatisée

### Système d'exploitation

**Systèmes supportés:**
- Ubuntu Server 22.04 LTS (recommandé)
- Debian 12
- Rocky Linux 9
- CentOS Stream 9

**Configuration minimale:**
- Kernel Linux 5.15+
- Système à jour (security patches)

### Logiciels requis

| Logiciel | Version minimale | Vérification |
|----------|------------------|--------------|
| Docker | 24.0+ | `docker --version` |
| Docker Compose | 2.20+ | `docker compose version` |
| Git | 2.30+ | `git --version` |
| curl | 7.68+ | `curl --version` |
| openssl | 1.1.1+ | `openssl version` |

### Accès et certificats

**Requis avant installation:**

- ✅ Contrat opérateur signé avec l'ANS
- ✅ Numéro FINESS Juridique de votre structure
- ✅ Domaine(s) `*.mssante.fr` validé(s) par l'ANS
- ✅ Accès à Pro Santé Connect (PSC)
- ✅ Certificats IGC Santé (test ou production)

**À préparer:**

- Client ID et Client Secret PSC
- Clés d'API Annuaire National Santé
- Identifiant opérateur ANS

---

## Préparation de l'environnement

### 1. Mise à jour du système
```bash
# Ubuntu/Debian
sudo apt update && sudo apt upgrade -y

# Rocky/CentOS
sudo dnf update -y

# Redémarrage si kernel mis à jour
sudo reboot
```

### 2. Installation de Docker

**Méthode recommandée (script officiel):**
```bash
# Téléchargement et installation
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Ajout de l'utilisateur au groupe docker
sudo usermod -aG docker $USER

# Appliquer le nouveau groupe (ou se reconnecter)
newgrp docker

# Vérification
docker --version
docker compose version
```

**Alternative Ubuntu/Debian:**
```bash
# Installation via apt
sudo apt install -y docker.io docker-compose-plugin

# Configuration du service
sudo systemctl enable docker
sudo systemctl start docker
```

### 3. Configuration du firewall
```bash
# Installation ufw (Ubuntu/Debian)
sudo apt install -y ufw

# Règles de base
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Ports à ouvrir
sudo ufw allow 22/tcp        # SSH
sudo ufw allow 80/tcp        # HTTP
sudo ufw allow 443/tcp       # HTTPS
sudo ufw allow 25/tcp        # SMTP
sudo ufw allow 587/tcp       # SMTP Submission
sudo ufw allow 143/tcp       # IMAP

# Activation
sudo ufw enable

# Vérification
sudo ufw status verbose
```

### 4. Configuration DNS

Avant de continuer, assurez-vous que vos enregistrements DNS sont configurés :
```bash
# Exemple d'enregistrements nécessaires
# (Remplacer YOUR_IP et votre-domaine.mssante.fr)

# A Records
votre-domaine.mssante.fr.         A      YOUR_IP
mail.votre-domaine.mssante.fr.    A      YOUR_IP
api.votre-domaine.mssante.fr.     A      YOUR_IP
grafana.votre-domaine.mssante.fr. A      YOUR_IP

# MX Record
votre-domaine.mssante.fr.  MX  10  mail.votre-domaine.mssante.fr.

# SPF Record
votre-domaine.mssante.fr.  TXT  "v=spf1 mx -all"

# DKIM (à configurer après installation)
default._domainkey.votre-domaine.mssante.fr.  TXT  "v=DKIM1;k=rsa;p=..."
```

**Vérification DNS:**
```bash
# Vérifier les enregistrements A
dig votre-domaine.mssante.fr +short
dig mail.votre-domaine.mssante.fr +short

# Vérifier le MX
dig votre-domaine.mssante.fr MX +short

# Vérifier le SPF
dig votre-domaine.mssante.fr TXT +short
```

---

## Installation des dépendances

### 1. Cloner le dépôt
```bash
# Créer le répertoire de travail
mkdir -p ~/mssante-operator
cd ~/mssante-operator

# Cloner le projet
git clone https://github.com/votre-org/mssante-operator.git .

# Vérifier la structure
ls -la
```

### 2. Créer la structure des répertoires
```bash
# Création des répertoires de données
mkdir -p data/{postgres,redis,mail,logs,backups,prometheus,grafana}

# Création des répertoires de configuration
mkdir -p config/certificates/{igc-sante,server,domains}

# Permissions appropriées
chmod -R 755 data/
chmod 700 config/certificates/

# Vérification
tree -L 2 data/
tree -L 2 config/
```

### 3. Installation des outils complémentaires
```bash
# Ubuntu/Debian
sudo apt install -y \
    make \
    postgresql-client \
    redis-tools \
    curl \
    jq \
    vim \
    htop \
    net-tools

# Rocky/CentOS
sudo dnf install -y \
    make \
    postgresql \
    redis \
    curl \
    jq \
    vim \
    htop \
    net-tools
```

---

## Configuration initiale

### 1. Variables d'environnement

**Copier le fichier d'exemple:**
```bash
cp .env.example .env
```

**Éditer `.env` avec vos valeurs:**
```bash
nano .env
```

**Configuration minimale requise:**
```bash
# ===========================================
# DOMAINE PRINCIPAL
# ===========================================
DOMAIN=votre-operateur.mssante.fr

# ===========================================
# BASE DE DONNÉES POSTGRESQL
# ===========================================
POSTGRES_DB=mssante
POSTGRES_USER=mssante
POSTGRES_PASSWORD=ChangezCeMotDePasse123!
POSTGRES_HOST=postgres
POSTGRES_PORT=5432

# ===========================================
# REDIS
# ===========================================
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=ChangezCeMotDePasseRedis456!

# ===========================================
# JWT & SESSIONS
# ===========================================
JWT_SECRET=VotreCleSecretJWTTresLongueEtComplexe789!
JWT_EXPIRES_IN=3600
REFRESH_TOKEN_EXPIRES_IN=604800

# ===========================================
# PRO SANTÉ CONNECT
# ===========================================
PSC_CLIENT_ID=votre_client_id_psc
PSC_CLIENT_SECRET=votre_client_secret_psc
PSC_REDIRECT_URI=https://votre-operateur.mssante.fr/auth/psc/callback
PSC_AUTH_URL=https://auth.esw.esante.gouv.fr/auth/realms/esante-wallet/protocol/openid-connect/auth
PSC_TOKEN_URL=https://auth.esw.esante.gouv.fr/auth/realms/esante-wallet/protocol/openid-connect/token
PSC_USERINFO_URL=https://auth.esw.esante.gouv.fr/auth/realms/esante-wallet/protocol/openid-connect/userinfo

# ===========================================
# ANS - OPÉRATEUR
# ===========================================
OPERATOR_ID=VOTRE_ID_OPERATEUR_ANS
ANNUAIRE_API_URL=https://annuaire.sante.fr/api/v1
ANNUAIRE_API_KEY=votre_cle_api_annuaire

# ===========================================
# SMTP/IMAP CONFIGURATION
# ===========================================
SMTP_HOST=postfix
SMTP_PORT=587
IMAP_HOST=dovecot
IMAP_PORT=143

# ===========================================
# EMAIL SETTINGS
# ===========================================
DEFAULT_FROM_EMAIL=noreply@votre-operateur.mssante.fr
ADMIN_EMAIL=admin@votre-operateur.mssante.fr

# ===========================================
# MONITORING
# ===========================================
GRAFANA_ADMIN_PASSWORD=ChangezCeMotDePasseGrafana!
PROMETHEUS_RETENTION=15d

# ===========================================
# ENVIRONNEMENT
# ===========================================
NODE_ENV=production
LOG_LEVEL=info
```

**Sécuriser le fichier:**
```bash
chmod 600 .env
```

### 2. Configuration des services

#### API Backend
```bash
# Copier le fichier d'exemple
cp services/api/.env.example services/api/.env.production

# Éditer avec les valeurs de production
nano services/api/.env.production
```

#### Frontend
```bash
# Copier le fichier d'exemple
cp services/frontend/.env.example services/frontend/.env.production

# Contenu minimal
cat > services/frontend/.env.production << EOF
REACT_APP_API_URL=https://api.${DOMAIN}
REACT_APP_PSC_CLIENT_ID=${PSC_CLIENT_ID}
REACT_APP_ENV=production
EOF
```

### 3. Installation des certificats IGC Santé

**Structure attendue:**
```
config/certificates/
├── igc-sante/
│   ├── ca-bundle.pem          # Chaîne de certification IGC
│   ├── ac-igc-sante.pem       # AC racine
│   └── igc-serveurs.pem       # AC intermédiaire
└── server/
    ├── server.crt             # Certificat du serveur
    ├── server.key             # Clé privée
    └── fullchain.pem          # Certificat + chaîne
```

**Installation:**
```bash
# Copier vos certificats IGC Santé
cp /chemin/vers/ca-bundle.pem config/certificates/igc-sante/

# Copier le certificat de votre serveur
cp /chemin/vers/votre-cert.crt config/certificates/server/server.crt
cp /chemin/vers/votre-cert.key config/certificates/server/server.key

# Créer le fullchain si nécessaire
cat config/certificates/server/server.crt \
    config/certificates/igc-sante/ca-bundle.pem \
    > config/certificates/server/fullchain.pem

# Permissions strictes sur les clés privées
chmod 600 config/certificates/server/server.key
chmod 644 config/certificates/server/server.crt

# Vérifier les certificats
openssl x509 -in config/certificates/server/server.crt -text -noout
openssl rsa -in config/certificates/server/server.key -check
```

---

## Déploiement avec Docker

### 1. Construction des images
```bash
# Construire toutes les images
docker compose build --no-cache

# Ou construire un service spécifique
docker compose build api
docker compose build frontend
```

### 2. Initialisation de la base de données

**Démarrer PostgreSQL seul:**
```bash
docker compose up -d postgres

# Attendre que PostgreSQL soit prêt
docker compose exec postgres pg_isready -U mssante
```

**Exécuter les migrations:**
```bash
# Script d'initialisation
./scripts/init-db.sh

# Ou manuellement
docker compose exec postgres psql -U mssante -d mssante -f /docker-entrypoint-initdb.d/001_schema.sql
docker compose exec postgres psql -U mssante -d mssante -f /docker-entrypoint-initdb.d/002_roles_permissions.sql
```

**Vérifier la base:**
```bash
# Se connecter à PostgreSQL
docker compose exec postgres psql -U mssante -d mssante

# Vérifier les tables
\dt

# Quitter
\q
```

### 3. Démarrage de tous les services

**Avec Make (recommandé):**
```bash
make start
```

**Avec Docker Compose:**
```bash
docker compose up -d
```

**Vérifier le démarrage:**
```bash
# Voir les conteneurs en cours
docker compose ps

# Voir les logs en temps réel
docker compose logs -f

# Logs d'un service spécifique
docker compose logs -f api
docker compose logs -f postfix
```

### 4. Vérification de la santé des services
```bash
# Statut des conteneurs
docker compose ps

# État de santé des services
docker compose exec api curl -f http://localhost:3000/health || echo "API KO"
docker compose exec postgres pg_isready -U mssante || echo "PostgreSQL KO"
docker compose exec redis redis-cli ping || echo "Redis KO"

# Statistiques ressources
docker stats --no-stream
```

---

## Configuration des services

### 1. Configuration Postfix (SMTP)

**Vérifier la configuration:**
```bash
# Entrer dans le conteneur
docker compose exec postfix sh

# Vérifier la configuration
postconf -n

# Tester la connexion
telnet localhost 25
```

**Test d'envoi de mail:**
```bash
docker compose exec postfix sh -c '
echo "Subject: Test
Test message" | sendmail -v destinataire@example.com
'
```

### 2. Configuration Dovecot (IMAP)

**Vérifier la configuration:**
```bash
# Entrer dans le conteneur
docker compose exec dovecot sh

# Vérifier la configuration
doveconf -n

# Tester IMAP
openssl s_client -connect localhost:143 -starttls imap
```

### 3. Configuration Traefik

**Vérifier le dashboard:**
```bash
# Accéder au dashboard
# http://localhost:8080

# Ou via curl
curl http://localhost:8080/api/http/routers
```

### 4. Création du super administrateur
```bash
# Via l'API
curl -X POST https://api.votre-domaine.mssante.fr/api/v1/setup/admin \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@votre-domaine.mssante.fr",
    "password": "VotreMotDePasseSecurise123!",
    "firstName": "Admin",
    "lastName": "System"
  }'

# Ou via script SQL
docker compose exec postgres psql -U mssante -d mssante << EOF
INSERT INTO users (email, first_name, last_name, is_super_admin, status)
VALUES ('admin@votre-domaine.mssante.fr', 'Admin', 'System', true, 'active');
EOF
```

---

## Vérification de l'installation

### 1. Tests de connectivité

**API Backend:**
```bash
# Health check
curl https://api.votre-domaine.mssante.fr/health

# Réponse attendue
{
  "status": "healthy",
  "timestamp": "2024-03-20T10:30:00Z",
  "services": {
    "database": "up",
    "redis": "up",
    "smtp": "up",
    "imap": "up"
  }
}
```

**Frontend:**
```bash
# Vérifier l'accès
curl -I https://votre-domaine.mssante.fr

# Réponse attendue: HTTP/1.1 200 OK
```

**SMTP:**
```bash
# Test de connexion
telnet mail.votre-domaine.mssante.fr 587

# Test STARTTLS
openssl s_client -connect mail.votre-domaine.mssante.fr:587 -starttls smtp

# Vérifier le certificat
echo | openssl s_client -connect mail.votre-domaine.mssante.fr:587 -starttls smtp 2>/dev/null | openssl x509 -noout -subject -issuer -dates
```

**IMAP:**
```bash
# Test de connexion
telnet mail.votre-domaine.mssante.fr 143

# Test STARTTLS
openssl s_client -connect mail.votre-domaine.mssante.fr:143 -starttls imap
```

### 2. Tests fonctionnels

**Connexion à l'interface:**

1. Ouvrir https://votre-domaine.mssante.fr
2. Se connecter avec le compte admin créé
3. Vérifier l'accès au dashboard

**Création d'une BAL de test:**
```bash
curl -X POST https://api.votre-domaine.mssante.fr/api/v1/mailboxes \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "personal",
    "email": "test@votre-domaine.mssante.fr",
    "owner": {
      "rpps": "10001234567",
      "firstName": "Test",
      "lastName": "User"
    }
  }'
```

### 3. Monitoring

**Accès Grafana:**
```bash
# URL: https://grafana.votre-domaine.mssante.fr
# Login: admin
# Password: voir GRAFANA_ADMIN_PASSWORD dans .env
```

**Accès Prometheus:**
```bash
# Metrics API
curl http://localhost:9090/api/v1/query?query=up

# Targets
curl http://localhost:9090/api/v1/targets
```

### 4. Logs
```bash
# Voir tous les logs
docker compose logs

# Logs en temps réel
docker compose logs -f

# Logs d'un service spécifique
docker compose logs -f api
docker compose logs -f postfix
docker compose logs -f dovecot

# Dernières 100 lignes
docker compose logs --tail=100 api

# Logs dans les fichiers
tail -f data/logs/api/app.log
tail -f data/logs/postfix/mail.log
```

---

## Dépannage

### Problèmes courants

#### 1. Les conteneurs ne démarrent pas
```bash
# Vérifier les logs
docker compose logs

# Vérifier les erreurs de configuration
docker compose config

# Redémarrer les services
docker compose restart

# Rebuild si nécessaire
docker compose up -d --build
```

#### 2. Erreur de connexion PostgreSQL
```bash
# Vérifier que PostgreSQL est démarré
docker compose ps postgres

# Vérifier les logs
docker compose logs postgres

# Tester la connexion
docker compose exec postgres pg_isready -U mssante

# Se connecter manuellement
docker compose exec postgres psql -U mssante -d mssante
```

#### 3. Erreur de connexion Redis
```bash
# Vérifier Redis
docker compose ps redis

# Tester la connexion
docker compose exec redis redis-cli ping

# Avec mot de passe
docker compose exec redis redis-cli -a ${REDIS_PASSWORD} ping
```

#### 4. Problème de certificats
```bash
# Vérifier les certificats
openssl x509 -in config/certificates/server/server.crt -text -noout

# Vérifier la clé privée
openssl rsa -in config/certificates/server/server.key -check

# Vérifier que cert et key correspondent
openssl x509 -noout -modulus -in config/certificates/server/server.crt | openssl md5
openssl rsa -noout -modulus -in config/certificates/server/server.key | openssl md5
# Les deux hash doivent être identiques
```

#### 5. Problème de permissions
```bash
# Vérifier les permissions des données
ls -la data/

# Corriger les permissions si nécessaire
sudo chown -R 1000:1000 data/
chmod -R 755 data/

# Permissions des certificats
chmod 644 config/certificates/server/server.crt
chmod 600 config/certificates/server/server.key
```

#### 6. Port déjà utilisé
```bash
# Vérifier les ports en écoute
sudo netstat -tulpn | grep LISTEN

# Ou avec ss
sudo ss -tulpn

# Libérer un port si nécessaire
sudo kill -9 $(sudo lsof -t -i:80)
```

### Commandes utiles

**Redémarrage complet:**
```bash
# Arrêter tout
docker compose down

# Supprimer les volumes (ATTENTION: perte de données)
docker compose down -v

# Rebuild et restart
docker compose up -d --build
```

**Nettoyage Docker:**
```bash
# Supprimer les images inutilisées
docker image prune -a

# Supprimer les volumes inutilisés
docker volume prune

# Nettoyage complet
docker system prune -a --volumes
```

**Sauvegarde rapide:**
```bash
# Backup manuel
./scripts/backup.sh

# Restauration
./scripts/restore.sh backup_20240320_103000.tar.gz
```

### Support

Si vous rencontrez des problèmes non résolus :

1. Consultez les logs détaillés
2. Vérifiez la [documentation complète](../README.md)
3. Consultez le [guide de troubleshooting](troubleshooting.md)
4. Ouvrez une issue sur GitHub
5. Contactez le support ANS si problème MSSanté

---

## Prochaines étapes

Après l'installation réussie :

1. ✅ Configurer les domaines supplémentaires
2. ✅ Configurer DKIM/SPF/DMARC
3. ✅ Créer les BAL de test
4. ✅ Tests d'interopérabilité avec autres opérateurs
5. ✅ Configuration des backups automatiques
6. ✅ Configuration de la surveillance
7. ✅ Validation ANS en environnement de test
8. ✅ Migration vers la production

Consultez le [guide de configuration](configuration.md) pour les étapes suivantes.