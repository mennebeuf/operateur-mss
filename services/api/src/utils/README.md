# Utils - API MSSanté

Utilitaires partagés pour l'API backend. Ce dossier centralise les fonctions réutilisables à travers l'application.

## Structure

```
utils/
├── index.js        # Point d'entrée (exports centralisés)
├── logger.js       # Logging Winston
├── smtp.js         # Client SMTP/email
├── crypto.js       # Chiffrement et hachage
├── validators.js   # Validation Joi + patterns
├── helpers.js      # Fonctions utilitaires générales
└── README.md       # Cette documentation
```

## Import

```javascript
// Import groupé
const { logger, smtp, crypto, validators, helpers } = require('./utils');

// Import individuel (préféré pour la clarté)
const logger = require('./utils/logger');
const { schemas, validators } = require('./utils/validators');
```

---

## Modules

### logger.js

Logger Winston avec transports console et fichiers, plus des méthodes spécialisées pour l'audit.

```javascript
const logger = require('./utils/logger');

// Logs standard
logger.info('Message info');
logger.error('Erreur', { context: 'details' });
logger.debug('Debug uniquement en dev');

// Logs spécialisés
logger.auth('success', { userId: '123', ip: '192.168.1.1' });
logger.auth('failure', { email: 'user@test.fr', reason: 'bad_password' });

logger.mailbox('create', 'user@domaine.mssante.fr', { type: 'PERS' });
logger.mail('SMTP', 'send', { to: 'dest@mssante.fr', messageId: 'xxx' });

logger.security('access_denied', { resource: '/admin', userId: '123' });
logger.request(req, res, 45); // Log requête HTTP avec durée en ms
```

