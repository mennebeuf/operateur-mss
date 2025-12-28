# Structure Projet VSCode - Opérateur MSSanté

## 1. Structure complète du projet

✅ Organisation logique en 3 grandes parties :

services/ : API, Frontend, Postfix, Dovecot
config/ : Configurations globales
database/ : Migrations SQL
scripts/ : Automatisation
docs/ : Documentation
data/ : Données (gitignored)

✅ Architecture claire par service :

```
services/
├── api/              (Backend Node.js)
├── frontend/         (React)
├── postfix/          (SMTP)
└── dovecot/          (IMAP)
```

### Structure complète

```
mssante-operator/
│
├── .vscode/                          # Configuration VSCode
│   ├── settings.json                 # Paramètres workspace
│   ├── launch.json                   # Configuration debug
│   ├── extensions.json               # Extensions recommandées
│   └── tasks.json                    # Tâches automatisées
│
├── services/                         # Microservices
│   │
│   ├── api/                          # Backend API Node.js
│   │   ├── src/
│   │   │   ├── config/  ✅
│   │   │   │   ├── database.js ✅
│   │   │   │   ├── redis.js ✅
│   │   │   │   └── psc.js ✅
│   │   │   ├── controllers/ ✅
│   │   │   │   ├── authController.js ✅
│   │   │   │   ├── mailboxController.js ✅
│   │   │   │   ├── userController.js ✅
│   │   │   │   └── domainController.js ✅
│   │   │   ├── middleware/ ✅
│   │   │   │   ├── auth.js ✅
│   │   │   │   ├── permissions.js ✅
│   │   │   │   ├── domainContext.js ✅
│   │   │   │   ├── validation.js ✅
│   │   │   │   ├── quota.js ✅
│   │   │   │   ├── requestLogger.js ✅
│   │   │   │   ├── audit.js ✅
│   │   │   │   └── errorHandler.js ✅
│   │   │   ├── models/ ✅
│   │   │   │   ├── User.js ✅
│   │   │   │   ├── Mailbox.js ✅
│   │   │   │   ├── Domain.js ✅
│   │   │   │   ├── Certificate.js ✅
│   │   │   │   ├── index.js ✅
│   │   │   │   └── README.md ✅
│   │   │   ├── routes/
│   │   │   │   ├── auth.js
│   │   │   │   ├── mailboxes.js
│   │   │   │   ├── users.js
│   │   │   │   ├── domains.js
│   │   │   │   ├── email.js
│   │   │   │   └── admin/
│   │   │   │       ├── index.js
│   │   │   │       ├── domains.js
│   │   │   │       ├── users.js
│   │   │   │       ├── certificates.js
│   │   │   │       ├── statistics.js
│   │   │   │       ├── annuaire.js
│   │   │   │       └── monitoring.js
│   │   │   ├── services/
│   │   │   │   ├── email/
│   │   │   │   │   ├── imapService.js
│   │   │   │   │   └── smtpService.js
│   │   │   │   ├── annuaire/
│   │   │   │   │   ├── annuaireService.js
│   │   │   │   │   └── indicatorsService.js
│   │   │   │   └── certificates/
│   │   │   │       └── certificateService.js
│   │   │   ├── jobs/ ✅
│   │   │   │   ├── annuaireRetry.js ✅
│   │   │   │   ├── annuaireBatch.js ✅
│   │   │   │   ├── generateIndicators.js ✅
│   │   │   │   ├── downloadReports.js ✅
│   │   │   │   ├── certificateMonitor.js ✅
│   │   │   │   ├── cleanupSessions.js ✅
│   │   │   │   ├── dailyStatistics.js ✅
│   │   │   │   └── index.js ✅
│   │   │   ├── utils/ ✅
│   │   │   │   ├── logger.js ✅
│   │   │   │   ├── smtp.js ✅
│   │   │   │   ├── crypto.js ✅
│   │   │   │   ├── validators.js ✅
│   │   │   │   ├── helpers.js ✅
│   │   │   │   └── index.js ✅
│   │   │   ├── server.js ✅
│   │   │   └── app.js ✅
│   │   ├── tests/
│   │   │   ├── unit/
│   │   │   ├── integration/
│   │   │   └── e2e/
│   │   ├── .env.example ✅
│   │   ├── .env.development ✅
│   │   ├── .env.production ✅
│   │   ├── .eslintrc.js ✅
│   │   ├── .prettierrc ✅
│   │   ├── Dockerfile ✅
│   │   ├── package.json ✅
│   │   └── README.md ✅
│   │
│   ├── frontend/                     # Frontend React
│   │   ├── public/
│   │   │   ├── index.html
│   │   │   └── favicon.ico
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   ├── Common/
│   │   │   │   │   ├── Button.jsx
│   │   │   │   │   ├── Input.jsx
│   │   │   │   │   ├── Modal.jsx
│   │   │   │   │   └── Loader.jsx
│   │   │   │   ├── Email/
│   │   │   │   │   ├── MessageRow.jsx
│   │   │   │   │   ├── MessageView.jsx
│   │   │   │   │   ├── AttachmentItem.jsx
│   │   │   │   │   ├── RecipientInput.jsx
│   │   │   │   │   └── RichTextEditor.jsx
│   │   │   │   └── Admin/
│   │   │   │       ├── StatCard.jsx
│   │   │   │       ├── DomainCard.jsx
│   │   │   │       └── UserTable.jsx
│   │   │   ├── pages/
│   │   │   │   ├── Auth/
│   │   │   │   │   ├── Login.jsx
│   │   │   │   │   └── PSCCallback.jsx
│   │   │   │   ├── Dashboard/
│   │   │   │   │   └── index.jsx
│   │   │   │   ├── Mailboxes/
│   │   │   │   │   ├── MailboxList.jsx
│   │   │   │   │   ├── MailboxCreate.jsx
│   │   │   │   │   └── MailboxSettings.jsx
│   │   │   │   ├── Webmail/
│   │   │   │   │   ├── index.jsx
│   │   │   │   │   ├── FolderTree.jsx
│   │   │   │   │   ├── MessageList.jsx
│   │   │   │   │   ├── MessageView.jsx
│   │   │   │   │   ├── Compose.jsx
│   │   │   │   │   └── SearchBar.jsx
│   │   │   │   └── Admin/
│   │   │   │       ├── Dashboard.jsx
│   │   │   │       ├── Domains/
│   │   │   │       │   ├── DomainsList.jsx
│   │   │   │       │   ├── DomainCreate.jsx
│   │   │   │       │   ├── DomainEdit.jsx
│   │   │   │       │   └── DomainView.jsx
│   │   │   │       ├── Users/
│   │   │   │       │   ├── UsersList.jsx
│   │   │   │       │   ├── UserCreate.jsx
│   │   │   │       │   └── UserEdit.jsx
│   │   │   │       ├── Certificates/
│   │   │   │       │   ├── CertificatesList.jsx
│   │   │   │       │   └── CertificateUpload.jsx
│   │   │   │       ├── Annuaire/
│   │   │   │       │   ├── AnnuaireReports.jsx
│   │   │   │       │   └── MonthlyIndicators.jsx
│   │   │   │       ├── Statistics/
│   │   │   │       │   └── GlobalStats.jsx
│   │   │   │       └── Monitoring/
│   │   │   │           └── SystemHealth.jsx
│   │   │   ├── layouts/
│   │   │   │   ├── MainLayout.jsx
│   │   │   │   ├── AdminLayout.jsx
│   │   │   │   └── AuthLayout.jsx
│   │   │   ├── contexts/
│   │   │   │   ├── AuthContext.jsx
│   │   │   │   └── DomainContext.jsx
│   │   │   ├── hooks/
│   │   │   │   ├── useAuth.js
│   │   │   │   ├── usePermissions.js
│   │   │   │   └── useWebmail.js
│   │   │   ├── services/
│   │   │   │   ├── api.js
│   │   │   │   ├── authApi.js
│   │   │   │   ├── emailApi.js
│   │   │   │   └── adminApi.js
│   │   │   ├── utils/
│   │   │   │   ├── formatters.js
│   │   │   │   └── validators.js
│   │   │   ├── styles/
│   │   │   │   ├── index.css
│   │   │   │   └── tailwind.css
│   │   │   ├── App.jsx
│   │   │   ├── index.jsx
│   │   │   └── routes.jsx
│   │   ├── .env.example
│   │   ├── .eslintrc.js
│   │   ├── .prettierrc
│   │   ├── Dockerfile
│   │   ├── nginx.conf
│   │   ├── package.json
│   │   ├── tailwind.config.js
│   │   └── README.md
│   │
│   ├── postfix/                      # Service SMTP
│   │   ├── config/
│   │   │   ├── main.cf
│   │   │   ├── master.cf
│   │   │   ├── pgsql-virtual-domains.cf
│   │   │   ├── pgsql-virtual-mailboxes.cf
│   │   │   ├── pgsql-recipient-access.cf
│   │   │   └── pgsql-sni-maps.cf
│   │   ├── scripts/
│   │   │   └── entrypoint.sh
│   │   ├── Dockerfile
│   │   └── supervisord.conf
│   │
│   ├── dovecot/                      # Service IMAP
│   │   ├── config/
│   │   │   ├── dovecot.conf
│   │   │   ├── dovecot-sql.conf.ext
│   │   │   └── conf.d/
│   │   │       ├── 10-auth.conf
│   │   │       ├── 10-mail.conf
│   │   │       ├── 10-ssl.conf
│   │   │       └── 20-imap.conf
│   │   ├── scripts/
│   │   │   └── entrypoint.sh
│   │   └── Dockerfile
│   │
│   └── monitoring/                   # Services monitoring (optionnel)
│       ├── prometheus/
│       │   └── prometheus.yml
│       └── grafana/
│           └── dashboards/
│
├── config/                           # Configuration globale
│   ├── traefik/
│   │   ├── traefik.yml
│   │   └── dynamic.yml
│   ├── prometheus/
│   │   └── prometheus.yml
│   ├── certificates/
│   │   ├── igc-sante/
│   │   │   ├── ca-bundle.pem
│   │   │   └── crl.pem
│   │   └── domains/
│   │       └── README.md
│   └── nginx/
│       └── nginx.conf
│
├── database/                         # Scripts SQL
│   ├── migrations/
│   │   ├── 001_initial_schema.sql
│   │   ├── 002_roles_permissions.sql
│   │   ├── 003_multi_domains.sql
│   │   ├── 004_annuaire.sql
│   │   └── 005_statistics.sql
│   ├── seeds/
│   │   ├── dev_users.sql
│   │   └── dev_domains.sql
│   └── init-db.sh
│
├── scripts/                          # Scripts utilitaires
│   ├── setup/
│   │   ├── setup-env.sh
│   │   └── install-deps.sh
│   ├── backup/
│   │   ├── backup.sh
│   │   └── restore.sh
│   ├── deploy/
│   │   ├── deploy.sh
│   │   ├── deploy-production.sh
│   │   └── rollback.sh
│   ├── certificates/
│   │   ├── install-cert.sh
│   │   └── renew-certs.sh
│   └── maintenance/
│       ├── cleanup-logs.sh
│       └── check-health.sh
│
├── docs/                             # Documentation
│   ├── architecture/
│   │   ├── overview.md
│   │   ├── database-schema.md
│   │   └── api-specification.md
│   ├── guides/
│   │   ├── installation.md
│   │   ├── configuration.md
│   │   ├── deployment.md
│   │   └── troubleshooting.md
│   ├── api/
│   │   └── swagger.yaml
│   └── admin/
│       ├── user-management.md
│       └── domain-management.md
│
├── tests/                            # Tests globaux
│   ├── integration/
│   ├── e2e/
│   └── load/
│
├── data/                             # Données (gitignored)
│   ├── postgres/
│   ├── redis/
│   ├── mail/
│   ├── logs/
│   ├── backups/
│   └── certificates/
│
├── .gitignore ✅
├── .dockerignore
├── .env.example
├── docker-compose.yml
├── docker-compose.dev.yml
├── docker-compose.prod.yml
├── Makefile ✅
├── package.json ✅                      # Scripts racine
├── README.md ✅
└── LICENSE ✅
```

