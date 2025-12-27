# Architecture Multi-Domaines pour Opérateur MSSanté

## Vue d'ensemble

En tant qu'opérateur MSSanté, vous hébergez plusieurs établissements/structures, chacun avec son propre domaine :

```
Opérateur MSSanté "VotreOperateur"
├── hopital-paris.mssante.fr         (Hôpital de Paris)
├── clinique-lyon.mssante.fr         (Clinique de Lyon)
├── centre-sante-marseille.mssante.fr (Centre de Santé Marseille)
├── laboratoire-lille.mssante.fr      (Laboratoire Lille)
└── cabinet-dupont.mssante.fr         (Cabinet Dr. Dupont)
```

---

## Étape 1 : Modèle de données multi-domaines

### 1.1 Schéma de base de données étendu

```sql
-- Table des domaines (tenants)
CREATE TABLE domains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain_name VARCHAR(255) UNIQUE NOT NULL,
    finess_juridique VARCHAR(20) NOT NULL,
    organization_name VARCHAR(255) NOT NULL,
    organization_type VARCHAR(50), -- hospital, clinic, lab, private_practice
    status VARCHAR(20) DEFAULT 'pending',
    certificate_serial VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    activated_at TIMESTAMP,
    suspended_at TIMESTAMP,
    settings JSONB DEFAULT '{}',
    quotas JSONB DEFAULT '{"max_mailboxes": 100, "max_storage_gb": 100}',
    CONSTRAINT chk_domain_status CHECK (status IN ('pending', 'active', 'suspended', 'deleted'))
);

-- Index
CREATE INDEX idx_domains_name ON domains(domain_name);
CREATE INDEX idx_domains_finess ON domains(finess_juridique);
CREATE INDEX idx_domains_status ON domains(status);

-- Table des administrateurs de domaine
CREATE TABLE domain_admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain_id UUID REFERENCES domains(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) DEFAULT 'admin',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_admin_role CHECK (role IN ('admin', 'super_admin', 'billing')),
    UNIQUE(domain_id, user_id)
);

-- Modification table users (ajout domain_id)
ALTER TABLE users ADD COLUMN domain_id UUID REFERENCES domains(id);
CREATE INDEX idx_users_domain ON users(domain_id);

-- Modification table mailboxes (ajout domain_id)
ALTER TABLE mailboxes ADD COLUMN domain_id UUID REFERENCES domains(id);
CREATE INDEX idx_mailboxes_domain ON mailboxes(domain_id);

-- Contrainte: email doit correspondre au domaine
ALTER TABLE mailboxes ADD CONSTRAINT chk_email_domain 
    CHECK (email LIKE '%@' || (SELECT domain_name FROM domains WHERE id = domain_id));

-- Table des quotas par domaine
CREATE TABLE domain_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain_id UUID REFERENCES domains(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    mailboxes_count INTEGER DEFAULT 0,
    storage_used_mb BIGINT DEFAULT 0,
    messages_sent INTEGER DEFAULT 0,
    messages_received INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(domain_id, date)
);

-- Vues utiles
CREATE VIEW domain_stats AS
SELECT 
    d.id,
    d.domain_name,
    d.organization_name,
    d.status,
    COUNT(DISTINCT m.id) as mailboxes_count,
    COUNT(DISTINCT u.id) as users_count,
    COALESCE(SUM(s.storage_used_mb), 0) as total_storage_mb
FROM domains d
LEFT JOIN mailboxes m ON d.id = m.domain_id AND m.status = 'active'
LEFT JOIN users u ON d.id = u.domain_id AND u.status = 'active'
LEFT JOIN statistics s ON m.id = s.mailbox_id
GROUP BY d.id, d.domain_name, d.organization_name, d.status;
```

### 1.2 Données de test

