# 🏥 Opérateur MSSanté - Plateforme de Messagerie Sécurisée de Santé

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D%2020.0.0-brightgreen)](https://nodejs.org)
[![React Version](https://img.shields.io/badge/react-18.2.0-blue)](https://reactjs.org)
[![Docker](https://img.shields.io/badge/docker-required-blue)](https://docker.com)

> Plateforme complète d'opérateur MSSanté conforme au Référentiel #1 v1.6.0 de l'Agence du Numérique en Santé (ANS)

## 📋 Table des matières

- [Vue d'ensemble](#-vue-densemble)
- [Fonctionnalités](#-fonctionnalités)
- [Architecture](#-architecture)
- [Prérequis](#-prérequis)
- [Installation](#-installation)
- [Configuration](#-configuration)
- [Démarrage](#-démarrage)
- [Utilisation](#-utilisation)
- [API Documentation](#-api-documentation)
- [Déploiement](#-déploiement)
- [Tests](#-tests)
- [Maintenance](#-maintenance)
- [Conformité MSSanté](#-conformité-mssanté)
- [Contribution](#-contribution)
- [Support](#-support)
- [License](#-license)

---

## 🎯 Vue d'ensemble

Cette plateforme permet de devenir **opérateur MSSanté** et d'héberger des messageries sécurisées pour les professionnels et établissements de santé.

### Qu'est-ce que MSSanté ?

MSSanté (Messageries Sécurisées de Santé) est un espace de confiance géré par l'ANS permettant aux professionnels de santé d'échanger des données de santé de manière sécurisée par messagerie électronique.

### Objectifs du projet

- ✅ Fournir un service de messagerie sécurisée conforme MSSanté
- ✅ Héberger plusieurs établissements (multi-tenant)
- ✅ Offrir un webmail moderne et intuitif
- ✅ Automatiser l'alimentation de l'Annuaire National
- ✅ Générer et soumettre les indicateurs mensuels à l'ANS
- ✅ Assurer la haute disponibilité et la sécurité

---

## ✨ Fonctionnalités

### 🔐 Sécurité & Conformité

- ✅ **Chiffrement TLS 1.2+** avec certificats IGC Santé
- ✅ **Authentification Pro Santé Connect** (PSC) OAuth 2.0
- ✅ **Authentification par certificat** pour les BAL applicatives
- ✅ **Conformité RGPD** avec gestion des consentements
- ✅ **Audit complet** de toutes les actions

### 📬 Gestion des Boîtes Aux Lettres (BAL)

- ✅ **3 types de BAL** : Personnelles, Organisationnelles, Applicatives
- ✅ **Multi-domaines** : Hébergement de plusieurs établissements
- ✅ **Quotas configurables** par domaine
- ✅ **Liste rouge** (masquage annuaire)
- ✅ **Délégations** pour les BAL organisationnelles

### 💻 Webmail Intégré

- ✅ **Interface moderne** type Gmail/Outlook
- ✅ **Lecture/Envoi** de messages sécurisés
- ✅ **Pièces jointes** (jusqu'à 25 Mo)
- ✅ **Dossiers personnalisés**
- ✅ **Recherche avancée**
- ✅ **Brouillons** et messages planifiés
- ✅ **Éditeur HTML** riche

### 🏢 Multi-tenant

- ✅ **Gestion de domaines** multiples
- ✅ **Isolation complète** des données
- ✅ **Certificats séparés** par domaine
- ✅ **Quotas individuels** par établissement
- ✅ **Administration déléguée**

### 📊 Administration

- ✅ **Dashboard** avec statistiques temps réel
- ✅ **Gestion des utilisateurs** et rôles (RBAC)
- ✅ **Gestion des certificats** avec alertes expiration
- ✅ **Monitoring** de la plateforme
- ✅ **Logs et audit** complets

### 📖 Annuaire National & Indicateurs

- ✅ **Publication automatique** dans l'Annuaire National
- ✅ **Comptes rendus** d'alimentation
- ✅ **Indicateurs mensuels** automatisés
- ✅ **Soumission à l'ANS** (API + SFTP)
- ✅ **Retry automatique** en cas d'échec

### 🔧 Monitoring & Supervision

- ✅ **Prometheus + Grafana** pour les métriques
- ✅ **ELK Stack** pour les logs
- ✅ **Alerting** (certificats, quotas, erreurs)
- ✅ **Health checks** automatiques

---

## 🏗️ Architecture

### Stack Technique

```
┌─────────────────────────────────────────────────────────┐
│                   Internet / Utilisateurs               │
└───────────────────────┬─────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────┐
│                 Traefik (Reverse Proxy)                 │
│          Ports: 80, 443, 25, 587, 143                   │
└────────┬────────┬────────────┬──────────────┬───────────┘
         │        │            │              │
    ┌────▼───┐ ┌──▼────┐ ┌─────▼────┐ ┌───────▼──────┐
    │Frontend│ │ API   │ │ Postfix  │ │   Dovecot    │
    │ React  │ │Node.js│ │  SMTP    │ │    IMAP      │
    └────────┘ └────┬──┘ └──────────┘ └──────────────┘
                    │
         ┌──────────┼─────────┐
         │          │         │
    ┌────▼─────┐ ┌──▼──┐ ┌────▼──────┐
    │PostgreSQL│ │Redis│ │Prometheus │
    └──────────┘ └─────┘ └───────────┘
```

### Technologies

**Backend:**

- Node.js 20+
- Express.js
- PostgreSQL 15
- Redis 7

**Frontend:**

- React 18
- Tailwind CSS
- Axios
- React Router

**Mail:**

- Postfix (SMTP)
- Dovecot (IMAP)
- Rspamd (Antispam)

**Infrastructure:**

- Docker & Docker Compose
- Traefik (Reverse Proxy)
- Prometheus + Grafana
- ELK Stack (optionnel)

---

## 📦 Prérequis

### Matériel Recommandé

**Environnement de développement:**

- CPU: 4 cores
- RAM: 8 GB
- Disque: 50 GB SSD

**Environnement de production:**

- CPU: 8+ cores
- RAM: 16+ GB
- Disque: 200+ GB SSD
- Bande passante: 100 Mbps+

### Logiciels Requis

- **Docker** 24.0+
- **Docker Compose** 2.20+
- **Node.js** 20.0+ (pour développement local)
- **Git** 2.30+
- **Make** (optionnel, recommandé)

### Autres Prérequis

- **Contrat Opérateur** signé avec l'ANS
- **FINESS Juridique** de votre structure
- **Certificats IGC Santé** (test et production)
- **Domaine(s)** `*.mssante.fr` déclaré(s)
- **Configuration DNS** (MX, SPF, DKIM)

---

## 🚀 Installation

### 1. Cloner le projet

```bash
git clone https://github.com/votre-org/mssante-operator.git
cd mssante-operator
```

### 2. Copier les fichiers d'environnement

```bash
# Environnement racine
cp .env.example .env

# API Backend
cp services/api/.env.example services/api/.env.development

# Frontend
cp services/frontend/.env.example services/frontend/.env.development
```

### 3. Installer les dépendances

**Avec Make:**

```bash
make install
```

**Sans Make:**

```bash
cd services/api && npm install
cd ../frontend && npm install
```

### 4. Configuration de la base de données

Éditer `.env` à la racine:

```bash
# PostgreSQL
POSTGRES_DB=mssante
POSTGRES_USER=mssante
POSTGRES_PASSWORD=VotreMotDePasseSecurise123!

# Redis
REDIS_PASSWORD=VotreRedisPassword456!

# JWT
JWT_SECRET=VotreCleSecretJWT789!

# Pro Santé Connect
PSC_CLIENT_ID=votre_client_id_psc
PSC_CLIENT_SECRET=votre_client_secret_psc

# Domaine principal
DOMAIN=votre-operateur.mssante.fr

# ANS
OPERATOR_ID=VOTRE_ID_OPERATEUR
ANNUAIRE_API_KEY=votre_cle_api_ans
```

### 5. Démarrer les services

**Avec Make:**

```bash
make start
```

**Avec Docker Compose:**

```bash
docker-compose up -d
```

### 6. Initialiser la base de données

```bash
# Exécuter les migrations
make db-migrate

# (Optionnel) Peupler avec des données de test
make db-seed
```

### 7. Vérifier l'installation

```bash
# Vérifier que tous les services sont up
docker-compose ps

# Tester l'API
curl http://localhost:3000/health

# Tester le frontend
curl http://localhost:80
```

---

## ⚙️ Configuration

### Configuration de l'API

Fichier: `services/api/.env.development`

```bash
# Serveur
NODE_ENV=development
PORT=3000

# Base de données
DB_HOST=postgres
DB_PORT=5432
DB_NAME=mssante
DB_USER=mssante
DB_PASSWORD=VotreMotDePasseSecurise123!

# Redis
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=VotreRedisPassword456!

# JWT
JWT_SECRET=VotreCleSecretJWT789!
JWT_EXPIRATION=24h

# Pro Santé Connect
PSC_CLIENT_ID=votre_client_id
PSC_CLIENT_SECRET=votre_client_secret
PSC_AUTHORIZATION_URL=https://auth.esw.esante.gouv.fr/auth/realms/esante-wallet/protocol/openid-connect/auth
PSC_TOKEN_URL=https://auth.esw.esante.gouv.fr/auth/realms/esante-wallet/protocol/openid-connect/token
PSC_REDIRECT_URI=http://localhost:3000/auth/psc/callback

# SMTP
SMTP_HOST=postfix
SMTP_PORT=587

# IMAP
IMAP_HOST=dovecot
IMAP_PORT=143

# Annuaire ANS
ANNUAIRE_BASE_URL=https://annuaire.formation.mssante.fr/api/v1
ANNUAIRE_API_KEY=votre_cle_api
```

### Configuration du Frontend

Fichier: `services/frontend/.env.development`

```bash
REACT_APP_API_URL=http://localhost:3000/api/v1
REACT_APP_PSC_CLIENT_ID=votre_client_id
REACT_APP_ENV=development
```

### Certificats IGC Santé

Placer vos certificats dans `config/certificates/`:

```bash
config/certificates/
├── igc-sante/
│   ├── ca-bundle.pem       # Chaîne de certification IGC Santé
│   └── crl.pem             # Liste de révocation
└── domains/
    └── votre-domaine.mssante.fr/
        ├── cert.pem        # Certificat serveur
        ├── key.pem         # Clé privée
        └── chain.pem       # Chaîne complète
```

**Installer un certificat pour un domaine:**

```bash
./scripts/certificates/install-cert.sh \
  votre-domaine.mssante.fr \
  /chemin/vers/cert.pem \
  /chemin/vers/key.pem
```

### Configuration DNS

Configurer les enregistrements DNS suivants:

```dns
; Enregistrements A
votre-domaine.mssante.fr.         A      VOTRE_IP
mail.votre-domaine.mssante.fr.    A      VOTRE_IP

; Enregistrement MX
votre-domaine.mssante.fr.  MX  10  mail.votre-domaine.mssante.fr.

; SPF
votre-domaine.mssante.fr.  TXT  "v=spf1 mx -all"

; DMARC
_dmarc.votre-domaine.mssante.fr.  TXT  "v=DMARC1; p=quarantine; rua=mailto:dmarc@votre-domaine.mssante.fr"
```

---

## 🎬 Démarrage

### Développement

**Démarrer tous les services:**

```bash
make start
# ou
docker-compose up -d
```

**Voir les logs:**

```bash
make logs
# ou
docker-compose logs -f
```

**Démarrer uniquement l'API (mode dev):**

```bash
cd services/api
npm run dev
```

**Démarrer uniquement le frontend:**

```bash
cd services/frontend
npm start
```

### Production

```bash
# Build des images
make build

# Démarrer avec la config production
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Ou utiliser le script de déploiement
./scripts/deploy/deploy-production.sh
```

### Commandes utiles

```bash
# Arrêter tous les services
make stop

# Redémarrer
make restart

# Voir les conteneurs
make ps

# Shell dans l'API
make shell-api

# Shell PostgreSQL
make shell-db

# Backup de la base
make backup

# Exécuter les tests
make test

# Linter le code
make lint
```

---

## 📖 Utilisation

### Accès aux interfaces

**Frontend (Webmail + Admin):**

- URL: https://votre-domaine.mssante.fr
- Premier utilisateur: Créé via script ou directement en base

**API:**

- URL: https://api.votre-domaine.mssante.fr
- Documentation: https://api.votre-domaine.mssante.fr/docs

**Grafana (Monitoring):**

- URL: https://grafana.votre-domaine.mssante.fr
- User: admin
- Pass: Défini dans `.env`

**Traefik Dashboard:**

- URL: http://localhost:8080

### Créer le premier super admin

```bash
# Se connecter à PostgreSQL
docker-compose exec postgres psql -U mssante -d mssante

# Créer l'utilisateur
INSERT INTO users (email, first_name, last_name, password_hash, is_super_admin, role_id, status)
VALUES (
  'admin@votre-domaine.mssante.fr',
  'Admin',
  'Système',
  '$2b$10$...', -- Hash bcrypt du mot de passe
  true,
  (SELECT id FROM roles WHERE name = 'super_admin'),
  'active'
);
```

### Créer un domaine

1. Se connecter en tant que super admin
2. Aller dans **Admin > Domaines**
3. Cliquer sur **+ Nouveau domaine**
4. Remplir:
   - Nom de domaine: `hopital-exemple.mssante.fr`
   - FINESS Juridique: `750000001`
   - Nom organisation: `Hôpital Exemple`
   - Type: Hôpital
   - Quotas: 100 BAL, 100 GB
5. Valider

### Créer une BAL

1. Sélectionner le domaine
2. Aller dans **BAL > Nouvelle BAL**
3. Choisir le type (Personnelle/Organisationnelle/Applicative)
4. Remplir les informations
5. Valider

La BAL sera automatiquement:
- Créée techniquement (Postfix/Dovecot)
- Publiée dans l'Annuaire National (si applicable)

---

## 📚 API Documentation

### Authentification

**Connexion:**

```bash
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "user@hopital.mssante.fr",
  "password": "password"
}

# Réponse
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "uuid",
    "email": "user@hopital.mssante.fr",
    "role": "domain_admin"
  }
}
```

**Utilisation du token:**

```bash
GET /api/v1/mailboxes
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

### Endpoints principaux

**Mailboxes:**

- `GET /api/v1/mailboxes` - Liste des BAL
- `POST /api/v1/mailboxes` - Créer une BAL
- `GET /api/v1/mailboxes/:id` - Détails d'une BAL
- `PUT /api/v1/mailboxes/:id` - Modifier une BAL
- `DELETE /api/v1/mailboxes/:id` - Supprimer une BAL

**Email (Webmail):**

- `GET /api/v1/email/folders` - Liste des dossiers
- `GET /api/v1/email/messages` - Liste des messages
- `GET /api/v1/email/messages/:uid` - Message complet
- `POST /api/v1/email/send` - Envoyer un email
- `POST /api/v1/email/draft` - Sauvegarder un brouillon

**Admin (Super Admin uniquement):**

- `GET /api/v1/admin/domains` - Liste des domaines
- `POST /api/v1/admin/domains` - Créer un domaine
- `GET /api/v1/admin/statistics` - Statistiques globales
- `POST /api/v1/admin/indicators/submit` - Soumettre indicateurs

Documentation complète: [docs/api/swagger.yaml](docs/api/swagger.yaml)

---

## 🚢 Déploiement

### Environnement de production

**1. Préparer le serveur:**

```bash
# Installer Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Configurer le firewall
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 25/tcp
sudo ufw allow 587/tcp
sudo ufw allow 143/tcp
```

**2. Configurer les variables d'environnement:**

```bash
# Copier l'exemple
cp .env.example .env

# Éditer avec des valeurs de production
nano .env
```

**3. Placer les certificats:**

```bash
# Certificats IGC Santé
mkdir -p config/certificates/igc-sante
cp /path/to/ca-bundle.pem config/certificates/igc-sante/

# Certificats de domaine
mkdir -p config/certificates/domains/votre-domaine.mssante.fr
cp /path/to/cert.pem config/certificates/domains/votre-domaine.mssante.fr/
cp /path/to/key.pem config/certificates/domains/votre-domaine.mssante.fr/
chmod 600 config/certificates/domains/votre-domaine.mssante.fr/key.pem
```

**4. Déployer:**

```bash
# Utiliser le script de déploiement
./scripts/deploy/deploy-production.sh

# Ou manuellement
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

**5. Vérifier:**

```bash
# Santé des services
make health

# Logs
docker-compose logs -f
```

### Mise à jour

```bash
# Pull des dernières modifications
git pull origin main

# Rebuild et redémarrage
docker-compose up -d --build

# Ou avec zero-downtime
./scripts/deploy/rolling-update.sh
```

### Rollback

```bash
# Revenir à la version précédente
./scripts/deploy/rollback.sh

# Ou manuellement
git checkout <previous-commit>
docker-compose up -d --build
```

---

## 🧪 Tests

### Tests unitaires

```bash
# Tous les tests
make test

# API uniquement
cd services/api
npm test

# Frontend uniquement
cd services/frontend
npm test

# Avec couverture
npm test -- --coverage
```

### Tests d'intégration

```bash
cd services/api
npm run test:integration
```

### Tests E2E

```bash
cd tests/e2e
npm run test:e2e
```

### Tests de charge

```bash
cd tests/load
# Utilise k6 ou artillery
k6 run load-test.js
```

---

## 🔧 Maintenance

### Sauvegardes

**Backup automatique quotidien:**

Le script `scripts/backup/backup.sh` s'exécute automatiquement via cron:

```bash
# Backup manuel
make backup

# Contenu sauvegardé:
# - Base PostgreSQL
# - Base Redis
# - Mails (maildir)
# - Configurations
# - Certificats
```

**Restauration:**

```bash
# Restaurer depuis un backup
./scripts/backup/restore.sh /path/to/backup_20250101_120000.tar.gz
```

### Mise à jour des certificats

**Vérifier l'expiration:**

```bash
# Liste des certificats expirant bientôt
curl -X GET https://api.votre-domaine.mssante.fr/api/v1/admin/certificates/expiring \
  -H "Authorization: Bearer $TOKEN"
```

**Renouveler un certificat:**

```bash
./scripts/certificates/renew-cert.sh votre-domaine.mssante.fr
```

### Rotation des logs

Configurer logrotate:

```bash
# /etc/logrotate.d/mssante
/var/log/mssante/*.log {
    daily
    rotate 30
    compress
    delaycompress
    notifempty
    create 0640 root root
    sharedscripts
    postrotate
        docker-compose exec -T api kill -USR1 1
    endscript
}
```

### Monitoring

**Alertes configurées:**

- Certificat expire dans moins de 30 jours
- Utilisation disque > 85%
- Taux d'erreur > 5%
- Service down > 2 minutes
- Quota domaine atteint à 90%

**Accéder aux métriques:**

```bash
# Prometheus
open http://localhost:9090

# Grafana
open https://grafana.votre-domaine.mssante.fr
```

---

## ✅ Conformité MSSanté

### Référentiel #1 v1.6.0

Cette plateforme est conforme aux exigences du **Référentiel #1 Opérateurs de Messageries Sécurisées de Santé v1.6.0** publié le 20/03/2024.

**Points de conformité:**

✅ **Sécurité:**

- TLS 1.2+ obligatoire
- Certificats IGC Santé
- Suites de chiffrement conformes ANSSI
- Authentification Pro Santé Connect (OAuth 2.0)
- Authentification mutuelle par certificat (BAL applicatives)

✅ **Protocoles:**

- SMTP + STARTTLS (port 587 et 25)
- IMAP4 + STARTTLS (port 143)
- API LPS/DUI standardisée

✅ **Annuaire National:**

- Publication automatique des BAL
- Consultation des comptes rendus
- Retry automatique en cas d'échec

✅ **Indicateurs:**

- Génération mensuelle automatique
- Soumission avant le 10 du mois
- Format conforme ANS

✅ **Gestion:**

- 3 types de BAL (PERS, ORG, APP)
- Liste rouge
- Dépublication après 2 ans d'inactivité

### Tests de conformité

Utiliser l'outil de test fourni par l'ANS:

```bash
# Accès à l'environnement de test ANS
# URL: https://mssante.formation.mssante.fr

# Exécuter les tests de conformité
./scripts/conformity/run-ans-tests.sh
```

### Procédure de validation ANS

1. Tests sur l'environnement de test ANS
2. Génération du rapport de tests
3. Envoi à `monserviceclient.mssante@esante.gouv.fr`
4. Validation par l'ANS (2-4 semaines)
5. Inscription sur la liste blanche
6. Go Live production

---

## 🤝 Contribution

Les contributions sont les bienvenues !

### Processus

1. Fork le projet
2. Créer une branche (`git checkout -b feature/AmazingFeature`)
3. Commit les changements (`git commit -m 'feat: Add AmazingFeature'`)
4. Push vers la branche (`git push origin feature/AmazingFeature`)
5. Ouvrir une Pull Request

### Conventions

**Commits:**
```
type(scope): description

Types: feat, fix, docs, style, refactor, test, chore
```

**Code:**
- ESLint + Prettier configurés
- Tests obligatoires pour les nouvelles fonctionnalités
- Documentation mise à jour

---

## 💬 Support

### Documentation

- [Guide d'installation](docs/guides/installation.md)
- [Guide de configuration](docs/guides/configuration.md)
- [Guide de déploiement](docs/guides/deployment.md)
- [Troubleshooting](docs/guides/troubleshooting.md)
- [API Documentation](docs/api/swagger.yaml)^-