---

## 2. Configuration VSCode

### 2.1 `.vscode/settings.json`

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "eslint.workingDirectories": [
    "./services/api",
    "./services/frontend"
  ],
  "files.exclude": {
    "**/node_modules": true,
    "**/.DS_Store": true,
    "**/data": true,
    "**/.env": true
  },
  "search.exclude": {
    "**/node_modules": true,
    "**/data": true,
    "**/.git": true
  },
  "files.associations": {
    "*.cf": "properties",
    "docker-compose*.yml": "yaml"
  },
  "[javascript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[javascriptreact]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[json]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[markdown]": {
    "editor.wordWrap": "on"
  },
  "prettier.configPath": "./services/frontend/.prettierrc",
  "terminal.integrated.defaultProfile.linux": "bash",
  "docker.containers.label": "ContainerName",
  "docker.containers.groupBy": "Compose Project Name"
}
```

### 2.2 `.vscode/launch.json`

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug API",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/services/api/src/server.js",
      "cwd": "${workspaceFolder}/services/api",
      "envFile": "${workspaceFolder}/services/api/.env.development",
      "console": "integratedTerminal",
      "restart": true,
      "protocol": "inspector",
      "skipFiles": ["<node_internals>/**"]
    },
    {
      "name": "Debug Frontend",
      "type": "chrome",
      "request": "launch",
      "url": "http://localhost:3000",
      "webRoot": "${workspaceFolder}/services/frontend/src",
      "sourceMapPathOverrides": {
        "webpack:///src/*": "${webRoot}/*"
      }
    },
    {
      "name": "Debug Tests API",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/services/api/node_modules/.bin/jest",
      "args": ["--runInBand", "--no-cache"],
      "cwd": "${workspaceFolder}/services/api",
      "console": "integratedTerminal",
      "internalConsoleOptions": "neverOpen"
    },
    {
      "name": "Attach to Docker API",
      "type": "node",
      "request": "attach",
      "port": 9229,
      "address": "localhost",
      "localRoot": "${workspaceFolder}/services/api",
      "remoteRoot": "/app",
      "protocol": "inspector"
    }
  ],
  "compounds": [
    {
      "name": "Full Stack",
      "configurations": ["Debug API", "Debug Frontend"]
    }
  ]
}
```