```sql
-- Insertion de domaines de test
INSERT INTO domains (domain_name, finess_juridique, organization_name, organization_type, status) VALUES
('hopital-paris.mssante.fr', '750000001', 'Hôpital de Paris', 'hospital', 'active'),
('clinique-lyon.mssante.fr', '690000002', 'Clinique Saint-Jean Lyon', 'clinic', 'active'),
('laboratoire-lille.mssante.fr', '590000003', 'Laboratoire BioMed Lille', 'lab', 'active');

-- Insertion d'utilisateurs par domaine
INSERT INTO users (rpps_id, first_name, last_name, email, domain_id) VALUES
('10001234567', 'Jean', 'Dupont', 'jean.dupont@hopital-paris.mssante.fr', 
    (SELECT id FROM domains WHERE domain_name = 'hopital-paris.mssante.fr')),
('10001234568', 'Marie', 'Martin', 'marie.martin@clinique-lyon.mssante.fr',
    (SELECT id FROM domains WHERE domain_name = 'clinique-lyon.mssante.fr'));

-- Insertion de BAL par domaine
INSERT INTO mailboxes (email, type, owner_id, domain_id, status) VALUES
('jean.dupont@hopital-paris.mssante.fr', 'personal',
    (SELECT id FROM users WHERE rpps_id = '10001234567'),
    (SELECT id FROM domains WHERE domain_name = 'hopital-paris.mssante.fr'), 'active'),
('secretariat.cardio@hopital-paris.mssante.fr', 'organizational',
    (SELECT id FROM users WHERE rpps_id = '10001234567'),
    (SELECT id FROM domains WHERE domain_name = 'hopital-paris.mssante.fr'), 'active');
```

---

## Étape 2 : Configuration Postfix multi-domaines

### 2.1 main.cf adapté

```conf
# services/postfix/main.cf

# Domaines virtuels depuis PostgreSQL
virtual_mailbox_domains = pgsql:/etc/postfix/pgsql-virtual-domains.cf
virtual_mailbox_maps = pgsql:/etc/postfix/pgsql-virtual-mailboxes.cf
virtual_alias_maps = pgsql:/etc/postfix/pgsql-virtual-aliases.cf

# Transport
virtual_transport = lmtp:unix:private/dovecot-lmtp

# Restrictions par domaine
smtpd_recipient_restrictions =
    check_recipient_access pgsql:/etc/postfix/pgsql-recipient-access.cf,
    permit_mynetworks,
    permit_sasl_authenticated,
    reject_unauth_destination

# Certificats SNI (Server Name Indication) pour multi-domaines
tls_server_sni_maps = pgsql:/etc/postfix/pgsql-sni-maps.cf
```

### 2.2 Requêtes PostgreSQL

#### pgsql-virtual-domains.cf

```conf
# services/postfix/pgsql-virtual-domains.cf
hosts = postgres
user = mssante
password = ${POSTGRES_PASSWORD}
dbname = mssante

# Query pour récupérer les domaines actifs
query = SELECT domain_name FROM domains 
        WHERE domain_name = '%s' 
        AND status = 'active'
```

#### pgsql-virtual-mailboxes.cf

```conf
# services/postfix/pgsql-virtual-mailboxes.cf
hosts = postgres
user = mssante
password = ${POSTGRES_PASSWORD}
dbname = mssante

# Query pour vérifier l'existence d'une BAL
query = SELECT m.email FROM mailboxes m
        JOIN domains d ON m.domain_id = d.id
        WHERE m.email = '%s'
        AND m.status = 'active'
        AND d.status = 'active'
```

#### pgsql-recipient-access.cf

```conf
# services/postfix/pgsql-recipient-access.cf
hosts = postgres
user = mssante
password = ${POSTGRES_PASSWORD}
dbname = mssante

# Vérifier les quotas par domaine
query = SELECT 
        CASE 
            WHEN d.status = 'suspended' THEN 'REJECT Domain suspended'
            WHEN (SELECT COUNT(*) FROM mailboxes WHERE domain_id = d.id) >= 
                 CAST(d.quotas->>'max_mailboxes' AS INTEGER) 
            THEN 'DEFER Domain quota exceeded'
            ELSE 'OK'
        END as access
        FROM domains d
        JOIN mailboxes m ON m.domain_id = d.id
        WHERE m.email = '%s'
```

#### pgsql-sni-maps.cf (certificats par domaine)

