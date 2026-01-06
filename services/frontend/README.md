# Frontend MSSanté Operator

Interface utilisateur React pour la plateforme Opérateur MSSanté.

## 🚀 Technologies

- **React 18** - Framework UI
- **Tailwind CSS** - Styling utilitaire
- **React Router 6** - Routing SPA
- **React Query** - Gestion des données serveur
- **Zustand** - State management
- **Axios** - Client HTTP
- **React Hook Form** - Gestion des formulaires

## 📁 Structure du projet

```
src/
├── components/           # Composants réutilisables
│   ├── common/          # Boutons, inputs, modals...
│   ├── layout/          # Header, Sidebar, Footer
│   └── features/        # Composants par fonctionnalité
├── pages/               # Pages de l'application
│   ├── auth/            # Login, Callback PSC
│   ├── webmail/         # Interface email
│   └── admin/           # Administration
├── contexts/            # Contextes React
├── hooks/               # Hooks personnalisés
├── services/            # Services API
├── utils/               # Fonctions utilitaires
├── styles/              # Fichiers CSS/Tailwind
├── App.jsx              # Composant racine
├── routes.jsx           # Configuration des routes
└── index.jsx            # Point d'entrée
```

## 🛠️ Installation

### Prérequis

- Node.js 18+
- npm 9+

### Installation des dépendances

```bash
npm install
```

### Configuration

1. Copier le fichier d'environnement :

```bash
cp .env.example .env.development
```

2. Configurer les variables :

```env
REACT_APP_API_URL=http://localhost:3001/api/v1
REACT_APP_PSC_CLIENT_ID=votre_client_id
```

## 🚀 Développement

### Démarrer le serveur de développement

```bash
npm start
```

L'application sera accessible sur [http://localhost:3000](http://localhost:3000).

### Scripts disponibles

| Commande | Description |
|----------|-------------|
| `npm start` | Démarre le serveur de développement |
| `npm run build` | Génère le build de production |
| `npm test` | Lance les tests |
| `npm run test:coverage` | Tests avec rapport de couverture |
| `npm run lint` | Vérifie le code avec ESLint |
| `npm run lint:fix` | Corrige automatiquement les erreurs ESLint |
| `npm run format` | Formate le code avec Prettier |
| `npm run analyze` | Analyse la taille du bundle |

## 🔐 Authentification

L'application utilise **Pro Santé Connect (PSC)** pour l'authentification des professionnels de santé.

### Flux d'authentification

1. L'utilisateur clique sur "Connexion"
2. Redirection vers PSC (OAuth2)
3. Authentification via carte CPS ou e-CPS
4. Callback avec le code d'autorisation
5. Échange du code contre un JWT
6. Stockage du token et redirection

## 📱 Pages principales

### Webmail (`/webmail`)
- Liste des emails
- Lecture/écriture de messages
- Gestion des pièces jointes
- Recherche et filtres

### Administration (`/admin`)
- Gestion des BAL
- Gestion des utilisateurs
- Certificats IGC Santé
- Statistiques et monitoring
- Interface Annuaire ANS

## 🎨 Conventions de code

### Nomenclature

- **Composants** : PascalCase (`UserList.jsx`)
- **Hooks** : camelCase avec préfixe `use` (`useAuth.js`)
- **Utilitaires** : camelCase (`formatters.js`)
- **Constantes** : SCREAMING_SNAKE_CASE

### Structure d'un composant

```jsx
import React from 'react';
import PropTypes from 'prop-types';

const MonComposant = ({ prop1, prop2 }) => {
  // Hooks
  // État local
  // Effets
  // Handlers
  // Rendu

  return (
    <div>
      {/* JSX */}
    </div>
  );
};

MonComposant.propTypes = {
  prop1: PropTypes.string.isRequired,
  prop2: PropTypes.number
};

MonComposant.defaultProps = {
  prop2: 0
};

export default MonComposant;
```

## 🐳 Docker

### Build de l'image

```bash
docker build -t mssante-frontend .
```

### Exécution

```bash
docker run -p 80:80 mssante-frontend
```

### Variables de build

```bash
docker build \
  --build-arg REACT_APP_API_URL=https://api.exemple.mssante.fr \
  --build-arg REACT_APP_PSC_CLIENT_ID=mon_client_id \
  -t mssante-frontend .
```

## ✅ Tests

### Lancer les tests

```bash
npm test
```

### Couverture de code

```bash
npm run test:coverage
```

Objectif : 70% de couverture minimum.

## 📦 Build de production

```bash
npm run build
```

Les fichiers sont générés dans le dossier `build/`.

### Optimisations incluses

- Minification JS/CSS
- Tree shaking
- Code splitting
- Compression Gzip (via Nginx)
- Cache des assets statiques

## 🔧 Configuration Nginx

Le fichier `nginx.conf` inclut :

- Compression Gzip
- Headers de sécurité (CSP, XSS, etc.)
- Cache optimisé pour les assets
- Support du routing SPA
- Healthcheck endpoint

## 📄 Licence

Propriétaire - © 2024 MSSanté Operator

## 📞 Support

- Email : support@votre-operateur.mssante.fr
- Documentation : [docs.mssante.fr](https://docs.mssante.fr)