### 2.3 `.vscode/extensions.json`

```json
{
  "recommendations": [
    // Essentiels
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "editorconfig.editorconfig",
    
    // JavaScript/React
    "dsznajder.es7-react-js-snippets",
    "rodrigovallades.es7-react-js-snippets",
    "formulahendry.auto-rename-tag",
    "bradlc.vscode-tailwindcss",
    
    // Node.js
    "christian-kohler.npm-intellisense",
    "eg2.vscode-npm-script",
    
    // Docker
    "ms-azuretools.vscode-docker",
    "ms-vscode-remote.remote-containers",
    
    // Database
    "cweijan.vscode-postgresql-client2",
    "mtxr.sqltools",
    "mtxr.sqltools-driver-pg",
    
    // Git
    "eamodio.gitlens",
    "donjayamanne.githistory",
    
    // Markdown
    "yzhang.markdown-all-in-one",
    "davidanson.vscode-markdownlint",
    
    // Autres utiles
    "gruntfuggly.todo-tree",
    "streetsidesoftware.code-spell-checker",
    "wayou.vscode-todo-highlight",
    "aaron-bond.better-comments",
    "pkief.material-icon-theme"
  ]
}
```

### 2.4 `.vscode/tasks.json`

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Start All Services",
      "type": "shell",
      "command": "docker-compose up -d",
      "problemMatcher": []
    },
    {
      "label": "Stop All Services",
      "type": "shell",
      "command": "docker-compose down",
      "problemMatcher": []
    },
    {
      "label": "Rebuild Services",
      "type": "shell",
      "command": "docker-compose up -d --build",
      "problemMatcher": []
    },
    {
      "label": "View Logs",
      "type": "shell",
      "command": "docker-compose logs -f",
      "problemMatcher": []
    },
    {
      "label": "Run API Tests",
      "type": "npm",
      "script": "test",
      "path": "services/api/",
      "problemMatcher": ["$eslint-stylish"]
    },
    {
      "label": "Lint API",
      "type": "npm",
      "script": "lint",
      "path": "services/api/",
      "problemMatcher": ["$eslint-stylish"]
    },
    {
      "label": "Lint Frontend",
      "type": "npm",
      "script": "lint",
      "path": "services/frontend/",
      "problemMatcher": ["$eslint-stylish"]
    },
    {
      "label": "Database Migration",
      "type": "shell",
      "command": "./scripts/db-migrate.sh",
      "problemMatcher": []
    },
    {
      "label": "Backup Database",
      "type": "shell",
      "command": "./scripts/backup/backup.sh",
      "problemMatcher": []
    }
  ]
}
```

---

## 3. Fichiers de configuration essentiels

### 3.1 `.gitignore` (racine)

```gitignore
# Environnement
.env
.env.local
.env.*.local
*.key
*.pem