```conf
# services/postfix/pgsql-sni-maps.cf
hosts = postgres
user = mssante
password = ${POSTGRES_PASSWORD}
dbname = mssante

# Retourne le chemin du certificat selon le domaine
query = SELECT 
        CONCAT('/etc/ssl/domains/', domain_name, '/cert.pem') as cert_file
        FROM domains
        WHERE domain_name = '%s'
        AND status = 'active'
```

### 2.3 Structure des certificats par domaine

```
config/certificates/
├── igc-sante/
│   ├── ca-bundle.pem
│   └── crl.pem
└── domains/
    ├── hopital-paris.mssante.fr/
    │   ├── cert.pem
    │   ├── key.pem
    │   └── chain.pem
    ├── clinique-lyon.mssante.fr/
    │   ├── cert.pem
    │   ├── key.pem
    │   └── chain.pem
    └── laboratoire-lille.mssante.fr/
        ├── cert.pem
        ├── key.pem
        └── chain.pem
```

---

## Étape 3 : Configuration Dovecot multi-domaines

### 3.1 dovecot.conf adapté

```conf
# services/dovecot/dovecot.conf

# Protocoles
protocols = imap lmtp

# SSL/TLS avec SNI
ssl = required
ssl_cert = </etc/ssl/domains/%d/cert.pem
ssl_key = </etc/ssl/domains/%d/key.pem
ssl_ca = </etc/ssl/igc-sante/ca-bundle.pem

# Variables: %d = domaine, %n = user local part, %u = user complet

# Mail location par domaine
mail_location = maildir:/var/mail/%d/%n

# Authentification SQL
passdb {
  driver = sql
  args = /etc/dovecot/dovecot-sql.conf.ext
}

userdb {
  driver = sql
  args = /etc/dovecot/dovecot-sql.conf.ext
}

# Quotas par domaine
plugin {
  quota = maildir:User quota
  quota_rule = *:storage=1G
  quota_rule2 = *:messages=10000
  
  # Quota depuis la base de données
  quota_sql = /etc/dovecot/dovecot-quota-sql.conf.ext
}
```

### 3.2 dovecot-sql.conf.ext

```conf
# services/dovecot/dovecot-sql.conf.ext
driver = pgsql
connect = host=postgres dbname=mssante user=mssante password=${POSTGRES_PASSWORD}

# Requête d'authentification
password_query = \
  SELECT m.email as user, u.password_hash as password, \
         CONCAT('/var/mail/', d.domain_name, '/', SPLIT_PART(m.email, '@', 1)) as userdb_home, \
         5000 as userdb_uid, 5000 as userdb_gid \
  FROM mailboxes m \
  JOIN users u ON m.owner_id = u.id \
  JOIN domains d ON m.domain_id = d.id \
  WHERE m.email = '%u' \
  AND m.status = 'active' \
  AND d.status = 'active'

# Requête utilisateur
user_query = \
  SELECT CONCAT('/var/mail/', d.domain_name, '/', SPLIT_PART(m.email, '@', 1)) as home, \
         5000 as uid, 5000 as gid, \
         CONCAT('*:storage=', CAST(d.quotas->>'max_storage_gb' AS INTEGER) * 1024, 'M') as quota_rule \
  FROM mailboxes m \
  JOIN domains d ON m.domain_id = d.id \
  WHERE m.email = '%u' \
  AND m.status = 'active'
```

---

## Étape 4 : API Backend multi-domaines

### 4.1 Middleware d'identification du domaine

```javascript
// services/api/src/middleware/domainContext.js
const { Pool } = require('pg');
const pool = new Pool({
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD
});

/**
 * Middleware pour identifier et attacher le domaine au contexte
 */
const domainContext = async (req, res, next) => {
  try {
    // Extraction du domaine depuis:
    // 1. Header X-Domain (pour API)
    // 2. Subdomain (pour web)
    // 3. Token JWT (pour utilisateurs authentifiés)
    
    let domainName = req.headers['x-domain'];
    
    if (!domainName && req.hostname) {
      // Extraction depuis subdomain
      const parts = req.hostname.split('.');
      if (parts.length >= 3) {
        domainName = parts.slice(-3).join('.');
      }
    }
    
    if (!domainName && req.user) {
      // Extraction depuis le token utilisateur
      domainName = req.user.domain;
    }
    
    if (!domainName) {
      return res.status(400).json({ 
        error: 'Domaine non spécifié' 
      });
    }
    
    // Récupération du domaine depuis la DB
    const result = await pool.query(
      'SELECT * FROM domains WHERE domain_name = $1 AND status = $2',
      [domainName, 'active']
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Domaine non trouvé ou inactif' 
      });
    }
    
    // Attacher le domaine au contexte de la requête
    req.domain = result.rows[0];
    
    next();
  } catch (error) {
    console.error('Erreur domainContext:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

module.exports = { domainContext };
```

