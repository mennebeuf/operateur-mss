# Configuration Traefik - MSSanté Operator

## Vue d'ensemble

Traefik agit comme reverse proxy et load balancer pour l'infrastructure MSSanté. Il gère le routage des requêtes HTTP/HTTPS et TCP (mail), la terminaison TLS, et la génération automatique des certificats.

```
Internet
    │
    ▼
┌─────────────────────────────────────────────────┐
│                   TRAEFIK                        │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌────────┐ │
│  │ :80     │ │ :443    │ │ :25/587 │ │ :143   │ │
│  │ HTTP    │ │ HTTPS   │ │ SMTP    │ │ IMAP   │ │
│  └────┬────┘ └────┬────┘ └────┬────┘ └───┬────┘ │
│       │           │           │          │      │
│       ▼           ▼           ▼          ▼      │
│   Redirect    Frontend     Postfix    Dovecot   │
│   → HTTPS       API                             │
└─────────────────────────────────────────────────┘
```

---

## Structure des fichiers

```
config/traefik/
├── traefik.yml      # Configuration statique (points d'entrée, providers)
└── dynamic.yml      # Configuration dynamique (routers, services, middlewares)
```

---

## Fichier traefik.yml

### Points d'entrée (entryPoints)

Les points d'entrée définissent les ports sur lesquels Traefik écoute.

| Point d'entrée | Port | Usage |
|----------------|------|-------|
| `web` | 80 | HTTP (redirige vers HTTPS) |
| `websecure` | 443 | HTTPS (Frontend + API) |
| `smtp` | 25 | SMTP entrant |
| `submission` | 587 | SMTP authentifié |
| `imap` | 143 | IMAP |

```yaml
entryPoints:
  web:
    address: ":80"
    http:
      redirections:
        entryPoint:
          to: websecure      # Redirection automatique
          scheme: https
```

### Providers

Traefik utilise deux sources de configuration :

1. **Docker** : Découverte automatique des services via labels
2. **File** : Configuration dynamique dans `dynamic.yml`

```yaml
providers:
  docker:
    endpoint: "unix:///var/run/docker.sock"
    exposedByDefault: false    # Sécurité : expose uniquement les services avec label
    network: mssante-network
  file:
    filename: /etc/traefik/dynamic.yml
    watch: true                # Rechargement automatique
```

### Certificats Let's Encrypt

```yaml
certificatesResolvers:
  letsencrypt:
    acme:
      email: admin@votre-domaine.fr    # ⚠️ À PERSONNALISER
      storage: /certificates/acme.json
      httpChallenge:
        entryPoint: web
```

**Personnalisation requise :**
- Remplacer `admin@votre-domaine.fr` par votre email de contact

---

## Fichier dynamic.yml

### Configuration TLS

#### Options TLS standard

```yaml
tls:
  options:
    default:
      minVersion: VersionTLS12
      cipherSuites:
        - TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384
        - TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256
        # ...
```

Ces cipher suites sont conformes aux exigences MSSanté et garantissent une sécurité optimale.

#### Certificats IGC Santé

```yaml
tls:
  certificates:
    - certFile: /certificates/server/fullchain.pem
      keyFile: /certificates/server/server.key
```

**Prérequis :**
- Placer votre certificat IGC Santé dans `config/certificates/server/`
- Construire le fullchain : `cat server.crt intermediate.pem root.pem > fullchain.pem`

### Routers HTTP

#### Frontend

```yaml
routers:
  frontend:
    rule: "Host(`votre-domaine.mssante.fr`)"    # ⚠️ À PERSONNALISER
    entryPoints:
      - websecure
    service: frontend
    middlewares:
      - security-headers
      - rate-limit
```

#### API

```yaml
routers:
  api:
    rule: "Host(`api.votre-domaine.mssante.fr`)"    # ⚠️ À PERSONNALISER
    entryPoints:
      - websecure
    service: api
    middlewares:
      - security-headers
      - rate-limit
      - cors
```

### Middlewares

#### En-têtes de sécurité

```yaml
middlewares:
  security-headers:
    headers:
      frameDeny: true                    # Protection clickjacking
      browserXssFilter: true             # Protection XSS
      contentTypeNosniff: true           # Empêche le MIME sniffing
      forceSTSHeader: true               # Force HTTPS
      stsSeconds: 31536000               # HSTS 1 an
```

#### Rate Limiting

```yaml
  rate-limit:
    rateLimit:
      average: 100      # Requêtes moyennes par période
      burst: 200        # Pic autorisé
      period: 1m        # Période de calcul
```

**Ajustement recommandé selon votre charge :**
- Faible trafic : `average: 50, burst: 100`
- Trafic moyen : `average: 100, burst: 200`
- Fort trafic : `average: 500, burst: 1000`

#### CORS

```yaml
  cors:
    headers:
      accessControlAllowOriginList:
        - "https://votre-domaine.mssante.fr"    # ⚠️ À PERSONNALISER
```

**Personnalisation requise :**
- Ajouter tous les domaines autorisés à accéder à l'API

#### Authentification Dashboard