# Dependencies
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Data
data/
backups/
logs/
*.log

# Certificats
config/certificates/domains/*
!config/certificates/domains/.gitkeep
config/certificates/*.pem
config/certificates/*.key

# IDE
.vscode/*
!.vscode/settings.json
!.vscode/tasks.json
!.vscode/launch.json
!.vscode/extensions.json
.idea/
*.swp
*.swo
*~

# OS
.DS_Store
Thumbs.db

# Build
dist/
build/
*.tgz

# Testing
coverage/
.nyc_output/

# Docker
docker-compose.override.yml

# Temporary
tmp/
temp/
*.tmp
```

### 3.2 `Makefile` (commandes rapides)

```makefile
.PHONY: help install start stop restart logs clean test deploy

help: ## Afficher l'aide
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-30s\033[0m %s\n", $$1, $$2}'

install: ## Installer les dépendances
	@echo "📦 Installation des dépendances..."
	cd services/api && npm install
	cd services/frontend && npm install

start: ## Démarrer tous les services
	@echo "🚀 Démarrage des services..."
	docker-compose up -d

stop: ## Arrêter tous les services
	@echo "🛑 Arrêt des services..."
	docker-compose down

restart: stop start ## Redémarrer tous les services

logs: ## Afficher les logs
	docker-compose logs -f

logs-api: ## Logs de l'API uniquement
	docker-compose logs -f api

logs-frontend: ## Logs du frontend uniquement
	docker-compose logs -f frontend

clean: ## Nettoyer les conteneurs et volumes
	@echo "🧹 Nettoyage..."
	docker-compose down -v
	rm -rf data/postgres/* data/redis/* data/logs/*

build: ## Rebuilder les images
	@echo "🔨 Build des images..."
	docker-compose build --no-cache

test: ## Lancer les tests
	@echo "🧪 Tests API..."
	cd services/api && npm test
	@echo "🧪 Tests Frontend..."
	cd services/frontend && npm test

lint: ## Linter le code
	@echo "🔍 Lint API..."
	cd services/api && npm run lint
	@echo "🔍 Lint Frontend..."
	cd services/frontend && npm run lint

format: ## Formater le code
	@echo "✨ Format API..."
	cd services/api && npm run format
	@echo "✨ Format Frontend..."
	cd services/frontend && npm run format

db-migrate: ## Exécuter les migrations
	@echo "📊 Migrations database..."
	./scripts/db-migrate.sh

db-seed: ## Peupler la base (dev)
	@echo "🌱 Seed database..."
	./scripts/db-seed.sh

backup: ## Sauvegarder la base
	@echo "💾 Backup..."
	./scripts/backup/backup.sh

deploy-dev: ## Déployer en dev
	@echo "🚀 Déploiement développement..."
	./scripts/deploy/deploy.sh dev

deploy-prod: ## Déployer en production
	@echo "🚀 Déploiement production..."
	./scripts/deploy/deploy-production.sh

health: ## Vérifier la santé des services
	@echo "🏥 Health check..."
	curl http://localhost:3000/health
	curl http://localhost:443/api/health

ps: ## Afficher les conteneurs
	docker-compose ps

shell-api: ## Shell dans le conteneur API
	docker-compose exec api sh

shell-db: ## Shell PostgreSQL
	docker-compose exec postgres psql -U mssante -d mssante

.DEFAULT_GOAL := help
```

### 3.3 `package.json` (racine)

```json
{
  "name": "mssante-operator",
  "version": "1.0.0",
  "description": "Plateforme Opérateur MSSanté",
  "private": true,
  "scripts": {
    "install": "npm install --prefix services/api && npm install --prefix services/frontend",
    "dev:api": "cd services/api && npm run dev",
    "dev:frontend": "cd services/frontend && npm start",
    "dev": "concurrently \"npm run dev:api\" \"npm run dev:frontend\"",
    "build:api": "cd services/api && npm run build",
    "build:frontend": "cd services/frontend && npm run build",
    "build": "npm run build:api && npm run build:frontend",
    "test": "npm test --prefix services/api && npm test --prefix services/frontend",
    "lint": "npm run lint --prefix services/api && npm run lint --prefix services/frontend",
    "format": "prettier --write \"**/*.{js,jsx,json,md}\"",
    "docker:up": "docker-compose up -d",
    "docker:down": "docker-compose down",
    "docker:logs": "docker-compose logs -f",
    "docker:build": "docker-compose build"
  },
  "devDependencies": {
    "concurrently": "^8.2.0",
    "prettier": "^3.0.0"
  }
}
```

---

## 4. Workflow de développement recommandé

### 4.1 Démarrage rapide

```bash
# 1. Cloner le projet
git clone <repo-url> mssante-operator
cd mssante-operator

