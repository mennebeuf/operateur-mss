# Configuration Prometheus - MSSanté Operator

## Vue d'ensemble

Prometheus est le système de monitoring et d'alerting de l'infrastructure MSSanté. Il collecte les métriques de tous les services, évalue les règles d'alertes et transmet les notifications via AlertManager.

```
┌─────────────────────────────────────────────────────────────────┐
│                      ARCHITECTURE MONITORING                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐             │
│  │   API   │  │Postgres │  │  Redis  │  │ Postfix │             │
│  │  :3000  │  │  :9187  │  │  :9121  │  │  :9154  │             │
│  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘             │
│       │            │            │            │                    │
│       └────────────┴─────┬──────┴────────────┘                   │
│                          │                                        │
│                          ▼                                        │
│                   ┌─────────────┐                                 │
│                   │  PROMETHEUS │◄──── alerts.yml                 │
│                   │    :9090    │                                 │
│                   └──────┬──────┘                                 │
│                          │                                        │
│                          ▼                                        │
│                   ┌─────────────┐                                 │
│                   │ALERTMANAGER │◄──── alertmanager.yml           │
│                   │    :9093    │                                 │
│                   └──────┬──────┘                                 │
│                          │                                        │
│            ┌─────────────┼─────────────┐                         │
│            ▼             ▼             ▼                          │
│       ┌────────┐   ┌──────────┐  ┌───────────┐                   │
│       │ Email  │   │  Slack   │  │ PagerDuty │                   │
│       └────────┘   └──────────┘  └───────────┘                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Structure des fichiers

```
config/prometheus/
├── prometheus.yml      # Configuration principale Prometheus
├── alerts.yml          # Règles d'alertes
├── alertmanager.yml    # Configuration AlertManager (routage notifications)
└── blackbox.yml        # Sondes externes (HTTP, SMTP, IMAP)
```

---

## Fichier prometheus.yml

### Description

Configuration principale de Prometheus définissant les cibles à scraper et les paramètres globaux.

### Paramètres globaux

```yaml
global:
  scrape_interval: 15s          # Fréquence de collecte
  evaluation_interval: 15s       # Fréquence d'évaluation des règles
```

| Paramètre | Valeur | Description |
|-----------|--------|-------------|
| `scrape_interval` | 15s | Intervalle entre chaque collecte de métriques |
| `evaluation_interval` | 15s | Intervalle d'évaluation des règles d'alertes |

### Jobs de scrape

| Job | Port | Exporter | Métriques collectées |
|-----|------|----------|---------------------|
| `prometheus` | 9090 | natif | Métriques internes Prometheus |
| `node` | 9100 | node-exporter | CPU, RAM, disque, réseau |
| `traefik` | 8080 | natif | Requêtes, latence, erreurs |
| `api` | 3000 | custom | Métriques applicatives |
| `postgres` | 9187 | postgres-exporter | Connexions, requêtes, réplication |
| `redis` | 9121 | redis-exporter | Mémoire, commandes, clients |
| `postfix` | 9154 | postfix-exporter | Queue, messages envoyés/reçus |
| `dovecot` | 9166 | dovecot-exporter | Connexions IMAP, authentifications |
| `cadvisor` | 8080 | cadvisor | Métriques conteneurs Docker |

### Sondes Blackbox

Les sondes Blackbox permettent de vérifier la disponibilité des services depuis l'extérieur.

| Job | Module | Cibles | Vérification |
|-----|--------|--------|--------------|
| `blackbox-http` | http_2xx | Frontend, API | Code HTTP 2xx |
| `blackbox-smtp` | smtp_starttls | Port 587 | Connexion SMTP + STARTTLS |
| `blackbox-imap` | imap_starttls | Port 143 | Connexion IMAP + STARTTLS |
| `ssl` | ssl | Ports 443, 587 | Validité certificats |

### Personnalisation requise

```yaml
# Remplacer les domaines
static_configs:
  - targets:
      - https://votre-domaine.mssante.fr        # ⚠️ À personnaliser
      - https://api.votre-domaine.mssante.fr    # ⚠️ À personnaliser
