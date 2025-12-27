# Vue d'ensemble de l'Architecture - Opérateur MSSanté

## Table des matières

- [Introduction](#introduction)
- [Contexte MSSanté](#contexte-mssanté)
- [Architecture Globale](#architecture-globale)
- [Composants Principaux](#composants-principaux)
- [Flux de Données](#flux-de-données)
- [Modèle Multi-tenant](#modèle-multi-tenant)
- [Sécurité](#sécurité)
- [Scalabilité](#scalabilité)
- [Haute Disponibilité](#haute-disponibilité)

---

## Introduction

Cette plateforme permet de devenir **opérateur MSSanté** et d'héberger des services de messageries sécurisées pour les professionnels et établissements de santé en France.

### Objectifs Architecturaux

1. **Conformité** : Respecter le Référentiel #1 v1.6.0 de l'ANS
2. **Sécurité** : Protéger les données de santé (TLS 1.2+, certificats IGC)
3. **Multi-tenant** : Héberger plusieurs établissements isolés
4. **Scalabilité** : Support de milliers de BAL et millions de messages
5. **Disponibilité** : Garantir 99.9% d'uptime
6. **Maintenabilité** : Architecture modulaire et testable

### Principes de Conception

- **Microservices** : Services indépendants et spécialisés
- **Containerisation** : Déploiement via Docker
- **API-First** : Frontend découplé du backend
- **Stateless** : Sessions gérées par JWT et Redis
- **Event-Driven** : Jobs asynchrones pour traitement batch
- **Infrastructure as Code** : Configuration versionnée

---

## Contexte MSSanté

### Qu'est-ce que MSSanté ?

**MSSanté** (Messageries Sécurisées de Santé) est un espace de confiance géré par l'**Agence du Numérique en Santé (ANS)** permettant aux professionnels de santé d'échanger des données de santé à caractère personnel de manière sécurisée par messagerie électronique.

### Acteurs

```
┌─────────────────────────────────────────────────────┐
│        Agence du Numérique en Santé (ANS)           │
│         Gestionnaire de l'Espace de Confiance       │
└────────────────────┬────────────────────────────────┘
                     │
                     │ Contractualisation
                     │
         ┌───────────┴───────────┐
         │                       │
    ┌────▼─────┐          ┌─────▼────┐
    │Opérateur │          │Opérateur │
    │    A     │          │    B     │
    │  (VOUS)  │          │          │
    └────┬─────┘          └─────┬────┘
         │                      │
         │ Héberge              │
         │                      │
    ┌────▼──────────────────────▼────┐
    │  Établissements / Professionnels│
    │  - Hôpitaux                     │
    │  - Cliniques                    │
    │  - Cabinets libéraux            │
    │  - Laboratoires                 │
    └─────────────────────────────────┘
```

### Types de Boîtes Aux Lettres (BAL)

1. **BAL Personnelles** : Associées à un professionnel identifié (RPPS/ADELI)
2. **BAL Organisationnelles** : Associées à un service (secrétariat, urgences)
3. **BAL Applicatives** : Utilisées par des systèmes (DPI, LIS, automates)

### Obligations de l'Opérateur

- ✅ Fournir un service de messagerie sécurisée conforme
- ✅ Publier les BAL dans l'Annuaire National
- ✅ Soumettre les indicateurs mensuels à l'ANS
- ✅ Maintenir la conformité au Référentiel #1
- ✅ Assurer la sécurité et la disponibilité

---

## Architecture Globale

### Vue d'ensemble

```
┌─────────────────────────────────────────────────────────────┐
│                      INTERNET                               │
│  Utilisateurs : Professionnels de santé, Admins            │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        │ HTTPS (443)
                        │ SMTP (25, 587)
                        │ IMAP (143)
                        │
┌───────────────────────▼─────────────────────────────────────┐
│                   LOAD BALANCER / WAF                       │
│                    Traefik + ModSecurity                    │
│  - Reverse Proxy                                            │
│  - TLS Termination                                          │
│  - Rate Limiting                                            │
└────────┬──────────────┬──────────────┬──────────────────────┘
         │              │              │
         │              │              │
    ┌────▼────┐    ┌────▼────┐   ┌────▼────┐
    │Frontend │    │   API   │   │  Mail   │
    │ (React) │    │(Node.js)│   │Services │
    └────┬────┘    └────┬────┘   └────┬────┘
         │              │              │
         │         ┌────▼────┐    ┌────▼────┐
         │         │PostgreSQL    │Postfix  │
         │         │         │    │Dovecot  │
         │         └────┬────┘    └─────────┘
         │              │
         │         ┌────▼────┐
         └─────────┤  Redis  │
                   └─────────┘
                   
┌─────────────────────────────────────────────────────────────┐
│              SERVICES EXTERNES (ANS)                        │
│  - Annuaire National MSSanté                                │
│  - Pro Santé Connect (OAuth2)                               │
│  - IGC Santé (Certificats)                                  │
└─────────────────────────────────────────────────────────────┘
```

### Architecture en Couches

```
┌─────────────────────────────────────────────────────────┐
│              COUCHE PRÉSENTATION                        │
│  - React SPA                                            │
│  - Webmail Interface                                    │
│  - Admin Panel                                          │
└────────────────────┬────────────────────────────────────┘
                     │ REST API / WebSocket
┌────────────────────▼────────────────────────────────────┐
│              COUCHE APPLICATION                         │
│  - API REST (Express.js)                                │
│  - Authentification (JWT, OAuth2)                       │
│  - Business Logic                                       │
│  - Validation                                           │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│              COUCHE SERVICES                            │
│  - Email Service (IMAP/SMTP)                            │
│  - Annuaire Service                                     │
│  - Certificate Service                                  │
│  - Statistics Service                                   │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│              COUCHE DONNÉES                             │
│  - PostgreSQL (données structurées)                     │
│  - Redis (cache, sessions)                              │
│  - Filesystem (mails, logs)                             │
└─────────────────────────────────────────────────────────┘
```

---

## Composants Principaux

### 1. Frontend (React SPA)

**Responsabilités :**
- Interface utilisateur moderne et responsive
- Webmail complet (lecture, envoi, gestion)
- Panneau d'administration multi-niveaux
- Gestion des domaines et utilisateurs

**Technologies :**
- React 18 + React Router
- Tailwind CSS
- Axios (HTTP client)
- React Query (cache)

**Structure :**
```
src/
├── pages/           # Pages principales
├── components/      # Composants réutilisables
├── layouts/         # Layouts (Main, Admin, Auth)
├── services/        # API calls
├── contexts/        # React Contexts
├── hooks/           # Custom hooks
└── utils/           # Utilitaires
```

### 2. Backend API (Node.js)

**Responsabilités :**
- API REST pour le frontend
- Authentification et autorisation
- Gestion des BAL et utilisateurs
- Interface avec les services mail (IMAP/SMTP)
- Communication avec l'ANS (Annuaire, Indicateurs)

**Technologies :**
- Node.js 20 + Express.js
- PostgreSQL (via pg)
- Redis (cache et sessions)
- JWT + OAuth2

**Structure :**
```
src/
├── config/          # Configuration (DB, Redis, PSC)
├── controllers/     # Logique métier
├── middleware/      # Auth, validation, errors
├── models/          # Modèles de données
├── routes/          # Définition des routes
├── services/        # Services métier
├── jobs/            # Jobs asynchrones (cron)
└── utils/           # Helpers
```

**Endpoints principaux :**
- `/api/v1/auth/*` : Authentification
- `/api/v1/mailboxes/*` : Gestion BAL
- `/api/v1/email/*` : Webmail (IMAP/SMTP)
- `/api/v1/admin/*` : Administration
- `/api/v1/annuaire/*` : Interface ANS

### 3. Services Mail

#### Postfix (SMTP)

**Responsabilités :**
- Réception des emails (port 25)
- Soumission des emails (port 587)
- Routage vers autres opérateurs MSSanté
- Filtrage antispam (Rspamd)

**Configuration :**
- Virtual domains (PostgreSQL)
- TLS 1.2+ obligatoire
- Certificats IGC Santé
- Liste blanche ANS

#### Dovecot (IMAP)

**Responsabilités :**
- Stockage des emails (Maildir)
- Accès IMAP pour les clients
- Authentification (PostgreSQL + PSC)
- Quotas par domaine

**Configuration :**
- IMAP4 + STARTTLS (port 143)
- Authentification OAuth2 (PSC)
- Authentification certificat (BAL applicatives)
- ACL pour délégations

### 4. Base de Données (PostgreSQL)

**Responsabilités :**
- Stockage des données structurées
- Transactions ACID
- Intégrité référentielle

**Schéma principal :**
```
Tables principales :
├── users              # Utilisateurs
├── roles              # Rôles (RBAC)
├── permissions        # Permissions
├── domains            # Domaines (multi-tenant)
├── mailboxes          # BAL
├── certificates       # Certificats IGC
├── statistics         # Statistiques
└── audit_logs         # Journaux d'audit
```

### 5. Cache (Redis)

**Responsabilités :**
- Sessions utilisateurs
- Cache de données fréquentes
- File d'attente pour jobs
- Rate limiting

**Données stockées :**
- Sessions JWT
- Permissions utilisateurs (cache)
- Connexions IMAP (cache)
- Statistiques temps réel

### 6. Reverse Proxy (Traefik)

**Responsabilités :**
- Routage des requêtes
- TLS termination
- Load balancing
- Génération certificats (Let's Encrypt)

**Configuration :**
```yaml
Entrypoints:
├── web (80)      → Redirect HTTPS
├── websecure (443) → Frontend + API
├── smtp (25)       → Postfix
├── submission (587) → Postfix
└── imap (143)      → Dovecot
```

### 7. Monitoring (Prometheus + Grafana)

**Responsabilités :**
- Collecte de métriques
- Visualisation (dashboards)
- Alerting

**Métriques surveillées :**
- Utilisation ressources (CPU, RAM, Disque)
- Trafic réseau
- Nombre de messages
- Latence API
- Taux d'erreur
- Santé des services

---

## Flux de Données

### 1. Authentification Utilisateur

```
┌─────────┐                ┌─────────┐               ┌─────────┐
│Frontend │                │   API   │               │   PSC   │
└────┬────┘                └────┬────┘               └────┬────┘
     │                          │                         │
     │ 1. Initier auth PSC      │                         │
     │─────────────────────────>│                         │
     │                          │                         │
     │ 2. Redirect vers PSC     │                         │
     │<─────────────────────────│                         │
     │                          │                         │
     │ 3. Authentification      │                         │
     │──────────────────────────────────────────────────>│
     │                          │                         │
     │ 4. Code autorisation     │                         │
     │<──────────────────────────────────────────────────│
     │                          │                         │
     │ 5. Échange code → token  │                         │
     │─────────────────────────>│                         │
     │                          │ 6. Validation token     │
     │                          │────────────────────────>│
     │                          │                         │
     │                          │ 7. User info            │
     │                          │<────────────────────────│
     │                          │                         │
     │ 8. JWT + User data       │                         │
     │<─────────────────────────│                         │
     │                          │                         │
```

### 2. Envoi d'un Email

```
┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐
│ Webmail │     │   API   │     │ Postfix │     │Opérateur│
│         │     │         │     │         │     │  Dest   │
└────┬────┘     └────┬────┘     └────┬────┘     └────┬────┘
     │               │               │               │
     │ 1. Compose    │               │               │
     │ POST /send    │               │               │
     │──────────────>│               │               │
     │               │               │               │
     │               │ 2. Validation │               │
     │               │ (destinataire,│               │
     │               │  taille, etc) │               │
     │               │               │               │
     │               │ 3. SMTP AUTH  │               │
     │               │──────────────>│               │
     │               │               │               │
     │               │ 4. MAIL FROM  │               │
     │               │──────────────>│               │
     │               │               │               │
     │               │ 5. RCPT TO    │               │
     │               │──────────────>│               │
     │               │               │               │
     │               │ 6. DATA       │               │
     │               │──────────────>│               │
     │               │               │               │
     │               │               │ 7. Relay      │
     │               │               │──────────────>│
     │               │               │               │
     │               │               │ 8. 250 OK     │
     │               │               │<──────────────│
     │               │               │               │
     │               │ 9. 250 OK     │               │
     │               │<──────────────│               │
     │               │               │               │
     │ 10. Success   │               │               │
     │<──────────────│               │               │
     │               │               │               │
     │               │ 11. Save Sent │               │
     │               │──────────────>│               │
     │               │    (IMAP)     │               │
     │               │               │               │
```

### 3. Création d'une BAL

```
┌─────────┐     ┌─────────┐     ┌──────────┐     ┌─────────┐
│  Admin  │     │   API   │     │PostgreSQL│     │Annuaire │
│  Panel  │     │         │     │          │     │   ANS   │
└────┬────┘     └────┬────┘     └────┬─────┘     └────┬────┘
     │               │               │               │
     │ 1. Formulaire │               │               │
     │ POST /mailbox │               │               │
     │──────────────>│               │               │
     │               │               │               │
     │               │ 2. Validation │               │
     │               │ (domaine,     │               │
     │               │  quotas, etc) │               │
     │               │               │               │
     │               │ 3. INSERT     │               │
     │               │──────────────>│               │
     │               │               │               │
     │               │ 4. Result     │               │
     │               │<──────────────│               │
     │               │               │               │
     │               │ 5. Création   │               │
     │               │ technique     │               │
     │               │ (Postfix/     │               │
     │               │  Dovecot)     │               │
     │               │               │               │
     │               │ 6. Publication│               │
     │               │──────────────────────────────>│
     │               │               │               │
     │               │ 7. 200 OK     │               │
     │               │<──────────────────────────────│
     │               │               │               │
     │ 8. Success +  │               │               │
     │    BAL créée  │               │               │
     │<──────────────│               │               │
     │               │               │               │
```

### 4. Indicateurs Mensuels

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌─────────┐
│Cron Job  │     │PostgreSQL│     │   API    │     │   ANS   │
│(1er mois)│     │          │     │          │     │         │
└────┬─────┘     └────┬─────┘     └────┬─────┘     └────┬────┘
     │                │                │                │
     │ 1. Trigger     │                │                │
     │    (3h AM)     │                │                │
     │                │                │                │
     │ 2. Collecte    │                │                │
     │    statistiques│                │                │
     │───────────────>│                │                │
     │                │                │                │
     │ 3. Données     │                │                │
     │<───────────────│                │                │
     │                │                │                │
     │ 4. Agrégation  │                │                │
     │    et calculs  │                │                │
     │                │                │                │
     │ 5. INSERT      │                │                │
     │    monthly_ind.│                │                │
     │───────────────>│                │                │
     │                │                │                │
     │ 6. Génération  │                │                │
     │    CSV         │                │                │
     │                │                │                │
     │                │                │ 7. Soumission │
     │                │                │───────────────>│
     │                │                │                │
     │                │                │ 8. 200 OK     │
     │                │                │<───────────────│
     │                │                │                │
     │ 9. MAJ status  │                │                │
     │───────────────>│                │                │
     │                │                │                │
```

---

## Modèle Multi-tenant

### Isolation par Domaine

Chaque établissement hébergé possède:
- Son propre **domaine** (`hopital-paris.mssante.fr`)
- Ses propres **certificats** IGC Santé
- Ses propres **quotas** (BAL, stockage)
- Ses propres **administrateurs**
- Ses **données isolées** en base

```
┌─────────────────────────────────────────────────────┐
│              Opérateur MSSanté                      │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌──────────────────┐  ┌──────────────────┐        │
│  │ Domaine A        │  │ Domaine B        │        │
│  │ hopital-a.ms.fr  │  │ clinique-b.ms.fr │        │
│  │                  │  │                  │        │
│  │ - Cert A         │  │ - Cert B         │        │
│  │ - 500 BAL        │  │ - 100 BAL        │        │
│  │ - 500 GB         │  │ - 50 GB          │        │
│  │ - Admin: Dr X    │  │ - Admin: Dr Y    │        │
│  └──────────────────┘  └──────────────────┘        │
│                                                     │
│  ┌──────────────────┐                              │
│  │ Domaine C        │                              │
│  │ labo-c.mssante.fr│                              │
│  │                  │                              │
│  │ - Cert C         │                              │
│  │ - 50 BAL         │                              │
│  │ - 20 GB          │                              │
│  │ - Admin: Bio Z   │                              │
│  └──────────────────┘                              │
└─────────────────────────────────────────────────────┘
```

### Niveau d'accès

```
Super Admin
    ↓
    ├─ Gestion de tous les domaines
    ├─ Création de nouveaux domaines
    ├─ Gestion des certificats
    ├─ Accès aux statistiques globales
    └─ Configuration plateforme

Admin Domaine
    ↓
    ├─ Gestion des BAL de son domaine
    ├─ Gestion des utilisateurs de son domaine
    ├─ Statistiques de son domaine
    └─ Paramètres du domaine

Utilisateur
    ↓
    ├─ Gestion de ses propres BAL
    ├─ Webmail
    └─ Paramètres personnels
```

---

## Sécurité

### Authentification

**3 méthodes selon le contexte :**

1. **Pro Santé Connect (OAuth 2.0)**
   - Pour les BAL personnelles et organisationnelles
   - Standard national d'identification
   - Support CPS / e-CPS

2. **Certificat Client (mTLS)**
   - Pour les BAL applicatives
   - Certificats ORG_AUTH_CLI de l'IGC Santé
   - Authentification mutuelle

3. **JWT**
   - Pour l'API REST
   - Tokens signés et vérifiables
   - Durée de vie configurable

### Autorisation (RBAC)

```
Rôles → Permissions → Ressources

Exemple:
super_admin → mailbox.manage_all → Toutes les BAL
domain_admin → mailbox.read → BAL de son domaine
user → mailbox.read → Ses propres BAL
```

### Chiffrement

**En transit :**
- TLS 1.2+ obligatoire (TLS 1.0/1.1 interdits)
- Suites de chiffrement conformes ANSSI
- Certificats IGC Santé

**Au repos :**
- Base de données : Chiffrement des colonnes sensibles
- Fichiers : Chiffrement du filesystem (LUKS/dm-crypt)
- Sauvegardes : Chiffrées avec GPG

### Protection des Données

**RGPD :**
- Consentements enregistrés
- Droit à l'oubli implémenté
- Portabilité des données
- Journalisation des accès
- Anonymisation des logs

**Sécurité Applicative :**
- Validation des entrées (Joi)
- Protection CSRF
- Rate limiting
- SQL Injection prevention (parameterized queries)
- XSS prevention (DOMPurify)
- Secrets dans variables d'environnement

---

## Scalabilité

### Dimensionnement

**Capacité actuelle (par serveur) :**
- 10 000 BAL actives
- 1 million messages/jour
- 100 Go de stockage mail
- 1000 requêtes API/seconde

### Stratégies de Scaling

**Horizontal (Scale-out) :**
```
┌──────────────┐
│Load Balancer │
└──────┬───────┘
       │
   ┌───┴───┐
   │       │
┌──▼──┐ ┌──▼──┐
│API 1│ │API 2│ ... API N
└──┬──┘ └──┬──┘
   │       │
   └───┬───┘
       │
 ┌─────▼─────┐
 │PostgreSQL │
 │ (Master)  │
 └───────────┘
```

**Vertical (Scale-up) :**
- Augmentation CPU/RAM/Disque
- Migration vers serveurs plus puissants

### Optimisations

**Base de données :**
- Index optimisés
- Partitionnement (audit_logs par date)
- Réplication read replicas
- Connection pooling

**Cache :**
- Redis pour données fréquentes
- Cache HTTP (Traefik)
- CDN pour assets statiques

**Mail :**
- Queue management
- Batch processing
- Compression des archives

---

## Haute Disponibilité

### Architecture Résiliente

```
┌────────────────────────────────────────┐
│           Load Balancer                │
│          (HAProxy/Traefik)             │
└───────┬────────────┬───────────────────┘
        │            │
    ┌───▼───┐    ┌───▼───┐
    │API 1  │    │API 2  │
    │(Active)│   │(Active)│
    └───┬───┘    └───┬───┘
        │            │
        └──────┬─────┘
               │
    ┌──────────▼──────────┐
    │  PostgreSQL Master  │
    │     (Primary)       │
    └──────────┬──────────┘
               │ Replication
    ┌──────────▼──────────┐
    │ PostgreSQL Replica  │
    │    (Read-only)      │
    └─────────────────────┘
```

### Mécanismes de Résilience

**Redondance :**
- Plusieurs instances API
- Réplication PostgreSQL (streaming)
- Cluster Redis (Sentinel)
- RAID pour disques

**Failover :**
- Détection automatique de pannes
- Bascule automatique vers replica
- Promotion automatique
- Health checks réguliers

**Backup & Recovery :**
- Sauvegardes quotidiennes automatiques
- Backup incrémentiel toutes les 6h
- Stockage distant (S3-compatible)
- Procédure de restauration testée
- RTO : 4h / RPO : 15 min

**Monitoring & Alerting :**
- Surveillance 24/7
- Alertes automatiques
- Escalade selon criticité
- Astreinte technique

---

## Conclusion

Cette architecture permet de :

✅ **Respecter** les exigences MSSanté (Référentiel #1 v1.6.0)  
✅ **Héberger** plusieurs établissements en isolation complète  
✅ **Garantir** la sécurité et la confidentialité des données  
✅ **Assurer** haute disponibilité et performances  
✅ **Évoluer** pour supporter la croissance  
✅ **Maintenir** facilement avec une architecture modulaire  

### Prochaines Évolutions

- Migration vers Kubernetes pour orchestration
- Implémentation service mesh (Istio)
- Ajout d'un CDN global
- Support multi-régions
- IA pour détection spam avancée
- Analytics temps réel

---

## Références

- [Référentiel #1 MSSanté v1.6.0](https://mssante.fr/documents/16106/0/MSS_Référentiel_1_Opérateurs_MSSanté_v1.6.0_20240320.pdf)
- [Documentation ANS](https://esante.gouv.fr/produits-services/referentiel-operateur-mssante)
- [Pro Santé Connect](https://documentation.esante.gouv.fr/pages/viewpage.action?pageId=70320129)
- [IGC Santé](https://igc-sante.esante.gouv.fr)

---

**Dernière mise à jour :** Décembre 2025  
**Version du document :** 1.0  
**Auteur :** Équipe Architecture