**Configuration (variables d'environnement) :**

| Variable | Description | Défaut |
|----------|-------------|--------|
| `NODE_ENV` | Niveau de log : production=info, dev=debug, test=error | development |
| `LOG_DIR` | Répertoire des fichiers de log (production) | /var/log/mssante-api |

**Fichiers générés en production :**
- `combined.log` - Tous les logs
- `error.log` - Erreurs uniquement
- `security.log` - Événements d'audit

---

### smtp.js

Client SMTP pour l'envoi d'emails, compatible OAuth2 (Pro Santé Connect) et certificats clients.

```javascript
const smtp = require('./utils/smtp');

// Envoi avec OAuth2 (utilisateurs PSC)
await smtp.sendWithOAuth('user@domaine.mssante.fr', accessToken, {
  to: 'destinataire@autre.mssante.fr',
  subject: 'Objet du message',
  html: '<p>Contenu HTML</p>',
  attachments: [
    { filename: 'doc.pdf', content: base64Content, contentType: 'application/pdf' }
  ]
});

// Transport personnalisé (BAL applicatives avec certificat)
const transport = smtp.createCertTransport({
  cert: fs.readFileSync('client.crt'),
  key: fs.readFileSync('client.key')
});
await smtp.sendMail(transport, mailOptions);

// Validation
smtp.isValidMSSanteEmail('user@domaine.mssante.fr'); // true
smtp.extractDomain('user@domaine.mssante.fr'); // 'domaine.mssante.fr'
```

**Configuration :**

| Variable | Description | Défaut |
|----------|-------------|--------|
| `SMTP_HOST` | Serveur SMTP | localhost |
| `SMTP_PORT` | Port SMTP | 587 |

---

### crypto.js

Utilitaires cryptographiques conformes ANSSI. Chiffrement AES-256-GCM, hachage bcrypt.

```javascript
const crypto = require('./utils/crypto');

// Chiffrement symétrique (données sensibles en BDD)
const encrypted = crypto.encrypt('données sensibles');
const decrypted = crypto.decrypt(encrypted);

// Mots de passe
const hash = await crypto.hashPassword('motdepasse');
const isValid = await crypto.verifyPassword('motdepasse', hash);

// Tokens et codes
crypto.generateToken(32);           // Token hex 64 caractères
crypto.generateUUID();              // UUID v4
crypto.generateVerificationCode(6); // Code numérique "042851"
crypto.generateSecurePassword(16);  // Mot de passe aléatoire

// Hachage
crypto.sha256('data');
crypto.hmacSha256('data', 'secret');

// Fichiers
crypto.calculateChecksum(fileBuffer);
crypto.verifyFileIntegrity(fileBuffer, expectedHash);

// Masquage
crypto.maskEmail('jean.dupont@mssante.fr'); // 'j*********t@mssante.fr'
```

**Configuration :**

| Variable | Description | Requis |
|----------|-------------|--------|
| `ENCRYPTION_KEY` | Clé de chiffrement (min 32 car) | Oui en production |

---

### validators.js

Schémas Joi et fonctions de validation pour les données MSSanté.

```javascript
const { schemas, validators, Joi, PATTERNS } = require('./utils/validators');

// Validation avec schéma
const { error, value } = validators.validate(data, schemas.mailbox.create);
if (error) {
  console.log(error.details); // Détails des erreurs
}

// Schémas disponibles
schemas.user.create
schemas.user.update
schemas.mailbox.create
schemas.mailbox.update
schemas.domain.create
schemas.domain.update
schemas.auth.login
schemas.auth.changePassword
schemas.email.send
schemas.pagination
schemas.search

// Validation directe
validators.isValidMSSanteEmail('user@domaine.mssante.fr');
validators.isValidMSSanteDomain('domaine.mssante.fr');
validators.isValidRPPS('12345678901');
validators.isValidADELI('123456789');
validators.isValidFINESS('123456789');
validators.isStrongPassword('MonP@ssw0rd123');
validators.isValidUUID('550e8400-e29b-41d4-a716-446655440000');

// Patterns regex exportés
PATTERNS.mssanteEmail
PATTERNS.rpps
PATTERNS.strongPassword
```

---

### helpers.js

Fonctions utilitaires générales.

```javascript
const helpers = require('./utils/helpers');

// Dates
helpers.formatDate(new Date(), 'fr');        // '28/12/2025'
helpers.formatDate(new Date(), 'datetime');  // '28/12/2025 14:30:00'
helpers.dateDiff(date1, date2, 'days');

// Tailles
helpers.formatBytes(1536000);    // '1.46 MB'
helpers.mbToBytes(100);          // 104857600
helpers.bytesToMb(104857600);    // 100

// Strings
helpers.slugify('Héllo Wôrld!'); // 'hello-world'
helpers.truncate('Long text...', 50);
helpers.capitalize('jean');      // 'Jean'
helpers.formatName('jean', 'DUPONT'); // 'Jean DUPONT'

// Async
await helpers.sleep(1000);
await helpers.retry(asyncFn, 3, 1000); // 3 tentatives, backoff exponentiel

// Objets
helpers.cleanObject({ a: 1, b: null }); // { a: 1 }
helpers.isEmpty(value);
helpers.groupBy(array, 'category');

// Pagination
const { data, pagination } = helpers.paginate(items, 2, 20);

// Réponses API
helpers.apiResponse(data, 'Success', { meta: 'info' });
helpers.apiError('Not found', 'NOT_FOUND', { id: '123' });

// Requêtes
helpers.getClientIp(req);
helpers.shortId(8); // 'xK9mZp2q'
```

---

## Conventions

### Ajouter une fonction

1. **Identifier le bon module** - Ne pas mélanger les responsabilités
2. **Documenter avec JSDoc** - Paramètres, retour, exemple si complexe
3. **Exporter dans index.js** si usage fréquent
4. **Tester** - Les utils sont critiques, couvrir les cas limites

### Créer un nouveau module

Si un nouveau domaine émerge (ex: `pdf.js`, `imap.js`) :

1. Créer le fichier avec une classe ou des fonctions exportées
2. Ajouter l'export dans `index.js`
3. Documenter dans ce README
4. Garder le module focalisé (single responsibility)

### Style de code

- Fonctions pures quand possible (pas d'effets de bord)
- Gestion d'erreurs explicite (throw ou return null, pas de silence)
- Nommage explicite : `isValidMSSanteEmail` > `checkEmail`
- Paramètres par défaut pour la flexibilité

---

## Tests

```bash
# Depuis services/api/
npm test -- --grep "utils"

# Fichier spécifique
npm test -- src/utils/__tests__/crypto.test.js
```

Les tests doivent couvrir :
- Cas nominaux
- Valeurs limites (null, undefined, chaînes vides)
- Formats invalides (emails malformés, etc.)

---

## Évolutions prévues

- [ ] `imap.js` - Client IMAP (actuellement dans services/email/)
- [ ] `pdf.js` - Génération de PDF (rapports, exports)
- [ ] `queue.js` - Helpers pour les jobs asynchrones Redis