```

---

## Fichier alerts.yml

### Description

Définit les règles d'alertes évaluées par Prometheus. Chaque alerte possède une expression PromQL, une durée de déclenchement et des labels de sévérité.

### Groupes d'alertes

#### 1. Système (`system`)

| Alerte | Seuil | Durée | Sévérité |
|--------|-------|-------|----------|
| `HighCPUUsage` | CPU > 80% | 5min | warning |
| `CriticalCPUUsage` | CPU > 95% | 2min | critical |
| `LowMemory` | RAM dispo < 15% | 5min | warning |
| `CriticalMemory` | RAM dispo < 5% | 2min | critical |
| `DiskSpaceLow` | Disque < 20% | 10min | warning |
| `DiskSpaceCritical` | Disque < 10% | 5min | critical |
| `HighLoadAverage` | Load > 1.5 × CPU | 10min | warning |

#### 2. Services MSSanté (`mssante_services`)

| Alerte | Seuil | Durée | Sévérité |
|--------|-------|-------|----------|
| `ServiceDown` | up == 0 | 1min | critical |
| `APIHighLatency` | P95 > 1s | 5min | warning |
| `APIHighErrorRate` | Erreurs 5xx > 5% | 5min | warning |
| `APICriticalErrorRate` | Erreurs 5xx > 15% | 2min | critical |

#### 3. Services Mail (`mail_services`)

| Alerte | Seuil | Durée | Sévérité |
|--------|-------|-------|----------|
| `MailQueueHigh` | Queue > 100 | 10min | warning |
| `MailQueueCritical` | Queue > 500 | 5min | critical |
| `SMTPDown` | Sonde échec | 2min | critical |
| `IMAPDown` | Sonde échec | 2min | critical |
| `HighBounceRate` | Bounce > 10% | 30min | warning |

#### 4. Certificats (`certificates`)

| Alerte | Seuil | Durée | Sévérité |
|--------|-------|-------|----------|
| `CertificateExpiring30Days` | < 30 jours | 1h | warning |
| `CertificateExpiring7Days` | < 7 jours | 1h | critical |
| `CertificateExpired` | Expiré | immédiat | critical |

#### 5. Base de données (`database`)

| Alerte | Seuil | Durée | Sévérité |
|--------|-------|-------|----------|
| `PostgresHighConnections` | > 80% max | 5min | warning |
| `PostgresDown` | pg_up == 0 | 1min | critical |
| `PostgresSlowQueries` | Temps > 1s | 10min | warning |
| `RedisDown` | redis_up == 0 | 1min | critical |
| `RedisHighMemory` | > 90% max | 5min | warning |

#### 6. Conteneurs (`containers`)

| Alerte | Seuil | Durée | Sévérité |
|--------|-------|-------|----------|
| `ContainerRestarted` | Redémarrage détecté | immédiat | warning |
| `ContainerHighCPU` | CPU > 80% | 5min | warning |
| `ContainerHighMemory` | RAM > 90% limite | 5min | warning |

### Personnalisation des seuils

Pour ajuster un seuil, modifier l'expression `expr` :

```yaml
# Exemple : augmenter le seuil de queue mail à 200
- alert: MailQueueHigh
  expr: postfix_queue_size > 200    # Modifié de 100 à 200
  for: 10m
```

---

## Fichier alertmanager.yml

### Description

Configure le routage des alertes vers les différents canaux de notification (email, Slack, PagerDuty).

### Flux de routage

```
Alerte reçue
     │
     ▼
┌─────────────────┐
│  severity:      │
│  critical ?     │───► critical-alerts (PagerDuty + Email urgent)
└────────┬────────┘
         │ non
         ▼
┌─────────────────┐
│  service:       │
│  ssl ?          │───► security-team (Email sécurité)
└────────┬────────┘
         │ non
         ▼
