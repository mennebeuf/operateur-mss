# Spécifications API REST - Opérateur MSSanté

## Table des matières

1. [Vue d'ensemble](#vue-densemble)
2. [Architecture API](#architecture-api)
3. [Authentification](#authentification)
4. [Endpoints principaux](#endpoints-principaux)
5. [Modèles de données](#modèles-de-données)
6. [Gestion des erreurs](#gestion-des-erreurs)
7. [Rate limiting et quotas](#rate-limiting-et-quotas)
8. [Webhooks et événements](#webhooks-et-événements)

---

## Vue d'ensemble

### Informations générales

- **Base URL:** `https://api.votre-domaine.mssante.fr/api/v1`
- **Format:** JSON
- **Encodage:** UTF-8
- **Authentification:** JWT Bearer Token + OAuth2 (Pro Santé Connect)
- **Versioning:** Préfixe `/v1` dans l'URL

### Principes REST

- Utilisation des méthodes HTTP standards (GET, POST, PUT, DELETE)
- Codes de statut HTTP appropriés
- HATEOAS (liens de navigation dans les réponses)
- Pagination pour les collections
- Filtrage, tri et recherche via query parameters

---

## Architecture API

### Structure des routes

```
/api/v1/
├── auth/                   # Authentification
│   ├── login
│   ├── logout
│   ├── refresh
│   └── psc/               # Pro Santé Connect
│       ├── authorize
│       ├── token
│       └── userinfo
│
├── mailboxes/             # Gestion des BAL
│   ├── GET /
│   ├── POST /
│   ├── GET /:id
│   ├── PUT /:id
│   ├── DELETE /:id
│   └── /:id/delegations
│
├── users/                 # Gestion des utilisateurs
│   ├── GET /
│   ├── POST /
│   ├── GET /:id
│   ├── PUT /:id
│   └── DELETE /:id
│
├── domains/               # Gestion des domaines
│   ├── GET /
│   ├── POST /
│   ├── GET /:id
│   └── PUT /:id
│
├── email/                 # Webmail API
│   ├── folders/
│   ├── messages/
│   ├── send
│   └── drafts
│
├── certificates/          # Gestion des certificats
│   ├── GET /
│   ├── POST /upload
│   └── GET /:id
│
├── annuaire/             # Annuaire Santé
│   ├── search
│   └── sync
│
└── admin/                # Administration
    ├── domains/
    ├── statistics/
    ├── monitoring/
    └── audit/
```

---

## Authentification

### 1. Authentification locale (JWT)

#### POST /api/v1/auth/login

Connexion avec email/mot de passe pour les administrateurs.

**Request:**

```json
{
  "email": "admin@hopital.mssante.fr",
  "password": "SecurePassword123!"
}
```

**Response 200:**

```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 3600,
    "user": {
      "id": "uuid",
      "email": "admin@hopital.mssante.fr",
      "role": "domain_admin",
      "domain": {
        "id": "uuid",
        "name": "hopital.mssante.fr"
      }
    }
  }
}
```

#### POST /api/v1/auth/refresh

Rafraîchir le token d'accès.

**Request:**

```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response 200:**

```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 3600
  }
}
```

### 2. Pro Santé Connect (OAuth2)

#### GET /api/v1/auth/psc/authorize

Redirection vers Pro Santé Connect pour authentification.

**Query Parameters:**

- `redirect_uri`: URL de callback après authentification
- `state`: Token anti-CSRF

**Response:** Redirection 302 vers PSC

#### POST /api/v1/auth/psc/token

Échanger le code d'autorisation contre un token d'accès.

**Request:**

```json
{
  "code": "authorization_code_from_psc",
  "state": "anti_csrf_token"
}
```

**Response 200:**

```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 3600,
    "pscInfo": {
      "rpps": "10001234567",
      "firstName": "Jean",
      "lastName": "Dupont",
      "profession": "Médecin"
    }
  }
}
```

#### GET /api/v1/auth/psc/userinfo

Récupérer les informations de l'utilisateur PSC.

**Headers:**

```
Authorization: Bearer {token}
```

**Response 200:**

```json
{
  "success": true,
  "data": {
    "sub": "f:xyz:10001234567",
    "rpps": "10001234567",
    "given_name": "Jean",
    "family_name": "Dupont",
    "email": "jean.dupont@hopital.mssante.fr",
    "SubjectOrganization": "HOPITAL EXEMPLE",
    "SubjectRole": ["10^Médecin"]
  }
}
```

### Headers d'authentification

Toutes les requêtes authentifiées doivent inclure :

```
Authorization: Bearer {token}
```

---

## Endpoints principaux

### Mailboxes

#### GET /api/v1/mailboxes

Liste les boîtes aux lettres accessibles.

**Query Parameters:**

- `page`: Numéro de page (défaut: 1)
- `limit`: Éléments par page (défaut: 50, max: 100)
- `type`: Filtrer par type (personal, organizational, applicative)
- `status`: Filtrer par statut (pending, active, suspended)
- `search`: Recherche textuelle

**Response 200:**

```json
{
  "success": true,
  "data": {
    "mailboxes": [
      {
        "id": "uuid",
        "email": "jean.dupont@hopital.mssante.fr",
        "type": "personal",
        "status": "active",
        "owner": {
          "id": "uuid",
          "rpps": "10001234567",
          "firstName": "Jean",
          "lastName": "Dupont"
        },
        "quotaMb": 1024,
        "usedMb": 245,
        "createdAt": "2024-01-15T10:30:00Z",
        "lastActivity": "2024-03-20T14:22:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 150,
      "pages": 3
    }
  }
}
```

#### POST /api/v1/mailboxes

Créer une nouvelle boîte aux lettres.

**Request:**

```json
{
  "type": "personal",
  "email": "jean.dupont@hopital.mssante.fr",
  "owner": {
    "rpps": "10001234567",
    "firstName": "Jean",
    "lastName": "Dupont",
    "profession": "Médecin",
    "specialty": "Cardiologie"
  },
  "quotaMb": 1024,
  "hideFromDirectory": false
}
```

**Response 201:**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "jean.dupont@hopital.mssante.fr",
    "status": "pending",
    "message": "BAL créée. Publication dans l'annuaire en cours."
  }
}
```

#### GET /api/v1/mailboxes/:id

Détails d'une boîte aux lettres.

**Response 200:**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "jean.dupont@hopital.mssante.fr",
    "type": "personal",
    "status": "active",
    "owner": {
      "id": "uuid",
      "rpps": "10001234567",
      "firstName": "Jean",
      "lastName": "Dupont",
      "profession": "Médecin",
      "specialty": "Cardiologie"
    },
    "quotaMb": 1024,
    "usedMb": 245,
    "usagePercent": 24,
    "hideFromDirectory": false,
    "createdAt": "2024-01-15T10:30:00Z",
    "activatedAt": "2024-01-15T11:00:00Z",
    "lastActivity": "2024-03-20T14:22:00Z",
    "statistics": {
      "messagesSent": 128,
      "messagesReceived": 342,
      "totalMessages": 470
    }
  }
}
```

#### PUT /api/v1/mailboxes/:id

Modifier une boîte aux lettres.

**Request:**

```json
{
  "quotaMb": 2048,
  "hideFromDirectory": true,
  "status": "suspended"
}
```

**Response 200:**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "jean.dupont@hopital.mssante.fr",
    "quotaMb": 2048,
    "hideFromDirectory": true,
    "status": "suspended"
  }
}
```

#### DELETE /api/v1/mailboxes/:id

Supprimer une boîte aux lettres.

**Response 200:**

```json
{
  "success": true,
  "message": "BAL supprimée et dépubliée de l'annuaire"
}
```

### Users

#### GET /api/v1/users

Liste les utilisateurs.

**Query Parameters:**

- `page`, `limit`, `search`
- `role`: Filtrer par rôle

**Response 200:**

```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": "uuid",
        "email": "admin@hopital.mssante.fr",
        "rpps": "10001234567",
        "firstName": "Jean",
        "lastName": "Dupont",
        "role": "domain_admin",
        "status": "active",
        "lastLogin": "2024-03-20T09:15:00Z"
      }
    ],
    "pagination": {...}
  }
}
```

#### POST /api/v1/users

Créer un utilisateur.

**Request:**

```json
{
  "email": "medecin@hopital.mssante.fr",
  "rpps": "10001234568",
  "firstName": "Marie",
  "lastName": "Martin",
  "profession": "Médecin",
  "role": "user"
}
```

### Email (Webmail)

#### GET /api/v1/email/folders

Liste des dossiers IMAP.

**Response 200:**

```json
{
  "success": true,
  "data": {
    "folders": [
      {
        "name": "INBOX",
        "path": "INBOX",
        "specialUse": "\\Inbox",
        "messageCount": 45,
        "unseenCount": 12
      },
      {
        "name": "Sent",
        "path": "Sent",
        "specialUse": "\\Sent",
        "messageCount": 128,
        "unseenCount": 0
      }
    ]
  }
}
```

#### GET /api/v1/email/messages

Liste des messages d'un dossier.

**Query Parameters:**

- `folder`: Nom du dossier (défaut: INBOX)
- `page`, `limit`
- `search`: Recherche textuelle

**Response 200:**

```json
{
  "success": true,
  "data": {
    "messages": [
      {
        "uid": 1234,
        "messageId": "<msg@domain.com>",
        "from": {
          "name": "Dr. Dupont",
          "address": "dupont@hopital.mssante.fr"
        },
        "to": [
          {
            "name": "Dr. Martin",
            "address": "martin@clinique.mssante.fr"
          }
        ],
        "subject": "Compte rendu patient XYZ",
        "date": "2024-03-20T14:30:00Z",
        "flags": ["\\Seen"],
        "hasAttachments": true,
        "size": 45678
      }
    ],
    "pagination": {...}
  }
}
```

#### GET /api/v1/email/messages/:uid

Récupérer un message complet.

**Query Parameters:**

- `folder`: Nom du dossier

**Response 200:**

```json
{
  "success": true,
  "data": {
    "uid": 1234,
    "messageId": "<msg@domain.com>",
    "from": {...},
    "to": [...],
    "cc": [],
    "subject": "Compte rendu patient XYZ",
    "date": "2024-03-20T14:30:00Z",
    "html": "<html>...</html>",
    "text": "Texte brut du message...",
    "attachments": [
      {
        "filename": "resultat.pdf",
        "contentType": "application/pdf",
        "size": 123456,
        "contentId": "attachment1"
      }
    ]
  }
}
```

#### POST /api/v1/email/send

Envoyer un email.

**Request:**

```json
{
  "to": ["destinataire@hopital.mssante.fr"],
  "cc": [],
  "bcc": [],
  "subject": "Compte rendu",
  "html": "<p>Bonjour,</p><p>Veuillez trouver...</p>",
  "text": "Bonjour, Veuillez trouver...",
  "attachments": [
    {
      "filename": "document.pdf",
      "contentType": "application/pdf",
      "content": "base64_encoded_content"
    }
  ]
}
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "messageId": "<generated-id@domain.mssante.fr>",
    "accepted": ["destinataire@hopital.mssante.fr"],
    "rejected": []
  }
}
```

### Certificates

#### GET /api/v1/certificates

Liste des certificats.

**Response 200:**

```json
{
  "success": true,
  "data": {
    "certificates": [
      {
        "id": "uuid",
        "type": "domain",
        "domain": "hopital.mssante.fr",
        "subject": "CN=hopital.mssante.fr",
        "issuer": "CN=IGC SANTE SERVEURS APPLICATIFS",
        "serialNumber": "1234567890",
        "validFrom": "2024-01-01T00:00:00Z",
        "validTo": "2025-01-01T00:00:00Z",
        "status": "valid",
        "daysUntilExpiry": 90
      }
    ]
  }
}
```

#### POST /api/v1/certificates/upload

Installer un nouveau certificat.

**Request (multipart/form-data):**

```
certificate: file (PEM)
privateKey: file (PEM)
domain: string
type: string (domain|igc)
```

---

## Modèles de données

### User

```typescript
interface User {
  id: string;
  email: string;
  rpps?: string;
  adeli?: string;
  pscSubject?: string;
  firstName: string;
  lastName: string;
  profession?: string;
  specialty?: string;
  role: 'user' | 'domain_admin' | 'super_admin';
  isSuperAdmin: boolean;
  status: 'active' | 'suspended' | 'deleted';
  createdAt: string;
  updatedAt: string;
  lastLogin?: string;
}
```

### Mailbox

```typescript
interface Mailbox {
  id: string;
  email: string;
  type: 'personal' | 'organizational' | 'applicative';
  status: 'pending' | 'active' | 'suspended' | 'deleted';
  owner?: User;
  finessId?: string;
  organizationName?: string;
  serviceName?: string;
  applicationName?: string;
  quotaMb: number;
  usedMb: number;
  hideFromDirectory: boolean;
  createdAt: string;
  activatedAt?: string;
  lastActivity?: string;
}
```

### Domain

```typescript
interface Domain {
  id: string;
  name: string;
  finessJuridique: string;
  finessGeographique?: string;
  organizationType: string;
  organizationName: string;
  quotaMailboxes: number;
  quotaStorageGb: number;
  status: 'active' | 'suspended';
  createdAt: string;
}
```

---

## Gestion des erreurs

### Format des erreurs

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Les données fournies sont invalides",
    "details": [
      {
        "field": "email",
        "message": "Format d'email invalide"
      }
    ]
  }
}
```

### Codes d'erreur

| Code | Statut HTTP | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Données invalides |
| `UNAUTHORIZED` | 401 | Non authentifié |
| `FORBIDDEN` | 403 | Permissions insuffisantes |
| `NOT_FOUND` | 404 | Ressource introuvable |
| `CONFLICT` | 409 | Conflit (ex: email déjà utilisé) |
| `QUOTA_EXCEEDED` | 429 | Quota dépassé |
| `INTERNAL_ERROR` | 500 | Erreur serveur |

---

## Rate limiting et quotas

### Limites générales

- **API publique:** 1000 requêtes/heure par IP
- **API authentifiée:** 5000 requêtes/heure par utilisateur
- **Envoi d'emails:** 100 emails/heure par BAL

### Headers de réponse

```
X-RateLimit-Limit: 5000
X-RateLimit-Remaining: 4850
X-RateLimit-Reset: 1616420400
```

### Dépassement de quota

**Response 429:**

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Trop de requêtes",
    "retryAfter": 3600
  }
}
```

---

## Webhooks et événements

### Configuration des webhooks

```javascript
POST /api/v1/webhooks
{
  "url": "https://votre-service.com/webhook",
  "events": [
    "mailbox.created",
    "mailbox.deleted",
    "message.received"
  ],
  "secret": "webhook_secret_key"
}
```

### Événements disponibles

- `mailbox.created`: Nouvelle BAL créée
- `mailbox.activated`: BAL activée
- `mailbox.suspended`: BAL suspendue
- `mailbox.deleted`: BAL supprimée
- `message.received`: Nouveau message reçu
- `certificate.expiring`: Certificat expire bientôt (30j)

### Format des webhooks

```json
{
  "event": "mailbox.created",
  "timestamp": "2024-03-20T15:30:00Z",
  "data": {
    "id": "uuid",
    "email": "jean.dupont@hopital.mssante.fr",
    "type": "personal"
  }
}
```

---

Cette spécification API fournit une base complète pour l'implémentation de l'API REST de votre opérateur MSSanté.
