# Gestion des Domaines - Opérateur MSSanté

## Table des matières

1. [Vue d'ensemble](#vue-densemble)
2. [Création d'un domaine](#création-dun-domaine)
3. [Configuration d'un domaine](#configuration-dun-domaine)
4. [Gestion des quotas](#gestion-des-quotas)
5. [Gestion des administrateurs](#gestion-des-administrateurs)
6. [Gestion des certificats](#gestion-des-certificats)
7. [Statistiques par domaine](#statistiques-par-domaine)
8. [Suspension et suppression](#suspension-et-suppression)
9. [Migration et fusion](#migration-et-fusion)

---

## Vue d'ensemble

### Concept de domaine

En tant qu'opérateur MSSanté, vous hébergez plusieurs établissements ou structures, chacun avec son propre **domaine** :
```
Opérateur MSSanté "VotreOpérateur"
├── hopital-paris.mssante.fr
│   ├── 150 BAL actives
│   ├── 3 administrateurs
│   └── Quota: 200 BAL / 200 GB
│
├── clinique-lyon.mssante.fr
│   ├── 45 BAL actives
│   ├── 1 administrateur
│   └── Quota: 100 BAL / 100 GB
│
├── centre-sante-marseille.mssante.fr
│   ├── 78 BAL actives
│   ├── 2 administrateurs
│   └── Quota: 150 BAL / 150 GB
│
└── laboratoire-lille.mssante.fr
    ├── 23 BAL actives
    ├── 1 administrateur
    └── Quota: 50 BAL / 50 GB
```

### Hiérarchie et isolation
```
┌─────────────────────────────────────────────────────┐
│           SUPER ADMIN (Opérateur)                   │
│  - Voit et gère TOUS les domaines                   │
│  - Crée de nouveaux domaines                        │
│  - Configure les quotas globaux                     │
└─────────────────────────────────────────────────────┘
                       │
         ┌─────────────┼─────────────┐
         │             │             │
┌────────▼────────┐ ┌──▼─────────┐ ┌─▼────────────┐
│  Domaine A      │ │ Domaine B  │ │  Domaine C   │
│  (Isolé)        │ │ (Isolé)    │ │  (Isolé)     │
├─────────────────┤ ├────────────┤ ├──────────────┤
│ - BAL propres   │ │ - BAL      │ │ - BAL        │
│ - Utilisateurs  │ │ - Util.    │ │ - Util.      │
│ - Admins        │ │ - Admins   │ │ - Admins     │
│ - Stats         │ │ - Stats    │ │ - Stats      │
└─────────────────┘ └────────────┘ └──────────────┘

Isolation complète : Un admin du domaine A ne peut PAS voir/gérer le domaine B
```

### Attributs d'un domaine

| Attribut | Description | Exemple |
|----------|-------------|---------|
| **Nom de domaine** | Identifiant unique | `hopital-paris.mssante.fr` |
| **FINESS Juridique** | Identifiant établissement | `750000001` |
| **FINESS Géographique** | Optionnel, pour multi-sites | `750000002` |
| **Nom organisation** | Nom complet | `Hôpital de Paris` |
| **Type** | Catégorie | `hospital`, `clinic`, `lab` |
| **Quotas** | Limites | 200 BAL, 200 GB |
| **Statut** | État actuel | `active`, `suspended`, `pending` |
| **Certificat** | Certificat dédié (optionnel) | Serial: `ABC123...` |

---

## Création d'un domaine

### 1. Prérequis

Avant de créer un domaine, vérifier :

- ✅ Contrat signé avec l'établissement
- ✅ FINESS Juridique valide
- ✅ Nom de domaine disponible (`.mssante.fr`)
- ✅ Quotas définis (nombre de BAL, stockage)
- ✅ Administrateur identifié

### 2. Via l'interface web (Super Admin)

**Étape par étape :**

1. Se connecter en tant que Super Admin
2. Aller dans **Admin > Domaines**
3. Cliquer sur **+ Nouveau domaine**
4. Remplir le formulaire :
```
┌─────────────────────────────────────────────────────┐
│         Créer un nouveau domaine                    │
├─────────────────────────────────────────────────────┤
│                                                     │
│ Nom de domaine *                                    │
│ ┌─────────────────────────────────────────────┐   │
│ │ hopital-exemple.mssante.fr                  │   │
│ └─────────────────────────────────────────────┘   │
│                                                     │
│ FINESS Juridique *                                  │
│ ┌─────────────────────────────────────────────┐   │
│ │ 750000001                                   │   │
│ └─────────────────────────────────────────────┘   │
│                                                     │
│ FINESS Géographique (optionnel)                    │
│ ┌─────────────────────────────────────────────┐   │
│ │ 750000002                                   │   │
│ └─────────────────────────────────────────────┘   │
│                                                     │
│ Nom de l'organisation *                            │
│ ┌─────────────────────────────────────────────┐   │
│ │ Hôpital Exemple                             │   │
│ └─────────────────────────────────────────────┘   │
│                                                     │
│ Type d'organisation *                              │
│ ┌─────────────────────────────────────────────┐   │
│ │ [▼] Hôpital                                 │   │
│ └─────────────────────────────────────────────┘   │
│   - Hôpital                                        │
│   - Clinique                                       │
│   - Laboratoire                                    │
│   - Cabinet privé                                  │
│   - Centre de santé                                │
│                                                     │
│ Quotas                                             │
│ ┌─────────────────────┐ ┌─────────────────────┐   │
│ │ Nombre de BAL       │ │ Stockage (GB)       │   │
│ │ ┌─────────────────┐ │ │ ┌─────────────────┐ │   │
│ │ │ 100             │ │ │ │ 100             │ │   │
│ │ └─────────────────┘ │ │ └─────────────────┘ │   │
│ └─────────────────────┘ └─────────────────────┘   │
│                                                     │
│ [ Annuler ]              [ Créer le domaine ]      │
└─────────────────────────────────────────────────────┘
```

5. Valider

**Résultat :**
- Le domaine est créé avec le statut `pending`
- Un email de confirmation est envoyé
- Le domaine apparaît dans la liste avec l'icône ⏳

### 3. Via l'API
```bash
curl -X POST https://api.votre-operateur.mssante.fr/api/v1/admin/domains \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPER_ADMIN_TOKEN" \
  -d '{
    "domain_name": "hopital-exemple.mssante.fr",
    "finess_juridique": "750000001",
    "finess_geographique": "750000002",
    "organization_name": "Hôpital Exemple",
    "organization_type": "hospital",
    "quotas": {
      "max_mailboxes": 100,
      "max_storage_gb": 100
    }
  }'
```

**Réponse :**
```json
{
  "success": true,
  "data": {
    "id": "uuid-domain",
    "domain_name": "hopital-exemple.mssante.fr",
    "status": "pending",
    "created_at": "2024-03-20T10:00:00Z"
  }
}
```

### 4. Composant React
```jsx
// services/frontend/src/pages/Admin/Domains/CreateDomain.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const CreateDomain = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    domain_name: '',
    finess_juridique: '',
    finess_geographique: '',
    organization_name: '',
    organization_type: 'hospital',
    max_mailboxes: 100,
    max_storage_gb: 100
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const organizationTypes = [
    { value: 'hospital', label: 'Hôpital' },
    { value: 'clinic', label: 'Clinique' },
    { value: 'lab', label: 'Laboratoire' },
    { value: 'private_practice', label: 'Cabinet privé' },
    { value: 'health_center', label: 'Centre de santé' },
    { value: 'pharmacy', label: 'Pharmacie' },
    { value: 'nursing_home', label: 'EHPAD' },
    { value: 'medical_imaging', label: 'Imagerie médicale' }
  ];

  const validateForm = () => {
    const newErrors = {};

    // Validation du nom de domaine
    if (!formData.domain_name) {
      newErrors.domain_name = 'Nom de domaine requis';
    } else if (!formData.domain_name.endsWith('.mssante.fr')) {
      newErrors.domain_name = 'Le domaine doit se terminer par .mssante.fr';
    } else if (!/^[a-z0-9-]+\.mssante\.fr$/.test(formData.domain_name)) {
      newErrors.domain_name = 'Format invalide (lettres minuscules, chiffres et tirets uniquement)';
    }

    // Validation FINESS Juridique
    if (!formData.finess_juridique) {
      newErrors.finess_juridique = 'FINESS Juridique requis';
    } else if (!/^\d{9}$/.test(formData.finess_juridique)) {
      newErrors.finess_juridique = 'Format invalide (9 chiffres)';
    }

    // Validation FINESS Géographique (optionnel)
    if (formData.finess_geographique && !/^\d{9}$/.test(formData.finess_geographique)) {
      newErrors.finess_geographique = 'Format invalide (9 chiffres)';
    }

    // Validation nom organisation
    if (!formData.organization_name) {
      newErrors.organization_name = 'Nom de l\'organisation requis';
    }

    // Validation quotas
    if (formData.max_mailboxes < 1) {
      newErrors.max_mailboxes = 'Minimum 1 BAL';
    }
    if (formData.max_storage_gb < 1) {
      newErrors.max_storage_gb = 'Minimum 1 GB';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    setLoading(true);

    try {
      const response = await fetch('/api/v1/admin/domains', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          ...formData,
          quotas: {
            max_mailboxes: formData.max_mailboxes,
            max_storage_gb: formData.max_storage_gb
          }
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Erreur lors de la création');
      }

      alert('Domaine créé avec succès');
      navigate('/admin/domains');

    } catch (error) {
      alert('Erreur: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Créer un nouveau domaine</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Informations du domaine */}
        <div className="bg-white shadow rounded-lg p-6 space-y-4">
          <h2 className="font-bold text-lg">Informations du domaine</h2>

          <div>
            <label className="block text-sm font-medium mb-1">
              Nom de domaine * <span className="text-gray-500">(.mssante.fr)</span>
            </label>
            <input
              type="text"
              value={formData.domain_name}
              onChange={(e) => setFormData({...formData, domain_name: e.target.value.toLowerCase()})}
              placeholder="hopital-exemple.mssante.fr"
              className={`w-full px-3 py-2 border rounded ${
                errors.domain_name ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {errors.domain_name && (
              <p className="text-red-500 text-sm mt-1">{errors.domain_name}</p>
            )}
            <p className="text-sm text-gray-600 mt-1">
              Lettres minuscules, chiffres et tirets uniquement. Exemple: hopital-paris.mssante.fr
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                FINESS Juridique *
              </label>
              <input
                type="text"
                value={formData.finess_juridique}
                onChange={(e) => setFormData({...formData, finess_juridique: e.target.value})}
                placeholder="750000001"
                maxLength="9"
                className={`w-full px-3 py-2 border rounded ${
                  errors.finess_juridique ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {errors.finess_juridique && (
                <p className="text-red-500 text-sm mt-1">{errors.finess_juridique}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                FINESS Géographique <span className="text-gray-500">(optionnel)</span>
              </label>
              <input
                type="text"
                value={formData.finess_geographique}
                onChange={(e) => setFormData({...formData, finess_geographique: e.target.value})}
                placeholder="750000002"
                maxLength="9"
                className={`w-full px-3 py-2 border rounded ${
                  errors.finess_geographique ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {errors.finess_geographique && (
                <p className="text-red-500 text-sm mt-1">{errors.finess_geographique}</p>
              )}
            </div>
          </div>
        </div>

        {/* Organisation */}
        <div className="bg-white shadow rounded-lg p-6 space-y-4">
          <h2 className="font-bold text-lg">Organisation</h2>

          <div>
            <label className="block text-sm font-medium mb-1">
              Nom de l'organisation *
            </label>
            <input
              type="text"
              value={formData.organization_name}
              onChange={(e) => setFormData({...formData, organization_name: e.target.value})}
              placeholder="Hôpital Exemple"
              className={`w-full px-3 py-2 border rounded ${
                errors.organization_name ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {errors.organization_name && (
              <p className="text-red-500 text-sm mt-1">{errors.organization_name}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Type d'organisation *
            </label>
            <select
              value={formData.organization_type}
              onChange={(e) => setFormData({...formData, organization_type: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded"
            >
              {organizationTypes.map(type => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Quotas */}
        <div className="bg-white shadow rounded-lg p-6 space-y-4">
          <h2 className="font-bold text-lg">Quotas</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Nombre maximum de BAL *
              </label>
              <input
                type="number"
                value={formData.max_mailboxes}
                onChange={(e) => setFormData({...formData, max_mailboxes: parseInt(e.target.value) || 0})}
                min="1"
                className={`w-full px-3 py-2 border rounded ${
                  errors.max_mailboxes ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {errors.max_mailboxes && (
                <p className="text-red-500 text-sm mt-1">{errors.max_mailboxes}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Stockage maximum (GB) *
              </label>
              <input
                type="number"
                value={formData.max_storage_gb}
                onChange={(e) => setFormData({...formData, max_storage_gb: parseInt(e.target.value) || 0})}
                min="1"
                className={`w-full px-3 py-2 border rounded ${
                  errors.max_storage_gb ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {errors.max_storage_gb && (
                <p className="text-red-500 text-sm mt-1">{errors.max_storage_gb}</p>
              )}
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded p-4">
            <p className="text-sm text-blue-900">
              <strong>💡 Recommandations :</strong>
              <br />• Petite structure (&#60; 20 professionnels) : 50 BAL / 50 GB
              <br />• Structure moyenne (20-100 professionnels) : 100-200 BAL / 100-200 GB
              <br />• Grande structure (&#62; 100 professionnels) : 200+ BAL / 200+ GB
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-4">
          <button
            type="button"
            onClick={() => navigate('/admin/domains')}
            className="px-6 py-2 border border-gray-300 rounded hover:bg-gray-50"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Création...' : 'Créer le domaine'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateDomain;
```

---

## Configuration d'un domaine

### 1. Paramètres généraux
```bash
curl -X PUT https://api.votre-operateur.mssante.fr/api/v1/admin/domains/DOMAIN_ID \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPER_ADMIN_TOKEN" \
  -d '{
    "organization_name": "Nouveau nom",
    "settings": {
      "default_quota_mb": 1024,
      "auto_create_bal_on_psc": true,
      "require_2fa": false,
      "allowed_ip_ranges": ["10.0.0.0/8"],
      "custom_branding": {
        "logo_url": "https://...",
        "primary_color": "#0066CC"
      }
    }
  }'
```

### 2. Paramètres de messagerie
```json
{
  "mail_settings": {
    "max_attachment_size_mb": 25,
    "retention_days": 365,
    "auto_reply_enabled": true,
    "spam_filter_level": "medium",
    "allowed_domains": [
      "*.mssante.fr",
      "hopital-partenaire.mssante.fr"
    ]
  }
}
```

### 3. Paramètres de sécurité
```json
{
  "security_settings": {
    "password_policy": {
      "min_length": 12,
      "require_uppercase": true,
      "require_lowercase": true,
      "require_numbers": true,
      "require_special": true,
      "expiry_days": 90
    },
    "session_timeout_minutes": 30,
    "max_failed_login_attempts": 5,
    "ip_whitelist_enabled": false,
    "ip_whitelist": []
  }
}
```

---

## Gestion des quotas

### 1. Visualisation de l'utilisation
```bash
curl -X GET https://api.votre-operateur.mssante.fr/api/v1/admin/domains/DOMAIN_ID/usage \
  -H "Authorization: Bearer $SUPER_ADMIN_TOKEN"
```

**Réponse :**
```json
{
  "domain_id": "uuid",
  "domain_name": "hopital-exemple.mssante.fr",
  "quotas": {
    "max_mailboxes": 100,
    "max_storage_gb": 100
  },
  "current_usage": {
    "mailboxes": {
      "total": 78,
      "active": 75,
      "suspended": 3,
      "percentage": 78
    },
    "storage": {
      "used_gb": 62.5,
      "percentage": 62.5
    }
  },
  "top_consumers": [
    {
      "email": "dr.dupont@hopital-exemple.mssante.fr",
      "storage_mb": 2048,
      "percentage": 2.0
    }
  ]
}
```

### 2. Modification des quotas
```bash
curl -X PUT https://api.votre-operateur.mssante.fr/api/v1/admin/domains/DOMAIN_ID/quotas \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPER_ADMIN_TOKEN" \
  -d '{
    "max_mailboxes": 200,
    "max_storage_gb": 200
  }'
```

### 3. Alertes de quota

Configuration des alertes automatiques :
```json
{
  "quota_alerts": {
    "enabled": true,
    "thresholds": [
      {
        "percentage": 80,
        "recipients": ["admin@hopital-exemple.mssante.fr"],
        "frequency": "daily"
      },
      {
        "percentage": 90,
        "recipients": ["admin@hopital-exemple.mssante.fr", "support@votre-operateur.fr"],
        "frequency": "immediate"
      },
      {
        "percentage": 95,
        "recipients": ["admin@hopital-exemple.mssante.fr", "support@votre-operateur.fr"],
        "frequency": "immediate",
        "escalate": true
      }
    ]
  }
}
```

---

## Gestion des administrateurs

### 1. Ajouter un administrateur de domaine
```bash
curl -X POST https://api.votre-operateur.mssante.fr/api/v1/admin/domains/DOMAIN_ID/admins \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPER_ADMIN_TOKEN" \
  -d '{
    "user_id": "USER_ID",
    "role": "admin"
  }'
```

### 2. Lister les administrateurs
```bash
curl -X GET https://api.votre-operateur.mssante.fr/api/v1/admin/domains/DOMAIN_ID/admins \
  -H "Authorization: Bearer $SUPER_ADMIN_TOKEN"
```

### 3. Retirer un administrateur
```bash
curl -X DELETE https://api.votre-operateur.mssante.fr/api/v1/admin/domains/DOMAIN_ID/admins/USER_ID \
  -H "Authorization: Bearer $SUPER_ADMIN_TOKEN"
```

---

## Gestion des certificats

### 1. Certificat partagé vs dédié

**Certificat partagé (par défaut) :**
- Un certificat pour tous les domaines : `*.mssante.fr`
- Simple à gérer
- Recommandé pour la majorité des cas

**Certificat dédié (optionnel) :**
- Un certificat spécifique par domaine
- Nécessaire pour certains établissements
- Installation manuelle requise

### 2. Installer un certificat dédié
```bash
# 1. Télécharger le certificat
./scripts/certificates/install-domain-cert.sh \
  hopital-exemple.mssante.fr \
  /path/to/cert.pem \
  /path/to/key.pem

# 2. Mettre à jour la base de données
curl -X PUT https://api.votre-operateur.mssante.fr/api/v1/admin/domains/DOMAIN_ID \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPER_ADMIN_TOKEN" \
  -d '{
    "certificate_serial": "ABC123456789",
    "certificate_expiry": "2025-12-31T23:59:59Z"
  }'
```

### 3. Vérifier l'expiration
```bash
curl -X GET https://api.votre-operateur.mssante.fr/api/v1/admin/domains/DOMAIN_ID/certificate \
  -H "Authorization: Bearer $SUPER_ADMIN_TOKEN"
```

---

## Statistiques par domaine

### 1. Vue d'ensemble
```bash
curl -X GET https://api.votre-operateur.mssante.fr/api/v1/admin/domains/DOMAIN_ID/statistics \
  -H "Authorization: Bearer $SUPER_ADMIN_TOKEN"
```

**Réponse :**
```json
{
  "domain_id": "uuid",
  "domain_name": "hopital-exemple.mssante.fr",
  "period": "last_30_days",
  "mailboxes": {
    "total": 78,
    "personal": 65,
    "organizational": 10,
    "applicative": 3,
    "created": 5,
    "deleted": 2
  },
  "messages": {
    "sent": 12450,
    "received": 18230,
    "total": 30680
  },
  "storage": {
    "used_gb": 62.5,
    "average_per_mailbox_mb": 820
  },
  "activity": {
    "active_users_last_7_days": 68,
    "active_users_last_30_days": 75
  }
}
```

### 2. Rapport mensuel

Génération automatique d'un rapport PDF pour chaque domaine.

---

## Suspension et suppression

### 1. Suspendre un domaine

La suspension désactive temporairement tous les services :
```bash
curl -X PUT https://api.votre-operateur.mssante.fr/api/v1/admin/domains/DOMAIN_ID/suspend \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPER_ADMIN_TOKEN" \
  -d '{
    "reason": "Impayé",
    "notify_admin": true
  }'
```

**Effets :**
- ❌ Envoi/réception d'emails désactivé
- ❌ Connexion webmail désactivée
- ✅ Données conservées
- ✅ Peut être réactivé

### 2. Réactiver un domaine
```bash
curl -X PUT https://api.votre-operateur.mssante.fr/api/v1/admin/domains/DOMAIN_ID/activate \
  -H "Authorization: Bearer $SUPER_ADMIN_TOKEN"
```

### 3. Supprimer un domaine

⚠️ **Attention : Suppression définitive après 90 jours**
```bash
# 1. Marquer pour suppression
curl -X DELETE https://api.votre-operateur.mssante.fr/api/v1/admin/domains/DOMAIN_ID \
  -H "Authorization: Bearer $SUPER_ADMIN_TOKEN"

# Le domaine entre en période de grâce de 90 jours
# Statut: "pending_deletion"

# 2. Annuler la suppression (possible pendant 90 jours)
curl -X PUT https://api.votre-operateur.mssante.fr/api/v1/admin/domains/DOMAIN_ID/cancel-deletion \
  -H "Authorization: Bearer $SUPER_ADMIN_TOKEN"

# 3. Après 90 jours : suppression définitive automatique
```

---

## Migration et fusion

### 1. Migrer des BAL entre domaines
```bash
curl -X POST https://api.votre-operateur.mssante.fr/api/v1/admin/domains/migrate-mailboxes \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPER_ADMIN_TOKEN" \
  -d '{
    "source_domain_id": "DOMAIN_A_ID",
    "target_domain_id": "DOMAIN_B_ID",
    "mailbox_ids": ["MAI1", "MAILBOX_ID_2"],
    "preserve_emails": true
  }'
```

### 2. Fusionner deux domaines
```bash
curl -X POST https://api.votre-operateur.mssante.fr/api/v1/admin/domains/merge \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPER_ADMIN_TOKEN" \
  -d '{
    "source_domain_id": "DOMAIN_A_ID",
    "target_domain_id": "DOMAIN_B_ID",
    "strategy": "merge",
    "delete_source": true
  }'
```

---

## Cas d'usage courants

### 1. Nouvelle clinique rejoint l'opérateur
```bash
# 1. Créer le domaine
# 2. Créer l'admin
# 3. Configurer les quotas
# 4. Envoyer les identifiants
# 5. Former l'administrateur
```

### 2. Fusion de deux établissements
```bash
# 1. Identifier le domaine principal
# 2. Migrer les BAL du domaine secondaire
# 3. Mettre à jour les utilisateurs
# 4. Archiver l'ancien domaine
```

### 3. Départ d'un établissement
```bash
# 1. Exporter les données (90 jours)
# 2. Suspendre le domaine
# 3. Notifier les utilisateurs
# 4. Supprimer après confirmation
```

---

## Bonnes pratiques

1. **Nommage :**
   - Utiliser des noms courts et explicites
   - Éviter les acronymes obscurs
   - Format : `etablissement-ville.mssante.fr`

2. **Quotas :**
   - Commencer conservateur
   - Augmenter selon les besoins réels
   - Surveiller l'utilisation mensuellement

3. **Administration :**
   - 1-2 admins par domaine
   - Revoir les accès tous les 6 mois
   - Former les nouveaux admins

4. **Communication :**
   - Prévenir 30 jours avant toute modification
   - Documenter les changements
   - Offrir un support dédié

---