┌─────────────────┐
│  service:       │
│  postgres|redis?│───► dba-team (Email DBA)
└────────┬────────┘
         │ non
         ▼
┌─────────────────┐
│  service:       │
│  postfix|imap ? │───► mail-team (Email équipe mail)
└────────┬────────┘
         │ non
         ▼
┌─────────────────┐
│  severity:      │
│  warning ?      │───► slack-warnings (Slack uniquement)
└────────┬────────┘
         │ non
         ▼
    team-mssante (Email + Slack par défaut)
```

### Receivers

| Receiver | Canaux | Usage |
|----------|--------|-------|
| `team-mssante` | Email + Slack | Équipe principale, alertes générales |
| `critical-alerts` | Email + Slack + PagerDuty | Alertes critiques, astreinte |
| `security-team` | Email | Certificats, sécurité |
| `dba-team` | Email | PostgreSQL, Redis |
| `mail-team` | Email | Postfix, Dovecot |
| `slack-warnings` | Slack | Warnings non critiques |

### Règles d'inhibition

Les règles d'inhibition évitent le bruit en supprimant les alertes redondantes :

| Source | Cible supprimée | Condition |
|--------|-----------------|-----------|
| `ServiceDown` | `APIHighLatency`, `APIHighErrorRate`, `MailQueueHigh` | Même service |
| `PostgresDown` | `PostgresHighConnections` | - |
| severity: critical | severity: warning | Même alerte et service |

### Personnalisation requise

```yaml
global:
  smtp_smarthost: 'smtp.votre-domaine.fr:587'           # ⚠️ Serveur SMTP
  smtp_from: 'alerting@votre-domaine.mssante.fr'        # ⚠️ Expéditeur
  smtp_auth_username: 'alerting@votre-domaine.mssante.fr'
  smtp_auth_password: 'VOTRE_MOT_DE_PASSE_SMTP'         # ⚠️ Mot de passe

receivers:
  - name: 'team-mssante'
    email_configs:
      - to: 'ops@votre-domaine.fr'                      # ⚠️ Email équipe
    slack_configs:
      - api_url: 'https://hooks.slack.com/services/...' # ⚠️ Webhook Slack
  
  - name: 'critical-alerts'
    pagerduty_configs:
      - service_key: 'VOTRE_CLE_SERVICE_PAGERDUTY'      # ⚠️ Clé PagerDuty
```

---

## Fichier blackbox.yml

### Description

Configure les modules de sondes du Blackbox Exporter pour vérifier la disponibilité des services depuis l'extérieur.

### Modules disponibles

#### Sondes HTTP

| Module | Usage | Validation |
|--------|-------|------------|
| `http_2xx` | Sites web, API | Code 200-204 |
| `http_2xx_content` | API avec body | Code 200 + regex body |
| `http_post_2xx` | Endpoints POST | Code 200-202 |
| `http_basic_auth` | Sites protégés | Code 200 + auth |

#### Sondes Mail

| Module | Usage | Validation |
|--------|-------|------------|
| `smtp_starttls` | SMTP submission (587) | Banner 220 + STARTTLS |
| `smtp_banner` | SMTP entrant (25) | Banner 220 + EHLO |
| `imap_starttls` | IMAP (143) | Banner OK + STARTTLS |
| `imap_banner` | IMAP simple | Banner OK |

#### Sondes réseau

| Module | Usage | Validation |
|--------|-------|------------|
| `tcp_connect` | Port ouvert | Connexion TCP réussie |
| `tcp_connect_tls` | Port TLS | Connexion + handshake TLS |
| `dns_a` | Résolution DNS | Record A valide |
| `dns_mx` | Records MX | Record MX valide |
| `icmp` | Ping | Réponse ICMP |

### Personnalisation

```yaml
# Modifier le domaine pour les sondes DNS
dns_a:
  prober: dns
  dns:
    query_name: "votre-domaine.mssante.fr"    # ⚠️ À personnaliser
