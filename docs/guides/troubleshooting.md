# Guide de Dépannage - Opérateur MSSanté

## Table des matières

1. [Diagnostic général](#diagnostic-général)
2. [Problèmes de démarrage](#problèmes-de-démarrage)
3. [Problèmes de base de données](#problèmes-de-base-de-données)
4. [Problèmes d'authentification](#problèmes-dauthentification)
5. [Problèmes de messagerie](#problèmes-de-messagerie)
6. [Problèmes de certificats](#problèmes-de-certificats)
7. [Problèmes de performance](#problèmes-de-performance)
8. [Problèmes réseau](#problèmes-réseau)
9. [Problèmes de stockage](#problèmes-de-stockage)
10. [Outils de diagnostic](#outils-de-diagnostic)

---

## Diagnostic général

### Vérification rapide de l'état du système
```bash
#!/bin/bash
# scripts/diagnostic/quick-check.sh

echo "🔍 DIAGNOSTIC RAPIDE DU SYSTÈME"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 1. État des conteneurs
echo "📦 1. État des conteneurs Docker:"
docker compose ps

# 2. Utilisation des ressources
echo ""
echo "💻 2. Utilisation des ressources:"
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}"

# 3. Espace disque
echo ""
echo "💾 3. Espace disque:"
df -h | grep -E '(Filesystem|/dev/|data)'

# 4. Health checks
echo ""
echo "🏥 4. Health checks:"
echo -n "  API: "
curl -f -s http://localhost:3000/health > /dev/null && echo "✅ OK" || echo "❌ ERREUR"

echo -n "  PostgreSQL: "
docker compose exec -T postgres pg_isready -U mssante > /dev/null 2>&1 && echo "✅ OK" || echo "❌ ERREUR"

echo -n "  Redis: "
docker compose exec -T redis redis-cli ping > /dev/null 2>&1 && echo "✅ OK" || echo "❌ ERREUR"

echo -n "  SMTP: "
timeout 2 bash -c "</dev/tcp/localhost/587" 2>/dev/null && echo "✅ OK" || echo "❌ ERREUR"

echo -n "  IMAP: "
timeout 2 bash -c "</dev/tcp/localhost/143" 2>/dev/null && echo "✅ OK" || echo "❌ ERREUR"

# 5. Dernières erreurs dans les logs
echo ""
echo "📋 5. Dernières erreurs (5 lignes):"
docker compose logs --tail=50 | grep -i error | tail -5

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
```

### Vérification des logs
```bash
# Tous les logs en temps réel
docker compose logs -f

# Logs d'un service spécifique
docker compose logs -f api
docker compose logs -f postfix
docker compose logs -f dovecot

# Dernières 100 lignes avec timestamp
docker compose logs --tail=100 --timestamps api

# Filtrer les erreurs
docker compose logs | grep -i error
docker compose logs | grep -i warning

# Logs par niveau (si configuré)
docker compose logs api | grep "ERROR"
docker compose logs api | grep "WARN"
```

---

## Problèmes de démarrage

### Problème 1: Les conteneurs ne démarrent pas

**Symptômes:**
```
Error response from daemon: driver failed programming external connectivity
```

**Causes possibles:**
- Ports déjà utilisés par d'autres applications
- Firewall bloquant les ports
- Conflits de réseau Docker

**Solution:**
```bash
# 1. Vérifier les ports en écoute
sudo netstat -tulpn | grep -E ':(80|443|25|587|143|3000|5432|6379)'

# Ou avec ss
sudo ss -tulpn | grep -E ':(80|443|25|587|143|3000|5432|6379)'

# 2. Identifier le processus utilisant un port
sudo lsof -i :80
sudo lsof -i :5432

# 3. Arrêter le processus conflictuel
sudo kill -9 <PID>

# Ou arrêter le service
sudo systemctl stop nginx
sudo systemctl stop apache2

# 4. Redémarrer les conteneurs
docker compose down
docker compose up -d
```

### Problème 2: Erreur "Cannot connect to Docker daemon"

**Symptômes:**
```
Cannot connect to the Docker daemon at unix:///var/run/docker.sock
```

**Solution:**
```bash
# 1. Vérifier que Docker est démarré
sudo systemctl status docker

# 2. Démarrer Docker si nécessaire
sudo systemctl start docker

# 3. Vérifier les permissions
sudo usermod -aG docker $USER

# 4. Recharger les groupes (ou se reconnecter)
newgrp docker

# 5. Tester
docker ps
```

### Problème 3: Erreur "no space left on device"

**Symptômes:**
```
Error: failed to register layer: Error processing tar file: write /...: no space left on device
```

**Solution:**
```bash
# 1. Vérifier l'espace disque
df -h

# 2. Nettoyer Docker
docker system prune -a --volumes
# ⚠️ ATTENTION: Supprime toutes les images, conteneurs et volumes non utilisés

# 3. Nettoyer les logs
sudo journalctl --vacuum-time=3d
sudo find /var/log -name "*.log" -mtime +30 -delete

# 4. Nettoyer les anciennes images
docker images | grep "<none>" | awk '{print $3}' | xargs docker rmi

# 5. Augmenter l'espace si nécessaire
# Ajouter un nouveau volume ou étendre le disque
```

### Problème 4: Conteneur redémarre en boucle

**Symptômes:**
```
docker compose ps
NAME    STATUS
api     Restarting (1) 2 seconds ago
```

**Diagnostic:**
```bash
# 1. Voir les logs du conteneur
docker compose logs --tail=50 api

# 2. Inspecter le conteneur
docker inspect mssante-api

# 3. Vérifier les health checks
docker compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Health}}"

# 4. Tenter de démarrer en mode interactif
docker compose run --rm api sh
```

**Solutions courantes:**
```bash
# Si erreur de configuration
# Vérifier le fichier .env
cat .env | grep -v '^#' | grep -v '^$'

# Si erreur de migration DB
docker compose exec api npm run migrate

# Si erreur de permissions
sudo chown -R 1000:1000 data/

# Reconstruire l'image
docker compose build --no-cache api
docker compose up -d api
```

---

## Problèmes de base de données

### Problème 1: "Connection refused" PostgreSQL

**Symptômes:**
```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**Solution:**
```bash
# 1. Vérifier que PostgreSQL est démarré
docker compose ps postgres

# 2. Vérifier les logs
docker compose logs postgres

# 3. Tester la connexion
docker compose exec postgres pg_isready -U mssante

# 4. Se connecter manuellement
docker compose exec postgres psql -U mssante -d mssante

# 5. Vérifier les paramètres de connexion dans .env
cat .env | grep POSTGRES

# 6. Redémarrer PostgreSQL
docker compose restart postgres
```

### Problème 2: "Too many connections" PostgreSQL

**Symptômes:**
```
FATAL: sorry, too many clients already
```

**Solution:**
```bash
# 1. Voir les connexions actives
docker compose exec postgres psql -U mssante -d mssante -c "
SELECT count(*) as connections,
       usename,
       application_name
FROM pg_stat_activity
WHERE state = 'active'
GROUP BY usename, application_name
ORDER BY connections DESC;
"

# 2. Tuer les connexions inactives
docker compose exec postgres psql -U mssante -d mssante -c "
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE state = 'idle'
  AND query_start < NOW() - INTERVAL '10 minutes';
"

# 3. Augmenter max_connections dans postgresql.conf
# Éditer config/postgres/postgresql.conf
max_connections = 200

# 4. Redémarrer PostgreSQL
docker compose restart postgres
```

### Problème 3: Base de données corrompue

**Symptômes:**
```
ERROR: could not read block X in file "base/...": read only 0 of 8192 bytes
```

**Solution:**
```bash
# 1. BACKUP IMMÉDIAT si possible
docker compose exec postgres pg_dumpall -U mssante > backup_emergency.sql

# 2. Arrêter PostgreSQL
docker compose stop postgres

# 3. Vérifier l'intégrité
docker compose run --rm postgres sh -c "
  pg_checksums -D /var/lib/postgresql/data --check
"

# 4. Tenter une réparation
docker compose exec postgres psql -U mssante -d mssante -c "
  REINDEX DATABASE mssante;
"

# 5. Si échec, restaurer depuis backup
docker compose down postgres
rm -rf data/postgres/*
docker compose up -d postgres
# Attendre le démarrage
sleep 10
cat backup_emergency.sql | docker compose exec -T postgres psql -U mssante
```

### Problème 4: Migrations échouées

**Symptômes:**
```
Error: Migration "001_schema.sql" failed
```

**Solution:**
```bash
# 1. Vérifier l'état des migrations
docker compose exec postgres psql -U mssante -d mssante -c "
SELECT * FROM schema_migrations ORDER BY version DESC;
"

# 2. Voir la dernière migration appliquée
docker compose exec postgres psql -U mssante -d mssante -c "
SELECT version, applied_at FROM schema_migrations
ORDER BY applied_at DESC LIMIT 1;
"

# 3. Rollback manuel si nécessaire
docker compose exec postgres psql -U mssante -d mssante -f database/rollback/001_schema_down.sql

# 4. Réappliquer la migration
docker compose exec api npm run migrate

# 5. En cas d'échec, réinitialiser la base
# ⚠️ ATTENTION: Perte de données!
docker compose down postgres
rm -rf data/postgres/*
docker compose up -d postgres
sleep 10
docker compose exec api npm run migrate
docker compose exec api npm run seed
```

---

## Problèmes d'authentification

### Problème 1: Pro Santé Connect ne fonctionne pas

**Symptômes:**
```
Error: invalid_client
Error: redirect_uri_mismatch
```

**Solution:**
```bash
# 1. Vérifier la configuration PSC dans .env
cat .env | grep PSC

# Doit contenir:
# PSC_CLIENT_ID=votre_client_id
# PSC_CLIENT_SECRET=votre_secret
# PSC_REDIRECT_URI=https://votre-domaine.mssante.fr/auth/psc/callback

# 2. Vérifier que l'URL de callback est enregistrée dans PSC
# Se connecter au portail ANS et vérifier la configuration

# 3. Tester la connexion PSC manuellement
curl -v "https://auth.esw.esante.gouv.fr/auth/realms/esante-wallet/.well-known/openid-configuration"

# 4. Vérifier les logs de l'API
docker compose logs api | grep -i psc

# 5. Tester le flow OAuth2 complet
./scripts/test/test-psc-flow.sh
```

### Problème 2: JWT Token invalide

**Symptômes:**
```
401 Unauthorized
Error: jwt malformed
Error: jwt expired
```

**Solution:**
```bash
# 1. Vérifier la clé JWT_SECRET dans .env
cat .env | grep JWT_SECRET

# 2. Vérifier l'expiration du token
# Décoder le token JWT sur jwt.io

# 3. Forcer la régénération d'un nouveau token
curl -X POST https://api.votre-domaine.mssante.fr/api/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"YOUR_REFRESH_TOKEN"}'

# 4. Vérifier la synchronisation de l'horloge système
timedatectl status

# Si décalé, synchroniser
sudo timedatectl set-ntp true

# 5. Redémarrer l'API
docker compose restart api
```

### Problème 3: Échec d'authentification SMTP/IMAP

**Symptômes:**
```
535 5.7.8 Authentication failed
```

**Solution:**
```bash
# 1. Tester l'authentification SMTP manuellement
openssl s_client -connect mail.votre-domaine.mssante.fr:587 -starttls smtp
# Puis:
# EHLO test
# AUTH LOGIN
# <base64_email>
# <base64_password>

# 2. Vérifier les logs Postfix
docker compose logs postfix | grep -i auth

# 3. Vérifier les logs Dovecot
docker compose logs dovecot | grep -i auth

# 4. Tester avec swaks
swaks --to test@votre-domaine.mssante.fr \
      --from sender@example.com \
      --server mail.votre-domaine.mssante.fr:587 \
      --auth LOGIN \
      --auth-user user@votre-domaine.mssante.fr \
      --auth-password password \
      --tls

# 5. Vérifier la configuration OAuth2 dans Dovecot
docker compose exec dovecot cat /etc/dovecot/dovecot-oauth2.conf.ext
```

---

## Problèmes de messagerie

### Problème 1: Les emails ne sont pas envoyés

**Symptômes:**
- Les emails restent dans la queue
- Erreur "Connection timed out"
- Bounce messages

**Diagnostic:**
```bash
# 1. Vérifier la queue Postfix
docker compose exec postfix postqueue -p

# 2. Voir les messages en erreur
docker compose exec postfix postqueue -p | grep -A 2 "!"

# 3. Voir les logs d'envoi
docker compose logs postfix | grep "status=bounced"
docker compose logs postfix | grep "status=deferred"

# 4. Tester la connectivité SMTP
telnet mail-distant.mssante.fr 25

# 5. Vérifier les enregistrements DNS
dig votre-domaine.mssante.fr MX
dig votre-domaine.mssante.fr TXT
```

**Solutions:**
```bash
# Forcer l'envoi de la queue
docker compose exec postfix postqueue -f

# Supprimer un message spécifique de la queue
docker compose exec postfix postsuper -d QUEUE_ID

# Supprimer tous les messages en erreur
docker compose exec postfix postsuper -d ALL deferred

# Vérifier la configuration SMTP
docker compose exec postfix postconf | grep relayhost
docker compose exec postfix postconf | grep smtp_tls

# Redémarrer Postfix
docker compose restart postfix
```

### Problème 2: Les emails ne sont pas reçus

**Symptômes:**
- Aucun email dans la boîte aux lettres
- Expéditeurs reçoivent des bounces

**Diagnostic:**
```bash
# 1. Vérifier que le port 25 est ouvert
sudo netstat -tulpn | grep :25

# 2. Tester la réception depuis l'extérieur
telnet votre-domaine.mssante.fr 25
# Puis:
# HELO test.com
# MAIL FROM: test@test.com
# RCPT TO: user@votre-domaine.mssante.fr
# DATA
# Subject: Test
# 
# Test message
# .
# QUIT

# 3. Vérifier les logs de réception
docker compose logs postfix | grep "status=sent"

# 4. Vérifier que Dovecot reçoit les messages
docker compose logs dovecot | grep lmtp

# 5. Vérifier les fichiers sur disque
ls -lah data/mail/votre-domaine.mssante.fr/user/new/
```

**Solutions:**
```bash
# Vérifier les règles firewall
sudo ufw status
sudo iptables -L -n | grep 25

# Ouvrir le port si nécessaire
sudo ufw allow 25/tcp

# Vérifier la configuration Postfix
docker compose exec postfix postconf virtual_mailbox_domains
docker compose exec postfix postconf virtual_transport

# Tester la livraison locale
docker compose exec postfix sendmail -v user@votre-domaine.mssante.fr < test-email.txt

# Redémarrer les services mail
docker compose restart postfix dovecot
```

### Problème 3: Emails marqués comme spam

**Symptômes:**
- Emails arrivent dans spam
- SPF/DKIM/DMARC échouent

**Diagnostic:**
```bash
# 1. Tester SPF
dig votre-domaine.mssante.fr TXT | grep spf

# 2. Tester DKIM
dig default._domainkey.votre-domaine.mssante.fr TXT

# 3. Tester DMARC
dig _dmarc.votre-domaine.mssante.fr TXT

# 4. Analyser les headers d'un email reçu
# Chercher:
# - Authentication-Results
# - SPF: pass/fail
# - DKIM: pass/fail
# - DMARC: pass/fail

# 5. Tester avec un service en ligne
# https://www.mail-tester.com
```

**Solutions:**
```bash
# Corriger SPF
# Ajouter dans DNS:
# votre-domaine.mssante.fr. TXT "v=spf1 mx a ip4:VOTRE_IP -all"

# Régénérer les clés DKIM
docker compose exec postfix sh -c "
  opendkim-genkey -b 2048 -d votre-domaine.mssante.fr -D /etc/opendkim/keys -s default -v
"

# Récupérer la clé publique DKIM
docker compose exec postfix cat /etc/opendkim/keys/default.txt

# Ajouter dans DNS:
# default._domainkey.votre-domaine.mssante.fr. TXT "v=DKIM1; k=rsa; p=MIIBIj..."

# Redémarrer OpenDKIM
docker compose restart postfix
```

### Problème 4: Performance lente IMAP

**Symptômes:**
- Chargement lent des messages
- Timeouts

**Diagnostic:**
```bash
# 1. Vérifier les connexions actives
docker compose exec dovecot doveadm who

# 2. Voir les processus Dovecot
docker compose exec dovecot ps aux | grep dovecot

# 3. Vérifier l'utilisation CPU/RAM
docker stats dovecot

# 4. Tester la vitesse de connexion
time openssl s_client -connect mail.votre-domaine.mssante.fr:143 -starttls imap -quiet << EOF
a001 LOGIN user@votre-domaine.mssante.fr password
a002 SELECT INBOX
a003 FETCH 1:10 (FLAGS)
a004 LOGOUT
EOF
```

**Solutions:**
```bash
# Optimiser la configuration Dovecot
# Éditer services/dovecot/dovecot.conf

# Augmenter les processus
service imap-login {
  process_min_avail = 4
  process_limit = 512
}

# Activer le cache
mail_cache_min_mail_count = 10

# Redémarrer Dovecot
docker compose restart dovecot

# Optimiser la base de données
docker compose exec postgres psql -U mssante -d mssante -c "
  VACUUM ANALYZE mailboxes;
  REINDEX TABLE mailboxes;
"
```

---

## Problèmes de certificats

### Problème 1: Certificat expiré

**Symptômes:**
```
SSL certificate problem: certificate has expired
```

**Diagnostic:**
```bash
# Vérifier l'expiration du certificat
openssl x509 -in config/certificates/server/server.crt -noout -dates

# Vérifier la validité
openssl x509 -in config/certificates/server/server.crt -noout -checkend 0

# Vérifier depuis l'extérieur
echo | openssl s_client -connect votre-domaine.mssante.fr:443 -servername votre-domaine.mssante.fr 2>/dev/null | openssl x509 -noout -dates
```

**Solution:**
```bash
# 1. Renouveler le certificat auprès de l'IGC Santé
# (Suivre la procédure de votre AC)

# 2. Sauvegarder l'ancien certificat
cp config/certificates/server/server.crt config/certificates/server/server.crt.bak.$(date +%Y%m%d)

# 3. Installer le nouveau certificat
cp /path/to/new/cert.crt config/certificates/server/server.crt
cp /path/to/new/cert.key config/certificates/server/server.key

# 4. Vérifier le nouveau certificat
openssl x509 -in config/certificates/server/server.crt -text -noout

# 5. Redémarrer les services
docker compose restart postfix dovecot traefik

# 6. Tester
curl -v https://votre-domaine.mssante.fr
```

### Problème 2: Erreur de chaîne de certification

**Symptômes:**
```
SSL certificate problem: unable to get local issuer certificate
```

**Solution:**
```bash
# 1. Vérifier la chaîne complète
openssl s_client -connect votre-domaine.mssante.fr:443 -showcerts

# 2. Construire le fullchain.pem
cat config/certificates/server/server.crt \
    config/certificates/igc-sante/intermediate.pem \
    config/certificates/igc-sante/root.pem \
    > config/certificates/server/fullchain.pem

# 3. Mettre à jour la configuration
# Dans docker-compose.yml, utiliser fullchain.pem au lieu de server.crt

# 4. Redémarrer
docker compose restart
```

### Problème 3: Certificat non reconnu par les clients

**Symptômes:**
- Avertissement de sécurité dans les navigateurs
- Erreur "certificate verify failed"

**Solution:**
```bash
# 1. Vérifier que le certificat provient de l'IGC Santé
openssl x509 -in config/certificates/server/server.crt -noout -issuer

# 2. Installer le bundle CA IGC Santé
# Télécharger depuis: https://igc-sante.esante.gouv.fr

# 3. Vérifier que le CN correspond au domaine
openssl x509 -in config/certificates/server/server.crt -noout -subject

# 4. Vérifier le SAN (Subject Alternative Names)
openssl x509 -in config/certificates/server/server.crt -noout -text | grep -A 1 "Subject Alternative Name"

# 5. Si le certificat est correct, mettre à jour les CA sur les clients
# Pour Ubuntu/Debian:
sudo cp config/certificates/igc-sante/ca-bundle.pem /usr/local/share/ca-certificates/igc-sante.crt
sudo update-ca-certificates
```

---

## Problèmes de performance

### Problème 1: API lente

**Diagnostic:**
```bash
# 1. Mesurer les temps de réponse
time curl https://api.votre-domaine.mssante.fr/health

# 2. Profiler les requêtes
docker compose logs api | grep "duration"

# 3. Vérifier les requêtes SQL lentes
docker compose exec postgres psql -U mssante -d mssante -c "
SELECT pid, now() - pg_stat_activity.query_start AS duration, query
FROM pg_stat_activity
WHERE (now() - pg_stat_activity.query_start) > interval '1 second'
  AND state = 'active'
ORDER BY duration DESC;
"

# 4. Vérifier la charge système
docker stats
```

**Solutions:**
```bash
# 1. Ajouter des index manquants
docker compose exec postgres psql -U mssante -d mssante -c "
CREATE INDEX idx_mailboxes_email ON mailboxes(email);
CREATE INDEX idx_users_rpps ON users(rpps_id);
"

# 2. Optimiser les requêtes lentes
# Identifier avec EXPLAIN ANALYZE

# 3. Activer le cache Redis
# Vérifier que Redis est utilisé dans l'API

# 4. Augmenter les ressources
# Dans docker-compose.yml:
services:
  api:
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 4G

# 5. Scale horizontal
docker compose up -d --scale api=3
```

### Problème 2: Base de données surchargée

**Diagnostic:**
```bash
# 1. Connexions actives
docker compose exec postgres psql -U mssante -d mssante -c "
SELECT count(*), state FROM pg_stat_activity GROUP BY state;
"

# 2. Requêtes les plus coûteuses
docker compose exec postgres psql -U mssante -d mssante -c "
SELECT query, calls, total_time, mean_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;
"

# 3. Taille des tables
docker compose exec postgres psql -U mssante -d mssante -c "
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
"
```

**Solutions:**
```bash
# 1. VACUUM et ANALYZE
docker compose exec postgres psql -U mssante -d mssante -c "
VACUUM ANALYZE;
"

# 2. Archiver les anciennes données
docker compose exec postgres psql -U mssante -d mssante -c "
DELETE FROM audit_logs WHERE created_at < NOW() - INTERVAL '6 months';
"

# 3. Optimiser postgresql.conf
# Augmenter shared_buffers, work_mem, etc.

# 4. Activer le connection pooling avec PgBouncer
# Ajouter PgBouncer dans docker-compose.yml
```

### Problème 3: Disque plein

**Diagnostic:**
```bash
# 1. Vérifier l'espace disque
df -h

# 2. Trouver les gros fichiers
du -sh data/* | sort -h

# 3. Taille des logs
du -sh data/logs/*

# 4. Taille de la base de données
docker compose exec postgres psql -U mssante -d mssante -c "
SELECT pg_size_pretty(pg_database_size('mssante'));
"
```

**Solutions:**
```bash
# 1. Nettoyer les logs
find data/logs -name "*.log" -mtime +30 -delete
docker compose exec api npm run logs:clean

# 2. Nettoyer Docker
docker system prune -a --volumes

# 3. Archiver les vieux emails
# Déplacer les emails de plus de 2 ans vers un stockage d'archives

# 4. Compresser les anciennes sauvegardes
gzip /backup/*.sql

# 5. Étendre le volume si nécessaire
# (Dépend de votre infrastructure)
```

---

## Problèmes réseau

### Problème 1: Impossibilité de joindre l'Annuaire ANS

**Symptômes:**
```
Error: ECONNREFUSED connecting to annuaire.sante.fr
Error: timeout of 5000ms exceeded
```

**Diagnostic:**
```bash
# 1. Tester la connectivité
ping annuaire.sante.fr

# 2. Tester HTTPS
curl -v https://annuaire.sante.fr/api/v1

# 3. Vérifier les DNS
nslookup annuaire.sante.fr
dig annuaire.sante.fr

# 4. Tester depuis le conteneur
docker compose exec api curl -v https://annuaire.sante.fr/api/v1
```

**Solutions:**
```bash
# 1. Vérifier le proxy si applicable
echo $HTTP_PROXY
echo $HTTPS_PROXY

# 2. Configurer le proxy dans Docker
# Éditer /etc/systemd/system/docker.service.d/http-proxy.conf

# 3. Ajouter les DNS de secours
# Dans docker-compose.yml:
services:
  api:
    dns:
      - 8.8.8.8
      - 1.1.1.1

# 4. Vérifier le firewall sortant
sudo iptables -L OUTPUT -n

# 5. Contacter le support ANS si problème persiste
```

### Problème 2: Timeout connexions SMTP/IMAP

**Symptômes:**
- Clients ne peuvent pas se connecter
- Erreur "Connection timeout"

**Diagnostic:**
```bash
# 1. Tester depuis l'extérieur
telnet votre-domaine.mssante.fr 25
telnet votre-domaine.mssante.fr 587
telnet votre-domaine.mssante.fr 143

# 2. Vérifier que les ports écoutent
netstat -tulpn | grep -E ':(25|587|143)'

# 3. Tester avec timeout
timeout 10 telnet votre-domaine.mssante.fr 25

# 4. Vérifier les règles firewall
sudo iptables -L -n | grep -E '(25|587|143)'
sudo ufw status
```

**Solutions:**
```bash
# 1. Ouvrir les ports dans le firewall
sudo ufw allow 25/tcp
sudo ufw allow 587/tcp
sudo ufw allow 143/tcp

# 2. Vérifier les security groups (si cloud)
# AWS, Azure, GCP: ouvrir les ports dans les security groups

# 3. Augmenter les timeouts
# Dans Postfix:
smtp_connect_timeout = 60s

# Dans Dovecot:
client_timeout = 30 min

# 4. Redémarrer les services
docker compose restart postfix dovecot
```

---

## Problèmes de stockage

### Problème 1: Permissions refusées

**Symptômes:**
```
Error: EACCES: permission denied, open '/var/mail/...'
```

**Solution:**
```bash
# 1. Vérifier les permissions
ls -la data/mail/

# 2. Corriger les permissions
sudo chown -R 1000:1000 data/
chmod -R 755 data/

# 3. Pour les clés privées
chmod 600 config/certificates/server/server.key

# 4. Redémarrer les conteneurs
docker compose restart
```

### Problème 2: Corruption de fichiers

**Symptômes:**
- Emails illisibles
- Erreurs I/O dans les logs

**Solution:**
```bash
# 1. Vérifier l'intégrité du système de fichiers
sudo fsck /dev/sda1  # Adapter selon votre système

# 2. Vérifier les erreurs disque
sudo dmesg | grep -i error
sudo smartctl -a /dev/sda

# 3. Restaurer depuis backup
./scripts/backup/restore.sh /backup/latest.tar.gz

# 4. Reconstruire les index Dovecot
docker compose exec dovecot doveadm force-resync -u user@domain.mssante.fr INBOX
```

---

## Outils de diagnostic

### Script de diagnostic complet
```bash
#!/bin/bash
# scripts/diagnostic/full-diagnostic.sh

OUTPUT_DIR="/tmp/mssante-diagnostic-$(date +%Y%m%d_%H%M%S)"
mkdir -p "$OUTPUT_DIR"

echo "🔍 Diagnostic complet en cours..."
echo "📁 Rapport sera sauvegardé dans: $OUTPUT_DIR"

# 1. Informations système
echo "1. Informations système" > "$OUTPUT_DIR/system.txt"
uname -a >> "$OUTPUT_DIR/system.txt"
cat /etc/os-release >> "$OUTPUT_DIR/system.txt"
uptime >> "$OUTPUT_DIR/system.txt"

# 2. Docker
echo "2. Docker" > "$OUTPUT_DIR/docker.txt"
docker version >> "$OUTPUT_DIR/docker.txt"
docker compose version >> "$OUTPUT_DIR/docker.txt"
docker compose ps >> "$OUTPUT_DIR/docker.txt"
docker stats --no-stream >> "$OUTPUT_DIR/docker.txt"

# 3. Réseau
echo "3. Réseau" > "$OUTPUT_DIR/network.txt"
ip addr >> "$OUTPUT_DIR/network.txt"
netstat -tulpn >> "$OUTPUT_DIR/network.txt"
iptables -L -n >> "$OUTPUT_DIR/network.txt"

# 4. Disque
echo "4. Disque" > "$OUTPUT_DIR/disk.txt"
df -h >> "$OUTPUT_DIR/disk.txt"
du -sh data/* >> "$OUTPUT_DIR/disk.txt"

# 5. Base de données
echo "5. Base de données" > "$OUTPUT_DIR/database.txt"
docker compose exec -T postgres psql -U mssante -d mssante -c "SELECT version();" >> "$OUTPUT_DIR/database.txt"
docker compose exec -T postgres psql -U mssante -d mssante -c "SELECT count(*) FROM mailboxes;" >> "$OUTPUT_DIR/database.txt"
docker compose exec -T postgres psql -U mssante -d mssante -c "SELECT count(*) FROM users;" >> "$OUTPUT_DIR/database.txt"

# 6. Logs récents
echo "6. Logs" > "$OUTPUT_DIR/logs.txt"
docker compose logs --tail=500 >> "$OUTPUT_DIR/logs.txt"

# 7. Configuration
echo "7. Configuration" > "$OUTPUT_DIR/config.txt"
cat .env | grep -v PASSWORD | grep -v SECRET >> "$OUTPUT_DIR/config.txt"

# 8. Certificats
echo "8. Certificats" > "$OUTPUT_DIR/certificates.txt"
openssl x509 -in config/certificates/server/server.crt -noout -text >> "$OUTPUT_DIR/certificates.txt" 2>&1

# Créer une archive
tar -czf "${OUTPUT_DIR}.tar.gz" -C /tmp "$(basename $OUTPUT_DIR)"

echo "✅ Diagnostic terminé"
echo "📦 Archive: ${OUTPUT_DIR}.tar.gz"
echo ""
echo "Envoyez cette archive au support: support@votre-domaine.fr"
```

### Mode debug
```bash
# Activer le mode debug pour l'API
docker compose stop api
docker compose run --rm -e LOG_LEVEL=debug api

# Activer le debug Postfix
docker compose exec postfix postconf -e debug_peer_list=all
docker compose restart postfix

# Activer le debug Dovecot
docker compose exec dovecot doveconf -n | grep auth_debug
docker compose exec dovecot doveconf -e auth_debug=yes
docker compose restart dovecot
```

---

## Ressources et support

### Liens utiles

- **Documentation ANS:** https://esante.gouv.fr/produits-services/mssante
- **Référentiel MSSanté:** https://esante.gouv.fr/produits-services/mssante/documentation
- **Support ANS:** monserviceclient.mssante@esante.gouv.fr
- **Documentation Docker:** https://docs.docker.com
- **Documentation PostgreSQL:** https://www.postgresql.org/docs/
- **Documentation Postfix:** http://www.postfix.org/documentation.html
- **Documentation Dovecot:** https://doc.dovecot.org

### Obtenir de l'aide

Si les solutions de ce guide ne résolvent pas votre problème :

1. **Collecter les informations:**
```bash
   ./scripts/diagnostic/full-diagnostic.sh
```

2. **Vérifier les logs détaillés:**
```bash
   docker compose logs --tail=500 > logs.txt
```

3. **Contacter le support:**
   - Email: support@votre-domaine.fr
   - Slack: #mssante-support
   - Téléphone: +33 X XX XX XX XX

4. **Inclure dans votre demande:**
   - Description du problème
   - Étapes pour reproduire
   - Messages d'erreur exacts
   - Archive de diagnostic
   - Version du système

### Checklist avant de contacter le support

- [ ] J'ai consulté ce guide de troubleshooting
- [ ] J'ai vérifié les logs
- [ ] J'ai tenté un redémarrage
- [ ] J'ai créé une archive de diagnostic
- [ ] J'ai noté les messages d'erreur exacts
- [ ] J'ai vérifié que le problème persiste

---

Ce guide couvre les problèmes les plus courants. Pour des cas spécifiques ou des erreurs non documentées, n'hésitez pas à consulter la documentation complète ou à contacter le support.
