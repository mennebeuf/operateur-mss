# Configuration Nginx - MSSanté Operator

## Vue d'ensemble

Nginx est utilisé dans l'infrastructure MSSanté pour servir le frontend React et comme proxy optionnel vers l'API. En production, Traefik gère le routage principal et la terminaison TLS, tandis que Nginx sert les fichiers statiques du frontend.

```
┌─────────────────────────────────────────────────────────────────┐
│                        ARCHITECTURE                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│                         TRAEFIK                                  │
│                    (Reverse Proxy TLS)                           │
│                           │                                      │
│            ┌──────────────┼──────────────┐                      │
│            │              │              │                       │
│            ▼              ▼              ▼                       │
│    ┌──────────────┐ ┌──────────┐ ┌─────────────┐               │
│    │    NGINX     │ │   API    │ │  Postfix/   │               │
│    │  (Frontend)  │ │ Node.js  │ │  Dovecot    │               │
│    │              │ │          │ │             │               │
│    │ ┌──────────┐ │ │          │ │             │               │
│    │ │  React   │ │ │          │ │             │               │
│    │ │  Build   │ │ │          │ │             │               │
│    │ └──────────┘ │ │          │ │             │               │
│    └──────────────┘ └──────────┘ └─────────────┘               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Structure des fichiers

```
config/nginx/
├── nginx.conf                 # Configuration principale
├── conf.d/
│   ├── frontend.conf          # Serveur Frontend (React SPA)
│   ├── api.conf               # Proxy API Backend
│   └── security.conf          # Règles de sécurité globales
└── modsec/
    └── main.conf              # Configuration WAF ModSecurity
```

---

## Fichier nginx.conf

### Description

Configuration principale de Nginx définissant les paramètres globaux, l'optimisation des performances et les upstreams.

### Paramètres des workers

```nginx
worker_processes auto;           # Ajuste automatiquement au nombre de CPU
worker_rlimit_nofile 65535;      # Limite de fichiers ouverts
worker_connections 4096;         # Connexions par worker
```

| Paramètre | Valeur | Description |
|-----------|--------|-------------|
| `worker_processes` | auto | Nombre de workers (1 par CPU) |
| `worker_connections` | 4096 | Connexions simultanées par worker |
| `multi_accept` | on | Accepter plusieurs connexions à la fois |
| `use` | epoll | Méthode d'événements Linux optimisée |

### Optimisation des performances

| Paramètre | Valeur | Description |
|-----------|--------|-------------|
| `sendfile` | on | Transfert fichiers optimisé |
| `tcp_nopush` | on | Optimise l'envoi des headers |
| `tcp_nodelay` | on | Désactive l'algorithme Nagle |
| `keepalive_timeout` | 65s | Durée connexions persistantes |
| `client_max_body_size` | 50M | Taille max des requêtes |

### Compression Gzip

```nginx
gzip on;
gzip_comp_level 6;
gzip_min_length 256;
gzip_types text/plain text/css application/json application/javascript ...;
```

La compression est activée pour tous les types de contenus textuels avec un niveau de compression de 6 (équilibre performance/CPU).

### Format de log JSON

```nginx
log_format json_combined escape=json '{
    "time_local":"$time_local",
    "remote_addr":"$remote_addr",
    "request":"$request",
    "status":"$status",
    "request_time":"$request_time",
    ...
}';
```

Le format JSON facilite l'intégration avec ELK Stack pour l'analyse des logs.

### Upstream Backend

```nginx
upstream api_backend {
    least_conn;                                    # Load balancing
    server api:3000 weight=1 max_fails=3 fail_timeout=30s;
    keepalive 32;                                  # Connexions persistantes
}
```

---

## Fichier conf.d/frontend.conf

### Description

Configuration du serveur pour l'application React (Single Page Application).

### Routing SPA

```nginx
location / {
    try_files $uri $uri/ /index.html;
}
```

Cette directive redirige toutes les requêtes vers `index.html` pour permettre le routing côté client de React.

### Headers de sécurité

| Header | Valeur | Protection |
|--------|--------|------------|
| `Content-Security-Policy` | (voir ci-dessous) | XSS, injection |
| `Strict-Transport-Security` | max-age=31536000 | Force HTTPS |
| `Permissions-Policy` | geolocation=(), ... | APIs navigateur |

#### Content Security Policy

```nginx
add_header Content-Security-Policy "
    default-src 'self';
    script-src 'self' 'unsafe-inline' 'unsafe-eval';
    style-src 'self' 'unsafe-inline';
    img-src 'self' data: https:;
    font-src 'self' data:;
    connect-src 'self' https://api.votre-domaine.mssante.fr wss://api.votre-domaine.mssante.fr;
    frame-ancestors 'self';
