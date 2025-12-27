# Guide de mise en œuvre - Stack conteneurisée MSSanté

## Vue d'ensemble de l'architecture

### Architecture globale conteneurisée

```
┌─────────────────────────────────────────────────────────────┐
│                    Internet / Utilisateurs                  │
└─────────────────────────────┬───────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────┐
│                    Docker Host / Cluster                    │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │            Traefik (Reverse Proxy)                    │  │
│  │     Ports: 80, 443, 25, 587, 143                      │  │
│  └────────┬────────────┬──────────────┬─────────────┬────┘  │
│           │            │              │             │       │
│  ┌────────▼──────┐ ┌───▼─────┐ ┌──────▼─────┐ ┌─────▼────┐  │
│  │   API Node.js │ │ Postfix │ │   Dovecot  │ │ Frontend │  │
│  │   (Express)   │ │  (SMTP) │ │   (IMAP)   │ │  (React) │  │
│  └────────┬──────┘ └───┬─────┘ └──────┬─────┘ └──────────┘  │
│           │            │              │                     │
│  ┌────────▼────────────▼──────────────▼───────────────────┐ │
│  │                  PostgreSQL                            │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌──────────────────┐  ┌──────────────────┐                 │
│  │      Redis       │  │    Prometheus    │                 │
│  │     (Cache)      │  │   (Monitoring)   │                 │
│  └──────────────────┘  └──────────────────┘                 │
└─────────────────────────────────────────────────────────────┘
```

---

## Étape 1 : Préparation de l'environnement

### 1.1 Installation des prérequis

**Sur Ubuntu Server 22.04 LTS:**

```bash
# Mise à jour du système
sudo apt update && sudo apt upgrade -y

# Installation Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Ajout utilisateur au groupe docker
sudo usermod -aG docker $USER
newgrp docker

# Installation Docker Compose
sudo apt install docker-compose-plugin -y

# Vérification
docker --version
docker compose version
```

### 1.2 Structure du projet

```bash
# Création de l'arborescence
mkdir -p ~/mssante-operator
cd ~/mssante-operator

# Structure complète
mssante-operator/
├── docker-compose.yml
├── .env
├── services/
│   ├── api/
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   ├── src/
│   │   └── .env
│   ├── frontend/
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   └── src/
│   ├── postfix/
│   │   ├── Dockerfile
│   │   ├── main.cf
│   │   └── master.cf
│   └── dovecot/
│       ├── Dockerfile
│       ├── dovecot.conf
│       └── conf.d/
├── config/
│   ├── traefik/
│   │   └── traefik.yml
│   ├── prometheus/
│   │   └── prometheus.yml
│   └── certificates/
│       ├── igc-sante/
│       └── server/
├── data/
│   ├── postgres/
│   ├── redis/
│   ├── mail/
│   └── logs/
└── scripts/
    ├── init-db.sh
    ├── backup.sh
    └── deploy.sh
```

```bash
# Création automatique
mkdir -p services/{api,frontend,postfix,dovecot}
mkdir -p config/{traefik,prometheus,certificates/{igc-sante,server}}
mkdir -p data/{postgres,redis,mail,logs}
mkdir -p scripts
```

---

## Étape 2 : Configuration Docker Compose

### 2.1 Fichier docker-compose.yml principal