```

---

## Checklist de personnalisation

### prometheus.yml

| Élément | Valeur par défaut | Action |
|---------|-------------------|--------|
| Domaine frontend | `votre-domaine.mssante.fr` | Remplacer |
| Domaine API | `api.votre-domaine.mssante.fr` | Remplacer |
| Domaine mail | `mail.votre-domaine.mssante.fr` | Remplacer |

### alertmanager.yml

| Élément | Valeur par défaut | Action |
|---------|-------------------|--------|
| SMTP smarthost | `smtp.votre-domaine.fr:587` | Configurer |
| SMTP from | `alerting@votre-domaine.mssante.fr` | Configurer |
| SMTP password | `VOTRE_MOT_DE_PASSE_SMTP` | Configurer |
| Email ops | `ops@votre-domaine.fr` | Configurer |
| Email security | `security@votre-domaine.fr` | Configurer |
| Email DBA | `dba@votre-domaine.fr` | Configurer |
| Email mail-ops | `mail-ops@votre-domaine.fr` | Configurer |
| Webhook Slack | `https://hooks.slack.com/...` | Configurer |
| Clé PagerDuty | `VOTRE_CLE_SERVICE_PAGERDUTY` | Configurer |

### blackbox.yml

| Élément | Valeur par défaut | Action |
|---------|-------------------|--------|
| Domaine DNS | `votre-domaine.mssante.fr` | Remplacer |

---

## Script de personnalisation

```bash
#!/bin/bash
# scripts/configure-prometheus.sh

# Variables à définir
DOMAIN="exemple.mssante.fr"
MAIL_DOMAIN="mail.exemple.mssante.fr"
API_DOMAIN="api.exemple.mssante.fr"

SMTP_HOST="smtp.exemple.fr:587"
SMTP_FROM="alerting@exemple.mssante.fr"
SMTP_PASSWORD="votre-mot-de-passe"

EMAIL_OPS="ops@exemple.fr"
EMAIL_SECURITY="security@exemple.fr"
EMAIL_DBA="dba@exemple.fr"
EMAIL_MAIL="mail-ops@exemple.fr"

SLACK_WEBHOOK="https://hooks.slack.com/services/XXX/YYY/ZZZ"
PAGERDUTY_KEY="votre-cle-pagerduty"

# prometheus.yml
sed -i "s/votre-domaine.mssante.fr/$DOMAIN/g" config/prometheus/prometheus.yml
sed -i "s/api.votre-domaine.mssante.fr/$API_DOMAIN/g" config/prometheus/prometheus.yml
sed -i "s/mail.votre-domaine.mssante.fr/$MAIL_DOMAIN/g" config/prometheus/prometheus.yml

# alertmanager.yml
sed -i "s|smtp.votre-domaine.fr:587|$SMTP_HOST|g" config/prometheus/alertmanager.yml
sed -i "s|alerting@votre-domaine.mssante.fr|$SMTP_FROM|g" config/prometheus/alertmanager.yml
sed -i "s|VOTRE_MOT_DE_PASSE_SMTP|$SMTP_PASSWORD|g" config/prometheus/alertmanager.yml
sed -i "s|ops@votre-domaine.fr|$EMAIL_OPS|g" config/prometheus/alertmanager.yml
sed -i "s|security@votre-domaine.fr|$EMAIL_SECURITY|g" config/prometheus/alertmanager.yml
sed -i "s|dba@votre-domaine.fr|$EMAIL_DBA|g" config/prometheus/alertmanager.yml
sed -i "s|mail-ops@votre-domaine.fr|$EMAIL_MAIL|g" config/prometheus/alertmanager.yml
sed -i "s|https://hooks.slack.com/services/VOTRE/WEBHOOK/URL|$SLACK_WEBHOOK|g" config/prometheus/alertmanager.yml
sed -i "s|VOTRE_CLE_SERVICE_PAGERDUTY|$PAGERDUTY_KEY|g" config/prometheus/alertmanager.yml

# blackbox.yml
sed -i "s/votre-domaine.mssante.fr/$DOMAIN/g" config/prometheus/blackbox.yml

echo "✅ Configuration Prometheus personnalisée"
```