" always;
```

### Cache des assets

| Type de fichier | Durée cache | Header |
|-----------------|-------------|--------|
| `.css`, `.js` | 1 an | `public, immutable` |
| Images, fonts | 1 mois | `public` |
| `.json`, `.xml` | 1 jour | `public` |

Les fichiers avec hash dans le nom (générés par React) peuvent être cachés longtemps car leur nom change à chaque modification.

### Personnalisation requise

```nginx
# Remplacer le domaine API dans la CSP
connect-src 'self' https://api.votre-domaine.mssante.fr wss://api.votre-domaine.mssante.fr;
#                        ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^     ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
#                        ⚠️ À PERSONNALISER                   ⚠️ À PERSONNALISER
```

---

## Fichier conf.d/api.conf

### Description

Configuration du proxy vers l'API Backend Node.js.

### Configuration proxy principale

```nginx
location / {
    proxy_pass http://api_backend;
    
    # Headers essentiels
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Request-ID $request_id;
}
```

| Header | Description |
|--------|-------------|
| `X-Real-IP` | IP réelle du client |
| `X-Forwarded-For` | Chaîne des proxies traversés |
| `X-Forwarded-Proto` | Protocole original (http/https) |
| `X-Request-ID` | ID unique pour le tracing |

### Support WebSocket

```nginx
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
```

Nécessaire pour les notifications temps réel des emails.

### Endpoints spécifiques

| Endpoint | Configuration | Particularités |
|----------|---------------|----------------|
| `/health` | Logs désactivés | Health check load balancer |
| `/metrics` | IPs restreintes | Métriques Prometheus |
| `/api/v1/attachments` | 25MB, timeout 120s | Upload pièces jointes |
| `/api/v1/auth` | Rate limit strict | Protection brute force |
| `/api/v1/email` | Timeout 1h, WebSocket | Connexions longues |
| `/api/v1/admin` | Restriction IP possible | Administration |

### Timeouts

| Paramètre | Standard | Uploads | WebSocket |
|-----------|----------|---------|-----------|
| `proxy_connect_timeout` | 60s | 120s | 60s |
| `proxy_send_timeout` | 60s | 120s | 3600s |
| `proxy_read_timeout` | 60s | 120s | 3600s |

### Gestion des erreurs

```nginx
error_page 502 503 504 /api_error.json;