```yaml
version: '3.8'

services:
  # Reverse Proxy & Load Balancer
  traefik:
    image: traefik:v2.10
    container_name: mssante-traefik
    restart: unless-stopped
    ports:
      - "80:80"       # HTTP
      - "443:443"     # HTTPS
      - "25:25"       # SMTP
      - "587:587"     # SMTP Submission
      - "143:143"     # IMAP
      - "8080:8080"   # Dashboard Traefik
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - ./config/traefik/traefik.yml:/etc/traefik/traefik.yml:ro
      - ./config/certificates:/certificates:ro
      - ./data/logs/traefik:/logs
    networks:
      - mssante-network
    labels:
      - "traefik.enable=true"

  # Base de données PostgreSQL
  postgres:
    image: postgres:15-alpine
    container_name: mssante-postgres
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${POSTGRES_DB:-mssante}
      POSTGRES_USER: ${POSTGRES_USER:-mssante}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_INITDB_ARGS: "-E UTF8 --locale=fr_FR.UTF-8"
    volumes:
      - ./data/postgres:/var/lib/postgresql/data
      - ./scripts/init-db.sh:/docker-entrypoint-initdb.d/init-db.sh
    networks:
      - mssante-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-mssante}"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Cache Redis
  redis:
    image: redis:7-alpine
    container_name: mssante-redis
    restart: unless-stopped
    command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD}
    volumes:
      - ./data/redis:/data
    networks:
      - mssante-network
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  # API Backend (Node.js)
  api:
    build:
      context: ./services/api
      dockerfile: Dockerfile
    container_name: mssante-api
    restart: unless-stopped
    environment:
      NODE_ENV: production
      DB_HOST: postgres
      DB_PORT: 5432
      DB_NAME: ${POSTGRES_DB:-mssante}
      DB_USER: ${POSTGRES_USER:-mssante}
      DB_PASSWORD: ${POSTGRES_PASSWORD}
      REDIS_HOST: redis
      REDIS_PORT: 6379
      REDIS_PASSWORD: ${REDIS_PASSWORD}
      JWT_SECRET: ${JWT_SECRET}
      PSC_CLIENT_ID: ${PSC_CLIENT_ID}
      PSC_CLIENT_SECRET: ${PSC_CLIENT_SECRET}
    volumes:
      - ./data/logs/api:/app/logs
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - mssante-network
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.api.rule=Host(`api.${DOMAIN}`)"
      - "traefik.http.routers.api.entrypoints=websecure"
      - "traefik.http.routers.api.tls=true"
      - "traefik.http.services.api.loadbalancer.server.port=3000"

  # Frontend (React)
  frontend:
    build:
      context: ./services/frontend
      dockerfile: Dockerfile
    container_name: mssante-frontend
    restart: unless-stopped
    environment:
      REACT_APP_API_URL: https://api.${DOMAIN}
      REACT_APP_PSC_CLIENT_ID: ${PSC_CLIENT_ID}
    networks:
      - mssante-network
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.frontend.rule=Host(`${DOMAIN}`)"
      - "traefik.http.routers.frontend.entrypoints=websecure"
      - "traefik.http.routers.frontend.tls=true"
      - "traefik.http.services.frontend.loadbalancer.server.port=80"

  # Serveur SMTP (Postfix)
  postfix:
    build:
      context: ./services/postfix
      dockerfile: Dockerfile
    container_name: mssante-postfix
    restart: unless-stopped
    hostname: mail.${DOMAIN}
    environment:
      DOMAIN: ${DOMAIN}
      RELAY_HOST: ${RELAY_HOST:-}
    volumes:
      - ./data/mail:/var/mail
      - ./config/certificates/server:/etc/ssl/certs:ro
      - ./config/certificates/igc-sante:/etc/ssl/igc-sante:ro
      - ./data/logs/postfix:/var/log/postfix
    ports:
      - "25:25"
      - "587:587"
    networks:
      - mssante-network
    depends_on:
      - postgres

  # Serveur IMAP (Dovecot)
  dovecot:
    build:
      context: ./services/dovecot
      dockerfile: Dockerfile
    container_name: mssante-dovecot
    restart: unless-stopped
    environment:
      DOMAIN: ${DOMAIN}
    volumes:
      - ./data/mail:/var/mail
      - ./config/certificates/server:/etc/ssl/certs:ro
      - ./config/certificates/igc-sante:/etc/ssl/igc-sante:ro
      - ./data/logs/dovecot:/var/log/dovecot
    ports:
      - "143:143"
    networks:
      - mssante-network
    depends_on:
      - postgres
      - postfix

  # Monitoring (Prometheus)
  prometheus:
    image: prom/prometheus:latest
    container_name: mssante-prometheus
    restart: unless-stopped
    volumes:
      - ./config/prometheus/prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - ./data/prometheus:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
    networks:
      - mssante-network
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.prometheus.rule=Host(`monitoring.${DOMAIN}`)"
      - "traefik.http.routers.prometheus.entrypoints=websecure"
      - "traefik.http.routers.prometheus.tls=true"
      - "traefik.http.services.prometheus.loadbalancer.server.port=9090"

  # Visualisation (Grafana)
  grafana:
    image: grafana/grafana:latest
    container_name: mssante-grafana
    restart: unless-stopped
    environment:
      GF_SECURITY_ADMIN_PASSWORD: ${GRAFANA_PASSWORD}
      GF_INSTALL_PLUGINS: grafana-piechart-panel
    volumes:
      - ./data/grafana:/var/lib/grafana
    depends_on:
      - prometheus
    networks:
      - mssante-network
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.grafana.rule=Host(`grafana.${DOMAIN}`)"
      - "traefik.http.routers.grafana.entrypoints=websecure"
      - "traefik.http.routers.grafana.tls=true"
      - "traefik.http.services.grafana.loadbalancer.server.port=3000"

networks:
  mssante-network:
    driver: bridge

volumes:
  postgres_data:
  redis_data:
  mail_data:
```

