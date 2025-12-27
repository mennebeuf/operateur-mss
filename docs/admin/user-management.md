# Gestion des Utilisateurs - Opérateur MSSanté

## Table des matières

1. [Vue d'ensemble](#vue-densemble)
2. [Rôles et permissions](#rôles-et-permissions)
3. [Création d'utilisateurs](#création-dutilisateurs)
4. [Gestion des utilisateurs existants](#gestion-des-utilisateurs-existants)
5. [Attribution des rôles](#attribution-des-rôles)
6. [Gestion des domaines](#gestion-des-domaines)
7. [Audit et traçabilité](#audit-et-traçabilité)
8. [Cas d'usage courants](#cas-dusage-courants)

---

## Vue d'ensemble

### Hiérarchie des rôles

La plateforme MSSanté utilise un système de gestion des utilisateurs à 3 niveaux :
```
┌────────────────────────────────────────────────────────┐
│             SUPER ADMINISTRATEUR                       │
│  Opérateur MSSanté - Accès complet                     │
├────────────────────────────────────────────────────────┤
│  ✓ Gestion de tous les domaines                        │
│  ✓ Création/suppression de domaines                    │
│  ✓ Gestion globale des utilisateurs                    │
│  ✓ Configuration de la plateforme                      │
│  ✓ Accès aux statistiques globales                     │
│  ✓ Gestion des certificats                             │
│  ✓ Soumission des indicateurs ANS                      │
└────────────────────────────────────────────────────────┘
                        │
                        ▼
┌────────────────────────────────────────────────────────┐
│          ADMINISTRATEUR DE DOMAINE                     │
│  Établissement/Organisation - Accès limité au domaine  │
├────────────────────────────────────────────────────────┤
│  ✓ Gestion des BAL de son domaine                      │
│  ✓ Gestion des utilisateurs de son domaine             │
│  ✓ Consultation des statistiques de son domaine        │
│  ✓ Configuration du domaine                            │
│  ✓ Demande de renouvellement de certificats            │
└────────────────────────────────────────────────────────┘
                        │
                        ▼
┌────────────────────────────────────────────────────────┐
│                UTILISATEUR STANDARD                    │
│  Professionnel de santé - Accès personnel              │
├────────────────────────────────────────────────────────┤
│  ✓ Accès à ses propres BAL                             │
│  ✓ Consultation et envoi d'emails (webmail)            │
│  ✓ Gestion de ses paramètres personnels                │
│  ✓ Consultation de ses statistiques personnelles       │
└────────────────────────────────────────────────────────┘
```

### Types d'utilisateurs

| Type | Authentification | Accès | Cas d'usage |
|------|------------------|-------|-------------|
| **Super Admin** | Email/Mot de passe | Plateforme complète | Gestion de l'opérateur |
| **Admin Domaine** | Email/Mot de passe ou PSC | Domaine spécifique | Gestion d'établissement |
| **Utilisateur** | Pro Santé Connect | Ses BAL uniquement | Professionnel de santé |

---

## Rôles et permissions

### Matrice des permissions

| Ressource | Super Admin | Admin Domaine | Utilisateur |
|-----------|-------------|---------------|-------------|
| **Domaines** |
| Créer | ✅ | ❌ | ❌ |
| Voir tous | ✅ | ❌ | ❌ |
| Voir le sien | ✅ | ✅ | ❌ |
| Modifier le sien | ✅ | ✅ | ❌ |
| Supprimer | ✅ | ❌ | ❌ |
| **Utilisateurs** |
| Créer (global) | ✅ | ❌ | ❌ |
| Créer (domaine) | ✅ | ✅ | ❌ |
| Voir tous | ✅ | ❌ | ❌ |
| Voir domaine | ✅ | ✅ | ❌ |
| Modifier tous | ✅ | ❌ | ❌ |
| Modifier domaine | ✅ | ✅ | ❌ |
| Modifier soi-même | ✅ | ✅ | ✅ |
| **BAL** |
| Créer (global) | ✅ | ❌ | ❌ |
| Créer (domaine) | ✅ | ✅ | ❌ |
| Voir toutes | ✅ | ❌ | ❌ |
| Voir domaine | ✅ | ✅ | ❌ |
| Voir les siennes | ✅ | ✅ | ✅ |
| Modifier toutes | ✅ | ❌ | ❌ |
| Modifier domaine | ✅ | ✅ | ❌ |
| Supprimer | ✅ | ✅ | ❌ |
| **Certificats** |
| Voir tous | ✅ | ❌ | ❌ |
| Voir domaine | ✅ | ✅ | ❌ |
| Installer | ✅ | ❌ | ❌ |
| Renouveler | ✅ | Demande | ❌ |
| **Statistiques** |
| Globales | ✅ | ❌ | ❌ |
| Par domaine | ✅ | ✅ | ❌ |
| Personnelles | ✅ | ✅ | ✅ |
| **Configuration** |
| Plateforme | ✅ | ❌ | ❌ |
| Domaine | ✅ | ✅ | ❌ |
| Personnelle | ✅ | ✅ | ✅ |

### Permissions granulaires

Le système utilise un modèle RBAC (Role-Based Access Control) avec des permissions granulaires :
```javascript
// Exemples de permissions
const permissions = {
  // Format: resource.action
  'mailbox.create': 'Créer une BAL',
  'mailbox.read': 'Consulter les BAL',
  'mailbox.update': 'Modifier une BAL',
  'mailbox.delete': 'Supprimer une BAL',
  'mailbox.manage_all': 'Gérer toutes les BAL',
  
  'user.create': 'Créer un utilisateur',
  'user.read': 'Consulter les utilisateurs',
  'user.update': 'Modifier un utilisateur',
  'user.delete': 'Supprimer un utilisateur',
  'user.manage_all': 'Gérer tous les utilisateurs',
  
  'domain.create': 'Créer un domaine',
  'domain.read': 'Consulter les domaines',
  'domain.update': 'Modifier un domaine',
  'domain.delete': 'Supprimer un domaine',
  'domain.manage_all': 'Gérer tous les domaines',
  
  'stats.read_own': 'Consulter ses propres stats',
  'stats.read_domain': 'Consulter les stats du domaine',
  'stats.read_all': 'Consulter toutes les stats'
};
```

---

## Création d'utilisateurs

### 1. Créer un Super Administrateur

**Via l'interface (premier démarrage):**

Lors de la première installation, un formulaire permet de créer le super admin initial.

**Via la ligne de commande:**
```bash
# Script de création du premier super admin
docker compose exec api npm run create-super-admin

# Ou via SQL directement
docker compose exec postgres psql -U mssante -d mssante << EOF
INSERT INTO users (
  email,
  first_name,
  last_name,
  is_super_admin,
  status,
  password_hash
) VALUES (
  'admin@votre-operateur.mssante.fr',
  'Admin',
  'Système',
  true,
  'active',
  -- Hash du mot de passe (à générer avec bcrypt)
  '\$2b\$10\$...'
);
EOF
```

**Via l'API:**
```bash
curl -X POST https://api.votre-domaine.mssante.fr/api/v1/admin/users \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPER_ADMIN_TOKEN" \
  -d '{
    "email": "nouvel-admin@votre-operateur.mssante.fr",
    "firstName": "Jean",
    "lastName": "Dupont",
    "password": "MotDePasseSecurise123!",
    "role": "super_admin"
  }'
```

### 2. Créer un Administrateur de Domaine

**Interface web (Super Admin):**

1. Se connecter en tant que Super Admin
2. Aller dans **Admin > Utilisateurs**
3. Cliquer sur **+ Nouvel utilisateur**
4. Remplir le formulaire :
   - Email
   - Prénom / Nom
   - Rôle : **Administrateur de Domaine**
   - Domaine(s) à gérer
   - Mot de passe temporaire
5. Valider

**Via l'API:**
```bash
curl -X POST https://api.votre-domaine.mssante.fr/api/v1/admin/users \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPER_ADMIN_TOKEN" \
  -d '{
    "email": "admin.hopital@hopital-exemple.mssante.fr",
    "firstName": "Marie",
    "lastName": "Martin",
    "password": "MotDePasseTemporaire123!",
    "role": "domain_admin",
    "domains": ["uuid-du-domaine-hopital-exemple"]
  }'
```

**Composant React:**
```jsx
// services/frontend/src/pages/Admin/Users/CreateUser.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const CreateUser = () => {
  const navigate = useNavigate();
  const [domains, setDomains] = useState([]);
  const [formData, setFormData] = useState({
    email: '',
    firstName: '',
    lastName: '',
    password: '',
    role: 'user',
    selectedDomains: []
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadDomains();
  }, []);

  const loadDomains = async () => {
    const response = await fetch('/api/v1/admin/domains', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });
    const data = await response.json();
    setDomains(data.data.domains);
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.email) {
      newErrors.email = 'Email requis';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email invalide';
    }

    if (!formData.firstName) {
      newErrors.firstName = 'Prénom requis';
    }

    if (!formData.lastName) {
      newErrors.lastName = 'Nom requis';
    }

    if (!formData.password) {
      newErrors.password = 'Mot de passe requis';
    } else if (formData.password.length < 12) {
      newErrors.password = 'Minimum 12 caractères';
    }

    if (formData.role === 'domain_admin' && formData.selectedDomains.length === 0) {
      newErrors.domains = 'Sélectionnez au moins un domaine';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    setLoading(true);

    try {
      const response = await fetch('/api/v1/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message);
      }

      alert('Utilisateur créé avec succès');
      navigate('/admin/users');

    } catch (error) {
      alert('Erreur: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Créer un utilisateur</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Informations personnelles */}
        <div className="bg-white shadow rounded-lg p-6 space-y-4">
          <h2 className="font-bold text-lg">Informations personnelles</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Prénom *
              </label>
              <input
                type="text"
                value={formData.firstName}
                onChange={(e) => setFormData({...formData, firstName: e.target.value})}
                className={`w-full px-3 py-2 border rounded ${
                  errors.firstName ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {errors.firstName && (
                <p className="text-red-500 text-sm mt-1">{errors.firstName}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Nom *
              </label>
              <input
                type="text"
                value={formData.lastName}
                onChange={(e) => setFormData({...formData, lastName: e.target.value})}
                className={`w-full px-3 py-2 border rounded ${
                  errors.lastName ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {errors.lastName && (
                <p className="text-red-500 text-sm mt-1">{errors.lastName}</p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Email *
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              className={`w-full px-3 py-2 border rounded ${
                errors.email ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="utilisateur@domaine.mssante.fr"
            />
            {errors.email && (
              <p className="text-red-500 text-sm mt-1">{errors.email}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Mot de passe temporaire *
            </label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({...formData, password: e.target.value})}
              className={`w-full px-3 py-2 border rounded ${
                errors.password ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Minimum 12 caractères"
            />
            {errors.password && (
              <p className="text-red-500 text-sm mt-1">{errors.password}</p>
            )}
            <p className="text-sm text-gray-600 mt-1">
              L'utilisateur devra changer son mot de passe à la première connexion
            </p>
          </div>
        </div>

        {/* Rôle et permissions */}
        <div className="bg-white shadow rounded-lg p-6 space-y-4">
          <h2 className="font-bold text-lg">Rôle et permissions</h2>

          <div>
            <label className="block text-sm font-medium mb-1">
              Rôle *
            </label>
            <select
              value={formData.role}
              onChange={(e) => setFormData({...formData, role: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded"
            >
              <option value="user">Utilisateur standard</option>
              <option value="domain_admin">Administrateur de domaine</option>
              <option value="super_admin">Super administrateur</option>
            </select>
          </div>

          {/* Sélection des domaines pour admin domaine */}
          {formData.role === 'domain_admin' && (
            <div>
              <label className="block text-sm font-medium mb-1">
                Domaines à gérer *
              </label>
              <div className="border border-gray-300 rounded p-4 max-h-60 overflow-y-auto">
                {domains.map(domain => (
                  <label key={domain.id} className="flex items-center space-x-2 mb-2">
                    <input
                      type="checkbox"
                      checked={formData.selectedDomains.includes(domain.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFormData({
                            ...formData,
                            selectedDomains: [...formData.selectedDomains, domain.id]
                          });
                        } else {
                          setFormData({
                            ...formData,
                            selectedDomains: formData.selectedDomains.filter(id => id !== domain.id)
                          });
                        }
                      }}
                    />
                    <span>{domain.domain_name}</span>
                  </label>
                ))}
              </div>
              {errors.domains && (
                <p className="text-red-500 text-sm mt-1">{errors.domains}</p>
              )}
            </div>
          )}

          {/* Description des rôles */}
          <div className="bg-blue-50 border border-blue-200 rounded p-4">
            <p className="text-sm text-blue-900">
              {formData.role === 'user' && (
                <>
                  <strong>Utilisateur standard :</strong> Accès à ses propres BAL et au webmail uniquement.
                </>
              )}
              {formData.role === 'domain_admin' && (
                <>
                  <strong>Administrateur de domaine :</strong> Gestion des BAL et utilisateurs de son/ses domaine(s).
                </>
              )}
              {formData.role === 'super_admin' && (
                <>
                  <strong>Super administrateur :</strong> Accès complet à la plateforme, gestion de tous les domaines.
                </>
              )}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-4">
          <button
            type="button"
            onClick={() => navigate('/admin/users')}
            className="px-6 py-2 border border-gray-300 rounded hover:bg-gray-50"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Création...' : 'Créer l\'utilisateur'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateUser;
```

### 3. Créer un Utilisateur Standard

Les utilisateurs standards sont généralement créés automatiquement lors de la création de leur première BAL personnelle via Pro Santé Connect.

**Création manuelle (Admin Domaine):**
```bash
curl -X POST https://api.votre-domaine.mssante.fr/api/v1/admin/domain-users \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $DOMAIN_ADMIN_TOKEN" \
  -d '{
    "rpps": "10001234567",
    "firstName": "Pierre",
    "lastName": "Durand",
    "email": "pierre.durand@hopital-exemple.mssante.fr",
    "profession": "Médecin",
    "specialty": "Cardiologie"
  }'
```

---

## Gestion des utilisateurs existants

### 1. Liste des utilisateurs

**Interface Super Admin:**
```jsx
// services/frontend/src/pages/Admin/Users/UsersList.jsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const UsersList = () => {
  const [users, setUsers] = useState([]);
  const [filters, setFilters] = useState({
    search: '',
    role: '',
    status: '',
    domain: ''
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0
  });

  useEffect(() => {
    loadUsers();
  }, [filters, pagination.page]);

  const loadUsers = async () => {
    const params = new URLSearchParams({
      page: pagination.page,
      limit: pagination.limit,
      ...filters
    });

    const response = await fetch(`/api/v1/admin/users?${params}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });

    const data = await response.json();
    setUsers(data.data.users);
    setPagination({
      ...pagination,
      total: data.data.pagination.total
    });
  };

  const handleSuspend = async (userId) => {
    if (!confirm('Suspendre cet utilisateur ?')) return;

    try {
      await fetch(`/api/v1/admin/users/${userId}/suspend`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      loadUsers();
    } catch (error) {
      alert('Erreur: ' + error.message);
    }
  };

  const handleActivate = async (userId) => {
    try {
      await fetch(`/api/v1/admin/users/${userId}/activate`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      loadUsers();
    } catch (error) {
      alert('Erreur: ' + error.message);
    }
  };

  const handleDelete = async (userId) => {
    if (!confirm('Supprimer définitivement cet utilisateur ? Cette action est irréversible.')) return;

    try {
      await fetch(`/api/v1/admin/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      loadUsers();
    } catch (error) {
      alert('Erreur: ' + error.message);
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Gestion des utilisateurs</h1>
        <Link
          to="/admin/users/create"
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          + Nouvel utilisateur
        </Link>
      </div>

      {/* Filtres */}
      <div className="bg-white shadow rounded-lg p-4 mb-6">
        <div className="grid grid-cols-4 gap-4">
          <input
            type="text"
            placeholder="Rechercher..."
            value={filters.search}
            onChange={(e) => setFilters({...filters, search: e.target.value})}
            className="px-3 py-2 border border-gray-300 rounded"
          />

          <select
            value={filters.role}
            onChange={(e) => setFilters({...filters, role: e.target.value})}
            className="px-3 py-2 border border-gray-300 rounded"
          >
            <option value="">Tous les rôles</option>
            <option value="user">Utilisateur</option>
            <option value="domain_admin">Admin Domaine</option>
            <option value="super_admin">Super Admin</option>
          </select>

          <select
            value={filters.status}
            onChange={(e) => setFilters({...filters, status: e.target.value})}
            className="px-3 py-2 border border-gray-300 rounded"
          >
            <option value="">Tous les statuts</option>
            <option value="active">Actif</option>
            <option value="suspended">Suspendu</option>
            <option value="deleted">Supprimé</option>
          </select>

          <button
            onClick={() => setFilters({ search: '', role: '', status: '', domain: '' })}
            className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
          >
            Réinitialiser
          </button>
        </div>
      </div>

      {/* Tableau des utilisateurs */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Utilisateur
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Email
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Rôle
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Statut
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Dernière connexion
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {users.map(user => (
              <tr key={user.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="h-10 w-10 flex-shrink-0">
                      <div className="h-10 w-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold">
                        {user.first_name[0]}{user.last_name[0]}
                      </div>
                    </div>
                    <div className="ml-4">
                      <div className="font-medium text-gray-900">
                        {user.first_name} {user.last_name}
                      </div>
                      {user.rpps_id && (
                        <div className="text-sm text-gray-500">
                          RPPS: {user.rpps_id}
                        </div>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {user.email}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    user.is_super_admin 
                      ? 'bg-purple-100 text-purple-800'
                      : user.role === 'domain_admin'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {user.is_super_admin ? 'Super Admin' : 
                     user.role === 'domain_admin' ? 'Admin Domaine' : 'Utilisateur'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    user.status === 'active' 
                      ? 'bg-green-100 text-green-800'
                      : user.status === 'suspended'
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {user.status === 'active' ? 'Actif' : 
                     user.status === 'suspended' ? 'Suspendu' : 'Supprimé'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {user.last_login 
                    ? new Date(user.last_login).toLocaleDateString('fr-FR')
                    : 'Jamais'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex justify-end gap-2">
                    <Link
                      to={`/admin/users/${user.id}`}
                      className="text-blue-600 hover:underline"
                    >
                      Voir
                    </Link>
                    <Link
                      to={`/admin/users/${user.id}/edit`}
                      className="text-indigo-600 hover:underline"
                    >
                      Modifier
                    </Link>
                    {user.status === 'active' ? (
                      <button
                        onClick={() => handleSuspend(user.id)}
                        className="text-yellow-600 hover:underline"
                      >
                        Suspendre
                      </button>
                    ) : user.status === 'suspended' ? (
                      <button
                        onClick={() => handleActivate(user.id)}
                        className="text-green-600 hover:underline"
                      >
                        Activer
                      </button>
                    ) : null}
                    {!user.is_super_admin && (
                      <button
                        onClick={() => handleDelete(user.id)}
                        className="text-red-600 hover:underline"
                      >
                        Supprimer
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="mt-6 flex justify-between items-center">
        <div className="text-sm text-gray-700">
          Affichage de {((pagination.page - 1) * pagination.limit) + 1} à{' '}
          {Math.min(pagination.page * pagination.limit, pagination.total)} sur{' '}
          {pagination.total} utilisateurs
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setPagination({...pagination, page: pagination.page - 1})}
            disabled={pagination.page === 1}
            className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
          >
            Précédent
          </button>
          <button
            onClick={() => setPagination({...pagination, page: pagination.page + 1})}
            disabled={pagination.page * pagination.limit >= pagination.total}
            className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
          >
            Suivant
          </button>
        </div>
      </div>
    </div>
  );
};

export default UsersList;
```

### 2. Modifier un utilisateur

**Via l'API:**
```bash
curl -X PUT https://api.votre-domaine.mssante.fr/api/v1/admin/users/USER_ID \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{
    "firstName": "Pierre",
    "lastName": "Durand",
    "email": "p.durand@hopital.mssante.fr",
    "role": "domain_admin"
  }'
```

### 3. Suspendre un utilisateur

La suspension désactive temporairement l'accès sans supprimer les données.
```bash
curl -X PUT https://api.votre-domaine.mssante.fr/api/v1/admin/users/USER_ID/suspend \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### 4. Réactiver un utilisateur
```bash
curl -X PUT https://api.votre-domaine.mssante.fr/api/v1/admin/users/USER_ID/activate \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### 5. Supprimer un utilisateur

⚠️ **Attention :** La suppression est définitive et irréversible.
```bash
curl -X DELETE https://api.votre-domaine.mssante.fr/api/v1/admin/users/USER_ID \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

---

## Attribution des rôles

### Promouvoir un utilisateur en Admin Domaine
```bash
curl -X PUT https://api.votre-domaine.mssante.fr/api/v1/admin/users/USER_ID/role \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPER_ADMIN_TOKEN" \
  -d '{
    "role": "domain_admin",
    "domains": ["DOMAIN_ID_1", "DOMAIN_ID_2"]
  }'
```

### Révoquer les droits d'administration
```bash
curl -X PUT https://api.votre-domaine.mssante.fr/api/v1/admin/users/USER_ID/role \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPER_ADMIN_TOKEN" \
  -d '{
    "role": "user"
  }'
```

---

## Gestion des domaines

### Assigner un Admin Domaine à un domaine
```bash
curl -X POST https://api.votre-domaine.mssante.fr/api/v1/admin/domains/DOMAIN_ID/admins \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPER_ADMIN_TOKEN" \
  -d '{
    "userId": "USER_ID"
  }'
```

### Retirer un Admin Domaine d'un domaine
```bash
curl -X DELETE https://api.votre-domaine.mssante.fr/api/v1/admin/domains/DOMAIN_ID/admins/USER_ID \
  -H "Authorization: Bearer $SUPER_ADMIN_TOKEN"
```

---

## Audit et traçabilité

### Journal d'audit

Toutes les actions administratives sont tracées :
```sql
SELECT 
  al.id,
  al.action,
  al.resource_type,
  al.resource_id,
  u.email as performed_by,
  al.ip_address,
  al.user_agent,
  al.created_at,
  al.details
FROM audit_logs al
JOIN users u ON al.user_id = u.id
WHERE al.resource_type = 'user'
ORDER BY al.created_at DESC
LIMIT 100;
```

### Consulter l'historique d'un utilisateur
```bash
curl -X GET https://api.votre-domaine.mssante.fr/api/v1/admin/users/USER_ID/audit-logs \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

---

## Cas d'usage courants

### 1. Onboarding d'un nouvel établissement
```bash
# 1. Créer le domaine
curl -X POST https://api.votre-domaine.mssante.fr/api/v1/admin/domains \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPER_ADMIN_TOKEN" \
  -d '{
    "domain_name": "nouvel-hopital.mssante.fr",
    "finess_juridique": "750000001",
    "organization_name": "Nouvel Hôpital"
  }'

# 2. Créer l'admin du domaine
curl -X POST https://api.votre-domaine.mssante.fr/api/v1/admin/users \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPER_ADMIN_TOKEN" \
  -d '{
    "email": "admin@nouvel-hopital.mssante.fr",
    "firstName": "Admin",
    "lastName": "Hôpital",
    "password": "TemporaryPass123!",
    "role": "domain_admin",
    "domains": ["DOMAIN_ID"]
  }'

# 3. Envoyer les identifiants par email sécurisé
```

### 2. Changement d'administrateur de domaine
```bash
# 1. Créer le nouvel admin
# (voir section création)

# 2. Assigner au domaine
curl -X POST https://api.votre-domaine.mssante.fr/api/v1/admin/domains/DOMAIN_ID/admins \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPER_ADMIN_TOKEN" \
  -d '{"userId": "NEW_ADMIN_ID"}'

# 3. Période de transition (les deux admins coexistent)

# 4. Retirer l'ancien admin
curl -X DELETE https://api.votre-domaine.mssante.fr/api/v1/admin/domains/DOMAIN_ID/admins/OLD_ADMIN_ID \
  -H "Authorization: Bearer $SUPER_ADMIN_TOKEN"
```

### 3. Départ d'un professionnel de santé
```bash
# 1. Suspendre l'utilisateur (immédiat)
curl -X PUT https://api.votre-domaine.mssante.fr/api/v1/admin/users/USER_ID/suspend \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# 2. Archiver ses BAL (après 30 jours)
curl -X PUT https://api.votre-domaine.mssante.fr/api/v1/admin/mailboxes/MAILBOX_ID \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"status": "archived"}'

# 3. Supprimer l'utilisateur (après 6 mois)
curl -X DELETE https://api.votre-domaine.mssante.fr/api/v1/admin/users/USER_ID \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### 4. Réinitialisation de mot de passe
```bash
# Générer un nouveau mot de passe temporaire
curl -X POST https://api.votre-domaine.mssante.fr/api/v1/admin/users/USER_ID/reset-password \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Réponse contient le mot de passe temporaire à communiquer à l'utilisateur
```

---

## Bonnes pratiques

### Sécurité

1. **Mots de passe :**
   - Minimum 12 caractères
   - Mélange de majuscules, minuscules, chiffres et symboles
   - Changement obligatoire à la première connexion
   - Expiration tous les 90 jours (recommandé)

2. **Super Admins :**
   - Limiter le nombre de super admins (2-3 maximum)
   - Utiliser l'authentification à deux facteurs (si disponible)
   - Auditer régulièrement les actions

3. **Admins Domaine :**
   - Un ou deux par établissement maximum
   - Revoir les droits tous les 6 mois
   - Désactiver immédiatement en cas de départ

### Organisation

1. **Nommage des emails :**
   - Format cohérent : prenom.nom@domaine.mssante.fr
   - Éviter les caractères spéciaux
   - Documenter les exceptions

2. **Documentation :**
   - Tenir à jour la liste des admins
   - Documenter les procédures spécifiques
   - Conserver l'historique des changements

3. **Communication :**
   - Informer les utilisateurs des changements
   - Fournir une documentation claire
   - Offrir un support accessible

---

## Historique des modifications

| Date       | Version    | Auteur            | Description       |
|------------|------------|-------------------|-------------------|
| 2025-12-28 | 1.0.0      | Antoine MENNEBEUF | Création initiale |