location = /api_error.json {
    internal;
    default_type application/json;
    return 503 '{"error": "Service temporarily unavailable", "code": 503}';
}
```

Retourne une réponse JSON en cas d'indisponibilité du backend.

---

## Fichier conf.d/security.conf

### Description

Règles de sécurité globales applicables à tous les server blocks.

### Blocage des bots malveillants

```nginx
map $http_user_agent $bad_bot {
    default 0;
    ~*^$ 1;                                    # User-agent vide
    ~*(nikto|sqlmap|nmap|masscan) 1;           # Outils de scan
    ~*(wget|curl|libwww|python|perl|ruby) 1;   # Scripts
}
```

**Application dans un server block :**
```nginx
if ($bad_bot) {
    return 403;
}
```

### Zones de rate limiting

| Zone | Rate | Usage |
|------|------|-------|
| `req_limit` | 10 req/s | Requêtes générales |
| `auth_limit` | 5 req/min | Authentification |
| `api_limit` | 30 req/s | API |
| `upload_limit` | 1 req/s | Uploads |

### Listes IP

#### IPs autorisées (administration)

```nginx
geo $admin_allowed {
    default 0;
    127.0.0.1 1;
    10.0.0.0/8 1;
    172.16.0.0/12 1;
    192.168.0.0/16 1;
    # x.x.x.x 1;    # ⚠️ Ajouter vos IPs
}
```

#### IPs bloquées

```nginx
geo $blocked_ip {
    default 0;
    # x.x.x.x 1;    # Ajouter les IPs à bloquer
}
```

### Protection contre les injections

| Type | Pattern détecté |
|------|-----------------|
| SQL Injection | `union select`, `drop table`, etc. |
| Path Traversal | `../`, `/etc/passwd`, etc. |
| XSS basique | `<script>` |

---

## Fichier modsec/main.conf

### Description

Configuration du Web Application Firewall (WAF) ModSecurity avec les règles OWASP CRS.

### Activation

```nginx
SecRuleEngine On              # Production : blocage actif
# SecRuleEngine DetectionOnly # Développement : logs uniquement
```

### Limites de requêtes

| Paramètre | Valeur | Description |
|-----------|--------|-------------|
| `SecRequestBodyLimit` | 50MB | Corps de requête max |
| `SecRequestBodyNoFilesLimit` | 128KB | Corps sans fichiers |
| `SecResponseBodyLimit` | 512KB | Corps de réponse analysé |

### Règles OWASP CRS

```nginx
Include /etc/nginx/modsec/owasp-crs/crs-setup.conf
Include /etc/nginx/modsec/owasp-crs/rules/*.conf
```

Les règles OWASP Core Rule Set protègent contre :
- Injection SQL
- Cross-Site Scripting (XSS)
- Remote File Inclusion (RFI)
- Local File Inclusion (LFI)
- Remote Code Execution (RCE)

### Exclusions MSSanté

Certaines règles sont désactivées pour éviter les faux positifs :

| Endpoint | Règles exclues | Raison |
|----------|----------------|--------|
| `/api/v1/auth` | 942100, 942200 | Tokens longs |
| `/api/v1/attachments` | 920420, 200002 | Upload fichiers |
| `/api/v1/email` | 941100, 941110, 941160 | Contenu HTML emails |

### Règles personnalisées MSSanté

| ID | Description | Action |
|----|-------------|--------|
| 2000 | Accès `/admin` non autorisé | Blocage 403 |
| 2001 | Scan WordPress détecté | Blocage 403 |
| 2002 | Scan outils PHP | Blocage 403 |
| 2010-2011 | Brute force login (>10/min) | Blocage 429 |
| 3000 | Numéro SS dans réponse | Log alerte |

### Protection données de santé

```nginx
# Détection des numéros de sécurité sociale
SecRule RESPONSE_BODY "@rx \b[12][0-9]{2}(0[1-9]|1[0-2])[0-9]{2}[0-9]{3}[0-9]{3}[0-9]{2}\b" \
    "id:3000, phase:4, pass, log, msg:'Numéro SS détecté'"
```

---

## Checklist de personnalisation

### frontend.conf

| Élément | Valeur par défaut | Action |
|---------|-------------------|--------|
| Domaine API (CSP) | `api.votre-domaine.mssante.fr` | Remplacer |
| Domaine WebSocket (CSP) | `wss://api.votre-domaine.mssante.fr` | Remplacer |

### security.conf

| Élément | Action |
|---------|--------|
| IPs administration | Ajouter dans `$admin_allowed` |
| IPs bloquées | Ajouter dans `$blocked_ip` |
| User-agents autorisés | Adapter `$bad_bot` si nécessaire |

### modsec/main.conf

| Élément | Action |
|---------|--------|
| Mode (On/DetectionOnly) | Passer en `On` pour la production |
| Exclusions | Ajuster selon les faux positifs observés |

---

## Script de personnalisation

```bash
#!/bin/bash
# scripts/configure-nginx.sh

DOMAIN="exemple.mssante.fr"
API_DOMAIN="api.exemple.mssante.fr"

# Personnaliser frontend.conf
sed -i "s/api\.votre-domaine\.mssante\.fr/$API_DOMAIN/g" \
    config/nginx/conf.d/frontend.conf

echo "✅ Configuration Nginx personnalisée"
```

---

## Validation de la configuration

### Vérifier la syntaxe

```bash
# Via Docker
docker run --rm -v $(pwd)/config/nginx:/etc/nginx:ro nginx:alpine nginx -t

# Ou directement
nginx -t -c /path/to/nginx.conf
```

### Tester la configuration

```bash
# Démarrer Nginx en mode test
docker run --rm -p 8080:80 \
    -v $(pwd)/config/nginx/nginx.conf:/etc/nginx/nginx.conf:ro \
    -v $(pwd)/config/nginx/conf.d:/etc/nginx/conf.d:ro \
    nginx:alpine

# Tester les endpoints
curl -I http://localhost:8080/
curl -I http://localhost:8080/health
```

### Vérifier les headers de sécurité

```bash
# Vérifier les headers
curl -I https://votre-domaine.mssante.fr | grep -E "(X-Frame|X-Content|Strict-Transport|Content-Security)"
```

---

## Dépannage

### Erreur 502 Bad Gateway

```bash
# Vérifier que le backend est accessible
docker compose exec nginx ping api

# Vérifier les logs
docker compose logs nginx | grep -i error

# Vérifier l'upstream
docker compose exec nginx cat /etc/nginx/nginx.conf | grep upstream -A 5
```

### Erreur 413 Request Entity Too Large

```bash
# Augmenter la limite dans nginx.conf
client_max_body_size 100M;

# Ou dans le location spécifique
location /api/v1/attachments {
    client_max_body_size 50M;
}
```

### Erreur 403 Forbidden (ModSecurity)

```bash
# Vérifier les logs ModSecurity
tail -f /var/log/nginx/modsec_audit.log

# Identifier la règle bloquante
grep "id:" /var/log/nginx/modsec_audit.log | tail -20

# Ajouter une exclusion si faux positif
SecRule REQUEST_URI "@beginsWith /api/v1/problematic-endpoint" \
    "id:1003, phase:1, pass, nolog, ctl:ruleRemoveById=RULE_ID"
```

### Performance dégradée

```bash
# Vérifier le nombre de workers
grep worker_processes /etc/nginx/nginx.conf

# Vérifier les connexions actives
curl http://localhost/nginx_status

# Ajuster si nécessaire
worker_processes auto;
worker_connections 4096;
```

---

## Métriques et monitoring

### Activer le stub_status

```nginx
# Ajouter dans un server block
location /nginx_status {
    stub_status on;
    allow 127.0.0.1;
    allow 10.0.0.0/8;
    deny all;
}
```

### Métriques disponibles

| Métrique | Description |
|----------|-------------|
| Active connections | Connexions actives |
| accepts | Total connexions acceptées |
| handled | Total connexions gérées |
| requests | Total requêtes |
| Reading | Connexions en lecture |
| Writing | Connexions en écriture |
| Waiting | Connexions keep-alive |

### Intégration Prometheus

Utiliser `nginx-prometheus-exporter` pour exposer les métriques :

```yaml
# docker-compose.yml
nginx-exporter:
  image: nginx/nginx-prometheus-exporter:latest
  command:
    - '-nginx.scrape-uri=http://nginx/nginx_status'
  ports:
    - "9113:9113"
```

---

## Ressources complémentaires

- [Documentation Nginx](https://nginx.org/en/docs/)
- [ModSecurity Reference Manual](https://github.com/SpiderLabs/ModSecurity/wiki)
- [OWASP Core Rule Set](https://coreruleset.org/docs/)
- [Nginx Security Hardening](https://www.acunetix.com/blog/articles/nginx-security-hardening/)