### 2.2 Fichier .env

```bash
# .env
# ATTENTION: Ne jamais commiter ce fichier!

# Domaine
DOMAIN=votre-domaine.mssante.fr

# PostgreSQL
POSTGRES_DB=mssante
POSTGRES_USER=mssante
POSTGRES_PASSWORD=VotreMotDePasseSecurise123!

# Redis
REDIS_PASSWORD=VotreRedisPassword456!

# API
JWT_SECRET=VotreCleSecretJWT789!
PSC_CLIENT_ID=votre_client_id_psc
PSC_CLIENT_SECRET=votre_client_secret_psc

# Monitoring
GRAFANA_PASSWORD=VotreGrafanaPassword!

# SMTP Relay (optionnel)
RELAY_HOST=
```

---

## Étape 3 : Construction des services

### 3.1 Service API (Node.js + Express)

#### Dockerfile

```dockerfile
# services/api/Dockerfile
FROM node:20-alpine

# Installation des dépendances système
RUN apk add --no-cache \
    postgresql-client \
    openssl \
    ca-certificates

# Répertoire de travail
WORKDIR /app

# Copie des fichiers package
COPY package*.json ./

# Installation des dépendances
RUN npm ci --only=production

# Copie du code source
COPY . .

# Création utilisateur non-root
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

USER nodejs

# Port d'écoute
EXPOSE 3000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node healthcheck.js

# Démarrage
CMD ["node", "src/server.js"]
```

#### package.json

```json
{
  "name": "mssante-api",
  "version": "1.0.0",
  "description": "API Backend MSSanté",
  "main": "src/server.js",
  "scripts": {
    "start": "node src/server.js",
    "dev": "nodemon src/server.js",
    "test": "jest"
  },
  "dependencies": {
    "express": "^4.18.2",
    "pg": "^8.11.3",
    "redis": "^4.6.10",
    "jsonwebtoken": "^9.0.2",
    "bcrypt": "^5.1.1",
    "axios": "^1.6.0",
    "helmet": "^7.1.0",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1",
    "winston": "^3.11.0",
    "joi": "^17.11.0"
  },
  "devDependencies": {
    "nodemon": "^3.0.1",
    "jest": "^29.7.0"
  }
}
```

#### Structure src/

```bash
services/api/src/
├── server.js
├── config/
│   ├── database.js
│   ├── redis.js
│   └── psc.js
├── routes/
│   ├── auth.js
│   ├── mailboxes.js
│   ├── users.js
│   └── certificates.js
├── controllers/
│   ├── authController.js
│   ├── mailboxController.js
│   └── userController.js
├── models/
│   ├── User.js
│   ├── Mailbox.js
│   └── Certificate.js
├── middleware/
│   ├── auth.js
│   ├── validation.js
│   └── errorHandler.js
└── utils/
    ├── logger.js
    └── smtp.js
```

#### Exemple server.js

```javascript
// services/api/src/server.js
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
require('dotenv').config();

const logger = require('./utils/logger');
const { connectDB } = require('./config/database');
const { connectRedis } = require('./config/redis');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware de sécurité
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true
}));

// Parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/v1/auth', require('./routes/auth'));
app.use('/api/v1/mailboxes', require('./routes/mailboxes'));
app.use('/api/v1/users', require('./routes/users'));
app.use('/api/v1/certificates', require('./routes/certificates'));

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString() 
  });
});

// Gestion des erreurs
app.use((err, req, res, next) => {
  logger.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Erreur serveur'
  });
});

// Démarrage
const start = async () => {
  try {
    await connectDB();
    await connectRedis();
    
    app.listen(PORT, () => {
      logger.info(`API démarrée sur le port ${PORT}`);
    });
  } catch (error) {
    logger.error('Erreur démarrage:', error);
    process.exit(1);
  }
};

start();
```

### 3.2 Service Frontend (React)

