# Modèles de données - API MSSanté

Ce dossier contient les modèles de données de l'API backend MSSanté. Chaque modèle encapsule la logique d'accès à la base de données PostgreSQL et les règles métier associées.

## Architecture

```
models/
├── index.js          # Export centralisé de tous les modèles
├── User.js           # Utilisateurs et authentification
├── Mailbox.js        # Boîtes aux lettres MSSanté
├── Domain.js         # Domaines (établissements de santé)
├── Certificate.js    # Certificats IGC Santé
└── README.md         # Cette documentation
```

## Vue d'ensemble des modèles

| Modèle | Table SQL | Description |
|--------|-----------|-------------|
| `User` | `users` | Professionnels de santé, administrateurs |
| `Mailbox` | `mailboxes` | BAL personnelles, organisationnelles, applicatives |
| `Domain` | `domains` | Établissements de santé (multi-tenant) |
| `Certificate` | `certificates` | Certificats IGC Santé pour TLS et signature |

## Utilisation

### Import des modèles

```javascript
// Import individuel
const User = require('./models/User');
const Mailbox = require('./models/Mailbox');

// Import groupé
const { User, Mailbox, Domain, Certificate } = require('./models');
```

### Opérations CRUD

Tous les modèles suivent le même pattern :

```javascript
// Créer
const user = await User.create({
  email: 'jean.dupont@hopital.mssante.fr',
  firstName: 'Jean',
  lastName: 'Dupont',
  rpps: '10101010101'
});

// Lire par ID
const user = await User.findById('uuid-...');

// Lire par critère unique
const user = await User.findByEmail('jean.dupont@hopital.mssante.fr');
const user = await User.findByRpps('10101010101');

// Lister avec pagination et filtres
const { data, pagination } = await User.findAll({
  page: 1,
  limit: 20,
  search: 'dupont',
  status: 'active',
  domainId: 'uuid-...'
});

// Mettre à jour
await user.update({ firstName: 'Jean-Pierre', status: 'suspended' });

// Supprimer (soft delete)
await user.delete();
```

## Modèle User

Gère les utilisateurs de la plateforme : professionnels de santé, administrateurs de domaine et super administrateurs.

### Propriétés principales

| Propriété | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Identifiant unique |
| `email` | string | Adresse email |
| `rpps` | string | Numéro RPPS (11 chiffres) |
| `adeli` | string | Numéro ADELI (9 chiffres) |
| `pscSubject` | string | Identifiant Pro Santé Connect |
| `firstName` | string | Prénom |
| `lastName` | string | Nom |
| `profession` | string | Profession (médecin, infirmier...) |
| `specialty` | string | Spécialité médicale |
| `roleId` | UUID | Référence vers le rôle |
| `isSuperAdmin` | boolean | Super administrateur opérateur |
| `status` | enum | `active`, `suspended`, `deleted` |
| `domainId` | UUID | Domaine de rattachement |

### Méthodes spécifiques

```javascript
// Authentification
const isValid = await user.verifyPassword('motdepasse');
await user.updatePassword('nouveauMotDePasse');
await user.recordLogin();

// Permissions (RBAC)
const permissions = await user.getPermissions();
const canCreate = await user.hasPermission('mailbox.create');
const isAdmin = await user.isDomainAdmin(domainId);

// Recherche par identifiant professionnel
const user = await User.findByPscSubject('psc-subject-id');
```

## Modèle Mailbox

Gère les trois types de boîtes aux lettres MSSanté conformes au référentiel ANS.

### Types de BAL

| Type | Constante | Description | Exemple |
|------|-----------|-------------|---------|
| Personnelle | `PER` | Liée à un PS identifié | `jean.dupont@hopital.mssante.fr` |
| Organisationnelle | `ORG` | Service, secrétariat | `secretariat.cardio@hopital.mssante.fr` |
| Applicative | `APP` | Logiciel, DPI | `dpi.axigate@hopital.mssante.fr` |

### Propriétés principales

