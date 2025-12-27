# Architecture Technique pour devenir Opérateur MSSanté

## Table des matières

1. [Introduction](#introduction)
2. [Vue d'ensemble](#vue-densemble)
3. [Infrastructure de base](#infrastructure-de-base)
4. [Sécurité et Certificats](#sécurité-et-certificats)
5. [API LPS/DUI](#api-lpsdui)
6. [Gestion des Boîtes Aux Lettres](#gestion-des-boîtes-aux-lettres)
7. [Interface de Gestion](#interface-de-gestion)
8. [Intégration à l'Espace de Confiance](#intégration-à-lespace-de-confiance)
9. [Architecture Applicative](#architecture-applicative)
10. [Composants Additionnels](#composants-additionnels)
11. [Schéma de Base de Données](#schéma-de-base-de-données)
12. [Roadmap de Mise en Œuvre](#roadmap-de-mise-en-œuvre)
13. [Stack Technologique](#stack-technologique)
14. [Budget et Ressources](#budget-et-ressources)

---

## Introduction

Ce document présente l'architecture technique complète pour la mise en place d'une solution opérateur MSSanté conforme au **Référentiel #1 Opérateurs de Messageries Sécurisées de Santé v1.6.0** publié par l'Agence du Numérique en Santé (ANS).

### Contexte réglementaire

- **Référentiel applicable:** v1.6.0 du 20/03/2024
- **Date de conformité obligatoire:** 19/01/2025
- **Gestionnaire:** Agence du Numérique en Santé (ANS)
- **Cadre légal:** Articles L.1110-4 et L.1110-4-1 du Code de la Santé Publique

### Objectifs

- Proposer un service de messagerie sécurisée pour les professionnels de santé
- Assurer l'interopérabilité avec l'ensemble des opérateurs MSSanté
- Garantir la sécurité et la confidentialité des données de santé
- Fournir des interfaces de gestion des comptes et des BAL

---

## Vue d'ensemble

### Principe du système MSSanté

MSSanté est un **espace de confiance** géré par l'ANS, permettant aux professionnels de santé d'échanger des données de santé de manière sécurisée par messagerie électronique.

### Rôles et responsabilités

**Opérateur MSSanté:**
- Personne morale fournissant un service de messagerie sécurisée
- Engagement contractuel avec l'ANS
- Respect des exigences du Référentiel #1

**Types d'opérateurs:**
- **Opérateur Développeur:** Développe le connecteur MSSanté
- **Opérateur Acheteur:** Achète le connecteur auprès d'un développeur

### Architecture globale

```
┌─────────────────────────────────────────────────────────┐
│              Espace de Confiance MSSanté                │
│                   (géré par l'ANS)                      │
└──────────────────────┬──────────────────────────────────┘
                       │
         ┌─────────────┼─────────────┐
         │             │             │
    ┌────▼────┐   ┌────▼────┐   ┌────▼────┐
    │Opérateur│   │Opérateur│   │Opérateur│
    │    A    │   │    B    │   │    C    │
    └─────────┘   └─────────┘   └─────────┘
         │             │             │
    [Connecteur]  [Connecteur]  [Connecteur]
         │             │             │
    Professionnels  Établissements  Structures
    de santé        de santé        médico-sociales
```

---

## Infrastructure de base

### Composants serveur obligatoires

#### Connecteur MSSanté

Le **Connecteur MSSanté** est l'ensemble des équipements permettant l'interconnexion à l'espace de confiance.

**Composants minimaux:**

1. **Serveur SMTP**
   - Port: 587 (soumission)
   - Port: 25 (réception inter-opérateurs)
   - Protocole: SMTP + STARTTLS obligatoire
   - Conformité: RFC 5321, RFC 3207

2. **Serveur IMAP**
   - Port: 143
   - Protocole: IMAP4 rev1 ou rev2 + STARTTLS
   - Conformité: RFC 3501 ou RFC 9051

3. **Passerelle de sécurité**
   - TLS 1.2 minimum (TLS 1.0/1.1 interdits)
   - Suites de chiffrement conformes ANSSI
   - Gestion des certificats IGC Santé

### Stack technique recommandée

#### Option 1: Stack Linux classique

```
Système d'exploitation:
├── Ubuntu Server 22.04 LTS ou
├── Debian 12 ou
└── Rocky Linux 9

Services de messagerie:
├── Postfix (SMTP)
├── Dovecot (IMAP)
└── Rspamd (Antispam)

Reverse proxy / Load Balancer:
├── HAProxy ou
└── Nginx

Base de données:
├── PostgreSQL 14+ (recommandé) ou
└── MySQL 8.0+

Cache / Sessions:
├── Redis 7+
└── Memcached (optionnel)

Monitoring:
├── Prometheus
├── Grafana
└── Loki (logs)
```

#### Option 2: Stack moderne conteneurisée

```
Orchestration:
├── Kubernetes ou
└── Docker Swarm

Services:
├── Postfix (conteneur)
├── Dovecot (conteneur)
├── API Backend (conteneur)
└── Frontend Web (conteneur)

Stockage:
├── Volumes persistants
└── Object Storage (S3-compatible)
```

### Configuration réseau

```
┌─────────────────────────────────────┐
│          Internet                   │
└──────────────┬──────────────────────┘
               │
        ┌──────▼───────┐
        │  Firewall    │
        │  (WAF)       │
        └──────┬───────┘
               │
        ┌──────▼────────┐
        │ Load Balancer │
        │  (HAProxy)    │
        └──────┬────────┘
               │
    ┌──────────┼──────────┐
    │          │          │
┌───▼────┐ ┌───▼───┐ ┌────▼───┐
│SMTP    │ │IMAP   │ │Web API │
│Server  │ │Server │ │Server  │
└────────┘ └───────┘ └────────┘
```

**Ports à ouvrir:**

| Service | Port | Protocole | Usage |
|---------|------|-----------|-------|
| SMTP Submission | 587 | TCP | Envoi clients |
| SMTP MX | 25 | TCP | Réception inter-opérateurs |
| IMAP | 143 | TCP | Consultation clients |
| HTTPS | 443 | TCP | Interface web |
| API | 8443 | TCP | API REST (optionnel) |

---

## Sécurité et Certificats

### Certificats IGC Santé obligatoires

L'IGC (Infrastructure de Gestion de Clés) Santé est gérée par l'ANS et fournit les certificats nécessaires.

#### Types de certificats

**1. Certificats Serveur (SERV SSL)**
- Usage: Authentification des serveurs SMTP/IMAP
- Autorité: IGC Santé - AC Classe 4
- Durée: 3 ans
- Format: X.509 v3

**2. Certificats Organisation (ORG AUTH_CLI)**
- Usage: Authentification des BAL applicatives
- Permet: Authentification mutuelle (mTLS)
- Requis pour: Connexion des systèmes d'information

**3. Certificats de test**
- Fournis par l'ANS pour l'environnement de test
- Indispensables pour la phase de validation

### Procédure d'obtention

```
1. Contractualisation avec l'ANS
   └── Signature du contrat opérateur V2

2. Attestation de commande
   └── Document requis par l'autorité de certification

3. Commande des certificats
   ├── Via le portail IGC Santé
   ├── Identification avec carte CPS responsable
   └── Désignation d'un administrateur technique

4. Réception et installation
   ├── Certificat serveur (PEM)
   ├── Clé privée (chiffrée)
   └── Chaîne de certification
```

### Configuration TLS obligatoire

#### Versions TLS autorisées

```
✅ TLS 1.2 (minimum obligatoire)
✅ TLS 1.3 (recommandé)
❌ TLS 1.1 (interdit)
❌ TLS 1.0 (interdit)
❌ SSL 3.0 (interdit)
```

#### Suites de chiffrement conformes ANSSI

```nginx
# Configuration Nginx
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers 'ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256';
ssl_prefer_server_ciphers on;
ssl_session_timeout 1d;
ssl_session_cache shared:SSL:50m;
ssl_stapling on;
ssl_stapling_verify on;
```

```postfix
# Configuration Postfix
smtpd_tls_mandatory_protocols = !SSLv2, !SSLv3, !TLSv1, !TLSv1.1
smtpd_tls_protocols = !SSLv2, !SSLv3, !TLSv1, !TLSv1.1
smtp_tls_mandatory_protocols = !SSLv2, !SSLv3, !TLSv1, !TLSv1.1
smtp_tls_protocols = !SSLv2, !SSLv3, !TLSv1, !TLSv1.1

smtpd_tls_mandatory_ciphers = high
smtpd_tls_ciphers = high
tls_high_cipherlist = ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384
```

### Gestion des révocations (CRL/OCSP)

**CRL (Certificate Revocation List):**
```bash
# Téléchargement quotidien des CRL
0 2 * * * /usr/local/bin/download-crl.sh

# Script download-crl.sh
#!/bin/bash
wget https://igc-sante.esante.gouv.fr/AC-CLASSE-4/crl/AC-CLASSE-4.crl
openssl crl -inform DER -in AC-CLASSE-4.crl -outform PEM -out /etc/ssl/crl/igc-sante.pem
```

**OCSP (Online Certificate Status Protocol):**
```
Serveur OCSP ANS: http://ocsp.igc-sante.esante.gouv.fr
Vérification en temps réel de la révocation
```

### Architecture PKI

```
┌──────────────────────────────┐
│      IGC Santé (ANS)         │
│                              │
│  ┌────────────────────────┐  │
│  │   AC Racine IGC        │  │
│  └──────────┬─────────────┘  │
│             │                │
│  ┌──────────▼─────────────┐  │
│  │   AC Classe 4          │  │
│  │   (Serveurs)           │  │
│  └──────────┬─────────────┘  │
└─────────────┼────────────────┘
              │
              ▼
┌──────────────────────────────┐
│  Votre plateforme opérateur  │
│                              │
│  ┌────────────────────────┐  │
│  │ Certificat SERV SSL    │  │
│  │ - smtp.votre-domaine   │  │
│  │ - imap.votre-domaine   │  │
│  └────────────────────────┘  │
│                              │
│  ┌────────────────────────┐  │
│  │ Truststore             │  │
│  │ - AC Racine            │  │
│  │ - AC Classe 4          │  │
│  │ - CRL                  │  │
│  └────────────────────────┘  │
└──────────────────────────────┘
```

---

## API LPS/DUI

### Présentation

L'**API LPS/DUI** (Logiciel Professionnel de Santé / Document Unique d'Interface) est une interface standardisée obligatoire permettant l'interopérabilité entre les opérateurs et les clients de messagerie.

### Protocoles supportés

#### SMTP (Envoi)
```
Port: 587
Protocole: SMTP + STARTTLS
Conformité: RFC 5321, RFC 3207
Authentication: SASL (PLAIN, LOGIN, XOAUTH2)
```

#### IMAP (Réception)
```
Port: 143
Protocole: IMAP4 + STARTTLS
Conformité: RFC 3501 / RFC 9051
Authentication: SASL (PLAIN, LOGIN, XOAUTH2)
```

### Modes d'authentification

L'API LPS doit supporter plusieurs modes d'authentification selon le type de BAL.

#### 1. Pro Santé Connect (PSC) - OAuth 2.0

Pour les **BAL personnelles et organisationnelles**.

**Flux d'authentification:**

```
┌──────────┐                                    ┌─────────────┐
│  Client  │                                    │     PSC     │
│Messagerie│                                    │   (ANS)     │
└────┬─────┘                                    └──────┬──────┘
     │                                                 │
     │ 1. Demande d'autorisation                       │
     │────────────────────────────────────────────────>│
     │                                                 │
     │ 2. Interface d'authentification                 │
     │<────────────────────────────────────────────────│
     │                                                 │
     │ 3. Credentials (CPS/e-CPS)                      │
     │────────────────────────────────────────────────>│
     │                                                 │
     │ 4. Code d'autorisation                          │
     │<────────────────────────────────────────────────│
     │                                                 │
┌────▼─────┐                                    ┌──────┴──────┐
│  Client  │                                    │     PSC     │
└────┬─────┘                                    └──────┬──────┘
     │ 5. Échange code contre token                    │
     │────────────────────────────────────────────────>│
     │                                                 │
     │ 6. Access Token + ID Token                      │
     │<────────────────────────────────────────────────│
     │                                                 │
┌────▼─────┐                                    ┌─────────────┐
│  Client  │                                    │  Opérateur  │
└────┬─────┘                                    │  MSSanté    │
     │                                          └──────┬──────┘
     │ 7. Connexion IMAP/SMTP avec token               │
     │ AUTH XOAUTH2 <token>                            │
     │────────────────────────────────────────────────>│
     │                                                 │
     │ 8. Validation token auprès PSC                  │
     │                                                 │
     │ 9. Accès autorisé                               │
     │<────────────────────────────────────────────────│
     │                                                 │
```

**Implémentation OAuth 2.0 SASL:**

```javascript
// Exemple Node.js - Vérification token PSC
const verifyPSCToken = async (token) => {
  const response = await fetch('https://auth.esw.esante.gouv.fr/auth/realms/esante-wallet/protocol/openid-connect/userinfo', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  if (!response.ok) {
    throw new Error('Invalid token');
  }
  
  const userInfo = await response.json();
  
  return {
    subject: userInfo.sub,
    rpps: userInfo.SubjectNameID,
    email: userInfo.email,
    name: userInfo.given_name + ' ' + userInfo.family_name
  };
};

// Configuration serveur SMTP avec XOAUTH2
const smtpConfig = {
  auth: {
    type: 'custom',
    method: 'XOAUTH2',
    verify: async (auth, callback) => {
      try {
        const userInfo = await verifyPSCToken(auth.accessToken);
        callback(null, { user: userInfo });
      } catch (error) {
        callback(error);
      }
    }
  }
};
```

**Configuration Pro Santé Connect:**

```yaml
PSC_Configuration:
  Authorization_Endpoint: https://auth.esw.esante.gouv.fr/auth/realms/esante-wallet/protocol/openid-connect/auth
  Token_Endpoint: https://auth.esw.esante.gouv.fr/auth/realms/esante-wallet/protocol/openid-connect/token
  UserInfo_Endpoint: https://auth.esw.esante.gouv.fr/auth/realms/esante-wallet/protocol/openid-connect/userinfo
  
  Scopes_Required:
    - openid
    - email
    - profile
    - scope_all
  
  Response_Type: code
  Grant_Type: authorization_code
```

#### 2. Certificat ORG AUTH_CLI (mTLS)

Pour les **BAL applicatives**.

**Flux d'authentification:**

```
┌────────────┐                            ┌─────────────┐
│  Système   │                            │  Opérateur  │
│Information │                            │  MSSanté    │
└─────┬──────┘                            └──────┬──────┘
      │                                          │
      │ 1. Connexion TLS avec certificat         │
      │    client ORG AUTH_CLI                   │
      │─────────────────────────────────────────>│
      │                                          │
      │ 2. TLS Handshake                         │
      │    - Serveur envoie son certificat       │
      │    - Client envoie son certificat        │
      │<────────────────────────────────────────>│
      │                                          │
      │ 3. Validation mutuelle des certificats   │
      │    - Vérification chaîne IGC Santé       │
      │    - Vérification non-révocation (CRL)   │
      │                                          │
      │ 4. Canal TLS établi (mTLS)               │
      │<========================================>│
      │                                          │
      │ 5. Commandes SMTP/IMAP                   │
      │─────────────────────────────────────────>│
```

**Configuration Postfix (mTLS):**

```postfix
# main.cf
smtpd_tls_cert_file = /etc/ssl/certs/serveur-mssante.pem
smtpd_tls_key_file = /etc/ssl/private/serveur-mssante.key
smtpd_tls_CAfile = /etc/ssl/certs/igc-sante-ca.pem

# Exiger le certificat client
smtpd_tls_ask_ccert = yes
smtpd_tls_req_ccert = yes

# Vérification du certificat
smtpd_tls_ccert_verifydepth = 5

# Restriction basée sur le certificat
smtpd_recipient_restrictions =
    permit_mynetworks,
    permit_tls_clientcerts,
    reject_unauth_destination
```

**Configuration Dovecot (mTLS):**

```dovecot
ssl = required
ssl_cert = </etc/ssl/certs/serveur-mssante.pem
ssl_key = </etc/ssl/private/serveur-mssante.key
ssl_ca = </etc/ssl/certs/igc-sante-ca.pem

# Demander le certificat client
ssl_verify_client_cert = yes
ssl_require_crl = yes

# Authentification par certificat
auth_mechanisms = external

passdb {
  driver = static
  args = allow_nets=0.0.0.0/0
}
```

### Fichier de configuration d'autoconfig

Les opérateurs doivent fournir un fichier de configuration pour l'auto-configuration des clients.

**Exemple de fichier autoconfig.xml:**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<clientConfig version="1.1">
  <emailProvider id="votre-domaine.mssante.fr">
    <domain>votre-domaine.mssante.fr</domain>
    
    <!-- Configuration IMAP -->
    <incomingServer type="imap">
      <hostname>imap.votre-domaine.mssante.fr</hostname>
      <port>143</port>
      <socketType>STARTTLS</socketType>
      <authentication>OAuth2</authentication>
      <authentication>password-cleartext</authentication>
      <username>%EMAILADDRESS%</username>
      
      <!-- OAuth2 pour PSC -->
      <oauth2>
        <issuer>https://auth.esw.esante.gouv.fr/auth/realms/esante-wallet</issuer>
        <scope>openid email profile</scope>
        <authURL>https://auth.esw.esante.gouv.fr/auth/realms/esante-wallet/protocol/openid-connect/auth</authURL>
        <tokenURL>https://auth.esw.esante.gouv.fr/auth/realms/esante-wallet/protocol/openid-connect/token</tokenURL>
      </oauth2>
    </incomingServer>
    
    <!-- Configuration SMTP -->
    <outgoingServer type="smtp">
      <hostname>smtp.votre-domaine.mssante.fr</hostname>
      <port>587</port>
      <socketType>STARTTLS</socketType>
      <authentication>OAuth2</authentication>
      <authentication>password-cleartext</authentication>
      <username>%EMAILADDRESS%</username>
    </outgoingServer>
    
    <!-- Configuration BAL applicatives (certificat) -->
    <incomingServer type="imap">
      <hostname>imap-app.votre-domaine.mssante.fr</hostname>
      <port>143</port>
      <socketType>STARTTLS</socketType>
      <authentication>client-certificate</authentication>
      <username>%EMAILADDRESS%</username>
    </incomingServer>
    
  </emailProvider>
</clientConfig>
```

### Endpoints API REST (optionnel mais recommandé)

En complément des protocoles standard, vous pouvez proposer une API REST.

```
POST   /api/v1/auth/psc/authorize
POST   /api/v1/auth/psc/token
POST   /api/v1/auth/psc/refresh
GET    /api/v1/auth/psc/userinfo

GET    /api/v1/messages
POST   /api/v1/messages
GET    /api/v1/messages/:id
DELETE /api/v1/messages/:id

GET    /api/v1/folders
POST   /api/v1/folders
```

---

## Gestion des Boîtes Aux Lettres

### Types de BAL

Le système MSSanté définit trois types de boîtes aux lettres avec des caractéristiques distinctes.

#### 1. BAL Personnelles

**Caractéristiques:**
- Associée à un professionnel de santé identifié
- Authentification via Pro Santé Connect
- Format: `prenom.nom@domaine.mssante.fr`
- Publication dans l'Annuaire Santé (sauf liste rouge)

**Données d'identification requises:**
```json
{
  "type": "personal",
  "email": "jean.dupont@hopital-exemple.mssante.fr",
  "owner": {
    "rpps": "10001234567",
    "firstName": "Jean",
    "lastName": "Dupont",
    "profession": "Médecin",
    "specialty": "Cardiologie"
  },
  "authentication": "ProSanteConnect",
  "hideFromDirectory": false
}
```

**Cas d'usage:**

- Communication entre professionnels
- Échanges patient-médecin (via Mon Espace Santé)
- Envoi de comptes rendus médicaux

#### 2. BAL Organisationnelles

**Caractéristiques:**

- Associée à un service ou département
- Authentification via Pro Santé Connect (délégation)
- Format: `service.nom@domaine.mssante.fr`
- Gestion des droits d'accès multiples

**Données d'identification requises:**

```json
{
  "type": "organizational",
  "email": "secretariat.cardiologie@hopital-exemple.mssante.fr",
  "organization": {
    "finess": "010001234",
    "name": "Service de Cardiologie",
    "department": "Hôpital Exemple"
  },
  "authentication": "ProSanteConnect",
  "delegatedUsers": [
    {"rpps": "10001234567", "role": "admin"},
    {"rpps": "10001234568", "role": "read"},
    {"rpps": "10001234569", "role": "write"}
  ]
}
```

**Cas d'usage:**

- BAL de service partagée
- Secrétariat médical
- Service d'urgences
- Coordination de soins

#### 3. BAL Applicatives

**Caractéristiques:**

- Associée à un système d'information
- Authentification par certificat ORG AUTH_CLI
- Format: `app.nom@domaine.mssante.fr`
- Échanges automatisés

**Données d'identification requises:**
```json
{
  "type": "applicative",
  "email": "app.dpi@hopital-exemple.mssante.fr",
  "application": {
    "name": "DPI Hôpital",
    "finess": "010001234",
    "description": "Dossier Patient Informatisé"
  },
  "authentication": "ORG_AUTH_CLI",
  "certificate": {
    "serial": "1A2B3C4D5E6F",
    "subject": "CN=app.dpi,O=Hopital Exemple,C=FR",
    "issuer": "CN=AC CLASSE 4,O=IGC SANTE",
    "validUntil": "2026-12-31T23:59:59Z"
  }
}
```

**Cas d'usage:**

- Alimentation automatique du DMP
- Alimentation de Mon Espace Santé
- Systèmes de gestion de laboratoire
- Robots d'envoi de résultats

### Processus de création de BAL

#### Workflow de création

```
┌──────────────────────────────────────────────────────┐
│ 1. Demande de création                               │
│    - Formulaire web ou API                           │
│    - Vérification des données                        │
└────────────────┬─────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────────┐
│ 2. Validation                                        │
│    - Vérification RPPS (personnelles/org.)           │
│    - Vérification FINESS (org./applicatives)         │
│    - Vérification unicité email                      │
└────────────────┬─────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────────┐
│ 3. Création technique                                │
│    - Création compte messagerie                      │
│    - Configuration quotas                            │
│    - Configuration authentification                  │
└────────────────┬─────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────────┐
│ 4. Publication                                       │
│    - Ajout à l'Annuaire Santé (si non liste rouge)   │
│    - Notification au titulaire                       │
│    - Activation                                      │
└──────────────────────────────────────────────────────┘
```

#### Script de création (exemple)

```bash
#!/bin/bash
# create-mailbox.sh

TYPE=$1  # personal, organizational, applicative
EMAIL=$2
OWNER_RPPS=$3
FINESS=$4

# Validation format email
if [[ ! $EMAIL =~ ^[a-z0-9._%+-]+@[a-z0-9.-]+\.mssante\.fr$ ]]; then
    echo "❌ Format email invalide"
    exit 1
fi

# Vérification unicité
if doveadm user $EMAIL > /dev/null 2>&1; then
    echo "❌ Email déjà existant"
    exit 1
fi

# Création utilisateur système
useradd -m -d /var/mail/vhosts/$EMAIL -s /bin/false $EMAIL

# Création compte Dovecot
doveadm user $EMAIL

# Configuration quotas (1 Go par défaut)
doveadm quota set -u $EMAIL storage 1G

# Publication dans l'annuaire
curl -X POST https://annuaire.mssante.fr/api/v1/publish \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$EMAIL\",
    \"type\": \"$TYPE\",
    \"rpps\": \"$OWNER_RPPS\",
    \"finess\": \"$FINESS\"
  }"

echo "✅ BAL créée: $EMAIL"
```

### Gestion des délégations

Pour les BAL organisationnelles, plusieurs utilisateurs peuvent avoir accès.

**Niveaux de droits:**

| Rôle | Lecture | Écriture | Suppression | Admin |
|------|---------|----------|-------------|-------|
| Lecteur | ✅ | ❌ | ❌ | ❌ |
| Rédacteur | ✅ | ✅ | ❌ | ❌ |
| Gestionnaire | ✅ | ✅ | ✅ | ❌ |
| Administrateur | ✅ | ✅ | ✅ | ✅ |

**Implémentation des ACL Dovecot:**

```
# dovecot-acl pour BAL organisationnelle
# /var/mail/vhosts/secretariat.service@domaine.mssante.fr/dovecot-acl

user=jean.dupont@domaine.mssante.fr lrwstipekxa
user=marie.martin@domaine.mssante.fr lr
user=paul.durand@domaine.mssante.fr lrwstipek
```

### Liste rouge (masquage annuaire)

Les professionnels peuvent demander à ne pas apparaître dans l'Annuaire Santé.

**Processus:**

1. Demande du titulaire
2. Validation par l'opérateur
3. Dépublication de l'annuaire
4. BAL reste active et fonctionnelle

```javascript
// API - Mise en liste rouge
app.post('/api/v1/mailboxes/:id/hide', authenticate, async (req, res) => {
  const mailbox = await Mailbox.findById(req.params.id);
  
  // Vérifier que le demandeur est le titulaire
  if (mailbox.ownerId !== req.user.id) {
    return res.status(403).json({ error: 'Non autorisé' });
  }
  
  // Mise à jour
  mailbox.hideFromDirectory = true;
  await mailbox.save();
  
  // Dépublication annuaire
  await annuaireService.unpublish(mailbox.email);
  
  res.json({ message: 'BAL masquée de l\'annuaire' });
});
```

### Gestion du cycle de vie

**États possibles:**

```
┌─────────┐     activation       ┌────────┐
│ Pending │─────────────────────>│ Active │
└─────────┘                      └───┬────┘
                                     │
                    suspension       │       réactivation
                ┌────────────────────┤◄──────────────────┐
                │                    │                   │
                ▼                    │                   │
           ┌──────────┐              │             ┌──────────┐
           │Suspended │              │             │  Active  │
           └──────────┘              │             └──────────┘
                │                    │
                │    suppression     │
                └────────────────────┤
                                     │
                                     ▼
                                ┌─────────┐
                                │ Deleted │
                                └─────────┘
```

**Règles de gestion:**

- **Inactivité > 1 an:** Notification au titulaire
- **Inactivité > 18 mois:** Suspension automatique
- **Inactivité > 2 ans:** Dépublication de l'annuaire (exigence ANS)
- **Suppression:** Conservation des logs 3 ans minimum

---

## Interface de Gestion

### Vue d'ensemble

L'interface de gestion permet aux administrateurs et aux utilisateurs de gérer leurs BAL et leurs paramètres.

### Architecture Frontend

```
┌─────────────────────────────────────────────────────┐
│                 Interface Web                       │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────┐   │
│  │ Authentif.   │  │  Dashboard   │  │  Webmail │   │
│  │  (PSC)       │  │              │  │          │   │
│  └──────────────┘  └──────────────┘  └──────────┘   │
│                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────┐   │
│  │ Gestion BAL  │  │     Admin    │  │   Audit  │   │
│  │              │  │              │  │          │   │
│  └──────────────┘  └──────────────┘  └──────────┘   │
└─────────────────────────────────────────────────────┘
```

### Stack Frontend recommandé

#### Option React

```jsx
// Structure du projet
src/
├── components/
│   ├── Auth/
│   │   ├── PSCLogin.jsx
│   │   └── CertificateAuth.jsx
│   ├── Dashboard/
│   │   ├── Overview.jsx
│   │   └── Statistics.jsx
│   ├── Mailbox/
│   │   ├── MailboxList.jsx
│   │   ├── MailboxCreate.jsx
│   │   └── MailboxSettings.jsx
│   ├── Admin/
│   │   ├── UserManagement.jsx
│   │   └── CertificateManagement.jsx
│   └── Webmail/
│       ├── MessageList.jsx
│       ├── MessageView.jsx
│       └── Compose.jsx
├── services/
│   ├── api.js
│   ├── auth.js
│   └── mailbox.js
├── store/
│   ├── authSlice.js
│   ├── mailboxSlice.js
│   └── store.js
└── App.jsx

// Dépendances principales
{
  "dependencies": {
    "react": "^18.2.0",
    "react-router-dom": "^6.20.0",
    "redux": "^5.0.0",
    "@reduxjs/toolkit": "^2.0.0",
    "axios": "^1.6.0",
    "tailwindcss": "^3.3.0",
    "react-query": "^3.39.0"
  }
}
```

#### Option Vue.js

```javascript
// Structure du projet
src/
├── views/
│   ├── Dashboard.vue
│   ├── MailboxManagement.vue
│   ├── AdminPanel.vue
│   └── Webmail.vue
├── components/
│   ├── Auth/
│   ├── Mailbox/
│   └── Common/
├── store/
│   ├── modules/
│   │   ├── auth.js
│   │   └── mailbox.js
│   └── index.js
├── router/
│   └── index.js
└── services/
    └── api.js

// Dépendances principales
{
  "dependencies": {
    "vue": "^3.3.0",
    "vue-router": "^4.2.0",
    "vuex": "^4.1.0",
    "axios": "^1.6.0",
    "element-plus": "^2.4.0"
  }
}
```

### Modules fonctionnels

#### 1. Module d'authentification

**Écran de connexion avec PSC:**

```jsx
// PSCLogin.jsx
import React from 'react';
import { useNavigate } from 'react-router-dom';

const PSCLogin = () => {
  const navigate = useNavigate();
  
  const handlePSCLogin = () => {
    const pscAuthUrl = `https://auth.esw.esante.gouv.fr/auth/realms/esante-wallet/protocol/openid-connect/auth`;
    const params = new URLSearchParams({
      client_id: process.env.REACT_APP_PSC_CLIENT_ID,
      response_type: 'code',
      redirect_uri: `${window.location.origin}/auth/callback`,
      scope: 'openid email profile',
      state: generateState()
    });
    
    window.location.href = `${pscAuthUrl}?${params}`;
  };
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="text-center text-3xl font-extrabold text-gray-900">
            Connexion Opérateur MSSanté
          </h2>
        </div>
        <div className="mt-8 space-y-6">
          <button
            onClick={handlePSCLogin}
            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
          >
            Se connecter avec Pro Santé Connect
          </button>
        </div>
      </div>
    </div>
  );
};
```

#### 2. Module Dashboard

**Tableau de bord principal:**

```jsx
// Dashboard.jsx
const Dashboard = () => {
  const { data: stats } = useQuery('statistics', fetchStatistics);
  
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Tableau de bord</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <StatCard
          title="BAL actives"
          value={stats?.activeMailboxes}
          icon="📬"
        />
        <StatCard
          title="Messages envoyés (30j)"
          value={stats?.sentMessages}
          icon="📤"
        />
        <StatCard
          title="Messages reçus (30j)"
          value={stats?.receivedMessages}
          icon="📥"
        />
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RecentActivity />
        <QuickActions />
      </div>
    </div>
  );
};
```

#### 3. Module Gestion des BAL

**Liste des boîtes aux lettres:**

```jsx
// MailboxList.jsx
const MailboxList = () => {
  const [mailboxes, setMailboxes] = useState([]);
  const [filter, setFilter] = useState('all');
  
  useEffect(() => {
    fetchMailboxes(filter).then(setMailboxes);
  }, [filter]);
  
  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Mes boîtes aux lettres</h1>
        <button
          onClick={() => navigate('/mailboxes/create')}
          className="bg-blue-600 text-white px-4 py-2 rounded-md"
        >
          Créer une BAL
        </button>
      </div>
      
      <div className="mb-4">
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="border rounded-md px-3 py-2"
        >
          <option value="all">Tous les types</option>
          <option value="personal">Personnelles</option>
          <option value="organizational">Organisationnelles</option>
          <option value="applicative">Applicatives</option>
        </select>
      </div>
      
      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <ul className="divide-y divide-gray-200">
          {mailboxes.map(mailbox => (
            <MailboxListItem key={mailbox.id} mailbox={mailbox} />
          ))}
        </ul>
      </div>
    </div>
  );
};
```

**Formulaire de création:**

```jsx
// MailboxCreate.jsx
const MailboxCreate = () => {
  const [formData, setFormData] = useState({
    type: 'personal',
    email: '',
    firstName: '',
    lastName: '',
    rpps: '',
    finess: ''
  });
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      await api.post('/api/v1/mailboxes', formData);
      toast.success('BAL créée avec succès');
      navigate('/mailboxes');
    } catch (error) {
      toast.error('Erreur lors de la création');
    }
  };
  
  return (
    <form onSubmit={handleSubmit} className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Créer une boîte aux lettres</h1>
      
      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Type de BAL
          </label>
          <select
            value={formData.type}
            onChange={(e) => setFormData({...formData, type: e.target.value})}
            className="mt-1 block w-full rounded-md border-gray-300"
          >
            <option value="personal">Personnelle</option>
            <option value="organizational">Organisationnelle</option>
            <option value="applicative">Applicative</option>
          </select>
        </div>
        
        {formData.type === 'personal' && (
          <>
            <div>
              <label>Prénom</label>
              <input
                type="text"
                value={formData.firstName}
                onChange={(e) => setFormData({...formData, firstName: e.target.value})}
                className="mt-1 block w-full rounded-md border-gray-300"
              />
            </div>
            <div>
              <label>Nom</label>
              <input
                type="text"
                value={formData.lastName}
                onChange={(e) => setFormData({...formData, lastName: e.target.value})}
                className="mt-1 block w-full rounded-md border-gray-300"
              />
            </div>
            <div>
              <label>N° RPPS</label>
              <input
                type="text"
                value={formData.rpps}
                onChange={(e) => setFormData({...formData, rpps: e.target.value})}
                className="mt-1 block w-full rounded-md border-gray-300"
              />
            </div>
          </>
        )}
        
        <div>
          <label>Adresse email</label>
          <input
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({...formData, email: e.target.value})}
            placeholder="exemple@domaine.mssante.fr"
            className="mt-1 block w-full rounded-md border-gray-300"
          />
        </div>
        
        <button
          type="submit"
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md"
        >
          Créer la BAL
        </button>
      </div>
    </form>
  );
};
```

#### 4. Module Webmail intégré

**Interface de lecture des messages:**

```jsx
// Webmail.jsx
const Webmail = () => {
  const [selectedMailbox, setSelectedMailbox] = useState(null);
  const [messages, setMessages] = useState([]);
  const [selectedMessage, setSelectedMessage] = useState(null);
  
  return (
    <div className="h-screen flex">
      {/* Sidebar - Liste des BAL */}
      <div className="w-64 bg-gray-100 p-4">
        <h2 className="font-bold mb-4">Mes boîtes</h2>
        <MailboxList onSelect={setSelectedMailbox} />
      </div>
      
      {/* Liste des messages */}
      <div className="w-96 border-r">
        <MessageList
          mailbox={selectedMailbox}
          messages={messages}
          onSelect={setSelectedMessage}
        />
      </div>
      
      {/* Contenu du message */}
      <div className="flex-1 p-6">
        {selectedMessage ? (
          <MessageView message={selectedMessage} />
        ) : (
          <div className="text-gray-400 text-center mt-20">
            Sélectionnez un message
          </div>
        )}
      </div>
    </div>
  );
};
```

#### 5. Module Administration

**Gestion des utilisateurs:**

```jsx
// UserManagement.jsx
const UserManagement = () => {
  const [users, setUsers] = useState([]);
  
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Gestion des utilisateurs</h1>
      
      <div className="bg-white shadow rounded-lg">
        <table className="min-w-full">
          <thead className="bg-gray-50">
            <tr>
              <th>Nom</th>
              <th>Email</th>
              <th>RPPS</th>
              <th>Rôle</th>
              <th>BAL</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <UserRow key={user.id} user={user} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
```

**Gestion des certificats:**

```jsx
// CertificateManagement.jsx
const CertificateManagement = () => {
  const [certificates, setCertificates] = useState([]);
  
  const checkExpiration = (expiryDate) => {
    const daysRemaining = Math.floor(
      (new Date(expiryDate) - new Date()) / (1000 * 60 * 60 * 24)
    );
    
    if (daysRemaining < 30) return 'danger';
    if (daysRemaining < 90) return 'warning';
    return 'ok';
  };
  
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Certificats</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {certificates.map(cert => (
          <div key={cert.id} className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold">{cert.type}</h3>
              <span className={`badge badge-${checkExpiration(cert.expiryDate)}`}>
                {cert.status}
              </span>
            </div>
            <div className="text-sm text-gray-600 space-y-2">
              <div>
                <strong>Sujet:</strong> {cert.subject}
              </div>
              <div>
                <strong>Émetteur:</strong> {cert.issuer}
              </div>
              <div>
                <strong>Expire le:</strong> {new Date(cert.expiryDate).toLocaleDateString()}
              </div>
              <div>
                <strong>Série:</strong> {cert.serialNumber}
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button className="btn btn-sm btn-primary">Renouveler</button>
              <button className="btn btn-sm btn-secondary">Télécharger</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
```

### Backend API

**Architecture API REST:**

```javascript
// server.js (Express)
const express = require('express');
const app = express();

// Middleware
app.use(express.json());
app.use(cors());
app.use(helmet());

// Routes
app.use('/api/v1/auth', require('./routes/auth'));
app.use('/api/v1/mailboxes', require('./routes/mailboxes'));
app.use('/api/v1/users', require('./routes/users'));
app.use('/api/v1/certificates', require('./routes/certificates'));
app.use('/api/v1/messages', require('./routes/messages'));
app.use('/api/v1/audit', require('./routes/audit'));

// routes/mailboxes.js
const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');

// Lister les BAL
router.get('/', authenticate, async (req, res) => {
  const mailboxes = await Mailbox.find({
    userId: req.user.id
  });
  res.json(mailboxes);
});

// Créer une BAL
router.post('/', authenticate, async (req, res) => {
  const { type, email, rpps, finess } = req.body;
  
  // Validation
  if (!isValidMSSanteEmail(email)) {
    return res.status(400).json({ error: 'Format email invalide' });
  }
  
  // Vérification unicité
  const exists = await Mailbox.findOne({ email });
  if (exists) {
    return res.status(409).json({ error: 'Email déjà utilisé' });
  }
  
  // Création
  const mailbox = await Mailbox.create({
    type,
    email,
    rpps,
    finess,
    userId: req.user.id,
    status: 'pending'
  });
  
  // Création technique
  await createMailboxTechnical(mailbox);
  
  // Publication annuaire
  await publishToDirectory(mailbox);
  
  res.status(201).json(mailbox);
});

// Mettre à jour une BAL
router.put('/:id', authenticate, async (req, res) => {
  const mailbox = await Mailbox.findById(req.params.id);
  
  if (!mailbox || mailbox.userId !== req.user.id) {
    return res.status(404).json({ error: 'BAL non trouvée' });
  }
  
  Object.assign(mailbox, req.body);
  await mailbox.save();
  
  res.json(mailbox);
});

// Supprimer une BAL
router.delete('/:id', authenticate, async (req, res) => {
  const mailbox = await Mailbox.findById(req.params.id);
  
  if (!mailbox || mailbox.userId !== req.user.id) {
    return res.status(404).json({ error: 'BAL non trouvée' });
  }
  
  // Suppression technique
  await deleteMailboxTechnical(mailbox);
  
  // Dépublication
  await unpublishFromDirectory(mailbox);
  
  mailbox.status = 'deleted';
  await mailbox.save();
  
  res.json({ message: 'BAL supprimée' });
});

module.exports = router;
```

---

## Intégration à l'Espace de Confiance

### Services ANS à intégrer

#### 1. Annuaire National MSSanté

L'Annuaire National permet de rechercher les professionnels de santé et leurs BAL.

**Endpoints:**

```
# Production
https://annuaire.mssante.fr/api/v1/

# Test
https://annuaire.formation.mssante.fr/api/v1/
```

**API de recherche:**

```javascript
// Recherche par nom
const searchProfessional = async (lastName, firstName) => {
  const response = await fetch(
    `https://annuaire.mssante.fr/api/v1/search?` +
    `lastName=${encodeURIComponent(lastName)}&` +
    `firstName=${encodeURIComponent(firstName)}`,
    {
      headers: {
        'Authorization': `Bearer ${operatorToken}`,
        'Content-Type': 'application/json'
      }
    }
  );
  
  return await response.json();
};

// Recherche par RPPS
const searchByRPPS = async (rpps) => {
  const response = await fetch(
    `https://annuaire.mssante.fr/api/v1/professionals/${rpps}`,
    {
      headers: {
        'Authorization': `Bearer ${operatorToken}`
      }
    }
  );
  
  return await response.json();
};

// Publication d'une BAL
const publishMailbox = async (mailboxData) => {
  const response = await fetch(
    'https://annuaire.mssante.fr/api/v1/mailboxes',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${operatorToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: mailboxData.email,
        type: mailboxData.type,
        rpps: mailboxData.rpps,
        finess: mailboxData.finess,
        hideFromDirectory: mailboxData.hideFromDirectory
      })
    }
  );
  
  return await response.json();
};
```

#### 2. Liste Blanche des domaines

La liste blanche est un fichier géré par l'ANS contenant tous les domaines MSSanté autorisés.

**Format de la liste blanche:**

```
# Format: domaine;type;finess;date_ajout
hopital-paris.mssante.fr;operateur;750000001;2024-01-15
clinique-exemple.mssante.fr;operateur;690000002;2024-02-20
laboratoire-test.mssante.fr;operateur;130000003;2024-03-10
```

**Téléchargement et synchronisation:**

```bash
#!/bin/bash
# sync-whitelist.sh

WHITELIST_URL="https://mssante.fr/api/v1/whitelist"
LOCAL_FILE="/etc/mssante/whitelist.txt"
TEMP_FILE="/tmp/whitelist_new.txt"

# Téléchargement
curl -H "Authorization: Bearer $API_TOKEN" \
     -o "$TEMP_FILE" \
     "$WHITELIST_URL"

# Vérification
if [ $? -eq 0 ]; then
    # Sauvegarde de l'ancienne version
    cp "$LOCAL_FILE" "$LOCAL_FILE.bak"
    
    # Remplacement
    mv "$TEMP_FILE" "$LOCAL_FILE"
    
    # Rechargement Postfix
    postmap hash:/etc/mssante/whitelist.txt
    postfix reload
    
    echo "✅ Liste blanche mise à jour"
else
    echo "❌ Erreur téléchargement"
    exit 1
fi
```

**Configuration Postfix avec liste blanche:**

```
# main.cf
smtpd_recipient_restrictions =
    permit_mynetworks,
    check_sender_access hash:/etc/mssante/whitelist,
    reject_unauth_destination

# Fichier /etc/postfix/sender_access
hopital-paris.mssante.fr OK
clinique-exemple.mssante.fr OK
```

#### 3. Service de révocation (CRL/OCSP)

**Configuration automatique des CRL:**

```bash
#!/bin/bash
# update-crl.sh

CRL_BASE_URL="https://igc-sante.esante.gouv.fr"
CRL_DIR="/etc/ssl/crl"

# Téléchargement CRL AC Classe 4
wget -O "$CRL_DIR/ac-classe-4.crl" \
     "$CRL_BASE_URL/AC-CLASSE-4/crl/AC-CLASSE-4.crl"

# Conversion DER vers PEM
openssl crl -inform DER -in "$CRL_DIR/ac-classe-4.crl" \
            -outform PEM -out "$CRL_DIR/ac-classe-4.pem"

# Rechargement des services
systemctl reload postfix
systemctl reload dovecot

echo "✅ CRL mise à jour"
```

**Planification (crontab):**

```cron
# Mise à jour quotidienne à 2h du matin
0 2 * * * /usr/local/bin/update-crl.sh >> /var/log/crl-update.log 2>&1

# Synchronisation liste blanche toutes les heures
0 * * * * /usr/local/bin/sync-whitelist.sh >> /var/log/whitelist-sync.log 2>&1
```

### Architecture réseau inter-opérateurs

```
┌────────────────────────────────────────────┐
│         Votre Connecteur MSSanté           │
│                                            │
│  ┌────────────┐          ┌──────────────┐  │
│  │   SMTP     │          │     IMAP     │  │
│  │  Sortant   │          │   Entrant    │  │
│  │  Port 25   │          │   Port 143   │  │
│  └─────┬──────┘          └──────┬───────┘  │
│        │                        │          │
│        │  ┌──────────────────┐  │          │
│        └──┤     Postfi       │-─┘          │
│           │     Dovecot      │             │
│           └──────────────────┘             │
│                    │                       │
└────────────────────┼───────────────────────┘
                     │
         ┌───────────┼───────────┐
         │           │           │
    ┌────▼────┐ ┌────▼────┐ ┌────▼────┐
    │Opérateur│ │Opérateur│ │Opérateur│
    │    A    │ │    B    │ │    C    │
    └─────────┘ └─────────┘ └─────────┘
```

**Configuration DNS MX:**

```dbs
; Zone DNS pour votre-domaine.mssante.fr
@               IN  MX  10  mx1.votre-domaine.mssante.fr.
@               IN  MX  20  mx2.votre-domaine.mssante.fr.

mx1             IN  A       203.0.113.10
mx2             IN  A       203.0.113.11

; Enregistrement SPF
@               IN  TXT     "v=spf1 mx -all"
; DKIM
default._domainkey  IN  TXT  "v=DKIM1; k=rsa; p=MIGfMA0GCS..."
; DMARC
_dmarc          IN  TXT     "v=DMARC1; p=quarantine; rua=mailto:dmarc@votre-domaine.mssante.fr"
```

---

## Architecture Applicative

### Architecture globale en couches

```
┌────────────────────────────────────────────────────────┐
│                   Couche Présentation                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │   Web UI     │  │  Mobile App  │  │   API Pub    │  │
│  │  (React)     │  │  (React N.)  │  │   (REST)     │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└────────────────────────┬───────────────────────────────┘
                         │
┌────────────────────────▼───────────────────────────────┐
│                   Couche Services                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ Auth Service │  │ Mail Service │  │Admin Service │  │
│  │   (PSC)      │  │ (SMTP/IMAP)  │  │(Gestion BAL) │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└────────────────────────┬───────────────────────────────┘
                         │
┌────────────────────────▼───────────────────────────────┐
│                  Couche Métier                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  Mailbox     │  │  Certificate │  │    Audit     │  │
│  │  Manager     │  │   Manager    │  │   Manager    │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└────────────────────────┬───────────────────────────────┘
                         │
┌────────────────────────▼───────────────────────────────┐
│                 Couche Persistance                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  PostgreSQL  │  │    Redis     │  │ File Storage │  │
│  │    (BDD)     │  │   (Cache)    │  │  (Messages)  │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└────────────────────────────────────────────────────────┘
```

### Microservices vs Monolithe

#### Option Monolithe (recommandée pour démarrer)

**Avantages:**

- Déploiement simplifié
- Moins de complexité opérationnelle
- Performance (pas de latence réseau interne)

**Structure:**

```
application/
├── src/
│   ├── api/
│   │   ├── routes/
│   │   └── controllers/
│   ├── services/
│   │   ├── auth/
│   │   ├── mailbox/
│   │   ├── mail/
│   │   └── certificate/
│   ├── models/
│   ├── middleware/
│   └── utils/
├── config/
├── tests/
└── docker-compose.yml
```

#### Option Microservices (pour grande échelle)

**Architecture:**

```
┌─────────────────┐     ┌─────────────────┐
│  Auth Service   │     │  Mail Service   │
│  (Node.js)      │     │  (Python)       │
│  Port 3001      │     │  Port 3002      │
└────────┬────────┘     └────────┬────────┘
         │                       │
         └───────────┬───────────┘
                     │
            ┌────────▼────────┐
            │  API Gateway    │
            │  (Kong/Nginx)   │
            │  Port 443       │
            └────────┬────────┘
                     │
         ┌───────────┼───────────┐
         │           │           │
┌────────▼────┐ ┌────▼─────┐ ┌───▼──────┐
│ Mailbox Svc │ │ Cert Svc │ │ Audit Svc│
│  Port 3003  │ │Port 3004 │ │ Port 3005│
└─────────────┘ └──────────┘ └──────────┘
```

### Haute disponibilité

**Configuration cluster:**

```yaml
# docker-compose.ha.yml
version: '3.8'

services:
  # Load Balancer
  haproxy:
    image: haproxy:2.8
    ports:
      - "443:443"
      - "25:25"
      - "587:587"
      - "143:143"
    volumes:
      - ./haproxy.cfg:/usr/local/etc/haproxy/haproxy.cfg
    
  # API Servers
  api-1:
    build: ./api
    environment:
      - NODE_ENV=production
      - DB_HOST=postgres-master
    depends_on:
      - postgres-master
      - redis-master
    
  api-2:
    build: ./api
    environment:
      - NODE_ENV=production
      - DB_HOST=postgres-master
    
  # PostgreSQL Master
  postgres-master:
    image: postgres:15
    environment:
      - POSTGRES_DB=mssante
      - POSTGRES_REPLICATION_MODE=master
    volumes:
      - postgres-master-data:/var/lib/postgresql/data
    
  # PostgreSQL Replica
  postgres-replica:
    image: postgres:15
    environment:
      - POSTGRES_REPLICATION_MODE=slave
      - POSTGRES_MASTER_HOST=postgres-master
    
  # Redis Master
  redis-master:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    volumes:
      - redis-master-data:/data
    
  # Redis Replica
  redis-replica:
    image: redis:7-alpine
    command: redis-server --slaveof redis-master 6379
    
  # SMTP Servers
  postfix-1:
    build: ./postfix
    volumes:
      - ./certs:/etc/ssl/certs
      - mail-storage:/var/mail
    
  postfix-2:
    build: ./postfix
    volumes:
      - ./certs:/etc/ssl/certs
      - mail-storage:/var/mail

volumes:
  postgres-master-data:
  redis-master-data:
  mail-storage:
    driver: nfs
    driver_opts:
      share: nfs-server:/mssante/mail
```

**Configuration HAProxy:**

```bash
# haproxy.cfg
global
maxconn 4096
ssl-default-bind-ciphers ECDHE-RSA-AES256-GCM-SHA384:...
ssl-default-bind-options no-sslv3 no-tlsv10 no-tlsv11
defaults
mode http
timeout connect 5s
timeout client 50s
timeout server 50s

# Frontend HTTPS
frontend https_front
bind *:443 ssl crt /etc/ssl/certs/mssante.pem
default_backend api_servers

# Backend API
backend api_servers
balance roundrobin
server api1 api-1:3000 check
server api2 api-2:3000 check

# Frontend SMTP
frontend smtp_front
mode tcp
bind *:25
bind *:587
default_backend smtp_servers

# Backend SMTP
backend smtp_servers
mode tcp
balance leastconn
server smtp1 postfix-1:25 check
server smtp2 postfix-2:25 check

# Frontend IMAP
frontend imap_front
mode tcp
bind *:143
default_backend imap_servers

# Backend IMAP
backend imap_servers
mode tcp
balance leastconn
server imap1 dovecot-1:143 check
server imap2 dovecot-2:143 check
```

---

## Composants Additionnels

### Monitoring et Supervision

#### Prometheus + Grafana

**Configuration Prometheus:**

```yaml
# prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'mssante-api'
    static_configs:
      - targets: ['api-1:3000', 'api-2:3000']
  
  - job_name: 'postfix'
    static_configs:
      - targets: ['postfix-exporter:9154']
  
  - job_name: 'dovecot'
    static_configs:
      - targets: ['dovecot-exporter:9166']
  
  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres-exporter:9187']
  
  - job_name: 'redis'
    static_configs:
      - targets: ['redis-exporter:9121']

alerting:
  alertmanagers:
    - static_configs:
        - targets: ['alertmanager:9093']

rule_files:
  - 'alerts.yml'
```

**Règles d'alerte:**
```yaml
# alerts.yml
groups:
  - name: mssante_alerts
    interval: 30s
    rules:
      # Certificat expire bientôt
      - alert: CertificateExpiringSoon
        expr: ssl_cert_not_after - time() < 86400 * 30
        for: 1h
        labels:
          severity: warning
        annotations:
          summary: "Certificat expire dans moins de 30 jours"
      
      # Service SMTP down
      - alert: SMTPServiceDown
        expr: up{job="postfix"} == 0
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "Service SMTP indisponible"
      
      # Taux d'erreur élevé
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Taux d'erreur > 5%"
      
      # Utilisation disque élevée
      - alert: HighDiskUsage
        expr: (node_filesystem_size_bytes - node_filesystem_free_bytes) / node_filesystem_size_bytes > 0.85
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Utilisation disque > 85%"
```

**Dashboards Grafana:**
```json
{
  "dashboard": {
    "title": "MSSanté - Vue d'ensemble",
    "panels": [
      {
        "title": "Messages envoyés/reçus",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(postfix_sent_total[5m])",
            "legendFormat": "Envoyés"
          },
          {
            "expr": "rate(postfix_received_total[5m])",
            "legendFormat": "Reçus"
          }
        ]
      },
      {
        "title": "BAL actives",
        "type": "stat",
        "targets": [
          {
            "expr": "mssante_mailboxes_active_total"
          }
        ]
      },
      {
        "title": "Taux d'erreur",
        "type": "gauge",
        "targets": [
          {
            "expr": "rate(http_requests_total{status=~\"5..\"}[5m])"
          }
        ]
      }
    ]
  }
}
```

#### ELK Stack (Logs)

**Configuration Filebeat:**
```yaml
# filebeat.yml
filebeat.inputs:
  - type: log
    enabled: true
    paths:
      - /var/log/postfix/*.log
    fields:
      service: postfix
  
  - type: log
    enabled: true
    paths:
      - /var/log/dovecot/*.log
    fields:
      service: dovecot
  
  - type: log
    enabled: true
    paths:
      - /var/log/api/*.log
    fields:
      service: api

output.elasticsearch:
  hosts: ["elasticsearch:9200"]
  index: "mssante-%{+yyyy.MM.dd}"

setup.kibana:
  host: "kibana:5601"
```

### Sécurité

#### Antispam / Antivirus

**Configuration Rspamd:**

```conf
# /etc/rspamd/local.d/worker-normal.inc
enabled = true;
count = 4;
/etc/rspamd/local.d/milter_headers.conf
use = ["x-spam-status", "x-spam-level", "authentication-results"];
/etc/rspamd/local.d/dkim_signing.conf
path = "/var/lib/rspamd/dkim/domain.domain.
domain.selector.key";
selector = "default";
```

**Configuration ClamAV:**

```conf
# /etc/clamav/clamd.conf
LogFile /var/log/clamav/clamd.log
LogTime yes
DatabaseDirectory /var/lib/clamav
TCPSocket 3310
MaxThreads 12
MaxConnectionQueueLength 30
```

**Intégration Postfix + Rspamd + ClamAV:**

```conf
# main.cf
smtpd_milters = inet:localhost:11332
non_smtpd_milters = inet:localhost:11332
milter_protocol = 6
milter_mail_macros = i {mail_addr} {client_addr} {client_name} {auth_authen}
milter_default_action = accept
```

#### Firewall (WAF)

**Configuration ModSecurity:**

```nginx
# nginx.conf
http {
    modsecurity on;
    modsecurity_rules_file /etc/nginx/modsec/main.conf;
    
    server {
        listen 443 ssl http2;
        server_name api.votre-domaine.mssante.fr;
        
        ssl_certificate /etc/ssl/certs/mssante.pem;
        ssl_certificate_key /etc/ssl/private/mssante.key;
        
        location / {
            modsecurity on;
            proxy_pass http://api_backend;
        }
    }
}
```

**Règles OWASP:**

```conf
# /etc/nginx/modsec/main.conf
Include /etc/nginx/modsec/modsecurity.conf
Include /etc/nginx/modsec/owasp-crs/crs-setup.conf
Include /etc/nginx/modsec/owasp-crs/rules/*.conf
Règles personnalisées
SecRule REQUEST_URI "@contains /api/v1/admin" 
"id:1000,
phase:1,
deny,
status:403,
log,
msg:'Tentative accès admin non autorisé'"
```

### Sauvegarde et PCA

#### Stratégie de sauvegarde

```bash
#!/bin/bash
# backup.sh

BACKUP_DIR="/backup/mssante"
DATE=$(date +%Y%m%d_%H%M%S)

# Sauvegarde PostgreSQL
pg_dump -h postgres-master -U mssante mssante | \
    gzip > "$BACKUP_DIR/db_$DATE.sql.gz"

# Sauvegarde Redis (RDB)
redis-cli --rdb "$BACKUP_DIR/redis_$DATE.rdb"

# Sauvegarde fichiers de configuration
tar -czf "$BACKUP_DIR/config_$DATE.tar.gz" \
    /etc/postfix \
    /etc/dovecot \
    /etc/nginx \
    /etc/ssl

# Sauvegarde messages (incrémentale)
rsync -avz --backup --backup-dir="$BACKUP_DIR/mail_incremental_$DATE" \
    /var/mail/ "$BACKUP_DIR/mail_latest/"

# Chiffrement
for file in "$BACKUP_DIR"/*_$DATE.*; do
    gpg --encrypt --recipient backup@votre-domaine.fr "$file"
    rm "$file"
done

# Rotation (garder 30 jours)
find "$BACKUP_DIR" -name "*.gpg" -mtime +30 -delete

# Copie vers stockage distant
rclone sync "$BACKUP_DIR" s3:mssante-backup/
```

**Planification:**

```cron
# Sauvegarde complète quotidienne
0 1 * * * /usr/local/bin/backup.sh >> /var/log/backup.log 2>&1

# Sauvegarde incrémentale toutes les 6h
0 */6 * * * /usr/local/bin/backup-incremental.sh
```

#### Plan de Continuité d'Activité (PCA)

**Documentation PCA:**

1. **RTO (Recovery Time Objective):** 4 heures
2. **RPO (Recovery Point Objective):** 15 minutes
3. **Site de secours:** Datacenter secondaire

**Procédure de bascule:**

```bash
#!/bin/bash
# failover.sh

echo "🚨 Déclenchement du PCA"

# 1. Vérification site secondaire
if ! ping -c 3 backup-site.example.com; then
    echo "❌ Site secondaire inaccessible"
    exit 1
fi

# 2. Arrêt du site principal
ssh primary-site.example.com "systemctl stop postfix dovecot"

# 3. Promotion du replica PostgreSQL
ssh backup-site.example.com "pg_ctl promote -D /var/lib/postgresql/data"

# 4. Activation Redis replica
ssh backup-site.example.com "redis-cli slaveof no one"

# 5. Mise à jour DNS
./update-dns.sh --primary=backup-site.example.com

# 6. Démarrage services
ssh backup-site.example.com "systemctl start postfix dovecot api"

echo "✅ Bascule terminée"
```

### Conformité RGPD

#### Registre des traitements

```json
{
  "traitement": {
    "nom": "Système de messagerie sécurisée MSSanté",
    "responsable": {
      "nom": "Votre Organisation",
      "dpo": "dpo@votre-organisation.fr"
    },
    "finalites": [
      "Échanges sécurisés de données de santé",
      "Coordination des soins"
    ],
    "categories_donnees": [
      "Identité",
      "Données de santé",
      "Données de connexion"
    ],
    "categories_personnes": [
      "Professionnels de santé",
      "Patients"
    ],
    "destinataires": [
      "Autres professionnels de santé",
      "Établissements de santé"
    ],
    "duree_conservation": {
      "messages": "Variable selon contexte médical",
      "logs": "3 ans minimum"
    },
    "mesures_securite": [
      "Chiffrement TLS 1.2+",
      "Authentification forte (PSC)",
      "Certificats IGC Santé",
      "Journalisation des accès"
    ]
  }
}
```

#### Gestion des droits des personnes

```javascript
// API RGPD
app.post('/api/v1/gdpr/export', authenticate, async (req, res) => {
  const userId = req.user.id;
  
  // Export des données personnelles
  const data = {
    identity: await User.findById(userId).select('-password'),
    mailboxes: await Mailbox.find({ userId }),
    messages: await Message.find({ userId }),
    connections: await AuditLog.find({ userId, action: 'login' })
  };
  
  // Génération PDF ou JSON
  const pdf = await generatePDFExport(data);
  
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename=mes-donnees.pdf');
  res.send(pdf);
});

app.delete('/api/v1/gdpr/delete', authenticate, async (req, res) => {
  const userId = req.user.id;
  
  // Anonymisation des logs (ne pas supprimer pour traçabilité)
  await AuditLog.updateMany(
    { userId },
    { $set: { userId: null, anonymized: true } }
  );
  
  // Suppression messages
  await Message.deleteMany({ userId });
  
  // Suppression BAL
  await Mailbox.updateMany(
    { userId },
    { $set: { status: 'deleted' } }
  );
  
  // Suppression compte
  await User.findByIdAndDelete(userId);
  
  res.json({ message: 'Données supprimées' });
});
```

---

## Schéma de Base de Données

### Modèle relationnel (PostgreSQL)

```sql
-- Table des utilisateurs
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rpps_id VARCHAR(20) UNIQUE,
    adeli_id VARCHAR(20),
    psc_subject VARCHAR(255) UNIQUE,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    email VARCHAR(255) UNIQUE,
    profession VARCHAR(100),
    specialty VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP,
    status VARCHAR(20) DEFAULT 'active',
    CONSTRAINT chk_status CHECK (status IN ('active', 'suspended', 'deleted'))
);

-- Index
CREATE INDEX idx_users_rpps ON users(rpps_id);
CREATE INDEX idx_users_psc ON users(psc_subject);
CREATE INDEX idx_users_status ON users(status);

-- Table des boîtes aux lettres
CREATE TABLE mailboxes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    type VARCHAR(20) NOT NULL,
    owner_id UUID REFERENCES users(id),
    finess_id VARCHAR(20),
    organization_name VARCHAR(255),
    service_name VARCHAR(255),
    application_name VARCHAR(255),
    status VARCHAR(20) DEFAULT 'pending',
    hide_from_directory BOOLEAN DEFAULT FALSE,
    quota_mb INTEGER DEFAULT 1024,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    activated_at TIMESTAMP,
    last_activity TIMESTAMP,
    CONSTRAINT chk_type CHECK (type IN ('personal', 'organizational', 'applicative')),
    CONSTRAINT chk_mailbox_status CHECK (status IN ('pending', 'active', 'suspended', 'deleted'))
);

-- Index
CREATE INDEX idx_mailboxes_email ON mailboxes(email);
CREATE INDEX idx_mailboxes_owner ON mailboxes(owner_id);
CREATE INDEX idx_mailboxes_type ON mailboxes(type);
CREATE INDEX idx_mailboxes_status ON mailboxes(status);
CREATE INDEX idx_mailboxes_finess ON mailboxes(finess_id);

-- Table des délégations (pour BAL organisationnelles)
CREATE TABLE mailbox_delegations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mailbox_id UUID REFERENCES mailboxes(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL,
    granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    granted_by UUID REFERENCES users(id),
    expires_at TIMESTAMP,
    CONSTRAINT chk_role CHECK (role IN ('read', 'write', 'manage', 'admin')),
    UNIQUE(mailbox_id, user_id)
);

-- Index
CREATE INDEX idx_delegations_mailbox ON mailbox_delegations(mailbox_id);
CREATE INDEX idx_delegations_user ON mailbox_delegations(user_id);

-- Table des certificats
CREATE TABLE certificates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mailbox_id UUID REFERENCES mailboxes(id),
    type VARCHAR(20) NOT NULL,
    subject VARCHAR(500),
    issuer VARCHAR(500),
    serial_number VARCHAR(100) UNIQUE,
    certificate_pem TEXT NOT NULL,
    private_key_pem TEXT, -- Chiffré
    issued_at TIMESTAMP NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    revoked_at TIMESTAMP,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_cert_type CHECK (type IN ('SERV_SSL', 'ORG_AUTH_CLI', 'ORG_SIGN', 'ORG_CONF')),
    CONSTRAINT chk_cert_status CHECK (status IN ('active', 'expired', 'revoked'))
);

-- Index
CREATE INDEX idx_certificates_mailbox ON certificates(mailbox_id);
CREATE INDEX idx_certificates_serial ON certificates(serial_number);
CREATE INDEX idx_certificates_expires ON certificates(expires_at);

-- Table des journaux d'audit
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    user_id UUID REFERENCES users(id),
    mailbox_id UUID REFERENCES mailboxes(id),
    action VARCHAR(50) NOT NULL,
    resource_type VARCHAR(50),
    resource_id VARCHAR(255),
    ip_address INET,
    user_agent TEXT,
    status VARCHAR(20),
    details JSONB,
    anonymized BOOLEAN DEFAULT FALSE
);

-- Index partitionné par date pour performance
CREATE INDEX idx_audit_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX idx_audit_user ON audit_logs(user_id);
CREATE INDEX idx_audit_mailbox ON audit_logs(mailbox_id);
CREATE INDEX idx_audit_action ON audit_logs(action);

-- Partitionnement par mois
CREATE TABLE audit_logs_2024_01 PARTITION OF audit_logs
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

-- Table des statistiques
CREATE TABLE statistics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    mailbox_id UUID REFERENCES mailboxes(id),
    messages_sent INTEGER DEFAULT 0,
    messages_received INTEGER DEFAULT 0,
    storage_used_mb INTEGER DEFAULT 0,
    connections_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(date, mailbox_id)
);

-- Index
CREATE INDEX idx_statistics_date ON statistics(date DESC);
CREATE INDEX idx_statistics_mailbox ON statistics(mailbox_id);

-- Table des sessions (pour cache)
CREATE TABLE sessions (
    id VARCHAR(255) PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    data JSONB,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index
CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);

-- Fonctions utilitaires

-- Mise à jour automatique du timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_mailboxes_updated_at BEFORE UPDATE ON mailboxes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Vues utiles

-- Vue des BAL actives
CREATE VIEW active_mailboxes AS
SELECT 
    m.*,
    u.first_name,
    u.last_name,
    u.rpps_id,
    COUNT(DISTINCT md.user_id) as delegation_count
FROM mailboxes m
LEFT JOIN users u ON m.owner_id = u.id
LEFT JOIN mailbox_delegations md ON m.id = md.mailbox_id
WHERE m.status = 'active'
GROUP BY m.id, u.id;

-- Vue des certificats expirant bientôt
CREATE VIEW expiring_certificates AS
SELECT 
    c.*,
    m.email,
    (c.expires_at - CURRENT_TIMESTAMP) as time_remaining
FROM certificates c
JOIN mailboxes m ON c.mailbox_id = m.id
WHERE c.status = 'active'
AND c.expires_at < CURRENT_TIMESTAMP + INTERVAL '90 days'
ORDER BY c.expires_at;

-- Vue des statistiques quotidiennes
CREATE VIEW daily_statistics AS
SELECT 
    date,
    SUM(messages_sent) as total_sent,
    SUM(messages_received) as total_received,
    SUM(storage_used_mb) as total_storage_mb,
    COUNT(DISTINCT mailbox_id) as active_mailboxes
FROM statistics
GROUP BY date
ORDER BY date DESC;
```

### Données de test

```sql
-- Insertion utilisateurs de test
INSERT INTO users (rpps_id, first_name, last_name, email, profession, specialty) VALUES
('10001234567', 'Jean', 'Dupont', 'jean.dupont@example.fr', 'Médecin', 'Cardiologie'),
('10001234568', 'Marie', 'Martin', 'marie.martin@example.fr', 'Infirmière', 'Soins généraux'),
('10001234569', 'Paul', 'Durand', 'paul.durand@example.fr', 'Médecin', 'Radiologie');

-- Insertion BAL de test
INSERT INTO mailboxes (email, type, owner_id, status, finess_id) VALUES
('jean.dupont@test.mssante.fr', 'personal', 
    (SELECT id FROM users WHERE rpps_id = '10001234567'), 'active', '750000001'),
('secretariat.cardio@test.mssante.fr', 'organizational',
    (SELECT id FROM users WHERE rpps_id = '10001234567'), 'active', '750000001'),
('app.dpi@test.mssante.fr', 'applicative',
    NULL, 'active', '750000001');

-- Insertion délégations
INSERT INTO mailbox_delegations (mailbox_id, user_id, role) VALUES
((SELECT id FROM mailboxes WHERE email = 'secretariat.cardio@test.mssante.fr'),
 (SELECT id FROM users WHERE rpps_id = '10001234568'), 'write'),
((SELECT id FROM mailboxes WHERE email = 'secretariat.cardio@test.mssante.fr'),
 (SELECT id FROM users WHERE rpps_id = '10001234569'), 'read');
```

---

## Roadmap de Mise en Œuvre

### Phase 1: Préparation (8 semaines)

#### Semaines 1-2: Administrative

- [ ] Constitution de l'équipe projet
- [ ] Obtention du numéro FINESS Juridique
- [ ] Lecture complète du Référentiel #1 v1.6.0
- [ ] Identification des ressources nécessaires

#### Semaines 3-4: Contractualisation

- [ ] Signature du contrat opérateur V2 avec l'ANS
- [ ] Remplissage du pack opérateur
- [ ] Demande d'attestation pour certificats
- [ ] Inscription à l'environnement de test

#### Semaines 5-6: Infrastructure

- [ ] Choix du datacenter (ou cloud)
- [ ] Provisionnement des serveurs
- [ ] Configuration réseau de base
- [ ] Mise en place VPN si nécessaire

#### Semaines 7-8: Certificats

- [ ] Commande des certificats de test IGC Santé
- [ ] Réception et installation des certificats
- [ ] Tests de connexion TLS
- [ ] Configuration truststore IGC Santé

### Phase 2: Développement (16-20 semaines)

#### Semaines 9-12: Connecteur MSSanté

- [ ] Installation et configuration Postfix
- [ ] Installation et configuration Dovecot
- [ ] Configuration TLS 1.2+ et suites de chiffrement
- [ ] Mise en place authentification mTLS
- [ ] Tests de connexion SMTP/IMAP

#### Semaines 13-16: Authentification PSC

- [ ] Inscription sur Pro Santé Connect
- [ ] Implémentation OAuth 2.0 SASL
- [ ] Configuration endpoints PSC
- [ ] Tests d'authentification
- [ ] Gestion des tokens et refresh

#### Semaines 17-20: API LPS/DUI

- [ ] Implémentation protocoles SMTP/IMAP standardisés
- [ ] Développement endpoints API REST
- [ ] Fichier de configuration autoconfig
- [ ] Tests d'interopérabilité
- [ ] Documentation API

#### Semaines 21-24: Gestion des BAL

- [ ] Développement module création BAL
- [ ] Système de gestion des délégations
- [ ] Gestion des quotas
- [ ] Publication/dépublication annuaire
- [ ] Liste rouge

#### Semaines 25-28: Interface de gestion

- [ ] Développement frontend (React/Vue)
- [ ] Module d'authentification PSC
- [ ] Dashboard et statistiques
- [ ] Interface de gestion des BAL
- [ ] Webmail intégré

### Phase 3: Tests et Validation (8 semaines)

#### Semaines 29-30: Tests internes

- [ ] Tests unitaires (>80% couverture)
- [ ] Tests d'intégration
- [ ] Tests de charge
- [ ] Tests de sécurité
- [ ] Correction des bugs

#### Semaines 31-32: Tests environnement ANS

- [ ] Connexion à l'environnement de test ANS
- [ ] Tests de conformité TLS
- [ ] Tests de révocation certificats
- [ ] Tests d'interopérabilité inter-opérateurs
- [ ] Tests de publication annuaire

#### Semaines 33-34: Outil de test ANS

- [ ] Exécution de l'outil de test et de contrôle
- [ ] Documentation des résultats
- [ ] Correction des non-conformités
- [ ] Nouvelle exécution jusqu'à conformité complète

#### Semaines 35-36: Rapport de tests

- [ ] Génération du rapport de tests
- [ ] Rédaction de la documentation technique
- [ ] Préparation de l'Annexe 1 (production)
- [ ] Envoi à l'ANS: monserviceclient.mssante@esante.gouv.fr

### Phase 4: Mise en Production (4 semaines)

#### Semaines 37-38: Validation ANS

- [ ] Réception de la validation ANS
- [ ] Commande des certificats de production
- [ ] Configuration environnement de production
- [ ] Migration des données de test

#### Semaines 39-40: Go Live

- [ ] Basculement sur l'environnement de production
- [ ] Inscription sur la liste blanche
- [ ] Publication dans l'annuaire des opérateurs
- [ ] Communication aux premiers utilisateurs
- [ ] Monitoring 24/7

### Planning Gantt

|# Planning Gantt - Projet Opérateur MSSanté

## Vue d'ensemble (10 mois)

```
Mois                    | 1  | 2  | 3  | 4  | 5  | 6  | 7  | 8  | 9  | 10 |
------------------------|----|----|----|----|----|----|----|----|----|----|
Phase 1: Préparation    |████████                                        |
Phase 2: Développement  |    |████████████████████████████████           |
Phase 3: Tests          |    |    |    |    |    |    |    |████████     |
Phase 4: Production     |    |    |    |    |    |    |    |    |    |████|
```

## Vue détaillée par semaine (40 semaines)

```
Semaine | 1| 2| 3| 4| 5| 6| 7| 8| 9|10|11|12|13|14|15|16|17|18|19|20|21|22|23|24|25|26|27|28|29|30|31|32|33|34|35|36|37|38|39|40|
--------|--|--|--|--|--|--|--|--|--|--|--|--|--|--|--|--|--|--|--|--|--|--|--|--|--|--|--|--|--|--|--|--|--|--|--|--|--|--|--|--|
        | M O I S   1     | M O I S   2     | M O I S   3     | M O I S   4     | M O I S   5     | M O I S   6     | M O I S   7     | M O I S   8     | M O I S   9     | M10 |

PHASE 1 - PRÉPARATION
--------|--|--|--|--|--|--|--|--|--|--|--|--|--|--|--|--|--|--|--|--|--|--|--|--|--|--|--|--|--|--|--|--|--|--|--|--|--|--|--|--|
Admin   |██|██|  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
Contrat |  |  |██|██|  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
Infra   |  |  |  |  |██|██|  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
Certif  |  |  |  |  |  |  |██|██|  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |

PHASE 2 - DÉVELOPPEMENT
--------|--|--|--|--|--|--|--|--|--|--|--|--|--|--|--|--|--|--|--|--|--|--|--|--|--|--|--|--|--|--|--|--|--|--|--|--|--|--|--|--|
Connec. |  |  |  |  |  |  |  |  |██|██|██|██|  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
Auth PSC|  |  |  |  |  |  |  |  |  |  |  |  |██|██|██|██|  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
API LPS |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |██|██|██|██|  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
Gest BAL|  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |██|██|██|██|  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
Frontend|  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |██|██|██|██|  |  |  |  |  |  |  |  |  |  |  |  |

PHASE 3 - TESTS
--------|--|--|--|--|--|--|--|--|--|--|--|--|--|--|--|--|--|--|--|--|--|--|--|--|--|--|--|--|--|--|--|--|--|--|--|--|--|--|--|--|
Test int|  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |██|██|  |  |  |  |  |  |  |  |  |  |
Test ANS|  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |██|██|  |  |  |  |  |  |  |  |
Conform.|  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |██|██|  |  |  |  |  |  |
Rapport |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |██|██|  |  |  |  |

PHASE 4 - PRODUCTION
--------|--|--|--|--|--|--|--|--|--|--|--|--|--|--|--|--|--|--|--|--|--|--|--|--|--|--|--|--|--|--|--|--|--|--|--|--|--|--|--|--|
Valid.  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |██|██|  |  |
Go Live |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |██|██|
```

## Légende et jalons

```
██ = Activité en cours
🔴 = Jalon critique (Go/No-Go)
✓  = Livrable

Jalons critiques:
-----------------

📍 Semaine 8  🔴 Go/No-Go Phase 1
           ✓ Contrat ANS signé
           ✓ Certificats test reçus
           ✓ Infrastructure provisionnée
           ✓ FINESS Juridique obtenu

📍 Semaine 28 🔴 Go/No-Go Phase 2
           ✓ Connecteur MSSanté fonctionnel
           ✓ API LPS/DUI complète
           ✓ Interface utilisateur déployée
           ✓ Tests unitaires OK (>80%)

📍 Semaine 36 🔴 Go/No-Go Phase 3
           ✓ Conformité validée (outil ANS)
           ✓ Rapport de tests envoyé à l'ANS
           ✓ Corrections effectuées
           ✓ Documentation complète

📍 Semaine 40 🔴 Go Live Production
           ✓ Validation ANS reçue
           ✓ Certificats production installés
           ✓ Liste blanche mise à jour
           ✓ Première BAL créée et testée
           ✓ Monitoring actif 24/7
```

## Diagramme de dépendances

```
                         [Contrat ANS]
                               |
                               ↓
                    [Certificats Test]
                               |
                               ↓
             ┌─────────────────┴─────────────────┐
             ↓                                   ↓
   [Connecteur SMTP/IMAP]              [Authentification PSC]
             |                                   |
             |         ┌─────────────────────────┘
             |         |
             ↓         ↓
            [API LPS/DUI]
                |
                ↓
    ┌───────────┴───────────┐
    ↓                       ↓
[Gestion BAL]        [Interface Web]
    |                       |
    └───────────┬───────────┘
                ↓
        [Tests internes]
                |
                ↓
    [Tests environnement ANS]
                |
                ↓
        [Outil de conformité]
                |
                ↓
          [Rapport de tests]
                |
                ↓
          [Validation ANS]
                |
                ↓
      [Certificats Production]
                |
                ↓
            [Go Live]
```

## Vue par phase avec effort

```
Phase               | Durée   | Effort    | Équipe    | Période
--------------------|---------|-----------|-----------|------------------
1. Préparation      | 8 sem.  | 80 j/h    | 4 pers.   | Semaines 1-8
2. Développement    | 20 sem. | 800 j/h   | 8 pers.   | Semaines 9-28
3. Tests            | 8 sem.  | 200 j/h   | 5 pers.   | Semaines 29-36
4. Production       | 4 sem.  | 40 j/h    | 3 pers.   | Semaines 37-40
--------------------|---------|-----------|-----------|------------------
TOTAL               | 40 sem. | 1120 j/h  | Variable  | ~10 mois
```

**Légende Effort:**
- j/h = jours-homme
- Équipe = nombre moyen de personnes mobilisées
- Période = fenêtre temporelle de réalisation

## Planning optimiste vs réaliste vs conservateur

```
Scénario            | Phase 1 | Phase 2 | Phase 3 | Phase 4 | Total      | Probabilité
--------------------|---------|---------|---------|---------|------------|-------------
Optimiste           | 6 sem.  | 16 sem. | 6 sem.  | 3 sem.  | 31 sem.    | 10%
                    |         |         |         |         | (7 mois)   |
Réaliste (nominal)  | 8 sem.  | 20 sem. | 8 sem.  | 4 sem.  | 40 sem.    | 60%
                    |         |         |         |         | (10 mois)  |
Conservateur        | 10 sem. | 24 sem. | 10 sem. | 5 sem.  | 49 sem.    | 30%
                    |         |         |         |         | (12 mois)  |
```

**Recommandation:** Planifier selon le scénario réaliste (40 semaines) avec un buffer de 20% pour les imprévus, soit **48 semaines au total (11-12 mois)**.

## Risques et buffers recommandés

```
Phase               | Buffer    | Raison principale
--------------------|-----------|----------------------------------------
1. Préparation      | +2 sem.   | Délais administratifs ANS imprévisibles
2. Développement    | +4 sem.   | Complexité technique sous-estimée
3. Tests            | +2 sem.   | Non-conformités nécessitant corrections
4. Production       | +1 sem.   | Délai validation finale ANS
--------------------|-----------|----------------------------------------
TOTAL Buffer        | +9 sem.   | Marge de sécurité globale ~22%
```

## Calendrier type (exemple démarrage Janvier 2025)

```
Phase                    | Début      | Fin        | Durée
-------------------------|------------|------------|--------
1. Préparation           | 06/01/2025 | 02/03/2025 | 8 sem.
2. Développement         | 03/03/2025 | 20/07/2025 | 20 sem.
3. Tests                 | 21/07/2025 | 14/09/2025 | 8 sem.
4. Production            | 15/09/2025 | 12/10/2025 | 4 sem.
-------------------------|------------|------------|--------
GO LIVE                  | 13/10/2025 |            |
```

**Jalons clés:**
- 🎯 02/03/2025 : Fin Phase 1 - Go/No-Go
- 🎯 20/07/2025 : Fin Phase 2 - Go/No-Go
- 🎯 14/09/2025 : Fin Phase 3 - Go/No-Go
- 🚀 13/10/2025 : Go Live Production

## Chemin critique

Le **chemin critique** est la séquence d'activités qui détermine la durée minimale du projet. Tout retard sur ces tâches retarde l'ensemble du projet.

```
[CHEMIN CRITIQUE - 40 semaines]

Sem. 1-2   : Constitution équipe + FINESS
    ↓
Sem. 3-4   : Signature contrat ANS
    ↓
Sem. 5-6   : Provisionnement infrastructure
    ↓
Sem. 7-8   : Réception certificats test ⚠️ CRITIQUE
    ↓
Sem. 9-12  : Développement connecteur SMTP/IMAP ⚠️ CRITIQUE
    ↓
Sem. 13-16 : Intégration Pro Santé Connect ⚠️ CRITIQUE
    ↓
Sem. 17-20 : API LPS/DUI
    ↓
Sem. 21-24 : Gestion BAL
    ↓
Sem. 25-28 : Interface de gestion
    ↓
Sem. 29-30 : Tests internes
    ↓
Sem. 31-32 : Tests environnement ANS ⚠️ CRITIQUE
    ↓
Sem. 33-34 : Outil de conformité ANS ⚠️ CRITIQUE
    ↓
Sem. 35-36 : Rapport de tests
    ↓
Sem. 37-38 : Validation ANS ⚠️ CRITIQUE
    ↓
Sem. 39-40 : Déploiement production + Go Live

⚠️ = Tâche sur le chemin critique (aucune marge)
```

## Ressources par période

```
         | S1-8 | S9-16| S17-24| S25-28| S29-36| S37-40|
---------|------|------|-------|-------|-------|-------|
Chef     |  1   |  1   |   1   |   1   |   1   |   1   |
Archi    |  1   |  1   |   0.5 |   -   |   0.5 |   0.5 |
Dev Back |  -   |  3   |   3   |   2   |   1   |   -   |
Dev Front|  -   |  -   |   1   |   2   |   0.5 |   -   |
Sys Admin|  2   |  2   |   1   |   1   |   1   |   1   |
Sécu     |  0.5 |  1   |   0.5 |   -   |   1   |   0.5 |
QA       |  -   |  -   |   0.5 |   1   |   2   |   1   |
DPO      |  0.5 |  -   |   -   |   -   |   0.5 |   0.5 |
---------|------|------|-------|-------|-------|-------|
TOTAL    | 5    | 8    |  6.5  |   7   |  7.5  |  4.5  |
```

## Points de synchronisation avec l'ANS

```
Semaine | Action                              | Délai ANS estimé
--------|-------------------------------------|------------------
3-4     | Envoi contrat opérateur             | 2-4 semaines
7       | Demande certificats test            | 1-2 semaines
31-32   | Accès environnement test            | Immédiat
35-36   | Envoi rapport de tests              | 2-4 semaines
37-38   | Demande certificats production      | 1-2 semaines
39      | Inscription liste blanche           | 1 semaine
```

**💡 Conseil:** Anticiper systématiquement les délais ANS en démarrant les démarches 2 semaines avant le besoin réel.

### Jalons critiques (Go/No-Go)

1. **Fin Phase 1:** Contrat signé + Certificats test reçus
2. **Fin Phase 2:** Connecteur fonctionnel + API complète
3. **Fin Phase 3:** Conformité validée par outil ANS
4. **Fin Phase 4:** Validation ANS + Mise en production

### Équipe recommandée

| Rôle | Nombre | Compétences |
|------|--------|-------------|
| Chef de projet | 1 | Gestion projet, connaissance MSSanté |
| Architecte | 1 | Architecture système, sécurité |
| Développeur Backend | 2-3 | Node.js/Python/Java, API REST |
| Développeur Frontend | 1-2 | React/Vue, UX/UI |
| Administrateur Système | 1-2 | Linux, Postfix, Dovecot, TLS |
| Expert Sécurité | 1 | PKI, IGC Santé, RGPD |
| Testeur QA | 1 | Tests fonctionnels, automatisation |
| DPO (Délégué Protection Données) | 1 | RGPD, droit de la santé |

---

## Stack Technologique

### Options recommandées par composant

#### Backend

**Option 1: Node.js + Express**

```json
{
  "pros": [
    "Écosystème riche (npm)",
    "Performances excellentes (événementiel)",
    "Facilité de déploiement",
    "Grande communauté"
  ],
  "cons": [
    "JavaScript peut être source d'erreurs",
    "Gestion de la concurrence différente"
  ],
  "recommandation": "Bon choix pour API REST et temps réel"
}
```

**Option 2: Python + FastAPI/Django**

```json
{
  "pros": [
    "Excellent pour traitement de données",
    "Bibliothèques scientifiques riches",
    "Syntaxe claire et lisible",
    "Django Admin intégré"
  ],
  "cons": [
    "Performances légèrement inférieures à Node.js",
    "GIL (Global Interpreter Lock)"
  ],
  "recommandation": "Idéal si besoin d'analyse de données"
}
```

**Option 3: Java + Spring Boot**

```json
{
  "pros": [
    "Robustesse et stabilité",
    "Excellent pour microservices",
    "Typage fort",
    "Écosystème enterprise mature"
  ],
  "cons": [
    "Plus verbeux",
    "Courbe d'apprentissage",
    "Consommation mémoire plus élevée"
  ],
  "recommandation": "Parfait pour grande échelle et sécurité maximale"
}
```

#### Frontend

**Option 1: React**

```javascript
{
  "pros": [
    "Écosystème le plus vaste",
    "Grande flexibilité",
    "Performance excellente (Virtual DOM)",
    "Forte demande sur le marché"
  ],
  "cons": [
    "Courbe d'apprentissage React + Redux",
    "Choix à faire pour routing, state management"
  ],
  "recommandation": "Meilleur choix si besoin de flexibilité"
}
```

**Option 2: Vue.js**

```javascript
{
  "pros": [
    "Courbe d'apprentissage douce",
    "Documentation excellente",
    "Framework complet (Vue Router, Vuex intégrés)",
    "Performance similaire à React"
  ],
  "cons": [
    "Écosystème plus petit que React",
    "Moins de ressources/tutos"
  ],
  "recommandation": "Excellent si équipe moins expérimentée"
}
```

#### Base de données

**PostgreSQL (recommandé)**

```yaml
Avantages:
  - Open source et gratuit
  - ACID complet
  - Excellent pour données relationnelles
  - Extensible (JSON, PostGIS, etc.)
  - Performance excellente
  
Configuration:
  Version: 15+
  Extensions: uuid-ossp, pg_trgm, pgcrypto
  Réplication: Streaming replication
```

**MySQL (alternative)**

```yaml
Avantages:
  - Très populaire
  - Performance excellente pour lecture
  - Simplicité
  
Inconvénients:
  - Moins de fonctionnalités avancées
  - ACID moins robuste historiquement
```

#### Cache

**Redis (recommandé)**

```yaml
Usages:
  - Cache de session
  - Cache de données
  - File d'attente
  - Pub/Sub
  
Configuration:
  Version: 7+
  Persistence: AOF + RDB
  Réplication: Master-Slave
```

#### Serveur mail

**Postfix + Dovecot (recommandé)**

```yaml
Postfix:
  Role: MTA (Mail Transfer Agent)
  Avantages: Robuste, sécurisé, performant
  
Dovecot:
  Role: MDA (Mail Delivery Agent) + IMAP
  Avantages: Excellente performance IMAP, ACL avancées
  
Alternative:
  - Exim (moins courant)
  - OpenSMTPD (plus simple mais moins features)
```

### Stack complète recommandée

```
┌─────────────────────────────────────────┐
│           Production Stack              │
├─────────────────────────────────────────┤
│ OS: Ubuntu Server 22.04 LTS             │
│ Container: Docker + Docker Compose      │
│ Orchestration: Kubernetes (optionnel)   │
├─────────────────────────────────────────┤
│ Frontend: React 18 + TypeScript         │
│ UI Library: Tailwind CSS + shadcn/ui    │
│ State: Redux Toolkit                    │
│ Build: Vite                             │
├─────────────────────────────────────────┤
│ Backend: Node.js 20 + Express 4         │
│ Language: TypeScript                    │
│ Validation: Zod                         │
│ ORM: Prisma                             │
├─────────────────────────────────────────┤
│ Mail: Postfix 3.7 + Dovecot 2.3         │
│ Antispam: Rspamd 3.x                    │
│ Antivirus: ClamAV                       │
├─────────────────────────────────────────┤
│ Database: PostgreSQL 15                 │
│ Cache: Redis 7                          │
│ Search: Elasticsearch 8 (optionnel)     │
├─────────────────────────────────────────┤
│ Reverse Proxy: Nginx 1.24               │
│ Load Balancer: HAProxy 2.8              │
│ WAF: ModSecurity + OWASP CRS            │
├─────────────────────────────────────────┤
│ Monitoring: Prometheus + Grafana        │
│ Logging: ELK Stack (Elasticsearch,      │
│          Logstash, Kibana)              │
│ Tracing: Jaeger (optionnel)             │
├─────────────────────────────────────────┤
│ CI/CD: GitLab CI ou GitHub Actions      │
│ IaC: Terraform + Ansible                │
│ Secrets: HashiCorp Vault                │
└─────────────────────────────────────────┘
```

---

## Budget et Ressources

### Coûts de développement

#### Équipe interne (9 mois)

| Profil | Taux jour | Jours | Coût |
|--------|-----------|-------|------|
| Chef de projet | 600€ | 120 | 72 000€ |
| Architecte | 700€ | 60 | 42 000€ |
| Développeur Backend (×2) | 550€ | 320 | 176 000€ |
| Développeur Frontend | 550€ | 160 | 88 000€ |
| Admin Système (×2) | 500€ | 200 | 100 000€ |
| Expert Sécurité | 650€ | 40 | 26 000€ |
| Testeur QA | 450€ | 80 | 36 000€ |
| DPO | 500€ | 20 | 10 000€ |
| **TOTAL** | | **1000** | **550 000€** |

#### Équipe externalisée (forfait)

| Poste | Montant |
|-------|---------|
| Développement complet | 300 000€ - 450 000€ |
| Achat connecteur existant | 50 000€ - 150 000€ |
| Développement interfaces uniquement | 80 000€ - 150 000€ |

### Coûts d'infrastructure (annuels)

#### Option Cloud (AWS/Azure/GCP)

| Service | Configuration | Coût mensuel | Coût annuel |
|---------|---------------|--------------|-------------|
| VM Backend (×3) | 4 vCPU, 16 GB RAM | 450€ | 5 400€ |
| VM Mail (×2) | 2 vCPU, 8 GB RAM | 200€ | 2 400€ |
| Base de données | PostgreSQL managed | 300€ | 3 600€ |
| Load Balancer | | 50€ | 600€ |
| Stockage | 1 TB SSD | 100€ | 1 200€ |
| Bande passante | 5 TB/mois | 200€ | 2 400€ |
| Backup | S3 + snapshots | 100€ | 1 200€ |
| **TOTAL** | | **1 400€/mois** | **16 800€/an** |

#### Option Datacenter dédié

| Poste | Coût initial | Coût annuel |
|-------|--------------|-------------|
| Serveurs (×5) | 25 000€ | 3 000€ (maintenance) |
| Stockage (SAN/NAS) | 15 000€ | 2 000€ |
| Réseau (switches, FW) | 10 000€ | 1 000€ |
| Hébergement datacenter | - | 12 000€ |
| **TOTAL** | **50 000€** | **18 000€/an** |

### Coûts de certification et licences

| Poste | Coût initial | Coût annuel |
|-------|--------------|-------------|
| Certificats IGC Santé (×3) | 600€ | 600€ |
| Contrat ANS | Gratuit | Gratuit |
| Audit de sécurité | 10 000€ | 5 000€ |
| Certification HDS (optionnel) | 20 000€ | 5 000€ |
| **TOTAL** | **30 600€** | **10 600€** |

### Coûts de fonctionnement (annuels)

| Poste | Montant annuel |
|-------|----------------|
| Maintenance technique | 50 000€ - 80 000€ |
| Support utilisateurs | 30 000€ - 50 000€ |
| Monitoring et supervision | 10 000€ - 20 000€ |
| Conformité RGPD | 5 000€ - 10 000€ |
| Formation | 5 000€ - 10 000€ |
| **TOTAL** | **100 000€ - 170 000€** |

### Budget total estimé

#### Année 1 (Développement + Lancement)

Développement:           300 000€ - 550 000€
Infrastructure initiale:  50 000€ (si datacenter)
Certification:            30 600€
Infrastructure annuelle:  16 800€ - 18 000€
Fonctionnement:          100 000€ - 170 000€
─────────────────────────────────────────────
TOTAL ANNÉE 1:           497 400€ - 788 600€


#### Années suivantes (Maintenance)

Infrastructure:           16 800€ - 18 000€
Certification:            10 600€
Fonctionnement:          100 000€ - 170 000€
Évolutions:               50 000€ - 100 000€
─────────────────────────────────────────────
TOTAL ANNUEL:            177 400€ - 298 600€


### Modèles de revenus potentiels

#### Facturation aux utilisateurs finaux

| Type de BAL | Prix mensuel | Marge |
|-------------|--------------|-------|
| BAL Personnelle | 5€ - 10€ | 60% |
| BAL Organisationnelle | 15€ - 30€ | 65% |
| BAL Applicative | 50€ - 100€ | 70% |

**Exemple avec 1000 BAL:**

- 700 personnelles: 7 × 700 = 4 900€/mois
- 250 organisationnelles: 22 × 250 = 5 500€/mois
- 50 applicatives: 75 × 50 = 3 750€/mois
- **Total: 14 150€/mois soit 169 800€/an**

#### Facturation aux établissements (forfait)

| Type d'établissement | Forfait annuel |
|---------------------|----------------|
| Cabinet libéral | 500€ - 1 000€ |
| Centre de santé | 2 000€ - 5 000€ |
| Clinique privée | 5 000€ - 15 000€ |
| Hôpital | 15 000€ - 50 000€ |

### ROI estimé

**Scénario conservateur (1000 BAL):**

- Revenus annuels: 170 000€
- Coûts annuels: 200 000€
- ROI: Breakeven à ~3 ans

**Scénario optimiste (5000 BAL):**

- Revenus annuels: 850 000€
- Coûts annuels: 350 000€
- ROI: Breakeven à ~18 mois

### Recommandations

1. **Phase pilote:** Commencer avec 5-10 établissements partenaires
2. **Financement:** Rechercher financements publics (Ségur du Numérique)
3. **Partenariats:** S'associer à un opérateur développeur existant
4. **Externalisation:** Sous-traiter le connecteur, développer les interfaces

---

## Annexes

### Références documentaires

- **Référentiel #1 Opérateurs MSSanté v1.6.0**  
  https://mssante.fr/documents/16106/0/MSS_Référentiel_1_Opérateurs_MSSanté_v1.6.0_20240320.pdf

- **Référentiel #2 Clients de Messagerie v1.0**  
  https://mssante.fr/documents/16106/0/ANS_MSS_Ref2_Clients_de_messageries_MSSanté_v1.0_20230131.pdf

- **Contrat Opérateur V2**  
  https://mailiz.mssante.fr/is/doc-technique

- **Documentation Pro Santé Connect**  
  https://documentation.esante.gouv.fr/pages/viewpage.action?pageId=70320129

- **IGC Santé**  
  https://igc-sante.esante.gouv.fr

### Contacts utiles

- **Support ANS MSSanté:**  
  monserviceclient.mssante@esante.gouv.fr

- **Support technique:**  
  https://esante.gouv.fr/foire-aux-questions

- **Hotline opérateurs:**  
  Disponible via le portail opérateur après contractualisation

### Glossaire

| Terme | Définition |
|-------|------------|
| **ANS** | Agence du Numérique en Santé |
| **BAL** | Boîte Aux Lettres (messagerie) |
| **CPS** | Carte de Professionnel de Santé |
| **DMP** | Dossier Médical Partagé |
| **FINESS** | Fichier National des Établissements Sanitaires et Sociaux |
| **IGC** | Infrastructure de Gestion de Clés |
| **LPS** | Logiciel Professionnel de Santé |
| **MSSanté** | Messageries Sécurisées de Santé |
| **PSC** | Pro Santé Connect |
| **RPPS** | Répertoire Partagé des Professionnels de Santé |
| **TLS** | Transport Layer Security |

---

## Conclusion

La mise en place d'une solution opérateur MSSanté représente un projet complexe mais structuré, avec des spécifications claires définies par l'ANS. Les points critiques de réussite sont:

1. **Conformité stricte** au Référentiel #1 v1.6.0
2. **Sécurité maximale** (TLS 1.2+, certificats IGC Santé)
3. **Interopérabilité** via l'API LPS/DUI standardisée
4. **Expérience utilisateur** fluide et intuitive
5. **Support qualité** et réactivité

L'investissement initial est conséquent (300-800k€) mais le marché est porteur avec l'obligation croissante pour les professionnels de santé d'utiliser des messageries sécurisées.

**Prochaines étapes recommandées:**

1. Télécharger et étudier en détail le Référentiel #1 v1.6.0
2. Contacter l'ANS pour un rendez-vous de présentation
3. Évaluer l'option "opérateur acheteur" (acheter le connecteur)
4. Constituer l'équipe projet
5. Lancer la phase de préparation

Pour toute question complémentaire ou accompagnement dans votre projet, n'hésitez pas à contacter l'ANS ou des experts spécialisés en MSSanté.</parameter>

