# Guide de Configuration - Opérateur MSSanté

## Table des matières

1. [Configuration des services mail](#configuration-des-services-mail)
2. [Configuration de la sécurité](#configuration-de-la-sécurité)
3. [Configuration Pro Santé Connect](#configuration-pro-santé-connect)
4. [Configuration de l'Annuaire National](#configuration-de-lannuaire-national)
5. [Configuration DNS avancée](#configuration-dns-avancée)
6. [Configuration de la base de données](#configuration-de-la-base-de-données)
7. [Configuration du monitoring](#configuration-du-monitoring)
8. [Configuration des backups](#configuration-des-backups)
9. [Optimisation des performances](#optimisation-des-performances)

---

## Configuration des services mail

### 1. Configuration Postfix (SMTP)

#### Fichier principal main.cf

Emplacement : `services/postfix/main.cf`
```conf
# ===========================================
# PARAMÈTRES GÉNÉRAUX
# ===========================================
myhostname = mail.votre-domaine.mssante.fr
mydomain = votre-domaine.mssante.fr
myorigin = $mydomain
mydestination = localhost

# Bannière SMTP
smtpd_banner = $myhostname ESMTP MSSanté

# ===========================================
# TLS/SSL - OBLIGATOIRE MSSANTÉ
# ===========================================

# TLS pour le serveur (réception)
smtpd_tls_security_level = may
smtpd_tls_auth_only = yes
smtpd_tls_mandatory_protocols = !SSLv2, !SSLv3, !TLSv1, !TLSv1.1
smtpd_tls_protocols = !SSLv2, !SSLv3, !TLSv1, !TLSv1.1
smtpd_tls_mandatory_ciphers = high
smtpd_tls_ciphers = high

# Liste des suites de chiffrement (conforme ANSSI)
smtpd_tls_mandatory_cipher_list = ECDHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-SHA384:ECDHE-RSA-AES128-SHA256

# Certificats serveur IGC Santé
smtpd_tls_cert_file = /etc/ssl/certs/server.pem
smtpd_tls_key_file = /etc/ssl/certs/server.key
smtpd_tls_CAfile = /etc/ssl/igc-sante/ca-bundle.pem

# Options TLS
smtpd_tls_received_header = yes
smtpd_tls_session_cache_database = btree:${data_directory}/smtpd_scache
smtpd_tls_loglevel = 1

# TLS pour le client (envoi)
smtp_tls_security_level = may
smtp_tls_mandatory_protocols = !SSLv2, !SSLv3, !TLSv1, !TLSv1.1
smtp_tls_protocols = !SSLv2, !SSLv3, !TLSv1, !TLSv1.1
smtp_tls_CAfile = /etc/ssl/igc-sante/ca-bundle.pem
smtp_tls_session_cache_database = btree:${data_directory}/smtp_scache

# ===========================================
# AUTHENTIFICATION MUTUELLE (mTLS)
# ===========================================

# Demander le certificat client pour BAL applicatives
smtpd_tls_ask_ccert = yes
smtpd_tls_req_ccert = no

# Vérification des certificats clients
smtpd_tls_CAfile = /etc/ssl/igc-sante/ca-bundle.pem

# ===========================================
# VIRTUAL MAILBOXES (PostgreSQL)
# ===========================================

# Domaines virtuels
virtual_mailbox_domains = pgsql:/etc/postfix/pgsql-virtual-mailbox-domains.cf

# Mapping des boîtes aux lettres
virtual_mailbox_maps = pgsql:/etc/postfix/pgsql-virtual-mailbox-maps.cf

# Alias virtuels
virtual_alias_maps = pgsql:/etc/postfix/pgsql-virtual-alias-maps.cf

# Transport vers Dovecot via LMTP
virtual_transport = lmtp:unix:private/dovecot-lmtp

# ===========================================
# RESTRICTIONS ET SÉCURITÉ
# ===========================================

# Restrictions sur l'envoi
smtpd_sender_restrictions =
    reject_non_fqdn_sender,
    reject_unknown_sender_domain

# Restrictions sur les destinataires
smtpd_recipient_restrictions =
    permit_mynetworks,
    permit_sasl_authenticated,
    reject_non_fqdn_recipient,
    reject_unknown_recipient_domain,
    reject_unauth_destination,
    reject_rbl_client zen.spamhaus.org

# Restrictions HELO
smtpd_helo_restrictions =
    permit_mynetworks,
    reject_invalid_helo_hostname,
    reject_non_fqdn_helo_hostname

# ===========================================
# LIMITES ET QUOTAS
# ===========================================

# Taille maximale des messages (25 Mo conforme MSSanté)
message_size_limit = 26214400

# Taille boîte aux lettres (1 Go par défaut)
mailbox_size_limit = 1073741824

# Nombre max de destinataires
smtpd_recipient_limit = 50

# ===========================================
# PERFORMANCE
# ===========================================

# Nombre de processus
default_process_limit = 100
smtpd_client_connection_count_limit = 50
smtpd_client_connection_rate_limit = 100

# Timeouts
smtp_connect_timeout = 30s
smtp_helo_timeout = 300s
smtpd_timeout = 300s

# ===========================================
# LOGS ET MONITORING
# ===========================================

maillog_file = /var/log/postfix/mail.log
maillog_file_rotate_suffix = %Y%m%d-%H%M%S
maillog_file_prefixes = /var/log/postfix
```

#### Fichiers de requêtes PostgreSQL

**pgsql-virtual-mailbox-domains.cf:**
```conf
hosts = postgres
user = mssante
password = ${POSTGRES_PASSWORD}
dbname = mssante

query = SELECT domain_name FROM domains 
        WHERE domain_name = '%s' 
        AND status = 'active'
```

**pgsql-virtual-mailbox-maps.cf:**
```conf
hosts = postgres
user = mssante
password = ${POSTGRES_PASSWORD}
dbname = mssante

query = SELECT email FROM mailboxes 
        WHERE email = '%s' 
        AND status = 'active'
```

**pgsql-virtual-alias-maps.cf:**
```conf
hosts = postgres
user = mssante
password = ${POSTGRES_PASSWORD}
dbname = mssante

query = SELECT destination FROM aliases 
        WHERE source = '%s' 
        AND active = true
```

#### Configuration master.cf
```conf
# ===========================================
# SMTP - Port 25 (réception inter-opérateurs)
# ===========================================
smtp      inet  n       -       n       -       -       smtpd
  -o syslog_name=postfix/smtp
  -o smtpd_tls_security_level=may
  -o smtpd_sasl_auth_enable=no

# ===========================================
# SUBMISSION - Port 587 (envoi authentifié)
# ===========================================
submission inet n       -       n       -       -       smtpd
  -o syslog_name=postfix/submission
  -o smtpd_tls_security_level=encrypt
  -o smtpd_sasl_auth_enable=yes
  -o smtpd_sasl_type=dovecot
  -o smtpd_sasl_path=private/auth
  -o smtpd_client_restrictions=permit_sasl_authenticated,reject
  -o milter_macro_daemon_name=ORIGINATING

# ===========================================
# PICKUP (messages locaux)
# ===========================================
pickup    unix  n       -       n       60      1       pickup
  -o content_filter=
  -o receive_override_options=no_header_body_checks

# ===========================================
# CLEANUP
# ===========================================
cleanup   unix  n       -       n       -       0       cleanup

# ===========================================
# AUTRES SERVICES
# ===========================================
qmgr      unix  n       -       n       300     1       qmgr
tlsmgr    unix  -       -       n       1000?   1       tlsmgr
rewrite   unix  -       -       n       -       -       trivial-rewrite
bounce    unix  -       -       n       -       0       bounce
defer     unix  -       -       n       -       0       bounce
trace     unix  -       -       n       -       0       bounce
verify    unix  -       -       n       -       1       verify
flush     unix  n       -       n       1000?   0       flush
proxymap  unix  -       -       n       -       -       proxymap
proxywrite unix -       -       n       -       1       proxymap
smtp      unix  -       -       n       -       -       smtp
relay     unix  -       -       n       -       -       smtp
showq     unix  n       -       n       -       -       showq
error     unix  -       -       n       -       -       error
retry     unix  -       -       n       -       -       error
discard   unix  -       -       n       -       -       discard
local     unix  -       n       n       -       -       local
virtual   unix  -       n       n       -       -       virtual
lmtp      unix  -       -       n       -       -       lmtp
anvil     unix  -       -       n       -       1       anvil
scache    unix  -       -       n       -       1       scache
```

### 2. Configuration Dovecot (IMAP)

#### Fichier principal dovecot.conf

Emplacement : `services/dovecot/dovecot.conf`
```conf
# ===========================================
# PROTOCOLES
# ===========================================
protocols = imap lmtp

# ===========================================
# SSL/TLS OBLIGATOIRE
# ===========================================
ssl = required
ssl_cert = </etc/ssl/certs/server.pem
ssl_key = </etc/ssl/certs/server.key
ssl_ca = </etc/ssl/igc-sante/ca-bundle.pem

# Protocoles TLS (MSSanté)
ssl_min_protocol = TLSv1.2
ssl_cipher_list = ECDHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-SHA384:ECDHE-RSA-AES128-SHA256
ssl_prefer_server_ciphers = yes

# Options SSL
ssl_dh = </etc/ssl/dh2048.pem

# ===========================================
# AUTHENTIFICATION
# ===========================================
auth_mechanisms = plain login oauthbearer xoauth2

# Désactiver l'authentification en clair sans TLS
disable_plaintext_auth = yes

# ===========================================
# EMPLACEMENT DES MAILS
# ===========================================
mail_location = maildir:/var/mail/%d/%n

# Namespace INBOX
namespace inbox {
  inbox = yes
  separator = /
  
  mailbox Drafts {
    special_use = \Drafts
    auto = subscribe
  }
  
  mailbox Sent {
    special_use = \Sent
    auto = subscribe
  }
  
  mailbox Trash {
    special_use = \Trash
    auto = subscribe
  }
  
  mailbox Spam {
    special_use = \Junk
    auto = subscribe
  }
}

# ===========================================
# PERFORMANCE
# ===========================================

# Process limit
service imap-login {
  inet_listener imap {
    port = 143
  }
  
  process_min_avail = 4
  service_count = 1
  process_limit = 512
}

service lmtp {
  unix_listener /var/spool/postfix/private/dovecot-lmtp {
    mode = 0600
    user = postfix
    group = postfix
  }
}

# ===========================================
# LOGS
# ===========================================
log_path = /var/log/dovecot/dovecot.log
info_log_path = /var/log/dovecot/info.log
debug_log_path = /var/log/dovecot/debug.log

syslog_facility = mail
log_timestamp = "%Y-%m-%d %H:%M:%S "
```

#### Configuration auth-sql.conf.ext

Emplacement : `services/dovecot/conf.d/auth-sql.conf.ext`
```conf
passdb {
  driver = sql
  args = /etc/dovecot/dovecot-sql.conf.ext
}

userdb {
  driver = sql
  args = /etc/dovecot/dovecot-sql.conf.ext
}
```

#### Configuration dovecot-sql.conf.ext
```conf
driver = pgsql
connect = host=postgres dbname=mssante user=mssante password=${POSTGRES_PASSWORD}

# Requête de vérification du mot de passe
password_query = \
  SELECT email as user, password \
  FROM mailboxes \
  WHERE email = '%u' AND status = 'active'

# Requête utilisateur
user_query = \
  SELECT \
    email as user, \
    '/var/mail/%d/%n' as home, \
    'maildir:/var/mail/%d/%n' as mail, \
    1000 AS uid, \
    1000 AS gid, \
    quota_mb * 1048576 AS quota_rule \
  FROM mailboxes \
  WHERE email = '%u' AND status = 'active'
```

---

## Configuration de la sécurité

### 1. Configuration des suites de chiffrement TLS

#### Générer des paramètres Diffie-Hellman forts
```bash
# Générer DH 2048 bits (minimum MSSanté)
openssl dhparam -out config/certificates/dh2048.pem 2048

# Optionnel : DH 4096 bits (plus sécurisé)
openssl dhparam -out config/certificates/dh4096.pem 4096
```

#### Vérifier la configuration TLS
```bash
# Test avec nmap
nmap --script ssl-enum-ciphers -p 587 mail.votre-domaine.mssante.fr

# Test avec testssl.sh
./testssl.sh --starttls smtp mail.votre-domaine.mssante.fr:587
```

### 2. Configuration DKIM

#### Génération de la clé DKIM
```bash
# Créer le répertoire
mkdir -p /etc/opendkim/keys/votre-domaine.mssante.fr

# Générer la clé
opendkim-genkey -b 2048 -d votre-domaine.mssante.fr -D /etc/opendkim/keys/votre-domaine.mssante.fr -s default -v

# Permissions
chown -R opendkim:opendkim /etc/opendkim
chmod 600 /etc/opendkim/keys/*/default.private
```

#### Configuration OpenDKIM
```conf
# /etc/opendkim.conf
Syslog yes
SyslogSuccess yes
LogWhy yes

UMask 002
Mode sv
SubDomains no

Canonicalization relaxed/simple
AutoRestart yes
AutoRestartRate 10/1M
Background yes

DNSTimeout 5
SignatureAlgorithm rsa-sha256

OversignHeaders From

KeyTable /etc/opendkim/key.table
SigningTable refile:/etc/opendkim/signing.table
ExternalIgnoreList /etc/opendkim/trusted.hosts
InternalHosts /etc/opendkim/trusted.hosts
```

#### Fichiers de configuration

**/etc/opendkim/key.table:**
```
default._domainkey.votre-domaine.mssante.fr votre-domaine.mssante.fr:default:/etc/opendkim/keys/votre-domaine.mssante.fr/default.private
```

**/etc/opendkim/signing.table:**
```
*@votre-domaine.mssante.fr default._domainkey.votre-domaine.mssante.fr
```

**/etc/opendkim/trusted.hosts:**
```
127.0.0.1
localhost
votre-domaine.mssante.fr
*.votre-domaine.mssante.fr
```

#### Récupérer la clé publique pour DNS
```bash
cat /etc/opendkim/keys/votre-domaine.mssante.fr/default.txt
```

Résultat à ajouter dans votre DNS :
```
default._domainkey.votre-domaine.mssante.fr. IN TXT "v=DKIM1; k=rsa; p=MIIBIjANBgkqhk..."
```

### 3. Configuration SPF et DMARC

#### Enregistrement SPF
```dns
votre-domaine.mssante.fr. IN TXT "v=spf1 mx a ip4:VOTRE_IP -all"
```

#### Enregistrement DMARC
```dns
_dmarc.votre-domaine.mssante.fr. IN TXT "v=DMARC1; p=quarantine; rua=mailto:dmarc@votre-domaine.mssante.fr; ruf=mailto:dmarc@votre-domaine.mssante.fr; fo=1"
```

**Paramètres DMARC recommandés:**
- `p=quarantine` : Mettre en quarantaine les emails suspects
- `pct=100` : Appliquer la politique à 100% des emails
- `rua=` : Email pour rapports agrégés
- `ruf=` : Email pour rapports forensiques
- `sp=quarantine` : Politique pour les sous-domaines
- `adkim=r` : Alignment DKIM relaxed
- `aspf=r` : Alignment SPF relaxed

---

## Configuration Pro Santé Connect

### 1. Inscription sur Pro Santé Connect

#### Étapes d'inscription

1. Se connecter au portail ANS
2. Accéder à la section Pro Santé Connect
3. Créer une application
4. Remplir les informations :
   - Nom de l'application
   - Description
   - URLs de redirect
   - Logo

#### URLs de callback
```
# Développement
http://localhost:3000/auth/psc/callback

# Production
https://votre-domaine.mssante.fr/auth/psc/callback
https://api.votre-domaine.mssante.fr/api/v1/auth/psc/callback
```

### 2. Configuration des endpoints PSC

#### Variables d'environnement
```bash
# Pro Santé Connect
PSC_CLIENT_ID=votre_client_id_fourni_par_ans
PSC_CLIENT_SECRET=votre_client_secret_fourni_par_ans

# URLs PSC (Production)
PSC_AUTHORIZATION_URL=https://auth.esw.esante.gouv.fr/auth/realms/esante-wallet/protocol/openid-connect/auth
PSC_TOKEN_URL=https://auth.esw.esante.gouv.fr/auth/realms/esante-wallet/protocol/openid-connect/token
PSC_USERINFO_URL=https://auth.esw.esante.gouv.fr/auth/realms/esante-wallet/protocol/openid-connect/userinfo
PSC_LOGOUT_URL=https://auth.esw.esante.gouv.fr/auth/realms/esante-wallet/protocol/openid-connect/logout

# Scopes requis
PSC_SCOPES=openid email profile scope_all

# URL de redirection après authentification
PSC_REDIRECT_URI=https://votre-domaine.mssante.fr/auth/psc/callback
```

### 3. Configuration OAuth2 dans Dovecot

#### Configuration oauth2.conf.ext
```conf
# /etc/dovecot/conf.d/auth-oauth2.conf.ext

passdb {
  driver = oauth2
  mechanisms = xoauth2 oauthbearer
  args = /etc/dovecot/dovecot-oauth2.conf.ext
}
```

#### Configuration dovecot-oauth2.conf.ext
```conf
tokeninfo_url = https://auth.esw.esante.gouv.fr/auth/realms/esante-wallet/protocol/openid-connect/userinfo
introspection_url = https://auth.esw.esante.gouv.fr/auth/realms/esante-wallet/protocol/openid-connect/token/introspect
introspection_mode = post

client_id = votre_client_id
client_secret = votre_client_secret

username_attribute = email
active_attribute = active

# Validation du token
pass_attrs = \
  email=user=%{oauth2:email} \
  =allow_real_nets=0.0.0.0/0
```

---

## Configuration de l'Annuaire National

### 1. Connexion à l'API Annuaire

#### Variables d'environnement
```bash
# Annuaire National Santé
ANNUAIRE_API_URL=https://annuaire.sante.fr/api/v1
ANNUAIRE_API_KEY=votre_cle_api_fournie_par_ans
ANNUAIRE_OPERATOR_ID=votre_id_operateur

# URLs spécifiques
ANNUAIRE_SEARCH_URL=${ANNUAIRE_API_URL}/search
ANNUAIRE_PUBLISH_URL=${ANNUAIRE_API_URL}/mailboxes
ANNUAIRE_INDICATORS_URL=${ANNUAIRE_API_URL}/indicators
```

### 2. Configuration de la synchronisation

#### Cron de synchronisation
```bash
# Fichier : /etc/cron.d/mssante-annuaire

# Synchronisation quotidienne à 2h du matin
0 2 * * * root /app/scripts/annuaire/sync.sh >> /var/log/annuaire-sync.log 2>&1

# Soumission des indicateurs (le 1er de chaque mois à 6h)
0 6 1 * * root /app/scripts/annuaire/submit-indicators.sh >> /var/log/annuaire-indicators.log 2>&1
```

#### Script de synchronisation
```bash
#!/bin/bash
# scripts/annuaire/sync.sh

set -e

# Configuration
API_URL="${ANNUAIRE_API_URL}"
API_KEY="${ANNUAIRE_API_KEY}"
OPERATOR_ID="${ANNUAIRE_OPERATOR_ID}"

# Publier les nouvelles BAL
curl -X POST "${API_URL}/mailboxes/bulk" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d @/tmp/new-mailboxes.json

# Dépublier les BAL inactives
curl -X DELETE "${API_URL}/mailboxes/bulk" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d @/tmp/inactive-mailboxes.json

echo "Synchronisation terminée : $(date)"
```

### 3. Format de publication des BAL

#### Publication d'une BAL personnelle
```json
{
  "operatorId": "VOTRE_ID_OPERATEUR",
  "mailboxes": [
    {
      "email": "jean.dupont@hopital.mssante.fr",
      "type": "PERSONAL",
      "owner": {
        "rpps": "10001234567",
        "firstName": "Jean",
        "lastName": "Dupont",
        "profession": "Médecin",
        "specialty": "Cardiologie"
      },
      "organization": {
        "finessJuridique": "750000001",
        "finessGeographique": "750000002",
        "name": "Hôpital Exemple"
      },
      "hideFromDirectory": false,
      "createdAt": "2024-03-20T10:00:00Z"
    }
  ]
}
```

---

## Configuration DNS avancée

### 1. Enregistrements DNS complets
```dns
; ====================================
; ENREGISTREMENTS A
; ====================================
votre-domaine.mssante.fr.         3600 IN A     VOTRE_IP
mail.votre-domaine.mssante.fr.    3600 IN A     VOTRE_IP
api.votre-domaine.mssante.fr.     3600 IN A     VOTRE_IP
smtp.votre-domaine.mssante.fr.    3600 IN A     VOTRE_IP
imap.votre-domaine.mssante.fr.    3600 IN A     VOTRE_IP
grafana.votre-domaine.mssante.fr. 3600 IN A     VOTRE_IP

; ====================================
; ENREGISTREMENT MX
; ====================================
votre-domaine.mssante.fr.  3600 IN MX  10 mail.votre-domaine.mssante.fr.

; ====================================
; SPF
; ====================================
votre-domaine.mssante.fr.  3600 IN TXT "v=spf1 mx a ip4:VOTRE_IP -all"

; ====================================
; DKIM
; ====================================
default._domainkey.votre-domaine.mssante.fr. 3600 IN TXT "v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA..."

; ====================================
; DMARC
; ====================================
_dmarc.votre-domaine.mssante.fr. 3600 IN TXT "v=DMARC1; p=quarantine; rua=mailto:dmarc@votre-domaine.mssante.fr; ruf=mailto:dmarc@votre-domaine.mssante.fr; pct=100; fo=1"

; ====================================
; REVERSE DNS (PTR) - À demander chez votre hébergeur
; ====================================
; X.X.X.X.in-addr.arpa. IN PTR mail.votre-domaine.mssante.fr.
```

### 2. Configuration Autoconfig

#### Fichier autoconfig.xml

Emplacement : `services/frontend/public/.well-known/autoconfig/mail/config-v1.1.xml`
```xml
<?xml version="1.0" encoding="UTF-8"?>
<clientConfig version="1.1">
  <emailProvider id="votre-domaine.mssante.fr">
    <domain>votre-domaine.mssante.fr</domain>
    <displayName>MSSanté - Votre Organisation</displayName>
    <displayShortName>MSSanté</displayShortName>
    
    <!-- IMAP -->
    <incomingServer type="imap">
      <hostname>imap.votre-domaine.mssante.fr</hostname>
      <port>143</port>
      <socketType>STARTTLS</socketType>
      <authentication>OAuth2</authentication>
      <authentication>password-cleartext</authentication>
      <username>%EMAILADDRESS%</username>
      
      <!-- Configuration OAuth2 PSC -->
      <oauth2>
        <issuer>https://auth.esw.esante.gouv.fr/auth/realms/esante-wallet</issuer>
        <scope>openid email profile scope_all</scope>
        <authURL>https://auth.esw.esante.gouv.fr/auth/realms/esante-wallet/protocol/openid-connect/auth</authURL>
        <tokenURL>https://auth.esw.esante.gouv.fr/auth/realms/esante-wallet/protocol/openid-connect/token</tokenURL>
      </oauth2>
    </incomingServer>
    
    <!-- SMTP -->
    <outgoingServer type="smtp">
      <hostname>smtp.votre-domaine.mssante.fr</hostname>
      <port>587</port>
      <socketType>STARTTLS</socketType>
      <authentication>OAuth2</authentication>
      <authentication>password-cleartext</authentication>
      <username>%EMAILADDRESS%</username>
    </outgoingServer>
    
    <documentation url="https://votre-domaine.mssante.fr/help">
      <descr lang="fr">Guide de configuration MSSanté</descr>
    </documentation>
  </emailProvider>
</clientConfig>
```

---

## Configuration de la base de données

### 1. Optimisation PostgreSQL

#### Fichier postgresql.conf
```conf
# ===========================================
# MÉMOIRE
# ===========================================
shared_buffers = 4GB                    # 25% de la RAM
effective_cache_size = 12GB             # 75% de la RAM
maintenance_work_mem = 1GB
work_mem = 16MB

# ===========================================
# WAL (Write-Ahead Log)
# ===========================================
wal_buffers = 16MB
min_wal_size = 1GB
max_wal_size = 4GB
checkpoint_completion_target = 0.9
wal_level = replica

# ===========================================
# PERFORMANCE
# ===========================================
max_connections = 200
random_page_cost = 1.1                  # Pour SSD
effective_io_concurrency = 200          # Pour SSD

# ===========================================
# MONITORING
# ===========================================
shared_preload_libraries = 'pg_stat_statements'
pg_stat_statements.track = all
pg_stat_statements.max = 10000

# ===========================================
# LOGGING
# ===========================================
logging_collector = on
log_directory = '/var/log/postgresql'
log_filename = 'postgresql-%Y-%m-%d.log'
log_rotation_age = 1d
log_min_duration_statement = 1000       # Log queries > 1s
log_line_prefix = '%t [%p]: user=%u,db=%d,app=%a,client=%h '
```

### 2. Sauvegardes automatiques

#### Script de backup
```bash
#!/bin/bash
# scripts/backup/backup-postgres.sh

set -e

# Configuration
BACKUP_DIR="/backup/postgres"
RETENTION_DAYS=30
DATE=$(date +%Y%m%d_%H%M%S)

# Créer le répertoire de backup
mkdir -p "${BACKUP_DIR}"

# Backup de la base
docker compose exec -T postgres pg_dump -U mssante -Fc mssante \
  > "${BACKUP_DIR}/mssante_${DATE}.dump"

# Compression
gzip "${BACKUP_DIR}/mssante_${DATE}.dump"

# Nettoyage des anciens backups
find "${BACKUP_DIR}" -name "*.dump.gz" -mtime +${RETENTION_DAYS} -delete

echo "Backup terminé : mssante_${DATE}.dump.gz"
```

#### Restauration
```bash
#!/bin/bash
# scripts/backup/restore-postgres.sh

BACKUP_FILE=$1

if [ -z "$BACKUP_FILE" ]; then
  echo "Usage: $0 <backup_file.dump.gz>"
  exit 1
fi

# Décompression
gunzip -c "$BACKUP_FILE" > /tmp/restore.dump

# Restauration
docker compose exec -T postgres pg_restore \
  -U mssante \
  -d mssante \
  --clean \
  --if-exists \
  /tmp/restore.dump

rm /tmp/restore.dump

echo "Restauration terminée"
```

---

## Configuration du monitoring

### 1. Prometheus

#### Fichier prometheus.yml
```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  # Prometheus lui-même
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']
  
  # Node Exporter (métriques système)
  - job_name: 'node'
    static_configs:
      - targets: ['node-exporter:9100']
  
  # PostgreSQL Exporter
  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres-exporter:9187']
  
  # Redis Exporter
  - job_name: 'redis'
    static_configs:
      - targets: ['redis-exporter:9121']
  
  # API Backend
  - job_name: 'api'
    metrics_path: '/metrics'
    static_configs:
      - targets: ['api:3000']
  
  # Postfix Exporter
  - job_name: 'postfix'
    static_configs:
      - targets: ['postfix-exporter:9154']
  
  # Dovecot Exporter  
  - job_name: 'dovecot'
    static_configs:
      - targets: ['dovecot-exporter:9166']
```

### 2. Alertes Prometheus

#### Fichier alerts.yml
```yaml
groups:
  - name: system
    interval: 30s
    rules:
      # CPU élevé
      - alert: HighCPU
        expr: 100 - (avg by(instance) (irate(node_cpu_seconds_total{mode="idle"}[5m])) * 100) > 80
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "CPU élevé sur {{ $labels.instance }}"
          description: "Utilisation CPU > 80% pendant 5 minutes"
      
      # Mémoire faible
      - alert: LowMemory
        expr: (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes) * 100 < 10
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Mémoire faible sur {{ $labels.instance }}"
          description: "Mémoire disponible < 10%"
      
      # Disque plein
      - alert: DiskFull
        expr: (node_filesystem_avail_bytes / node_filesystem_size_bytes) * 100 < 15
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Disque plein sur {{ $labels.instance }}"
          description: "Espace disque < 15%"
  
  - name: mssante
    interval: 30s
    rules:
      # Service down
      - alert: ServiceDown
        expr: up == 0
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "Service {{ $labels.job }} down"
          description: "Le service {{ $labels.job }} est indisponible"
      
      # Certificat expirant
      - alert: CertificateExpiring
        expr: (ssl_cert_not_after - time()) / 86400 < 30
        for: 1h
        labels:
          severity: warning
        annotations:
          summary: "Certificat expire bientôt"
          description: "Le certificat {{ $labels.domain }} expire dans {{ $value }} jours"
      
      # Queue mail élevée
      - alert: HighMailQueue
        expr: postfix_queue_size > 100
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Queue mail élevée"
          description: "{{ $value }} messages en attente"
```

---

## Configuration des backups

### 1. Script de backup complet
```bash
#!/bin/bash
# scripts/backup/backup-all.sh

set -e

BACKUP_ROOT="/backup"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="${BACKUP_ROOT}/${DATE}"

mkdir -p "${BACKUP_DIR}"

echo "=== Backup PostgreSQL ==="
./scripts/backup/backup-postgres.sh

echo "=== Backup Redis ==="
docker compose exec -T redis redis-cli --rdb /data/dump.rdb
cp data/redis/dump.rdb "${BACKUP_DIR}/redis.rdb"

echo "=== Backup Mails ==="
tar -czf "${BACKUP_DIR}/mail.tar.gz" data/mail/

echo "=== Backup Configs ==="
tar -czf "${BACKUP_DIR}/config.tar.gz" config/

echo "=== Backup Certificates ==="
tar -czf "${BACKUP_DIR}/certificates.tar.gz" config/certificates/

# Créer un manifest
cat > "${BACKUP_DIR}/manifest.json" << EOF
{
  "date": "${DATE}",
  "components": [
    "postgres",
    "redis",
    "mail",
    "config",
    "certificates"
  ],
  "hostname": "$(hostname)",
  "version": "$(git describe --tags 2>/dev/null || echo 'unknown')"
}
EOF

echo "Backup terminé dans ${BACKUP_DIR}"
```

### 2. Synchronisation vers stockage externe
```bash
#!/bin/bash
# scripts/backup/sync-to-s3.sh

BACKUP_DIR="/backup"
S3_BUCKET="s3://your-backup-bucket/mssante/"

# Sync vers S3
aws s3 sync "${BACKUP_DIR}" "${S3_BUCKET}" \
  --storage-class STANDARD_IA \
  --exclude "*" \
  --include "*/manifest.json" \
  --include "*.dump.gz" \
  --include "*.tar.gz" \
  --include "*.rdb"

echo "Synchronisation S3 terminée"
```

---

## Optimisation des performances

### 1. Cache Redis

#### Configuration Redis
```conf
# /etc/redis/redis.conf

# Mémoire maximum
maxmemory 2gb

# Politique d'éviction
maxmemory-policy allkeys-lru

# Persistence
save 900 1
save 300 10
save 60 10000

# AOF pour durabilité
appendonly yes
appendfsync everysec

# Performance
tcp-backlog 511
timeout 0
tcp-keepalive 300
```

### 2. Connection pooling

#### Configuration PostgreSQL pooling
```bash
# pgbouncer.ini

[databases]
mssante = host=postgres port=5432 dbname=mssante

[pgbouncer]
listen_addr = *
listen_port = 6432
auth_type = md5
auth_file = /etc/pgbouncer/userlist.txt

pool_mode = transaction
max_client_conn = 1000
default_pool_size = 25
reserve_pool_size = 5
reserve_pool_timeout = 3

server_idle_timeout = 600
server_lifetime = 3600
```

### 3. Nginx caching (si utilisé)
```nginx
# Cache zone
proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=api_cache:10m max_size=1g inactive=60m use_temp_path=off;

server {
    location /api/ {
        proxy_cache api_cache;
        proxy_cache_valid 200 5m;
        proxy_cache_use_stale error timeout http_500 http_502 http_503;
        proxy_cache_bypass $http_cache_control;
        add_header X-Cache-Status $upstream_cache_status;
        
        proxy_pass http://api:3000;
    }
}
```

---

## Historique des modifications

| Date       | Version    | Auteur            | Description       |
|------------|------------|-------------------|-------------------|
| 2025-12-28 | 1.0.0      | Antoine MENNEBEUF | Création initiale |