### 4.2 Routes avec contexte domaine

```javascript
// services/api/src/routes/mailboxes.js
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { domainContext } = require('../middleware/domainContext');
const { checkQuota } = require('../middleware/quota');

// Toutes les routes nécessitent auth + domainContext
router.use(authenticate);
router.use(domainContext);

/**
 * Liste des BAL du domaine courant
 */
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT m.*, u.first_name, u.last_name
       FROM mailboxes m
       LEFT JOIN users u ON m.owner_id = u.id
       WHERE m.domain_id = $1
       AND m.status = 'active'
       ORDER BY m.created_at DESC`,
      [req.domain.id]
    );
    
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * Créer une BAL dans le domaine courant
 */
router.post('/', checkQuota, async (req, res) => {
  try {
    const { email, type, owner_rpps } = req.body;
    
    // Vérifier que l'email correspond au domaine
    if (!email.endsWith('@' + req.domain.domain_name)) {
      return res.status(400).json({ 
        error: 'L\'email doit appartenir au domaine ' + req.domain.domain_name 
      });
    }
    
    // Création de la BAL
    const { rows } = await pool.query(
      `INSERT INTO mailboxes (email, type, domain_id, owner_id, status)
       VALUES ($1, $2, $3, 
         (SELECT id FROM users WHERE rpps_id = $4 AND domain_id = $3),
         'active')
       RETURNING *`,
      [email, type, req.domain.id, owner_rpps]
    );
    
    // Création technique de la boîte mail
    await createMailboxTechnical(rows[0], req.domain);
    
    res.status(201).json(rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erreur création BAL' });
  }
});

module.exports = router;
```

### 4.3 Middleware de vérification des quotas

```javascript
// services/api/src/middleware/quota.js

/**
 * Vérifie que le domaine n'a pas dépassé ses quotas
 */
const checkQuota = async (req, res, next) => {
  try {
    const domain = req.domain;
    const quotas = domain.quotas;
    
    // Compter les BAL actuelles
    const { rows } = await pool.query(
      'SELECT COUNT(*) as count FROM mailboxes WHERE domain_id = $1 AND status = $2',
      [domain.id, 'active']
    );
    
    const currentCount = parseInt(rows[0].count);
    const maxMailboxes = quotas.max_mailboxes || 100;
    
    if (currentCount >= maxMailboxes) {
      return res.status(403).json({
        error: 'Quota de boîtes aux lettres atteint',
        current: currentCount,
        max: maxMailboxes
      });
    }
    
    next();
  } catch (error) {
    console.error('Erreur checkQuota:', error);
    res.status(500).json({ error: 'Erreur vérification quota' });
  }
};

module.exports = { checkQuota };
```

---

## Étape 5 : Interface d'administration multi-domaines

### 5.1 Sélecteur de domaine

```jsx
// services/frontend/src/components/DomainSelector.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const DomainSelector = () => {
  const [domains, setDomains] = useState([]);
  const [selectedDomain, setSelectedDomain] = useState(null);
  const navigate = useNavigate();
  
  useEffect(() => {
    // Charger les domaines de l'utilisateur
    fetch('/api/v1/domains', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    })
    .then(res => res.json())
    .then(data => {
      setDomains(data);
      if (data.length > 0) {
        const savedDomain = localStorage.getItem('selectedDomain');
        const domain = data.find(d => d.id === savedDomain) || data[0];
        setSelectedDomain(domain);
      }
    });
  }, []);
  
  const handleDomainChange = (domainId) => {
    const domain = domains.find(d => d.id === domainId);
    setSelectedDomain(domain);
    localStorage.setItem('selectedDomain', domainId);
    
    // Recharger les données pour ce domaine
    window.location.reload();
  };
  
  if (!selectedDomain) return null;
  
  return (
    <div className="domain-selector">
      <select 
        value={selectedDomain.id}
        onChange={(e) => handleDomainChange(e.target.value)}
        className="border rounded-md px-3 py-2 bg-white"
      >
        {domains.map(domain => (
          <option key={domain.id} value={domain.id}>
            {domain.organization_name} ({domain.domain_name})
          </option>
        ))}
      </select>
      
      <div className="mt-2 text-sm text-gray-600">
        <div>
          FINESS: {selectedDomain.finess_juridique}
        </div>
        <div>
          BAL actives: {selectedDomain.mailboxes_count || 0} / {selectedDomain.quotas.max_mailboxes}
        </div>
      </div>
    </div>
  );
};