# 2. Copier les fichiers d'environnement
cp .env.example .env
cp services/api/.env.example services/api/.env.development
cp services/frontend/.env.example services/frontend/.env.development

# 3. Installer les dépendances
make install
# ou
npm install

# 4. Démarrer les services Docker
make start
# ou
docker-compose up -d

# 5. Exécuter les migrations
make db-migrate

# 6. (Optionnel) Peupler avec des données de test
make db-seed

# 7. Ouvrir VSCode
code .
```

### 4.2 Commandes quotidiennes

```bash
# Démarrer le projet
make start

# Voir les logs
make logs

# Arrêter
make stop

# Tests
make test

# Lint et format
make lint
make format
```

### 4.3 Organisation des terminaux dans VSCode

**Terminal 1: API**

```bash
cd services/api
npm run dev
```

**Terminal 2: Frontend**

```bash
cd services/frontend
npm start
```

**Terminal 3: Docker logs**

```bash
docker-compose logs -f
```

**Terminal 4: Commandes diverses**

```bash
# Disponible pour git, scripts, etc.
```

---

## 5. Conventions de code

### 5.1 Nomenclature des fichiers

```
PascalCase:
- Composants React: UserList.jsx, DomainCard.jsx
- Classes: EmailService.js, DatabaseConnection.js

