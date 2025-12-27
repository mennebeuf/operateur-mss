# Gestion des Certificats IGC Santé

> Documentation des scripts de gestion des certificats pour la plateforme MSSanté

**Emplacement des scripts :** `scripts/certificates/`

**Emplacement de cette documentation :** `docs/admin/certificate-management.md`

---

## Table des matières

1. [Vue d'ensemble](#vue-densemble)
2. [Prérequis](#prérequis)
3. [Script install-cert.sh](#script-install-certsh)
4. [Script renew-certs.sh](#script-renew-certssh)
5. [Automatisation avec Cron](#automatisation-avec-cron)
6. [Intégration avec le monitoring](#intégration-avec-le-monitoring)
7. [Procédures IGC Santé](#procédures-igc-santé)
8. [Dépannage](#dépannage)

---

## Vue d'ensemble

La plateforme MSSanté utilise des certificats émis par l'**IGC Santé** (Infrastructure de Gestion de Clés du secteur Santé) pour :

- Authentifier les serveurs SMTP/IMAP (certificats SERV SSL)
- Permettre l'authentification mutuelle des BAL applicatives (certificats ORG AUTH_CLI)
- Signer les échanges (certificats ORG SIGN)

### Types de certificats gérés

| Type | Usage | Durée | Autorité |
|------|-------|-------|----------|
| SERV SSL | Authentification serveurs | 3 ans | IGC Santé - AC Classe 4 |
| ORG AUTH_CLI | Authentification BAL applicatives | 3 ans | IGC Santé |
| ORG SIGN | Signature des messages | 3 ans | IGC Santé |

### Structure des répertoires

```
config/certificates/
├── igc-sante/
│   ├── ca-bundle.pem          # Chaîne de certification IGC Santé
│   ├── crl.pem                # Liste de révocation
│   └── intermediate.pem       # Certificats intermédiaires
└── domains/
    ├── hopital-exemple.mssante.fr/
    │   ├── cert.pem           # Certificat du domaine
    │   ├── key.pem            # Clé privée (chmod 600)
    │   ├── chain.pem          # Chaîne de certification
    │   ├── fullchain.pem      # Certificat + chaîne
    │   └── backup_YYYYMMDD/   # Sauvegardes automatiques
    └── clinique-xyz.mssante.fr/
        └── ...
```

---

## Prérequis

### Outils requis

```bash
# Vérifier les dépendances
openssl version      # OpenSSL 1.1.1+ requis
docker --version     # Docker 20.10+ requis
docker compose version
```

### Permissions

Les scripts doivent être exécutés avec des droits suffisants pour :
- Écrire dans `config/certificates/`
- Accéder aux conteneurs Docker (postfix, dovecot, traefik)
- Écrire dans `/var/log/mssante/`

```bash
# Rendre les scripts exécutables
chmod +x scripts/certificates/install-cert.sh
chmod +x scripts/certificates/renew-certs.sh

# Créer le répertoire de logs
sudo mkdir -p /var/log/mssante
sudo chown $USER:$USER /var/log/mssante
```

### Variables d'environnement optionnelles

```bash
# Configuration des alertes (dans .env ou exportées)
export SLACK_WEBHOOK_URL="https://hooks.slack.com/services/xxx/yyy/zzz"
export ALERT_EMAIL="admin@votre-domaine.fr"
export SMTP_HOST="localhost"

# Configuration des seuils
export ALERT_DAYS=30      # Alerte si expiration < 30 jours
export WARNING_DAYS=60    # Avertissement si expiration < 60 jours

# Répertoire des certificats (défaut: ./config/certificates)
export CERT_BASE_DIR="./config/certificates"
```

---

## Script install-cert.sh

### Description

Installe un nouveau certificat IGC Santé pour un domaine MSSanté. Le script effectue des vérifications complètes avant l'installation et met à jour automatiquement la base de données et les services.

### Syntaxe

```bash
./scripts/certificates/install-cert.sh [OPTIONS] <domain> <cert_file> <key_file> [chain_file]
```

### Arguments

| Argument | Description | Obligatoire |
|----------|-------------|-------------|
| `domain` | Nom du domaine MSSanté (ex: `hopital.mssante.fr`) | ✅ Oui |
| `cert_file` | Chemin vers le certificat (.pem ou .crt) | ✅ Oui |
| `key_file` | Chemin vers la clé privée (.pem ou .key) | ✅ Oui |
| `chain_file` | Chemin vers la chaîne de certification | ❌ Non |

### Options

| Option | Description |
|--------|-------------|
| `-h, --help` | Affiche l'aide |
| `-f, --force` | Force l'installation sans confirmation |
| `-n, --no-reload` | Ne recharge pas les services après installation |

### Exemples d'utilisation

```bash
# Installation standard avec confirmation
./scripts/certificates/install-cert.sh \
  hopital-exemple.mssante.fr \
  /tmp/nouveau_cert.pem \
  /tmp/nouvelle_cle.pem

# Installation avec chaîne de certification
./scripts/certificates/install-cert.sh \
  clinique-xyz.mssante.fr \
  /tmp/cert.pem \
  /tmp/key.pem \
  /tmp/chain.pem

# Installation automatisée (CI/CD)
./scripts/certificates/install-cert.sh \
  --force \
  mon-domaine.mssante.fr \
  cert.pem \
  key.pem \
  chain.pem

# Installation sans rechargement des services
./scripts/certificates/install-cert.sh \
  --no-reload \
  mon-domaine.mssante.fr \
  cert.pem \
  key.pem
```

### Vérifications effectuées

Le script vérifie automatiquement :

1. **Existence des fichiers** source
2. **Validité du certificat** (format PEM valide)
3. **Correspondance clé/certificat** (modulus matching)
4. **CN du certificat** correspond au domaine
5. **Émetteur IGC Santé** (avertissement si autre CA)
6. **Date d'expiration** (alerte si < 30 jours)

### Opérations effectuées

1. ✅ Sauvegarde de l'ancien certificat (si existant)
2. ✅ Copie des nouveaux fichiers avec permissions correctes
3. ✅ Création du `fullchain.pem` (si chaîne fournie)
4. ✅ Mise à jour PostgreSQL (serial, fingerprint, expiration)
5. ✅ Rechargement de Postfix (`postfix reload`)
6. ✅ Rechargement de Dovecot (`doveadm reload`)
7. ✅ Redémarrage de Traefik
8. ✅ Écriture dans les logs d'audit

### Codes de sortie

| Code | Signification |
|------|---------------|
| 0 | Succès |
| 1 | Erreur (fichier manquant, certificat invalide, etc.) |

---

## Script renew-certs.sh

### Description

Vérifie l'état de tous les certificats et guide le processus de renouvellement. Peut envoyer des alertes automatiques et générer des rapports.

### Syntaxe

```bash
./scripts/certificates/renew-certs.sh [OPTIONS] [domain]
```

### Arguments

| Argument | Description | Obligatoire |
|----------|-------------|-------------|
| `domain` | Domaine spécifique à vérifier | ❌ Non (tous si omis) |

### Options

| Option | Description |
|--------|-------------|
| `-h, --help` | Affiche l'aide |
| `-c, --check` | Mode vérification uniquement (défaut) |
| `-r, --renew` | Mode renouvellement interactif |
| `-a, --alert-days N` | Seuil d'alerte en jours (défaut: 30) |
| `-w, --warning-days N` | Seuil d'avertissement en jours (défaut: 60) |
| `-s, --send-alerts` | Envoie des alertes (Slack/Email) |
| `-q, --quiet` | Mode silencieux |
| `--report` | Génère un rapport détaillé |

### Exemples d'utilisation

```bash
# Vérifier tous les certificats
./scripts/certificates/renew-certs.sh --check

# Vérifier un domaine spécifique
./scripts/certificates/renew-certs.sh --check hopital-exemple.mssante.fr

# Vérification quotidienne avec alertes
./scripts/certificates/renew-certs.sh --check --send-alerts

# Renouvellement interactif des certificats critiques
./scripts/certificates/renew-certs.sh --renew

# Générer un rapport complet
./scripts/certificates/renew-certs.sh --report

# Mode silencieux pour cron (seulement erreurs)
./scripts/certificates/renew-certs.sh --check --quiet --send-alerts

# Personnaliser les seuils
./scripts/certificates/renew-certs.sh --check --alert-days 45 --warning-days 90
```

### États des certificats

| État | Icône | Condition | Action |
|------|-------|-----------|--------|
| OK | ✅ | > 60 jours avant expiration | Aucune |
| Attention | 🟡 | 30-60 jours avant expiration | Planifier renouvellement |
| Critique | 🔴 | < 30 jours avant expiration | Renouveler immédiatement |
| Expiré | ❌ | Date dépassée | Urgence absolue |
| Manquant | ❌ | Fichier absent | Installer certificat |
| Invalide | ❌ | Certificat corrompu | Réinstaller |

### Mode renouvellement

Lorsque lancé avec `--renew`, le script :

1. Identifie les certificats critiques/expirés
2. Pour chaque certificat :
   - Affiche les instructions pour le portail IGC Santé
   - Propose de générer une CSR
   - Guide l'installation du nouveau certificat

### Format du rapport

```
==============================================
  RAPPORT DES CERTIFICATS MSSanté
  Généré le: 2025-01-15 10:30:00
  Serveur: mssante-prod-01
==============================================

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Domaine: hopital-exemple.mssante.fr
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Serial: ABC123456789
  Expiration: Jan 15 23:59:59 2025 GMT
  Jours restants: 45
  Issuer: IGC SANTE SERVEURS APPLICATIFS
  Status: 🟡 ATTENTION (< 60 jours)

==============================================
  RÉSUMÉ
==============================================
  ✅ OK:        3
  🟡 Attention: 1
  🔴 Critique:  0
  ❌ Expirés:   0
==============================================
```

### Codes de sortie

| Code | Signification |
|------|---------------|
| 0 | Tous les certificats sont OK |
| 1 | Au moins un certificat critique (< 30 jours) |
| 2 | Au moins un certificat expiré |

---

## Automatisation avec Cron

### Vérification quotidienne

```bash
# Éditer la crontab
crontab -e

# Ajouter la vérification quotidienne à 8h00
0 8 * * * /opt/mssante/scripts/certificates/renew-certs.sh --check --quiet --send-alerts >> /var/log/mssante/cert-check.log 2>&1
```

### Rapport hebdomadaire

```bash
# Rapport tous les lundis à 9h00
0 9 * * 1 /opt/mssante/scripts/certificates/renew-certs.sh --report >> /var/log/mssante/cert-report.log 2>&1
```

### Script de vérification pour systemd

```ini
# /etc/systemd/system/mssante-cert-check.service
[Unit]
Description=MSSanté Certificate Check
After=network.target docker.service

[Service]
Type=oneshot
User=mssante
WorkingDirectory=/opt/mssante
ExecStart=/opt/mssante/scripts/certificates/renew-certs.sh --check --send-alerts
StandardOutput=append:/var/log/mssante/cert-check.log
StandardError=append:/var/log/mssante/cert-check.log

[Install]
WantedBy=multi-user.target
```

```ini
# /etc/systemd/system/mssante-cert-check.timer
[Unit]
Description=Daily MSSanté Certificate Check

[Timer]
OnCalendar=*-*-* 08:00:00
Persistent=true

[Install]
WantedBy=timers.target
```

```bash
# Activer le timer
sudo systemctl enable --now mssante-cert-check.timer
```

---

## Intégration avec le monitoring

### Alertes Slack

Configurez le webhook Slack :

```bash
export SLACK_WEBHOOK_URL="https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX"
```

Format des alertes :

```
🔐 Alerte Certificat MSSanté
━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔴 Certificats critiques (< 30 jours):
  - hopital-exemple.mssante.fr (15 jours - expire: 2025-02-01)
  - clinique-xyz.mssante.fr (28 jours - expire: 2025-02-14)

mssante-prod-01 | 2025-01-15 08:00:00
```

### Alertes Email

```bash
export ALERT_EMAIL="admin@votre-etablissement.fr,securite@votre-etablissement.fr"
```

### Métriques Prometheus

Ajoutez un endpoint pour Prometheus dans l'API :

```javascript
// GET /api/v1/metrics/certificates
{
  "certificates_total": 5,
  "certificates_ok": 3,
  "certificates_warning": 1,
  "certificates_critical": 1,
  "certificates_expired": 0,
  "certificate_expiry_days": {
    "hopital-exemple.mssante.fr": 45,
    "clinique-xyz.mssante.fr": 120
  }
}
```

### Dashboard Grafana

Importez le dashboard `Certificates Overview` depuis `config/grafana/dashboards/certificates.json`.

---

## Procédures IGC Santé

### Obtention d'un nouveau certificat

1. **Connectez-vous** au portail IGC Santé : https://pki.esante.gouv.fr
2. **Identifiez-vous** avec votre carte CPS (responsable désigné)
3. **Sélectionnez** "Commander un certificat"
4. **Choisissez** le type : SERV SSL pour serveur
5. **Soumettez** la CSR (Certificate Signing Request)
6. **Téléchargez** le certificat une fois émis

### Génération d'une CSR

```bash
# Générer clé privée + CSR
openssl req -new -newkey rsa:4096 -nodes \
  -keyout hopital.mssante.fr.key \
  -out hopital.mssante.fr.csr \
  -subj "/CN=hopital.mssante.fr/O=CHU de Paris/C=FR"

# Vérifier la CSR
openssl req -in hopital.mssante.fr.csr -text -noout
```

### Renouvellement

Le renouvellement doit être initié **au moins 30 jours** avant expiration :

1. Générer une nouvelle CSR (ou réutiliser la clé existante)
2. Soumettre sur le portail IGC Santé
3. Installer avec `install-cert.sh`

---

## Dépannage

### Erreur : "La clé privée ne correspond pas au certificat"

```bash
# Vérifier les modulus
openssl x509 -in cert.pem -noout -modulus | md5sum
openssl rsa -in key.pem -noout -modulus | md5sum
# Les deux hashes doivent être identiques
```

### Erreur : "Certificat non reconnu"

```bash
# Vérifier la chaîne de certification
openssl verify -CAfile config/certificates/igc-sante/ca-bundle.pem cert.pem

# Reconstruire le fullchain
cat cert.pem chain.pem > fullchain.pem
```

### Services ne rechargent pas

```bash
# Vérifier les logs des conteneurs
docker compose logs postfix | tail -50
docker compose logs dovecot | tail -50
docker compose logs traefik | tail -50

# Forcer le redémarrage
docker compose restart postfix dovecot traefik
```

### Certificat expiré en production

**Procédure d'urgence :**

1. **Contacter l'IGC Santé** pour un renouvellement express
2. **Générer un certificat auto-signé temporaire** (si autorisé par votre politique)
3. **Installer le nouveau certificat dès réception**

```bash
# Certificat auto-signé temporaire (NON RECOMMANDÉ en production MSSanté)
openssl req -x509 -nodes -days 30 -newkey rsa:4096 \
  -keyout temp_key.pem \
  -out temp_cert.pem \
  -subj "/CN=hopital.mssante.fr/O=CHU de Paris/C=FR"
```

### Logs

Les logs sont disponibles dans :

- `/var/log/mssante/cert-install.log` - Installations
- `/var/log/mssante/cert-renew.log` - Vérifications et renouvellements
- `/tmp/cert-report-YYYYMMDD.txt` - Rapports générés

---

## Références

- [Documentation IGC Santé](https://igc-sante.esante.gouv.fr)
- [Référentiel MSSanté v1.6.0](https://esante.gouv.fr/mssante)
- [Guide ANSSI TLS](https://www.ssi.gouv.fr/guide/recommandations-de-securite-relatives-a-tls/)

---

## Historique des modifications

| Date | Version | Auteur | Description |
|------|---------|--------|-------------|
| 2025-01-XX | 1.0.0 | - | Création initiale |