export default DomainSelector;
```

### 5.2 Dashboard par domaine

```jsx
// services/frontend/src/pages/Dashboard.jsx
import React, { useEffect, useState } from 'react';
import { getDomainStats } from '../services/api';

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const domain = JSON.parse(localStorage.getItem('selectedDomain'));
  
  useEffect(() => {
    if (domain) {
      getDomainStats(domain.id).then(setStats);
    }
  }, [domain]);
  
  if (!stats) return <div>Chargement...</div>;
  
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">
        Dashboard - {domain.organization_name}
      </h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <StatCard
          title="BAL actives"
          value={stats.mailboxes_count}
          max={domain.quotas.max_mailboxes}
          icon="📬"
        />
        <StatCard
          title="Utilisateurs"
          value={stats.users_count}
          icon="👥"
        />
        <StatCard
          title="Stockage utilisé"
          value={`${stats.storage_used_gb} GB`}
          max={domain.quotas.max_storage_gb}
          icon="💾"
        />
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <MessagesChart domainId={domain.id} />
        <RecentActivity domainId={domain.id} />
      </div>
    </div>
  );
};
```

---

## Étape 6 : Interface Super-Admin (Gestion des domaines)

### 6.1 Liste des domaines

```jsx
// services/frontend/src/pages/admin/DomainsList.jsx
import React, { useState, useEffect } from 'react';