---

## Validation de la configuration

### Vérifier la syntaxe Prometheus

```bash
# Validation prometheus.yml
docker run --rm -v $(pwd)/config/prometheus:/etc/prometheus \
  prom/prometheus promtool check config /etc/prometheus/prometheus.yml

# Validation alerts.yml
docker run --rm -v $(pwd)/config/prometheus:/etc/prometheus \
  prom/prometheus promtool check rules /etc/prometheus/alerts.yml
```

### Vérifier AlertManager

```bash
# Validation alertmanager.yml
docker run --rm -v $(pwd)/config/prometheus:/etc/alertmanager \
  prom/alertmanager amtool check-config /etc/alertmanager/alertmanager.yml
```

### Tester les alertes

```bash
# Lister les alertes actives
curl -s http://localhost:9090/api/v1/alerts | jq

# Lister les règles
curl -s http://localhost:9090/api/v1/rules | jq

# Vérifier les targets
curl -s http://localhost:9090/api/v1/targets | jq '.data.activeTargets[] | {job: .labels.job, health: .health}'
```

### Tester les notifications

```bash
# Envoyer une alerte de test à AlertManager
curl -X POST http://localhost:9093/api/v1/alerts \
  -H "Content-Type: application/json" \
  -d '[{
    "labels": {
      "alertname": "TestAlert",
      "severity": "warning",
      "service": "test"
    },
    "annotations": {
      "summary": "Alerte de test",
      "description": "Ceci est une alerte de test pour vérifier les notifications"
    }
  }]'
```

---

## Dépannage

### Prometheus ne scrape pas les métriques

```bash
# Vérifier l'état des targets
curl http://localhost:9090/api/v1/targets

# Vérifier la connectivité
docker compose exec prometheus wget -qO- http://api:3000/metrics

# Vérifier les logs
docker compose logs prometheus | grep -i error
```

### AlertManager n'envoie pas les notifications

```bash
# Vérifier les alertes en attente
curl http://localhost:9093/api/v1/alerts

# Vérifier la configuration
docker compose exec alertmanager amtool config show

# Tester l'envoi email
docker compose exec alertmanager amtool alert add test severity=warning
```

### Les sondes Blackbox échouent

```bash
# Tester une sonde manuellement
curl "http://localhost:9115/probe?target=https://votre-domaine.mssante.fr&module=http_2xx"

# Vérifier les logs
docker compose logs blackbox-exporter
```

---

## Métriques importantes à surveiller

### Dashboard recommandé

| Panneau | Métrique | Description |
|---------|----------|-------------|
| Uptime services | `up` | État des services (1=up, 0=down) |
| Latence API P95 | `histogram_quantile(0.95, http_request_duration_seconds_bucket)` | Temps de réponse |
| Taux d'erreur | `rate(http_requests_total{status=~"5.."}[5m])` | Erreurs 5xx/min |
| Queue mail | `postfix_queue_size` | Messages en attente |
| Connexions DB | `pg_stat_activity_count` | Connexions PostgreSQL |
| Mémoire Redis | `redis_memory_used_bytes` | Utilisation mémoire |
| Expiration cert | `ssl_cert_not_after - time()` | Jours avant expiration |
| CPU conteneurs | `rate(container_cpu_usage_seconds_total[5m])` | Usage CPU |

---

## Ressources complémentaires

- [Documentation Prometheus](https://prometheus.io/docs/)
- [Documentation AlertManager](https://prometheus.io/docs/alerting/latest/alertmanager/)
- [Blackbox Exporter](https://github.com/prometheus/blackbox_exporter)
- [PromQL Cheat Sheet](https://promlabs.com/promql-cheat-sheet/)

---

## Historique des modifications

| Date       | Version    | Auteur            | Description       |
|------------|------------|-------------------|-------------------|
| 2025-12-28 | 1.0.0      | Antoine MENNEBEUF | Création initiale |
