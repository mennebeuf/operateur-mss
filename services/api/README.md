# MSSanté API Backend

API REST pour la plateforme Opérateur MSSanté - Messagerie Sécurisée de Santé.

## 📋 Table des matières

- [Vue d'ensemble](#vue-densemble)
- [Prérequis](#prérequis)
- [Installation](#installation)
- [Configuration](#configuration)
- [Démarrage](#démarrage)
- [Architecture](#architecture)
- [API Endpoints](#api-endpoints)
- [Authentification](#authentification)
- [Tests](#tests)
- [Déploiement](#déploiement)
- [Contribuer](#contribuer)

---

## 🎯 Vue d'ensemble

Cette API constitue le backend de la plateforme Opérateur MSSanté. Elle fournit :

- **Authentification** : JWT local + Pro Santé Connect (OAuth2/OIDC)
- **Gestion des BAL** : Création, modification, suppression des boîtes aux lettres
- **Webmail** : Interface IMAP/SMTP pour la consultation et l'envoi d'emails
- **Administration** : Gestion des domaines, utilisateurs et certificats
- **Annuaire ANS** : Publication et synchronisation avec l'Annuaire National
- **Indicateurs** : Génération et soumission des indicateurs mensuels

### Conformité MSSanté

✅ TLS 1.2+ obligatoire avec suites de chiffrement ANSSI  
✅ Certificats IGC Santé  
✅ Authentification Pro Santé Connect (OAuth 2.0)  
✅ Support des 3 types de BAL (PERS, ORG, APP)  
✅ Publication automatique à l'Annuaire National  

---

## 📦 Prérequis

- **Node.js** >= 20.0.0
- **npm** >= 10.0.0
- **PostgreSQL** >= 15
- **Redis** >= 7
- **Docker** (optionnel, recommandé)

---

## 🚀 Installation

### Avec Docker (recommandé)

```bash
# Cloner le projet
git clone https://github.com/votre-org/mssante-operator.git
cd mssante-operator/services/api

# Copier la configuration
cp .env.example .env.development

# Démarrer avec Docker Compose (depuis la racine)
cd ../..
docker-compose up -d
```

### Installation locale

```bash
# Cloner le projet
git clone https://github.com/votre-org/mssante-operator.git
cd mssante-operator/services/api

# Installer les dépendances
npm install

# Copier la configuration
cp .env.example .env.development

# Exécuter les migrations
npm run migrate:up

# (Optionnel) Peupler avec des données de test
npm run seed:dev
```

---

## ⚙️ Configuration

### Variables d'environnement

Créer un fichier `.env.development` ou `.env.production` :

```bash
# Environnement
NODE_ENV=development
PORT=3000

# Base de données PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_NAME=mssante
DB_USER=mssante
DB_PASSWORD=your_password

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password

# JWT
JWT_SECRET=your_jwt_secret_min_32_chars
JWT_EXPIRES_IN=3600

# Pro Santé Connect
PSC_CLIENT_ID=your_client_id
PSC_CLIENT_SECRET=your_client_secret
PSC_REDIRECT_URI=https://your-domain.mssante.fr/auth/psc/callback

# Annuaire ANS
ANNUAIRE_API_URL=https://annuaire.sante.fr/api/v1
ANNUAIRE_API_KEY=your_api_key
OPERATOR_ID=your_operator_id
```

Voir `.env.example` pour la liste complète des variables.

### Fichiers de configuration

| Fichier | Description |
|---------|-------------|
| `.env.development` | Configuration développement |
| `.env.production` | Configuration production |
| `.eslintrc.js` | Règles ESLint |
| `.prettierrc` | Configuration Prettier |

---

## 🏃 Démarrage

### Développement

```bash
# Démarrage avec hot-reload
npm run dev

# Démarrage avec debugger
npm run dev:debug
```

### Production

```bash
# Démarrage standard
npm start
```

### Vérification

```bash
# Health check
curl http://localhost:3000/health

# Réponse attendue
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "services": {
    "database": "ok",
    "redis": "ok"
  }
}
```

---

## 🏗️ Architecture

### Structure du projet

```
src/
├── config/              # Configuration (DB, Redis, PSC)
│   ├── database.js
│   ├── redis.js
│   └── psc.js
├── controllers/         # Logique métier
│   ├── authController.js
│   ├── mailboxController.js
│   ├── userController.js
│   └── domainController.js
├── middleware/          # Middlewares Express
│   ├── auth.js          # Authentification JWT/PSC
│   ├── permissions.js   # Contrôle d'accès RBAC
│   ├── validation.js    # Validation des requêtes
│   └── errorHandler.js  # Gestion des erreurs
├── models/              # Modèles de données
│   ├── User.js
│   ├── Mailbox.js
│   ├── Domain.js
│   └── Certificate.js
├── routes/              # Définition des routes
│   ├── auth.js
│   ├── mailboxes.js
│   ├── users.js
│   ├── domains.js
│   ├── email.js
│   └── admin/
├── services/            # Services métier
│   ├── email/
│   │   ├── imapService.js
│   │   └── smtpService.js
│   ├── annuaire/
│   │   ├── annuaireService.js
│   │   └── indicatorsService.js
│   └── certificates/
│       └── certificateService.js
├── jobs/                # Tâches planifiées
│   ├── annuaireRetry.js
│   ├── generateIndicators.js
│   └── certificateMonitor.js
├── utils/               # Utilitaires
│   ├── logger.js
│   ├── validators.js
│   ├── crypto.js
│   └── helpers.js
├── app.js               # Configuration Express
└── server.js            # Point d'entrée
```

### Technologies

| Composant | Technologie |
|-----------|-------------|
| Framework | Express.js 4.x |
| Base de données | PostgreSQL 15 + pg |
| Cache | Redis 7 + ioredis |
| Auth | JWT + OAuth2 (openid-client) |
| Email | nodemailer + imapflow |
| Validation | Joi |
| Logging | Winston |
| Jobs | Bull + node-cron |

---

## 📡 API Endpoints

### Base URL

```
https://api.votre-domaine.mssante.fr/api/v1
```

### Authentification

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| `POST` | `/auth/login` | Connexion locale (admin) |
| `POST` | `/auth/logout` | Déconnexion |
| `POST` | `/auth/refresh` | Rafraîchir le token |
| `GET` | `/auth/psc/authorize` | Initier auth PSC |
| `POST` | `/auth/psc/token` | Échanger code PSC |
| `GET` | `/auth/psc/userinfo` | Infos utilisateur PSC |

### Boîtes aux lettres

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| `GET` | `/mailboxes` | Liste des BAL |
| `POST` | `/mailboxes` | Créer une BAL |
| `GET` | `/mailboxes/:id` | Détails d'une BAL |
| `PUT` | `/mailboxes/:id` | Modifier une BAL |
| `DELETE` | `/mailboxes/:id` | Supprimer une BAL |
| `POST` | `/mailboxes/:id/publish` | Publier à l'annuaire |
| `POST` | `/mailboxes/:id/unpublish` | Dépublier |

### Webmail (Email)

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| `GET` | `/email/folders` | Liste des dossiers |
| `GET` | `/email/messages` | Liste des messages |
| `GET` | `/email/messages/:uid` | Lire un message |
| `POST` | `/email/send` | Envoyer un email |
| `POST` | `/email/draft` | Sauvegarder brouillon |
| `PATCH` | `/email/messages/:uid/flags` | Modifier les flags |
| `DELETE` | `/email/messages` | Supprimer des messages |

### Administration

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| `GET` | `/admin/domains` | Liste des domaines |
| `POST` | `/admin/domains` | Créer un domaine |
| `GET` | `/admin/users` | Liste des utilisateurs |
| `GET` | `/admin/statistics` | Statistiques globales |
| `GET` | `/admin/audit` | Logs d'audit |

### Annuaire ANS

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| `GET` | `/annuaire/search` | Rechercher dans l'annuaire |
| `POST` | `/annuaire/sync` | Synchroniser les BAL |
| `GET` | `/annuaire/reports` | Comptes rendus |
| `POST` | `/annuaire/indicators` | Soumettre indicateurs |

---

## 🔐 Authentification

### JWT (Administrateurs)

```bash
# Login
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@example.mssante.fr", "password": "secret"}'

# Utilisation du token
curl http://localhost:3000/api/v1/mailboxes \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..."
```

### Pro Santé Connect (Professionnels de santé)

```javascript
// 1. Rediriger vers PSC
GET /api/v1/auth/psc/authorize?redirect_uri=...&state=...

// 2. Callback avec le code
POST /api/v1/auth/psc/token
{
  "code": "authorization_code",
  "state": "anti_csrf_token"
}

// 3. Récupérer les infos utilisateur
GET /api/v1/auth/psc/userinfo
Authorization: Bearer {token}
```

---

## 🧪 Tests

### Exécuter les tests

```bash
# Tous les tests avec couverture
npm test

# Tests en mode watch
npm run test:watch

# Tests unitaires uniquement
npm run test:unit

# Tests d'intégration
npm run test:integration

# Tests end-to-end
npm run test:e2e
```

### Couverture

La couverture minimale requise est de **70%** pour :
- Branches
- Fonctions
- Lignes
- Statements

```bash
# Voir le rapport de couverture
open coverage/lcov-report/index.html
```

---

## 🔍 Qualité du code

### Linting

```bash
# Vérifier le code
npm run lint

# Corriger automatiquement
npm run lint:fix
```

### Formatage

```bash
# Formater le code
npm run format

# Vérifier le formatage
npm run format:check
```

---

## 🚢 Déploiement

### Docker

```dockerfile
# Build de l'image
docker build -t mssante-api .

# Exécution
docker run -d \
  --name mssante-api \
  -p 3000:3000 \
  --env-file .env.production \
  mssante-api
```

### Production Checklist

- [ ] Variables d'environnement configurées
- [ ] Certificats IGC Santé installés
- [ ] Base de données migrée
- [ ] Redis configuré avec mot de passe
- [ ] TLS 1.2+ activé
- [ ] Rate limiting configuré
- [ ] Logs configurés (rotation, niveau)
- [ ] Monitoring activé (health checks)
- [ ] Backup automatique configuré

---

## 📊 Monitoring

### Health Checks

```bash
# Vérification complète
GET /health

# Vérification de vivacité
GET /health/live
```

### Métriques

Les métriques Prometheus sont disponibles sur le port configuré :

```bash
GET http://localhost:9090/metrics
```

### Logs

Les logs sont générés au format JSON et rotés quotidiennement :

```bash
# Emplacement des logs
/var/log/mssante-api/
├── combined.log      # Tous les logs
├── error.log         # Erreurs uniquement
└── security.log      # Événements de sécurité
```

---

## 🤝 Contribuer

### Workflow

1. Fork le projet
2. Créer une branche (`git checkout -b feature/ma-feature`)
3. Commiter (`git commit -m 'feat: ajout ma feature'`)
4. Pousser (`git push origin feature/ma-feature`)
5. Ouvrir une Pull Request

### Convention de commits

```
type(scope): description

Types: feat, fix, docs, style, refactor, test, chore
```

### Standards de code

- ESLint + Prettier obligatoires
- Tests pour toute nouvelle fonctionnalité
- Documentation JSDoc pour les fonctions publiques
- Couverture de tests >= 70%

---

## 📚 Documentation

- [Guide d'installation complet](../../docs/guides/installation.md)
- [Configuration détaillée](../../docs/guides/configuration.md)
- [Spécifications API](../../docs/api/api-specifications.md)
- [Guide de déploiement](../../docs/guides/deployment.md)
- [Troubleshooting](../../docs/guides/troubleshooting.md)

---

## 📄 Licence

Ce projet est sous licence propriétaire. Voir le fichier [LICENSE](../../LICENSE) pour plus de détails.

---

## 📞 Support

- **Documentation** : [docs.votre-domaine.mssante.fr](https://docs.votre-domaine.mssante.fr)
- **Issues** : [GitHub Issues](https://github.com/votre-org/mssante-operator/issues)
- **Email** : support@votre-domaine.mssante.fr
- **ANS** : monserviceclient.mssante@esante.gouv.fr