| Propriété | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Identifiant unique |
| `email` | string | Adresse email MSSanté |
| `type` | enum | `PER`, `ORG`, `APP` |
| `status` | enum | `pending`, `active`, `suspended`, `archived`, `deleted` |
| `ownerId` | UUID | Propriétaire (User) |
| `ownerRpps` | string | RPPS du propriétaire |
| `domainId` | UUID | Domaine de rattachement |
| `displayName` | string | Nom d'affichage |
| `organizationName` | string | Nom de l'organisation (ORG) |
| `serviceName` | string | Nom du service (ORG) |
| `applicationName` | string | Nom de l'application (APP) |
| `quotaMb` | integer | Quota en Mo (défaut: 5120) |
| `usedMb` | integer | Espace utilisé en Mo |
| `hideFromDirectory` | boolean | Liste rouge (non publié dans l'annuaire) |

### Méthodes spécifiques

```javascript
// Cycle de vie
await mailbox.activate();
await mailbox.suspend();
await mailbox.delete();

// Quota
await mailbox.updateUsage(1024); // 1 Go utilisé
console.log(mailbox.quotaPercentage); // 20
console.log(mailbox.isOverQuota);     // false

// Délégations (BAL organisationnelles)
const delegations = await mailbox.getDelegations();
await mailbox.addDelegation(userId, 'write', grantedById);
await mailbox.revokeDelegation(userId, revokedById);

// Statistiques
const counts = await Mailbox.countByTypeAndDomain(domainId);
// { PER: 150, ORG: 45, APP: 12 }
```

### Rôles de délégation

| Rôle | Description |
|------|-------------|
| `read` | Lecture seule des emails |
| `write` | Lecture + envoi |
| `manage` | Gestion des paramètres |
| `admin` | Tous les droits |

## Modèle Domain

Gère les domaines MSSanté représentant les établissements de santé (architecture multi-tenant).

### Propriétés principales

| Propriété | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Identifiant unique |
| `domainName` | string | Nom de domaine MSSanté |
| `organizationName` | string | Nom de l'établissement |
| `organizationType` | string | Type (CHU, clinique, cabinet...) |
| `finessJuridique` | string | Numéro FINESS juridique (9 chiffres) |
| `finessGeographique` | string | Numéro FINESS géographique |
| `siret` | string | Numéro SIRET |
| `status` | enum | `pending`, `active`, `suspended`, `deleted` |
| `quotas` | JSON | Limites (BAL, stockage) |
| `settings` | JSON | Paramètres du domaine |
| `ansRegistered` | boolean | Enregistré auprès de l'ANS |

### Structure des quotas

```javascript
{
  maxMailboxes: 1000,      // Nombre max de BAL
  maxStorageGb: 500,       // Stockage total en Go
  maxUsersPerMailbox: 10   // Délégations max par BAL
}
```

### Structure des settings

```javascript
{
  allowExternalEmails: true,  // Emails hors MSSanté
  requireTls: true,           // TLS obligatoire
  allowForwarding: false,     // Transfert autorisé
  retentionDays: 365          // Durée de rétention
}
```

### Méthodes spécifiques

```javascript
// Cycle de vie
await domain.activate();
await domain.suspend();

// Administrateurs de domaine
const admins = await domain.getAdmins();
await domain.addAdmin(userId, grantedById);
await domain.removeAdmin(userId);

// Quotas et statistiques
const canCreate = await domain.checkQuota('mailboxes');
const stats = await domain.getStats();
// {
//   mailboxCount: 207,
//   personalCount: 150,
//   organizationalCount: 45,
//   applicativeCount: 12,
//   totalStorageGb: "125.50",
//   userCount: 180
// }

// Utilitaire
const domainName = Domain.extractFromEmail('user@hopital.mssante.fr');
// "hopital.mssante.fr"
```

## Modèle Certificate

Gère les certificats IGC Santé pour l'authentification TLS et la signature des messages.

### Types de certificats

| Type | Constante | Usage |
|------|-----------|-------|
| Serveur SSL | `SERV_SSL` | TLS des serveurs SMTP/IMAP |
| Auth. Client | `ORG_AUTH_CLI` | Authentification des BAL applicatives |
| Signature | `ORG_SIGN` | Signature des messages |
| Confidentialité | `ORG_CONF` | Chiffrement S/MIME |

### Propriétés principales

| Propriété | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Identifiant unique |
| `domainId` | UUID | Domaine associé |
| `mailboxId` | UUID | BAL associée (optionnel) |
| `type` | enum | Type de certificat |
| `subject` | string | Sujet du certificat (CN, O, C) |
| `issuer` | string | Autorité émettrice (IGC Santé) |
| `serialNumber` | string | Numéro de série unique |
| `fingerprintSha256` | string | Empreinte SHA256 |
| `keySize` | integer | Taille de la clé (2048, 4096) |
| `issuedAt` | timestamp | Date d'émission |
| `expiresAt` | timestamp | Date d'expiration |
| `revokedAt` | timestamp | Date de révocation |
| `status` | enum | `active`, `expired`, `revoked`, `pending` |

### Méthodes spécifiques

```javascript
// Propriétés calculées
console.log(cert.daysUntilExpiry);  // 45
console.log(cert.isExpired);        // false
console.log(cert.isExpiringSoon);   // true (< 30 jours)

// Gestion du cycle de vie
await cert.revoke('Compromission de la clé');
await cert.markExpired();

// Récupération sécurisée de la clé privée
const privateKey = await cert.getPrivateKey();

// Certificats expirant bientôt (alertes)
const expiring = await Certificate.findExpiringSoon(30);

// Job de mise à jour des statuts
const count = await Certificate.updateExpiredStatus();

// Statistiques pour dashboard
const stats = await Certificate.getStats(domainId);
// { total: 15, active: 12, expired: 2, revoked: 1, expiringSoon: 3 }

// Utilitaires
const fingerprint = Certificate.calculateFingerprint(pemContent);
const info = Certificate.parsePem(pemContent);
```

### Sécurité des clés privées

Les clés privées sont stockées chiffrées avec `pgp_sym_encrypt` de PostgreSQL. La clé de chiffrement est définie dans la variable d'environnement `CERTIFICATE_ENCRYPTION_KEY`.

## Gestion des erreurs

Tous les modèles propagent les erreurs PostgreSQL qui sont gérées par le middleware `errorHandler` :

```javascript
try {
  const mailbox = await Mailbox.create({ email: 'existant@domain.fr', ... });
} catch (error) {
  // Erreur 23505 (unique_violation) → 409 Conflict
  // Erreur 23503 (foreign_key_violation) → 409 Conflict
  // Erreur 23502 (not_null_violation) → 400 Bad Request
}
```

## Logging

Toutes les opérations importantes sont loggées via le module `utils/logger` :

```javascript
// Création
logger.info('Utilisateur créé', { userId: '...', email: '...' });

// Modification
logger.info('BAL mise à jour', { mailboxId: '...' });

// Suppression
logger.info('Certificat révoqué', { certId: '...', serialNumber: '...', reason: '...' });
```

## Transactions

Pour les opérations nécessitant plusieurs requêtes atomiques, utilisez la fonction `transaction` :

```javascript
const { transaction } = require('../config/database');

const result = await transaction(async (client) => {
  // Créer le domaine
  const domainResult = await client.query('INSERT INTO domains...', [...]);
  
  // Créer l'admin du domaine
  await client.query('INSERT INTO domain_admins...', [...]);
  
  // Créer la première BAL
  await client.query('INSERT INTO mailboxes...', [...]);
  
  return domainResult.rows[0];
});
```

## Conventions

- **Soft delete** : Les suppressions utilisent un statut `deleted` plutôt qu'un `DELETE` SQL
- **Timestamps** : `created_at`, `updated_at` sont gérés automatiquement
- **UUID** : Tous les identifiants sont des UUID v4
- **camelCase** : Les propriétés JavaScript sont en camelCase
- **snake_case** : Les colonnes PostgreSQL sont en snake_case
- **Pagination** : Format standard `{ data: [...], pagination: { page, limit, total, pages } }`

## Dépendances

```javascript
const { query, transaction } = require('../config/database');  // Pool PostgreSQL
const bcrypt = require('bcrypt');                               // Hash des mots de passe
const crypto = require('crypto');                               // Empreintes certificats
const logger = require('../utils/logger');                      // Logging Winston
```