camelCase:
- Fonctions: getUserById(), createMailbox()
- Variables: userEmail, domainList
- Fichiers utilitaires: formatters.js, validators.js

kebab-case:
- Fichiers CSS: main-layout.css
- Fichiers config: docker-compose.yml

SCREAMING_SNAKE_CASE:
- Constantes: MAX_RETRY_COUNT, API_BASE_URL
```

### 5.2 Structure des commits

```
type(scope): description courte

Description détaillée (optionnelle)

Types:
- feat: Nouvelle fonctionnalité
- fix: Correction de bug
- docs: Documentation
- style: Formatting, missing semi colons, etc
- refactor: Refactoring du code
- test: Ajout de tests
- chore: Mise à jour des dépendances, config, etc

Exemples:
feat(webmail): ajout du support des pièces jointes
fix(api): correction de la validation des emails
docs(readme): mise à jour des instructions d'installation
```

---

## 6. Snippets VSCode utiles

Créer `.vscode/snippets.code-snippets`:

```json
{
  "React Component": {
    "prefix": "rfc",
    "body": [
      "import React from 'react';",
      "",
      "const ${1:ComponentName} = () => {",
      "  return (",
      "    <div>",
      "      $0",
      "    </div>",
      "  );",
      "};",
      "",
      "export default ${1:ComponentName};"
    ]
  },
  "Express Route": {
    "prefix": "route",
    "body": [
      "router.${1:get}('/${2:path}', async (req, res) => {",
      "  try {",
      "    $0",
      "    res.json({ success: true });",
      "  } catch (error) {",
      "    console.error(error);",
      "    res.status(500).json({ error: 'Erreur serveur' });",
      "  }",
      "});"
    ]
  }
}
```

---

## 7. Extensions de productivité recommandées

**Must-have:**

- ESLint + Prettier
- GitLens
- Docker
- REST Client (pour tester l'API)

**Très utiles:**

- Todo Tree (trouver les TODO dans le code)
- Error Lens (afficher les erreurs inline)
- Path Intellisense (autocomplétion des chemins)
- Import Cost (voir la taille des imports)

Voilà une structure complète et professionnelle pour organiser votre projet MSSanté dans VSCode ! 🎯