```yaml
  auth-basic:
    basicAuth:
      users:
        - "admin:$apr1$ruca84Hq$mbjdMZBAG.KWn7vfN/SNK/"
```

**⚠️ OBLIGATOIRE : Générer un nouveau mot de passe**
```bash
# Installation htpasswd
sudo apt install apache2-utils

# Génération du hash
htpasswd -nb admin VotreMotDePasseSecurise

# Résultat à copier dans la config
admin:$apr1$xyz123$AbCdEf...
```

### Routers TCP (Services Mail)

```yaml
tcp:
  routers:
    smtp:
      entryPoints:
        - smtp
      rule: "HostSNI(`*`)"
      service: postfix-smtp
      tls:
        passthrough: true    # TLS géré par Postfix
```

Le mode `passthrough: true` transmet la connexion TLS directement à Postfix/Dovecot qui gèrent leur propre terminaison TLS avec les certificats IGC Santé.

---

## Personnalisations requises

### Checklist avant déploiement

| Élément | Fichier | Valeur par défaut | Action |
|---------|---------|-------------------|--------|
| Email ACME | `traefik.yml` | `admin@votre-domaine.fr` | Remplacer par votre email |
| Domaine frontend | `dynamic.yml` | `votre-domaine.mssante.fr` | Remplacer par votre domaine |
| Domaine API | `dynamic.yml` | `api.votre-domaine.mssante.fr` | Remplacer par votre domaine |
| Domaine dashboard | `dynamic.yml` | `traefik.votre-domaine.mssante.fr` | Remplacer par votre domaine |
| Origines CORS | `dynamic.yml` | `https://votre-domaine.mssante.fr` | Ajouter vos domaines |
| Auth dashboard | `dynamic.yml` | `admin:admin` | Générer nouveau hash |

### Script de personnalisation

```bash
#!/bin/bash
# scripts/configure-traefik.sh

DOMAIN="exemple.mssante.fr"
API_DOMAIN="api.exemple.mssante.fr"
ADMIN_EMAIL="admin@exemple.fr"

# Remplacement dans traefik.yml
sed -i "s/admin@votre-domaine.fr/$ADMIN_EMAIL/g" config/traefik/traefik.yml

# Remplacement dans dynamic.yml
sed -i "s/votre-domaine.mssante.fr/$DOMAIN/g" config/traefik/dynamic.yml
sed -i "s/api.votre-domaine.mssante.fr/$API_DOMAIN/g" config/traefik/dynamic.yml

# Générer le mot de passe dashboard
echo "Générer le hash du mot de passe dashboard :"
htpasswd -nb admin VotreMotDePasse
```

---

## Validation de la configuration

### Vérifier la syntaxe

```bash
# Validation avec Docker
docker run --rm -v $(pwd)/config/traefik:/etc/traefik traefik:v2.10 \
  traefik --configFile=/etc/traefik/traefik.yml --check
```

### Tester les certificats

```bash
# Vérifier le certificat servi
openssl s_client -connect votre-domaine.mssante.fr:443 -servername votre-domaine.mssante.fr

# Vérifier la chaîne de certification
curl -vI https://votre-domaine.mssante.fr
```

### Vérifier les routers

```bash
# Accéder au dashboard (si activé)
curl -u admin:password https://traefik.votre-domaine.mssante.fr/api/http/routers

# Vérifier les services
curl -u admin:password https://traefik.votre-domaine.mssante.fr/api/http/services
```

---

## Sécurisation en production

### Désactiver le dashboard non sécurisé

Dans `traefik.yml`, modifier :
```yaml
api:
  dashboard: true
  insecure: false    # Désactive l'accès non authentifié
```

### Restreindre l'accès au dashboard par IP

```yaml
middlewares:
  ip-whitelist:
    ipWhiteList:
      sourceRange:
        - "10.0.0.0/8"
        - "192.168.1.0/24"
        - "VotreIP/32"
```

### Activer les logs d'audit

```yaml
accessLog:
  filePath: /logs/access.log
  format: json
  fields:
    headers:
      names:
        User-Agent: keep
        Authorization: drop
        X-Forwarded-For: keep
```

---

## Dépannage

### Problème : Certificat non valide

```bash
# Vérifier les logs ACME
docker compose logs traefik | grep -i acme

# Vérifier que le port 80 est accessible (challenge HTTP)
curl -I http://votre-domaine.mssante.fr/.well-known/acme-challenge/test
```

### Problème : Service non accessible

```bash
# Vérifier que le service est découvert
docker compose logs traefik | grep -i "service"

# Vérifier les labels Docker du service
docker inspect mssante-api | grep -A 20 "Labels"
```

### Problème : Erreur 502 Bad Gateway

```bash
# Vérifier la connectivité réseau
docker compose exec traefik ping api

# Vérifier que le service écoute
docker compose exec api netstat -tlnp
```

---

## Historique des modifications

| Date       | Version    | Auteur            | Description       |
|------------|------------|-------------------|-------------------|
| 2025-12-28 | 1.0.0      | Antoine MENNEBEUF | Création initiale |