const DomainsList = () => {
  const [domains, setDomains] = useState([]);
  
  useEffect(() => {
    fetch('/api/v1/admin/domains', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'X-Admin': 'true'
      }
    })
    .then(res => res.json())
    .then(setDomains);
  }, []);
  
  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Gestion des domaines</h1>
        <button 
          onClick={() => navigate('/admin/domains/create')}
          className="bg-blue-600 text-white px-4 py-2 rounded-md"
        >
          + Nouveau domaine
        </button>
      </div>
      
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <table className="min-w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left">Domaine</th>
              <th className="px-6 py-3 text-left">Organisation</th>
              <th className="px-6 py-3 text-left">FINESS</th>
              <th className="px-6 py-3 text-left">BAL</th>
              <th className="px-6 py-3 text-left">Statut</th>
              <th className="px-6 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {domains.map(domain => (
              <tr key={domain.id}>
                <td className="px-6 py-4">
                  <div className="font-medium">{domain.domain_name}</div>
                  <div className="text-sm text-gray-500">
                    Créé le {new Date(domain.created_at).toLocaleDateString()}
                  </div>
                </td>
                <td className="px-6 py-4">{domain.organization_name}</td>
                <td className="px-6 py-4">{domain.finess_juridique}</td>
                <td className="px-6 py-4">
                  {domain.mailboxes_count} / {domain.quotas.max_mailboxes}
                </td>
                <td className="px-6 py-4">
                  <span className={`badge badge-${domain.status}`}>
                    {domain.status}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <button className="text-blue-600 hover:underline mr-3">
                    Éditer
                  </button>
                  <button className="text-red-600 hover:underline">
                    Suspendre
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
```

### 6.2 Création de domaine

```jsx
// services/frontend/src/pages/admin/DomainCreate.jsx
const DomainCreate = () => {
  const [formData, setFormData] = useState({
    domain_name: '',
    finess_juridique: '',
    organization_name: '',
    organization_type: 'hospital',
    max_mailboxes: 100,
    max_storage_gb: 100
  });
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const response = await fetch('/api/v1/admin/domains', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(formData)
      });
      
      if (response.ok) {
        toast.success('Domaine créé avec succès');
        navigate('/admin/domains');
      }
    } catch (error) {
      toast.error('Erreur lors de la création');
    }
  };
  
  return (
    <form onSubmit={handleSubmit} className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Nouveau domaine</h1>
      
      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium mb-2">
            Nom de domaine *
          </label>
          <input
            type="text"
            value={formData.domain_name}
            onChange={(e) => setFormData({...formData, domain_name: e.target.value})}
            placeholder="hopital-exemple.mssante.fr"
            className="w-full border rounded-md px-3 py-2"
            required
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-2">
            FINESS Juridique *
          </label>
          <input
            type="text"
            value={formData.finess_juridique}
            onChange={(e) => setFormData({...formData, finess_juridique: e.target.value})}
            placeholder="750000001"
            className="w-full border rounded-md px-3 py-2"
            required
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-2">
            Nom de l'organisation *
          </label>
          <input
            type="text"
            value={formData.organization_name}
            onChange={(e) => setFormData({...formData, organization_name: e.target.value})}
            placeholder="Hôpital Exemple"
            className="w-full border rounded-md px-3 py-2"
            required
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-2">
            Type d'organisation
          </label>
          <select
            value={formData.organization_type}
            onChange={(e) => setFormData({...formData, organization_type: e.target.value})}
            className="w-full border rounded-md px-3 py-2"
          >
            <option value="hospital">Hôpital</option>
            <option value="clinic">Clinique</option>
            <option value="lab">Laboratoire</option>
            <option value="private_practice">Cabinet privé</option>
            <option value="health_center">Centre de santé</option>
          </select>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Quota BAL
            </label>
            <input
              type="number"
              value={formData.max_mailboxes}
              onChange={(e) => setFormData({...formData, max_mailboxes: parseInt(e.target.value)})}
              className="w-full border rounded-md px-3 py-2"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">
              Quota Stockage (GB)
            </label>
            <input
              type="number"
              value={formData.max_storage_gb}
              onChange={(e) => setFormData({...formData, max_storage_gb: parseInt(e.target.value)})}
              className="w-full border rounded-md px-3 py-2"
            />
          </div>
        </div>
        
        <button
          type="submit"
          className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700"
        >
          Créer le domaine
        </button>
      </div>
    </form>
  );
};
```

---

## Étape 7 : Gestion des certificats par domaine

### 7.1 Script d'installation de certificat

```bash
#!/bin/bash
# scripts/install-domain-cert.sh

DOMAIN=$1
CERT_FILE=$2
KEY_FILE=$3

if [ -z "$DOMAIN" ] || [ -z "$CERT_FILE" ] || [ -z "$KEY_FILE" ]; then
    echo "Usage: $0 <domain> <cert_file> <key_file>"
    exit 1
fi

CERT_DIR="./config/certificates/domains/$DOMAIN"

# Création du répertoire
mkdir -p "$CERT_DIR"

# Copie des certificats
cp "$CERT_FILE" "$CERT_DIR/cert.pem"
cp "$KEY_FILE" "$CERT_DIR/key.pem"

# Permissions
chmod 644 "$CERT_DIR/cert.pem"
chmod 600 "$CERT_DIR/key.pem"

# Vérification du certificat
openssl x509 -in "$CERT_DIR/cert.pem" -noout -subject -dates

# Mise à jour de la base de données
docker compose exec -T postgres psql -U mssante -d mssante <<-SQL
    UPDATE domains 
    SET certificate_serial = '$(openssl x509 -in "$CERT_DIR/cert.pem" -noout -serial | cut -d= -f2)'
    WHERE domain_name = '$DOMAIN';
SQL

# Rechargement Postfix et Dovecot
docker compose exec postfix postfix reload
docker compose exec dovecot doveadm reload

