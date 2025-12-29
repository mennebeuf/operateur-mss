# Documentation des Tests Unitaires - Opérateur MSSanté

## Vue d'ensemble

Le projet MSSanté utilise **Jest** comme framework de test pour l'API (Node.js) et le Frontend (React). L'objectif est d'atteindre une couverture de code supérieure à **80%** avant la mise en production.

## Structure des tests

```
mssante-operator/
├── services/
│   ├── api/
│   │   └── tests/
│   │       ├── unit/          # Tests unitaires API
│   │       ├── integration/   # Tests d'intégration API
│   │       └── e2e/           # Tests end-to-end API
│   └── frontend/
│       └── tests/
│           ├── unit/          # Tests unitaires Frontend
│           └── e2e/           # Tests end-to-end Frontend
└── tests/
    ├── integration/           # Tests d'intégration globaux
    ├── e2e/                   # Tests E2E globaux
    └── load/                  # Tests de charge
```

## Commandes pour lancer les tests

### Lancer tous les tests

```bash
# Depuis la racine du projet
make test

# Ou avec npm
npm test
```

### Tests API uniquement

```bash
# Tous les tests API
cd services/api
npm test

# Tests unitaires uniquement
npm run test:unit

# Tests d'intégration
npm run test:integration

# Tests avec surveillance (watch mode)
npm run test:watch

# Tests avec couverture de code
npm test -- --coverage
```

### Tests Frontend uniquement

```bash
# Tous les tests Frontend
cd services/frontend
npm test

# Tests avec couverture
npm test -- --coverage

# Tests en mode watch
npm test -- --watch
```

### Tests E2E (End-to-End)

```bash
cd tests/e2e
npm run test:e2e
```

### Tests de charge

```bash
cd tests/load

# Avec k6
k6 run load-test.js

# Test de charge SMTP
./smtp-load-test.sh 1000
```

## Debugger les tests dans VS Code

Le projet inclut une configuration de débogage pour VS Code dans `.vscode/launch.json` :

1. Ouvrez VS Code
2. Allez dans l'onglet **Run and Debug** (Ctrl+Shift+D)
3. Sélectionnez **"Debug Tests API"**
4. Appuyez sur F5 pour lancer le débogage

## Configuration Jest

### API (`services/api/package.json`)

```json
{
  "scripts": {
    "test": "jest",
    "test:unit": "jest --testPathPattern=tests/unit",
    "test:integration": "jest --testPathPattern=tests/integration",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage"
  },
  "jest": {
    "testEnvironment": "node",
    "coverageThreshold": {
      "global": {
        "branches": 80,
        "functions": 80,
        "lines": 80,
        "statements": 80
      }
    }
  }
}
```

### Frontend (`services/frontend/package.json`)

```json
{
  "scripts": {
    "test": "react-scripts test",
    "test:coverage": "react-scripts test --coverage --watchAll=false"
  }
}
```

## Écrire un test unitaire

### Exemple : Test d'un service API

```javascript
// services/api/tests/unit/services/mailboxService.test.js

const mailboxService = require('../../../src/services/mailboxService');
const db = require('../../../src/config/database');

// Mock de la base de données
jest.mock('../../../src/config/database');

describe('MailboxService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createMailbox', () => {
    it('devrait créer une BAL avec succès', async () => {
      // Arrange
      const mailboxData = {
        email: 'test@domaine.mssante.fr',
        userId: 1,
        quota: 1073741824
      };
      
      db.query.mockResolvedValue({
        rows: [{ id: 1, ...mailboxData }]
      });

      // Act
      const result = await mailboxService.createMailbox(mailboxData);

      // Assert
      expect(result).toHaveProperty('id', 1);
      expect(result.email).toBe('test@domaine.mssante.fr');
      expect(db.query).toHaveBeenCalledTimes(1);
    });

    it('devrait lever une erreur si l\'email existe déjà', async () => {
      // Arrange
      const mailboxData = { email: 'existant@domaine.mssante.fr' };
      db.query.mockRejectedValue(new Error('duplicate key'));

      // Act & Assert
      await expect(mailboxService.createMailbox(mailboxData))
        .rejects
        .toThrow('duplicate key');
    });
  });
});
```

### Exemple : Test d'un composant React

```javascript
// services/frontend/tests/unit/components/MailboxList.test.jsx

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MailboxList from '../../../src/components/MailboxList';
import { getMailboxes } from '../../../src/services/api';

// Mock du service API
jest.mock('../../../src/services/api');

describe('MailboxList', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('devrait afficher la liste des BAL', async () => {
    // Arrange
    getMailboxes.mockResolvedValue([
      { id: 1, email: 'user1@domaine.mssante.fr' },
      { id: 2, email: 'user2@domaine.mssante.fr' }
    ]);

    // Act
    render(<MailboxList />);

    // Assert
    await waitFor(() => {
      expect(screen.getByText('user1@domaine.mssante.fr')).toBeInTheDocument();
      expect(screen.getByText('user2@domaine.mssante.fr')).toBeInTheDocument();
    });
  });

  it('devrait afficher un message si aucune BAL', async () => {
    // Arrange
    getMailboxes.mockResolvedValue([]);

    // Act
    render(<MailboxList />);

    // Assert
    await waitFor(() => {
      expect(screen.getByText('Aucune boîte aux lettres')).toBeInTheDocument();
    });
  });
});
```

## Bonnes pratiques

1. **Nommer clairement les tests** : Utilisez des descriptions en français qui expliquent le comportement attendu

2. **Structure AAA** : Organisez vos tests en trois sections :
   - **Arrange** : Préparer les données et mocks
   - **Act** : Exécuter l'action à tester
   - **Assert** : Vérifier le résultat

3. **Un test = un cas** : Chaque test doit vérifier un seul comportement

4. **Isoler les tests** : Utilisez `beforeEach` pour réinitialiser l'état entre les tests

5. **Mocker les dépendances externes** : Base de données, APIs externes, services tiers

## Rapport de couverture

Après l'exécution des tests avec `--coverage`, un rapport est généré :

```bash
# Rapport console
npm test -- --coverage

# Rapport HTML (ouvrir coverage/lcov-report/index.html)
open coverage/lcov-report/index.html
```

### Objectifs de couverture

| Métrique    | Objectif |
|-------------|----------|
| Branches    | > 80%    |
| Functions   | > 80%    |
| Lines       | > 80%    |
| Statements  | > 80%    |

## Intégration CI/CD

Les tests sont automatiquement exécutés dans le pipeline CI/CD :

```yaml
# .github/workflows/test.yml
test:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v3
    - name: Install dependencies
      run: npm install
    - name: Run tests
      run: npm test -- --coverage
    - name: Check coverage threshold
      run: npm test -- --coverage --coverageThreshold='{"global":{"branches":80}}'
```

## Dépannage

### Les tests échouent avec des erreurs de timeout

```bash
# Augmenter le timeout
npm test -- --testTimeout=30000
```

### Les mocks ne fonctionnent pas

Vérifiez que le chemin du mock correspond exactement au chemin du module :

```javascript
// ❌ Incorrect
jest.mock('../../services/api');

// ✅ Correct (chemin relatif depuis le fichier de test)
jest.mock('../../../src/services/api');
```

### Nettoyer le cache Jest

```bash
npm test -- --clearCache
```