#### Dockerfile

```dockerfile
# services/frontend/Dockerfile
# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Production stage
FROM nginx:alpine

# Copie des fichiers buildés
COPY --from=builder /app/build /usr/share/nginx/html

# Configuration Nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Utilisateur non-root
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chown -R nginx:nginx /var/cache/nginx && \
    chown -R nginx:nginx /var/log/nginx && \
    touch /var/run/nginx.pid && \
    chown -R nginx:nginx /var/run/nginx.pid

USER nginx

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

#### nginx.conf

```nginx
# services/frontend/nginx.conf
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    # Gzip
    gzip on;
    gzip_vary on;
    gzip_types text/plain text/css text/xml text/javascript 
               application/x-javascript application/xml+rss 
               application/json application/javascript;

    # SPA routing
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache des assets
    location ~* \.(jpg|jpeg|png|gif|ico|css|js|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Sécurité
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
}
```

### 3.3 Service Postfix (SMTP)

#### Dockerfile

```dockerfile
# services/postfix/Dockerfile
FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

# Installation Postfix
RUN apt-get update && apt-get install -y \
    postfix \
    postfix-pgsql \
    ca-certificates \
    rsyslog \
    supervisor \
    && rm -rf /var/lib/apt/lists/*

# Copie des configurations
COPY main.cf /etc/postfix/main.cf
COPY master.cf /etc/postfix/master.cf
COPY pgsql-virtual-mailbox-domains.cf /etc/postfix/
COPY pgsql-virtual-mailbox-maps.cf /etc/postfix/

# Script de démarrage
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Configuration supervisord
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

EXPOSE 25 587

CMD ["/entrypoint.sh"]
```

#### main.cf

```
# services/postfix/main.cf
# Configuration Postfix MSSanté

# Paramètres généraux
myhostname = mail.votre-domaine.mssante.fr
mydomain = votre-domaine.mssante.fr
myorigin = $mydomain
mydestination = localhost

# TLS obligatoire (MSSanté)
smtpd_tls_security_level = may
smtpd_tls_mandatory_protocols = !SSLv2, !SSLv3, !TLSv1, !TLSv1.1
smtpd_tls_protocols = !SSLv2, !SSLv3, !TLSv1, !TLSv1.1
smtpd_tls_mandatory_ciphers = high
smtpd_tls_ciphers = high

# Certificats IGC Santé
smtpd_tls_cert_file = /etc/ssl/certs/server.pem
smtpd_tls_key_file = /etc/ssl/certs/server.key
smtpd_tls_CAfile = /etc/ssl/igc-sante/ca-bundle.pem

# Authentification mutuelle pour BAL applicatives
smtpd_tls_ask_ccert = yes
smtpd_tls_req_ccert = no

# Virtual mailboxes (PostgreSQL)
virtual_mailbox_domains = pgsql:/etc/postfix/pgsql-virtual-mailbox-domains.cf
virtual_mailbox_maps = pgsql:/etc/postfix/pgsql-virtual-mailbox-maps.cf
virtual_transport = lmtp:unix:private/dovecot-lmtp

# Restrictions
smtpd_recipient_restrictions =
    permit_mynetworks,
    permit_sasl_authenticated,
    reject_unauth_destination

# Taille maximale messages (25 Mo)
message_size_limit = 26214400

# Logs
maillog_file = /var/log/postfix/mail.log
```

#### entrypoint.sh

```bash
#!/bin/bash
# services/postfix/entrypoint.sh

# Génération des tables de hash
postmap /etc/postfix/pgsql-virtual-mailbox-domains.cf
postmap /etc/postfix/pgsql-virtual-mailbox-maps.cf

# Démarrage rsyslog
service rsyslog start

# Démarrage Postfix
postfix start

# Suivi des logs
tail -f /var/log/postfix/mail.log
```

### 3.4 Service Dovecot (IMAP)

#### Dockerfile

```dockerfile
# services/dovecot/Dockerfile
FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

# Installation Dovecot
RUN apt-get update && apt-get install -y \
    dovecot-core \
    dovecot-imapd \
    dovecot-lmtpd \
    dovecot-pgsql \
    ca-certificates \
    rsyslog \
    && rm -rf /var/lib/apt/lists/*

# Copie des configurations
COPY dovecot.conf /etc/dovecot/dovecot.conf
COPY conf.d/ /etc/dovecot/conf.d/

# Script de démarrage
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 143

CMD ["/entrypoint.sh"]
```

#### dovecot.conf

```
# services/dovecot/dovecot.conf
# Configuration Dovecot MSSanté

protocols = imap lmtp

# SSL/TLS (MSSanté)
ssl = required
ssl_cert = </etc/ssl/certs/server.pem
ssl_key = </etc/ssl/certs/server.key
ssl_ca = </etc/ssl/igc-sante/ca-bundle.pem

ssl_min_protocol = TLSv1.2
ssl_cipher_list = ECDHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES128-GCM-SHA256
ssl_prefer_server_ciphers = yes

# Authentification
auth_mechanisms = plain login

# Base de données PostgreSQL
!include conf.d/auth-sql.conf.ext

# Mail location
mail_location = maildir:/var/mail/%d/%n

# Logs
log_path = /var/log/dovecot/dovecot.log
info_log_path = /var/log/dovecot/info.log
debug_log_path = /var/log/dovecot/debug.log
```

---

## Étape 4 : Configuration Traefik

### 4.1 traefik.yml

```yaml
# config/traefik/traefik.yml
global:
  checkNewVersion: true
  sendAnonymousUsage: false

# Points d'entrée
entryPoints:
  web:
    address: ":80"
    http:
      redirections:
        entryPoint:
          to: websecure
          scheme: https
  
  websecure:
    address: ":443"
    http:
      tls:
        options: default
  
  smtp:
    address: ":25"
  
  submission:
    address: ":587"
  
  imap:
    address: ":143"

# Fournisseurs
providers:
  docker:
    endpoint: "unix:///var/run/docker.sock"
    exposedByDefault: false
  file:
    filename: /etc/traefik/dynamic.yml
    watch: true

# API et dashboard
api:
  dashboard: true
  insecure: true

# Certificats
certificatesResolvers:
  letsencrypt:
    acme:
      email: admin@votre-domaine.fr
      storage: /certificates/acme.json
      httpChallenge:
        entryPoint: web

# TLS
tls:
  options:
    default:
      minVersion: VersionTLS12
      cipherSuites:
        - TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384
        - TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256
      curvePreferences:
        - CurveP521
        - CurveP384

# Logs
log:
  level: INFO
  filePath: /logs/traefik.log

accessLog:
  filePath: /logs/access.log
```

---

## Étape 5 : Scripts utilitaires

### 5.1 Script d'initialisation DB

```bash
#!/bin/bash
# scripts/init-db.sh

set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    -- Extensions
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    CREATE EXTENSION IF NOT EXISTS "pg_trgm";
    
    -- Table users
    CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        rpps_id VARCHAR(20) UNIQUE,
        psc_subject VARCHAR(255) UNIQUE,
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        email VARCHAR(255) UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        status VARCHAR(20) DEFAULT 'active'
    );
    
    -- Table mailboxes
    CREATE TABLE IF NOT EXISTS mailboxes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        type VARCHAR(20) NOT NULL,
        owner_id UUID REFERENCES users(id),
        status VARCHAR(20) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    
    -- Index
    CREATE INDEX idx_mailboxes_email ON mailboxes(email);
    CREATE INDEX idx_users_rpps ON users(rpps_id);
    
    GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO $POSTGRES_USER;
EOSQL

echo "Base de données initialisée avec succès!"
```

### 5.2 Script de déploiement

```bash
#!/bin/bash
# scripts/deploy.sh

set -e

echo "🚀 Déploiement MSSanté Operator"

# Vérification fichier .env
if [ ! -f .env ]; then
    echo "❌ Fichier .env manquant!"
    exit 1
fi

# Pull des images
echo "📥 Téléchargement des images..."
docker compose pull

# Build des services custom
echo "🔨 Build des services..."
docker compose build --no-cache

# Arrêt des anciens conteneurs
echo "🛑 Arrêt des conteneurs existants..."
docker compose down

# Démarrage
echo "▶️  Démarrage des services..."
docker compose up -d

# Attente de la disponibilité
echo "⏳ Attente du démarrage..."
sleep 10

# Vérification
echo "🔍 Vérification des services..."
docker compose ps

echo "✅ Déploiement terminé!"
echo ""
echo "📊 Accès aux services:"
echo "   - API: https://api.${DOMAIN}"
echo "   - Frontend: https://${DOMAIN}"
echo "   - Grafana: https://grafana.${DOMAIN}"
echo "   - Traefik Dashboard: http://localhost:8080"
```

### 5.3 Script de sauvegarde

```bash
#!/bin/bash
# scripts/backup.sh

BACKUP_DIR="./backups"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p "$BACKUP_DIR"

echo "💾 Sauvegarde PostgreSQL..."
docker compose exec -T postgres pg_dump -U mssante mssante | \
    gzip > "$BACKUP_DIR/db_$DATE.sql.gz"

echo "💾 Sauvegarde Redis..."
docker compose exec -T redis redis-cli --rdb /data/dump.rdb
cp data/redis/dump.rdb "$BACKUP_DIR/redis_$DATE.rdb"

echo "💾 Sauvegarde mails..."
tar -czf "$BACKUP_DIR/mail_$DATE.tar.gz" data/mail/

echo "✅ Sauvegarde terminée: $BACKUP_DIR"
```

---

## Étape 6 : Déploiement

### 6.1 Premier démarrage

```bash
# 1. Cloner ou créer la structure
cd ~/mssante-operator

# 2. Configurer .env
cp .env.example .env
nano .env  # Éditer les variables

# 3. Créer les répertoires data
mkdir -p data/{postgres,redis,mail,logs,prometheus,grafana}
chmod -R 755 data/

# 4. Premier démarrage
./scripts/deploy.sh

# 5. Vérifier les logs
docker compose logs -f

# 6. Vérifier la santé
docker compose ps
```

### 6.2 Commandes utiles

```bash
# Voir les logs d'un service
docker compose logs -f api
docker compose logs -f postfix

# Redémarrer un service
docker compose restart api

# Reconstruire un service
docker compose up -d --build api

# Entrer dans un conteneur
docker compose exec api sh
docker compose exec postgres psql -U mssante

# Arrêter tout
docker compose down

# Arrêter et supprimer les volumes
docker compose down -v

# Statistiques ressources
docker stats
```

### 6.3 Tests de fonctionnement

```bash
# Test API
curl https://api.votre-domaine.mssante.fr/health

# Test SMTP
telnet mail.votre-domaine.mssante.fr 587

# Test IMAP
openssl s_client -connect mail.votre-domaine.mssante.fr:143 -starttls imap

# Test PostgreSQL
docker compose exec postgres psql -U mssante -c "SELECT count(*) FROM users;"
```

---

## Étape 7 : Configuration post-déploiement

### 7.1 Installation des certificats IGC Santé

```bash
# Copier les certificats dans le bon répertoire
cp server.pem config/certificates/server/
cp server.key config/certificates/server/
cp ca-bundle.pem config/certificates/igc-sante/

# Vérifier les permissions
chmod 644 config/certificates/server/server.pem
chmod 600 config/certificates/server/server.key

# Redémarrer les services mail
docker compose restart postfix dovecot
```

### 7.2 Configuration DNS

```bash
# Ajouter les enregistrements DNS:
votre-domaine.mssante.fr.         A      YOUR_IP
mail.votre-domaine.mssante.fr.    A      YOUR_IP
api.votre-domaine.mssante.fr.     A      YOUR_IP
grafana.votre-domaine.mssante.fr. A      YOUR_IP

# MX
votre-domaine.mssante.fr.  MX  10  mail.votre-domaine.mssante.fr.

# SPF
votre-domaine.mssante.fr.  TXT  "v=spf1 mx -all"
```

---

## Étape 8 : Monitoring

### 8.1 Accès Grafana

```bash
# URL: https://grafana.votre-domaine.mssante.fr
# User: admin
# Pass: voir variable GRAFANA_PASSWORD dans .env
```

### 8.2 Dashboards recommandés

1. **Dashboard système**: CPU, RAM, Disque
2. **Dashboard Docker**: Conteneurs, réseaux
3. **Dashboard PostgreSQL**: Connexions, requêtes
4. **Dashboard Mail**: Messages envoyés/reçus

---

## Avantages de la stack conteneurisée

✅ **Isolation**: Chaque service dans son conteneur
✅ **Reproductibilité**: Même environnement partout
✅ **Scalabilité**: Facile d'ajouter des réplicas
✅ **Mise à jour**: Rolling updates sans downtime
✅ **Portabilité**: Fonctionne sur n'importe quel host
✅ **Développement**: Environnement identique dev/prod