echo "✅ Certificat installé pour $DOMAIN"
```

### 7.2 API de gestion des certificats

```javascript
// services/api/src/routes/admin/certificates.js
router.post('/domains/:domainId/certificate', async (req, res) => {
  try {
    const { domainId } = req.params;
    const { certificate_pem, private_key_pem } = req.body;
    
    // Vérifier que l'utilisateur est admin du domaine
    const isAdmin = await checkDomainAdmin(req.user.id, domainId);
    if (!isAdmin) {
      return res.status(403).json({ error: 'Non autorisé' });
    }
    
    // Récupérer le domaine
    const domain = await getDomain(domainId);
    
    // Sauvegarder les fichiers
    const certDir = `/certificates/domains/${domain.domain_name}`;
    await fs.promises.mkdir(certDir, { recursive: true });
    await fs.promises.writeFile(`${certDir}/cert.pem`, certificate_pem);
    await fs.promises.writeFile(`${certDir}/key.pem`, private_key_pem, { mode: 0o600 });
    
    // Extraire le serial
    const certInfo = forge.pki.certificateFromPem(certificate_pem);
    const serial = certInfo.serialNumber;
    
    // Mettre à jour la DB
    await pool.query(
      'UPDATE domains SET certificate_serial = $1 WHERE id = $2',
      [serial, domainId]
    );
    
    // Recharger Postfix/Dovecot
    exec('docker compose exec postfix postfix reload');
    exec('docker compose exec dovecot doveadm reload');
    
    res.json({ message: 'Certificat installé avec succès' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erreur installation certificat' });
  }
});
```

---

## Étape 8 : docker-compose.yml final multi-domaines

```yaml
version: '3.8'

services:
  # ... (services existants)
  
  postfix:
    build:
      context: ./services/postfix
      dockerfile: Dockerfile
    container_name: mssante-postfix
    restart: unless-stopped
    environment:
      POSTGRES_HOST: postgres
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      # Maildir par domaine
      - ./data/mail:/var/mail
      
      # Certificats par domaine
      - ./config/certificates/domains:/etc/ssl/domains:ro
      - ./config/certificates/igc-sante:/etc/ssl/igc-sante:ro
      
      # Configurations dynamiques
      - ./services/postfix/pgsql-virtual-domains.cf:/etc/postfix/pgsql-virtual-domains.cf:ro
      - ./services/postfix/pgsql-virtual-mailboxes.cf:/etc/postfix/pgsql-virtual-mailboxes.cf:ro
      - ./services/postfix/pgsql-recipient-access.cf:/etc/postfix/pgsql-recipient-access.cf:ro
      - ./services/postfix/pgsql-sni-maps.cf:/etc/postfix/pgsql-sni-maps.cf:ro
      
      - ./data/logs/postfix:/var/log/postfix
    networks:
      - mssante-network
    depends_on:
      - postgres
```

---

## Résumé de l'architecture multi-domaines

### Structure de stockage

```
data/mail/
├── hopital-paris.mssante.fr/
│   ├── jean.dupont/
│   │   ├── cur/
│   │   ├── new/
│   │   └── tmp/
│   └── secretariat.cardio/
├── clinique-lyon.mssante.fr/
│   └── marie.martin/
└── laboratoire-lille.mssante.fr/
    └── contact/
```

### Avantages de cette architecture

- ✅ **Isolation complète** entre domaines
- ✅ **Quotas individuels** par domaine
- ✅ **Certificats séparés** pour chaque domaine
- ✅ **Administration déléguée** par domaine
- ✅ **Facturation séparée** possible
- ✅ **Scalabilité** : ajout facile de nouveaux domaines
- ✅ **Sécurité** : cloisonnement des données

### Points d'attention

- ⚠️ **Certificats IGC Santé** : Un certificat par domaine
- ⚠️ **DNS** : Enregistrements MX pour chaque domaine
- ⚠️ **Liste blanche ANS** : Chaque domaine doit être déclaré
- ⚠️ **Quotas** : Surveillance par domaine
- ⚠️ **Sauvegarde** : Par domaine pour faciliter la restauration