# Intégration Annuaire National MSSanté

## Vue d'ensemble

En tant qu'opérateur MSSanté, vous devez :

1. **Alimenter l'Annuaire National** avec les BAL que vous opérez
2. **Consulter le compte rendu d'alimentation** pour vérifier les erreurs
3. **Déposer mensuellement les indicateurs** d'activité

```
┌─────────────────────────────────────────────────────┐
│          Votre Plateforme Opérateur                 │
│                                                     │
│  ┌──────────────┐    ┌──────────────┐              │
│  │ Gestion BAL  │───>│ Flux Annuaire│              │
│  └──────────────┘    └───────┬──────┘              │
│                              │                      │
│  ┌──────────────┐            │                      │
│  │ Statistiques │            │                      │
│  │  Mensuelle   │            │                      │
│  └───────┬──────┘            │                      │
└──────────┼───────────────────┼──────────────────────┘
           │                   │
           │                   │ HTTPS / SFTP
           │                   │
           ▼                   ▼
┌──────────────────────────────────────────────────────┐
│        Annuaire National MSSanté (ANS)               │
│                                                      │
│  ┌────────────┐  ┌──────────────┐  ┌─────────────┐ │
│  │ Publication│  │Compte Rendu  │  │ Indicateurs │ │
│  │    BAL     │  │Alimentation  │  │  Mensuels   │ │
│  └────────────┘  └──────────────┘  └─────────────┘ │
└──────────────────────────────────────────────────────┘
```

---

## 1. Alimentation de l'Annuaire National

### 1.1 Principe

L'Annuaire National MSSanté permet aux professionnels de santé de rechercher les BAL de leurs confrères.

**Règles importantes :**
- Seules les **BAL personnelles et organisationnelles** sont publiées
- Les **BAL applicatives** ne sont PAS publiées
- Respecter la **liste rouge** (masquage à la demande)
- Publication **en temps réel** ou **par lot quotidien**
- **Dépublication** des BAL inactives > 2 ans

### 1.2 Format du flux d'alimentation

L'ANS accepte plusieurs formats :

#### Format CSV (simple)

```csv
type_operation;adresse_bal;type_bal;identifiant_pp;nom;prenom;profession;specialite;finess_rattachement;liste_rouge
CREATE;jean.dupont@hopital-paris.mssante.fr;PERS;10001234567;DUPONT;Jean;Médecin;Cardiologie;750000001;NON
CREATE;secretariat.cardio@hopital-paris.mssante.fr;ORG;;;;;;750000001;NON
UPDATE;marie.martin@clinique-lyon.mssante.fr;PERS;10001234568;MARTIN;Marie;Infirmière;;690000002;NON
DELETE;ancien.compte@hopital-paris.mssante.fr;PERS;;;;;750000001;
```

**Colonnes :**
- `type_operation` : CREATE, UPDATE, DELETE
- `adresse_bal` : Email complet
- `type_bal` : PERS (personnelle), ORG (organisationnelle)
- `identifiant_pp` : RPPS ou ADELI (uniquement pour PERS)
- `nom`, `prenom` : Titulaire (uniquement pour PERS)
- `profession` : Ex: Médecin, Infirmière, Pharmacien
- `specialite` : Ex: Cardiologie (optionnel)
- `finess_rattachement` : FINESS de l'établissement
- `liste_rouge` : OUI/NON (masquer de l'annuaire)

#### Format XML (standard)

```xml
<?xml version="1.0" encoding="UTF-8"?>
<flux_annuaire>
  <header>
    <operateur_id>VOTRE_ID_OPERATEUR</operateur_id>
    <date_generation>2025-12-26T10:00:00Z</date_generation>
    <nb_operations>3</nb_operations>
  </header>
  
  <operations>
    <!-- Création BAL personnelle -->
    <operation type="CREATE">
      <bal>
        <adresse>jean.dupont@hopital-paris.mssante.fr</adresse>
        <type>PERS</type>
        <titulaire>
          <identifiant type="RPPS">10001234567</identifiant>
          <nom>DUPONT</nom>
          <prenom>Jean</prenom>
          <profession code="10">Médecin</profession>
          <specialite code="53">Cardiologie et maladies vasculaires</specialite>
        </titulaire>
        <rattachement>
          <finess_juridique>750000001</finess_juridique>
          <finess_geographique>750000002</finess_geographique>
        </rattachement>
        <liste_rouge>false</liste_rouge>
        <date_creation>2025-12-26</date_creation>
      </bal>
    </operation>
    
    <!-- Création BAL organisationnelle -->
    <operation type="CREATE">
      <bal>
        <adresse>secretariat.cardio@hopital-paris.mssante.fr</adresse>
        <type>ORG</type>
        <service>
          <nom>Secrétariat Service Cardiologie</nom>
          <type>secretariat</type>
        </service>
        <rattachement>
          <finess_juridique>750000001</finess_juridique>
          <finess_geographique>750000002</finess_geographique>
        </rattachement>
        <liste_rouge>false</liste_rouge>
        <date_creation>2025-12-26</date_creation>
      </bal>
    </operation>
    
    <!-- Suppression BAL -->
    <operation type="DELETE">
      <bal>
        <adresse>ancien.compte@hopital-paris.mssante.fr</adresse>
        <motif>Utilisateur parti</motif>
        <date_suppression>2025-12-26</date_suppression>
      </bal>
    </operation>
  </operations>
</flux_annuaire>
```

### 1.3 API de publication (Web Services)

L'ANS fournit une API SOAP/REST pour la publication en temps réel.

#### Endpoint API

```
Production:  https://annuaire.mssante.fr/api/v1/
Test:        https://annuaire.formation.mssante.fr/api/v1/
```

#### Authentification

```javascript
// services/api/src/services/annuaire.js
const axios = require('axios');

class AnnuaireService {
  constructor() {
    this.baseURL = process.env.ANNUAIRE_BASE_URL || 'https://annuaire.mssante.fr/api/v1';
    this.operatorId = process.env.OPERATOR_ID;
    this.apiKey = process.env.ANNUAIRE_API_KEY;
  }
  
  // Headers d'authentification
  getHeaders() {
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'X-Operator-ID': this.operatorId,
      'Content-Type': 'application/json'
    };
  }
  
  /**
   * Publier une BAL dans l'annuaire
   */
  async publishMailbox(mailbox, user, domain) {
    try {
      // Ne publier que les BAL personnelles et organisationnelles
      if (mailbox.type === 'applicative') {
        console.log('BAL applicative - pas de publication');
        return { success: true, skipped: true };
      }
      
      // Vérifier la liste rouge
      if (mailbox.hide_from_directory) {
        console.log('Liste rouge - pas de publication');
        return { success: true, skipped: true };
      }
      
      const payload = {
        operation: 'CREATE',
        bal: {
          adresse: mailbox.email,
          type: mailbox.type === 'personal' ? 'PERS' : 'ORG',
          domaine: domain.domain_name,
          operateur_id: this.operatorId,
          date_creation: mailbox.created_at
        }
      };
      
      // Données spécifiques selon le type
      if (mailbox.type === 'personal' && user) {
        payload.bal.titulaire = {
          identifiant: user.rpps_id,
          type_identifiant: 'RPPS',
          nom: user.last_name,
          prenom: user.first_name,
          profession: user.profession,
          specialite: user.specialty
        };
      } else if (mailbox.type === 'organizational') {
        payload.bal.service = {
          nom: mailbox.service_name,
          type: mailbox.service_type
        };
      }
      
      // Rattachement
      payload.bal.rattachement = {
        finess_juridique: domain.finess_juridique,
        finess_geographique: domain.finess_geographique
      };
      
      // Appel API
      const response = await axios.post(
        `${this.baseURL}/mailboxes`,
        payload,
        { headers: this.getHeaders() }
      );
      
      console.log(`✅ BAL publiée: ${mailbox.email}`);
      
      // Stocker l'ID de publication
      await this.savePublicationRecord(mailbox.id, response.data.publication_id);
      
      return {
        success: true,
        publication_id: response.data.publication_id
      };
      
    } catch (error) {
      console.error('❌ Erreur publication annuaire:', error.response?.data || error.message);
      
      // Stocker l'erreur
      await this.savePublicationError(mailbox.id, error.response?.data || error.message);
      
      return {
        success: false,
        error: error.response?.data || error.message
      };
    }
  }
  
  /**
   * Mettre à jour une BAL dans l'annuaire
   */
  async updateMailbox(mailbox, user, domain) {
    try {
      const payload = {
        operation: 'UPDATE',
        bal: {
          adresse: mailbox.email,
          // ... même structure que CREATE
        }
      };
      
      const response = await axios.put(
        `${this.baseURL}/mailboxes/${mailbox.email}`,
        payload,
        { headers: this.getHeaders() }
      );
      
      console.log(`✅ BAL mise à jour: ${mailbox.email}`);
      
      return { success: true };
      
    } catch (error) {
      console.error('❌ Erreur mise à jour annuaire:', error.response?.data);
      return { success: false, error: error.response?.data };
    }
  }
  
  /**
   * Dépublier une BAL de l'annuaire
   */
  async unpublishMailbox(mailbox, reason = 'Suppression') {
    try {
      const response = await axios.delete(
        `${this.baseURL}/mailboxes/${mailbox.email}`,
        {
          headers: this.getHeaders(),
          data: {
            motif: reason,
            date_suppression: new Date().toISOString()
          }
        }
      );
      
      console.log(`✅ BAL dépubliée: ${mailbox.email}`);
      
      return { success: true };
      
    } catch (error) {
      console.error('❌ Erreur dépublication annuaire:', error.response?.data);
      return { success: false, error: error.response?.data };
    }
  }
  
  /**
   * Rechercher dans l'annuaire
   */
  async search(criteria) {
    try {
      const response = await axios.get(
        `${this.baseURL}/search`,
        {
          headers: this.getHeaders(),
          params: criteria
        }
      );
      
      return response.data;
      
    } catch (error) {
      console.error('❌ Erreur recherche annuaire:', error.response?.data);
      throw error;
    }
  }
}

module.exports = new AnnuaireService();
```

### 1.4 Table de suivi des publications

```sql
-- Table pour tracer les publications dans l'annuaire
CREATE TABLE annuaire_publications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mailbox_id UUID REFERENCES mailboxes(id) ON DELETE CASCADE,
    publication_id VARCHAR(255), -- ID retourné par l'annuaire
    operation VARCHAR(20) NOT NULL, -- CREATE, UPDATE, DELETE
    status VARCHAR(20) DEFAULT 'pending',
    request_payload JSONB,
    response_data JSONB,
    error_message TEXT,
    attempted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    success_at TIMESTAMP,
    CONSTRAINT chk_operation CHECK (operation IN ('CREATE', 'UPDATE', 'DELETE')),
    CONSTRAINT chk_status CHECK (status IN ('pending', 'success', 'error', 'retry'))
);

CREATE INDEX idx_annuaire_publications_mailbox ON annuaire_publications(mailbox_id);
CREATE INDEX idx_annuaire_publications_status ON annuaire_publications(status);
CREATE INDEX idx_annuaire_publications_date ON annuaire_publications(attempted_at DESC);
```

### 1.5 Intégration dans le workflow de création de BAL

```javascript
// services/api/src/controllers/mailboxController.js
const annuaireService = require('../services/annuaire');

const createMailbox = async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { email, type, owner_rpps } = req.body;
    const domain = req.domain;
    
    // 1. Créer la BAL en base
    const mailboxResult = await client.query(
      `INSERT INTO mailboxes (email, type, domain_id, owner_id, status)
       VALUES ($1, $2, $3, 
         (SELECT id FROM users WHERE rpps_id = $4 AND domain_id = $3),
         'active')
       RETURNING *`,
      [email, type, domain.id, owner_rpps]
    );
    
    const mailbox = mailboxResult.rows[0];
    
    // 2. Créer la boîte mail technique (Postfix/Dovecot)
    await createMailboxTechnical(mailbox, domain);
    
    // 3. Publier dans l'annuaire (si applicable)
    if (type === 'personal' || type === 'organizational') {
      const user = await getUser(mailbox.owner_id);
      
      const publicationResult = await annuaireService.publishMailbox(
        mailbox,
        user,
        domain
      );
      
      if (!publicationResult.success) {
        console.warn('⚠️ Échec publication annuaire (continuera quand même)');
        // Ne pas bloquer la création de BAL si l'annuaire est indisponible
        // Un processus de retry s'en occupera
      }
    }
    
    await client.query('COMMIT');
    
    res.status(201).json(mailbox);
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Erreur création BAL:', error);
    res.status(500).json({ error: 'Erreur création BAL' });
  } finally {
    client.release();
  }
};
```

### 1.6 Processus de retry automatique

```javascript
// services/api/src/jobs/annuaireRetry.js
const cron = require('node-cron');
const annuaireService = require('../services/annuaire');

/**
 * Job de retry pour les publications échouées
 * S'exécute toutes les heures
 */
cron.schedule('0 * * * *', async () => {
  console.log('🔄 Lancement du job de retry annuaire');
  
  try {
    // Récupérer les publications en erreur ou en attente
    const { rows } = await pool.query(`
      SELECT 
        ap.*,
        m.email,
        m.type,
        m.owner_id,
        m.domain_id
      FROM annuaire_publications ap
      JOIN mailboxes m ON ap.mailbox_id = m.id
      WHERE ap.status IN ('error', 'retry', 'pending')
      AND ap.attempted_at < NOW() - INTERVAL '1 hour'
      ORDER BY ap.attempted_at ASC
      LIMIT 100
    `);
    
    console.log(`📋 ${rows.length} publications à retraiter`);
    
    for (const pub of rows) {
      try {
        const mailbox = {
          id: pub.mailbox_id,
          email: pub.email,
          type: pub.type,
          owner_id: pub.owner_id
        };
        
        const domain = await getDomain(pub.domain_id);
        const user = await getUser(pub.owner_id);
        
        let result;
        switch (pub.operation) {
          case 'CREATE':
            result = await annuaireService.publishMailbox(mailbox, user, domain);
            break;
          case 'UPDATE':
            result = await annuaireService.updateMailbox(mailbox, user, domain);
            break;
          case 'DELETE':
            result = await annuaireService.unpublishMailbox(mailbox);
            break;
        }
        
        if (result.success) {
          await pool.query(
            `UPDATE annuaire_publications 
             SET status = 'success', success_at = NOW()
             WHERE id = $1`,
            [pub.id]
          );
          console.log(`✅ Retry réussi: ${pub.email}`);
        } else {
          await pool.query(
            `UPDATE annuaire_publications 
             SET status = 'retry', error_message = $1, attempted_at = NOW()
             WHERE id = $2`,
            [result.error, pub.id]
          );
          console.log(`⚠️ Retry échoué: ${pub.email}`);
        }
        
      } catch (error) {
        console.error(`❌ Erreur retry ${pub.email}:`, error);
      }
      
      // Pause pour éviter de surcharger l'API
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('✅ Job de retry terminé');
    
  } catch (error) {
    console.error('❌ Erreur job retry:', error);
  }
});
```

### 1.7 Flux par lot (alternative SFTP)

Pour les volumes importants, l'ANS propose un dépôt par SFTP.

```javascript
// services/api/src/jobs/annuaireBatch.js
const cron = require('node-cron');
const fs = require('fs').promises;
const SftpClient = require('ssh2-sftp-client');

/**
 * Génération d'un flux quotidien pour l'annuaire
 * S'exécute tous les jours à 2h du matin
 */
cron.schedule('0 2 * * *', async () => {
  console.log('📦 Génération du flux annuaire quotidien');
  
  try {
    const date = new Date().toISOString().split('T')[0];
    const filename = `flux_annuaire_${process.env.OPERATOR_ID}_${date}.csv`;
    const filepath = `/tmp/${filename}`;
    
    // Récupérer toutes les opérations de la journée
    const { rows } = await pool.query(`
      SELECT 
        ap.operation as type_operation,
        m.email as adresse_bal,
        CASE m.type 
          WHEN 'personal' THEN 'PERS'
          WHEN 'organizational' THEN 'ORG'
        END as type_bal,
        u.rpps_id as identifiant_pp,
        u.last_name as nom,
        u.first_name as prenom,
        u.profession,
        u.specialty as specialite,
        d.finess_juridique as finess_rattachement,
        CASE m.hide_from_directory 
          WHEN true THEN 'OUI'
          ELSE 'NON'
        END as liste_rouge
      FROM annuaire_publications ap
      JOIN mailboxes m ON ap.mailbox_id = m.id
      LEFT JOIN users u ON m.owner_id = u.id
      JOIN domains d ON m.domain_id = d.id
      WHERE DATE(ap.attempted_at) = CURRENT_DATE
      AND ap.status = 'pending'
    `);
    
    console.log(`📊 ${rows.length} opérations à traiter`);
    
    // Générer le fichier CSV
    const header = 'type_operation;adresse_bal;type_bal;identifiant_pp;nom;prenom;profession;specialite;finess_rattachement;liste_rouge\n';
    const lines = rows.map(row => 
      `${row.type_operation};${row.adresse_bal};${row.type_bal};${row.identifiant_pp || ''};${row.nom || ''};${row.prenom || ''};${row.profession || ''};${row.specialite || ''};${row.finess_rattachement};${row.liste_rouge}`
    );
    
    await fs.writeFile(filepath, header + lines.join('\n'));
    
    // Upload via SFTP
    const sftp = new SftpClient();
    
    await sftp.connect({
      host: process.env.ANNUAIRE_SFTP_HOST,
      port: process.env.ANNUAIRE_SFTP_PORT || 22,
      username: process.env.ANNUAIRE_SFTP_USER,
      password: process.env.ANNUAIRE_SFTP_PASSWORD
    });
    
    await sftp.put(filepath, `/incoming/${filename}`);
    await sftp.end();
    
    console.log(`✅ Flux déposé: ${filename}`);
    
    // Nettoyer le fichier local
    await fs.unlink(filepath);
    
  } catch (error) {
    console.error('❌ Erreur génération flux:', error);
  }
});
```

---

## 2. Consultation du Compte Rendu d'Alimentation

### 2.1 Principe

Après chaque flux d'alimentation, l'ANS génère un **compte rendu** indiquant :
- Nombre d'opérations traitées
- Nombre de succès
- Nombre d'erreurs avec détails
- Anomalies détectées

### 2.2 Récupération du compte rendu (API)

```javascript
// services/api/src/services/annuaire.js

class AnnuaireService {
  /**
   * Récupérer le compte rendu d'alimentation
   */
  async getAlimentationReport(date = null) {
    try {
      const targetDate = date || new Date().toISOString().split('T')[0];
      
      const response = await axios.get(
        `${this.baseURL}/reports/alimentation`,
        {
          headers: this.getHeaders(),
          params: {
            date: targetDate,
            operateur_id: this.operatorId
          }
        }
      );
      
      return response.data;
      
    } catch (error) {
      console.error('❌ Erreur récupération CR:', error.response?.data);
      throw error;
    }
  }
  
  /**
   * Récupérer les erreurs détaillées
   */
  async getAlimentationErrors(date = null) {
    try {
      const targetDate = date || new Date().toISOString().split('T')[0];
      
      const response = await axios.get(
        `${this.baseURL}/reports/alimentation/errors`,
        {
          headers: this.getHeaders(),
          params: {
            date: targetDate,
            operateur_id: this.operatorId
          }
        }
      );
      
      return response.data;
      
    } catch (error) {
      console.error('❌ Erreur récupération erreurs:', error.response?.data);
      throw error;
    }
  }
}
```

### 2.3 Récupération par SFTP

```javascript
// services/api/src/jobs/downloadReports.js
const cron = require('node-cron');
const SftpClient = require('ssh2-sftp-client');
const fs = require('fs').promises;

/**
 * Téléchargement quotidien des comptes rendus
 * S'exécute tous les jours à 8h
 */
cron.schedule('0 8 * * *', async () => {
  console.log('📥 Téléchargement des comptes rendus');
  
  try {
    const sftp = new SftpClient();
    
    await sftp.connect({
      host: process.env.ANNUAIRE_SFTP_HOST,
      port: process.env.ANNUAIRE_SFTP_PORT || 22,
      username: process.env.ANNUAIRE_SFTP_USER,
      password: process.env.ANNUAIRE_SFTP_PASSWORD
    });
    
    // Lister les fichiers dans /reports
    const files = await sftp.list('/reports');
    
    for (const file of files) {
      // Télécharger uniquement les nouveaux rapports
      if (file.name.startsWith('CR_') && file.name.includes(process.env.OPERATOR_ID)) {
        const remotePath = `/reports/${file.name}`;
        const localPath = `./data/reports/${file.name}`;
        
        await sftp.get(remotePath, localPath);
        console.log(`✅ Téléchargé: ${file.name}`);
        
        // Traiter le rapport
        await processReport(localPath);
        
        // Archiver sur le serveur SFTP
        await sftp.rename(remotePath, `/reports/archive/${file.name}`);
      }
    }
    
    await sftp.end();
    
  } catch (error) {
    console.error('❌ Erreur téléchargement CR:', error);
  }
});

/**
 * Traiter un compte rendu
 */
async function processReport(filepath) {
  try {
    const content = await fs.readFile(filepath, 'utf-8');
    const lines = content.split('\n');
    
    // Parser le rapport (format CSV)
    // ligne_numero;adresse_bal;statut;code_erreur;message_erreur
    
    for (let i = 1; i < lines.length; i++) {
      const [numero, email, statut, code_erreur, message] = lines[i].split(';');
      
      if (statut === 'ERREUR') {
        console.error(`❌ Erreur pour ${email}: ${message}`);
        
        // Enregistrer l'erreur en base
        await pool.query(`
          UPDATE annuaire_publications 
          SET status = 'error', 
              error_message = $1,
              response_data = jsonb_build_object('code', $2, 'message', $3)
          WHERE mailbox_id = (SELECT id FROM mailboxes WHERE email = $4)
          AND operation = 'CREATE'
          ORDER BY attempted_at DESC
          LIMIT 1
        `, [message, code_erreur, message, email]);
      } else if (statut === 'OK') {
        console.log(`✅ Succès pour ${email}`);
        
        await pool.query(`
          UPDATE annuaire_publications 
          SET status = 'success', success_at = NOW()
          WHERE mailbox_id = (SELECT id FROM mailboxes WHERE email = $1)
          AND operation = 'CREATE'
          ORDER BY attempted_at DESC
          LIMIT 1
        `, [email]);
      }
    }
    
  } catch (error) {
    console.error('❌ Erreur traitement rapport:', error);
  }
}
```

### 2.4 Interface de consultation des rapports

```jsx
// services/frontend/src/pages/AnnuaireReports.jsx
import React, { useState, useEffect } from 'react';

const AnnuaireReports = () => {
  const [reports, setReports] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [errors, setErrors] = useState([]);
  
  useEffect(() => {
    loadReports();
  }, []);
  
  const loadReports = async () => {
    const response = await fetch('/api/v1/annuaire/reports', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });
    const data = await response.json();
    setReports(data);
  };
  
  const loadReportDetails = async (reportId) => {
    const response = await fetch(`/api/v1/annuaire/reports/${reportId}/errors`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });
    const data = await response.json();
    setErrors(data);
    setSelectedReport(reportId);
  };
  
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">
        Comptes Rendus d'Alimentation Annuaire
      </h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Liste des rapports */}
        <div className="lg:col-span-1">
          <div className="bg-white shadow rounded-lg p-4">
            <h2 className="font-bold mb-4">Rapports récents</h2>
            
            <div className="space-y-2">
              {reports.map(report => (
                <div
                  key={report.id}
                  onClick={() => loadReportDetails(report.id)}
                  className={`p-3 border rounded cursor-pointer hover:bg-gray-50 ${
                    selectedReport === report.id ? 'border-blue-500 bg-blue-50' : ''
                  }`}
                >
                  <div className="font-medium">
                    {new Date(report.date).toLocaleDateString()}
                  </div>
                  <div className="text-sm text-gray-600">
                    {report.total_operations} opérations
                  </div>
                  <div className="flex gap-2 mt-2">
                    <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                      ✓ {report.success_count}
                    </span>
                    {report.error_count > 0 && (
                      <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">
                        ✗ {report.error_count}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        
        {/* Détails des erreurs */}
        <div className="lg:col-span-2">
          {selectedReport ? (
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="font-bold mb-4">Erreurs du rapport</h2>
              
              {errors.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  ✅ Aucune erreur dans ce rapport
                </div>
              ) : (
                <div className="space-y-4">
                  {errors.map((error, index) => (
                    <div key={index} className="border-l-4 border-red-500 bg-red-50 p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-medium text-red-900">
                            {error.adresse_bal}
                          </div>
                          <div className="text-sm text-red-700 mt-1">
                            Code: {error.code_erreur}
                          </div>
                          <div className="text-sm text-gray-700 mt-2">
                            {error.message_erreur}
                          </div>
                        </div>
                        <button
                          onClick={() => retryPublication(error.mailbox_id)}
                          className="text-sm bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
                        >
                          Réessayer
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white shadow rounded-lg p-6 text-center text-gray-500">
              Sélectionnez un rapport pour voir les détails
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AnnuaireReports;
```

---

## 3. Dépôt Mensuel des Indicateurs

### 3.1 Indicateurs requis

L'ANS exige un rapport mensuel contenant :

**Indicateurs de volumétrie :**
- Nombre total de BAL actives par type (PERS, ORG, APP)
- Nombre de BAL créées dans le mois
- Nombre de BAL supprimées dans le mois
- Nombre de BAL en liste rouge

**Indicateurs d'activité :**
- Nombre de messages envoyés
- Nombre de messages reçus
- Volume de données échangées (MB)
- Taux de disponibilité du service

**Indicateurs par domaine :**
- Statistiques par établissement hébergé

### 3.2 Collecte des statistiques

```sql
-- Table des indicateurs mensuels
CREATE TABLE monthly_indicators (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    year INTEGER NOT NULL,
    month INTEGER NOT NULL,
    domain_id UUID REFERENCES domains(id),
    
    -- Volumétrie BAL
    bal_personal_count INTEGER DEFAULT 0,
    bal_organizational_count INTEGER DEFAULT 0,
    bal_applicative_count INTEGER DEFAULT 0,
    bal_created_count INTEGER DEFAULT 0,
    bal_deleted_count INTEGER DEFAULT 0,
    bal_liste_rouge_count INTEGER DEFAULT 0,
    
    -- Activité
    messages_sent INTEGER DEFAULT 0,
    messages_received INTEGER DEFAULT 0,
    data_volume_mb BIGINT DEFAULT 0,
    
    -- Disponibilité
    uptime_percentage DECIMAL(5,2),
    incidents_count INTEGER DEFAULT 0,
    
    -- Métadonnées
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    submitted_at TIMESTAMP,
    submitted_by UUID REFERENCES users(id),
    
    UNIQUE(year, month, domain_id)
);

CREATE INDEX idx_monthly_indicators_date ON monthly_indicators(year, month);
CREATE INDEX idx_monthly_indicators_domain ON monthly_indicators(domain_id);
```

### 3.3 Génération des indicateurs

```javascript
// services/api/src/jobs/generateIndicators.js
const cron = require('node-cron');

/**
 * Génération des indicateurs mensuels
 * S'exécute le 1er de chaque mois à 3h
 */
cron.schedule('0 3 1 * *', async () => {
  console.log('📊 Génération des indicateurs mensuels');
  
  try {
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const year = lastMonth.getFullYear();
    const month = lastMonth.getMonth() + 1;
    
    console.log(`📅 Période: ${year}-${month.toString().padStart(2, '0')}`);
    
    // Récupérer tous les domaines
    const { rows: domains } = await pool.query(
      'SELECT * FROM domains WHERE status = $1',
      ['active']
    );
    
    for (const domain of domains) {
      await generateDomainIndicators(domain, year, month);
    }
    
    // Générer les indicateurs globaux (tous domaines)
    await generateGlobalIndicators(year, month);
    
    console.log('✅ Indicateurs générés');
    
  } catch (error) {
    console.error('❌ Erreur génération indicateurs:', error);
  }
});

async function generateDomainIndicators(domain, year, month) {
  const client = await pool.connect();
  
  try {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);
    
    // 1. Volumétrie BAL
    const { rows: balCounts } = await client.query(`
      SELECT 
        type,
        COUNT(*) as count
      FROM mailboxes
      WHERE domain_id = $1
      AND status = 'active'
      AND created_at <= $2
      GROUP BY type
    `, [domain.id, endDate]);
    
    const balPersonal = balCounts.find(r => r.type === 'personal')?.count || 0;
    const balOrg = balCounts.find(r => r.type === 'organizational')?.count || 0;
    const balApp = balCounts.find(r => r.type === 'applicative')?.count || 0;
    
    // 2. BAL créées dans le mois
    const { rows: balCreated } = await client.query(`
      SELECT COUNT(*) as count
      FROM mailboxes
      WHERE domain_id = $1
      AND created_at BETWEEN $2 AND $3
    `, [domain.id, startDate, endDate]);
    
    // 3. BAL supprimées dans le mois
    const { rows: balDeleted } = await client.query(`
      SELECT COUNT(*) as count
      FROM mailboxes
      WHERE domain_id = $1
      AND status = 'deleted'
      AND updated_at BETWEEN $2 AND $3
    `, [domain.id, startDate, endDate]);
    
    // 4. BAL en liste rouge
    const { rows: balListeRouge } = await client.query(`
      SELECT COUNT(*) as count
      FROM mailboxes
      WHERE domain_id = $1
      AND hide_from_directory = true
      AND status = 'active'
    `, [domain.id]);
    
    // 5. Messages envoyés/reçus
    const { rows: messages } = await client.query(`
      SELECT 
        SUM(messages_sent) as sent,
        SUM(messages_received) as received,
        SUM(storage_used_mb) as storage
      FROM statistics s
      JOIN mailboxes m ON s.mailbox_id = m.id
      WHERE m.domain_id = $1
      AND s.date BETWEEN $2 AND $3
    `, [domain.id, startDate, endDate]);
    
    // 6. Insérer les indicateurs
    await client.query(`
      INSERT INTO monthly_indicators (
        year, month, domain_id,
        bal_personal_count, bal_organizational_count, bal_applicative_count,
        bal_created_count, bal_deleted_count, bal_liste_rouge_count,
        messages_sent, messages_received, data_volume_mb
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT (year, month, domain_id) 
      DO UPDATE SET
        bal_personal_count = EXCLUDED.bal_personal_count,
        bal_organizational_count = EXCLUDED.bal_organizational_count,
        bal_applicative_count = EXCLUDED.bal_applicative_count,
        bal_created_count = EXCLUDED.bal_created_count,
        bal_deleted_count = EXCLUDED.bal_deleted_count,
        bal_liste_rouge_count = EXCLUDED.bal_liste_rouge_count,
        messages_sent = EXCLUDED.messages_sent,
        messages_received = EXCLUDED.messages_received,
        data_volume_mb = EXCLUDED.data_volume_mb,
        generated_at = NOW()
    `, [
      year, month, domain.id,
      balPersonal, balOrg, balApp,
      balCreated.rows[0].count, balDeleted.rows[0].count, balListeRouge.rows[0].count,
      messages.rows[0].sent || 0, messages.rows[0].received || 0, messages.rows[0].storage || 0
    ]);
    
    console.log(`✅ Indicateurs générés pour ${domain.domain_name}`);
    
  } catch (error) {
    console.error(`❌ Erreur pour ${domain.domain_name}:`, error);
  } finally {
    client.release();
  }
}

async function generateGlobalIndicators(year, month) {
  // Indicateurs globaux = somme de tous les domaines
  await pool.query(`
    INSERT INTO monthly_indicators (
      year, month, domain_id,
      bal_personal_count, bal_organizational_count, bal_applicative_count,
      bal_created_count, bal_deleted_count, bal_liste_rouge_count,
      messages_sent, messages_received, data_volume_mb
    )
    SELECT 
      $1, $2, NULL,
      SUM(bal_personal_count),
      SUM(bal_organizational_count),
      SUM(bal_applicative_count),
      SUM(bal_created_count),
      SUM(bal_deleted_count),
      SUM(bal_liste_rouge_count),
      SUM(messages_sent),
      SUM(messages_received),
      SUM(data_volume_mb)
    FROM monthly_indicators
    WHERE year = $1 AND month = $2 AND domain_id IS NOT NULL
    ON CONFLICT (year, month, domain_id) 
    DO UPDATE SET
      bal_personal_count = EXCLUDED.bal_personal_count,
      bal_organizational_count = EXCLUDED.bal_organizational_count,
      bal_applicative_count = EXCLUDED.bal_applicative_count,
      bal_created_count = EXCLUDED.bal_created_count,
      bal_deleted_count = EXCLUDED.bal_deleted_count,
      bal_liste_rouge_count = EXCLUDED.bal_liste_rouge_count,
      messages_sent = EXCLUDED.messages_sent,
      messages_received = EXCLUDED.messages_received,
      data_volume_mb = EXCLUDED.data_volume_mb,
      generated_at = NOW()
  `, [year, month]);
}
```

### 3.4 Format du fichier d'indicateurs

```javascript
// services/api/src/services/indicatorsExport.js
const fs = require('fs').promises;

async function exportIndicatorsCSV(year, month) {
  const { rows } = await pool.query(`
    SELECT 
      mi.*,
      d.domain_name,
      d.organization_name,
      d.finess_juridique
    FROM monthly_indicators mi
    LEFT JOIN domains d ON mi.domain_id = d.id
    WHERE mi.year = $1 AND mi.month = $2
    ORDER BY d.domain_name NULLS FIRST
  `, [year, month]);
  
  // En-tête CSV
  const header = [
    'operateur_id',
    'annee',
    'mois',
    'domaine',
    'nom_organisation',
    'finess',
    'bal_personnelles',
    'bal_organisationnelles',
    'bal_applicatives',
    'bal_creees',
    'bal_supprimees',
    'bal_liste_rouge',
    'messages_envoyes',
    'messages_recus',
    'volume_donnees_mb',
    'taux_disponibilite'
  ].join(';');
  
  // Lignes de données
  const lines = rows.map(row => [
    process.env.OPERATOR_ID,
    row.year,
    row.month,
    row.domain_name || 'GLOBAL',
    row.organization_name || 'Tous domaines',
    row.finess_juridique || '',
    row.bal_personal_count,
    row.bal_organizational_count,
    row.bal_applicative_count,
    row.bal_created_count,
    row.bal_deleted_count,
    row.bal_liste_rouge_count,
    row.messages_sent,
    row.messages_received,
    row.data_volume_mb,
    row.uptime_percentage || '99.9'
  ].join(';'));
  
  return header + '\n' + lines.join('\n');
}
```

### 3.5 Soumission des indicateurs

```javascript
// services/api/src/services/annuaire.js

class AnnuaireService {
  /**
   * Soumettre les indicateurs mensuels
   */
  async submitMonthlyIndicators(year, month) {
    try {
      // Générer le CSV
      const csvContent = await exportIndicatorsCSV(year, month);
      
      const filename = `indicateurs_${process.env.OPERATOR_ID}_${year}_${month.toString().padStart(2, '0')}.csv`;
      const filepath = `/tmp/${filename}`;
      
      await fs.writeFile(filepath, csvContent);
      
      // Option 1: Upload via API
      const formData = new FormData();
      formData.append('file', fs.createReadStream(filepath));
      formData.append('year', year);
      formData.append('month', month);
      
      const response = await axios.post(
        `${this.baseURL}/indicators/submit`,
        formData,
        {
          headers: {
            ...this.getHeaders(),
            'Content-Type': 'multipart/form-data'
          }
        }
      );
      
      console.log(`✅ Indicateurs soumis: ${filename}`);
      
      // Marquer comme soumis en base
      await pool.query(`
        UPDATE monthly_indicators
        SET submitted_at = NOW()
        WHERE year = $1 AND month = $2
      `, [year, month]);
      
      // Nettoyer
      await fs.unlink(filepath);
      
      return response.data;
      
    } catch (error) {
      console.error('❌ Erreur soumission indicateurs:', error.response?.data);
      throw error;
    }
  }
  
  /**
   * Soumettre via SFTP (alternative)
   */
  async submitMonthlyIndicatorsSFTP(year, month) {
    try {
      const csvContent = await exportIndicatorsCSV(year, month);
      const filename = `indicateurs_${process.env.OPERATOR_ID}_${year}_${month.toString().padStart(2, '0')}.csv`;
      const filepath = `/tmp/${filename}`;
      
      await fs.writeFile(filepath, csvContent);
      
      // Upload SFTP
      const sftp = new SftpClient();
      
      await sftp.connect({
        host: process.env.ANNUAIRE_SFTP_HOST,
        port: process.env.ANNUAIRE_SFTP_PORT || 22,
        username: process.env.ANNUAIRE_SFTP_USER,
        password: process.env.ANNUAIRE_SFTP_PASSWORD
      });
      
      await sftp.put(filepath, `/indicators/${filename}`);
      await sftp.end();
      
      console.log(`✅ Indicateurs déposés via SFTP: ${filename}`);
      
      // Marquer comme soumis
      await pool.query(`
        UPDATE monthly_indicators
        SET submitted_at = NOW()
        WHERE year = $1 AND month = $2
      `, [year, month]);
      
      await fs.unlink(filepath);
      
    } catch (error) {
      console.error('❌ Erreur soumission SFTP:', error);
      throw error;
    }
  }
}
```

### 3.6 Interface de gestion des indicateurs

```jsx
// services/frontend/src/pages/MonthlyIndicators.jsx
import React, { useState, useEffect } from 'react';

const MonthlyIndicators = () => {
  const [indicators, setIndicators] = useState([]);
  const [selectedPeriod, setSelectedPeriod] = useState(null);
  
  useEffect(() => {
    loadIndicators();
  }, []);
  
  const loadIndicators = async () => {
    const response = await fetch('/api/v1/indicators', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });
    const data = await response.json();
    setIndicators(data);
  };
  
  const submitIndicators = async (year, month) => {
    if (!confirm(`Soumettre les indicateurs de ${month}/${year} à l'ANS ?`)) {
      return;
    }
    
    try {
      const response = await fetch('/api/v1/indicators/submit', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ year, month })
      });
      
      if (response.ok) {
        alert('Indicateurs soumis avec succès');
        loadIndicators();
      }
    } catch (error) {
      alert('Erreur lors de la soumission');
    }
  };
  
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">
        Indicateurs Mensuels
      </h1>
      
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <table className="min-w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left">Période</th>
              <th className="px-6 py-3 text-left">BAL Totales</th>
              <th className="px-6 py-3 text-left">Messages</th>
              <th className="px-6 py-3 text-left">Volume</th>
              <th className="px-6 py-3 text-left">Statut</th>
              <th className="px-6 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {indicators.map(ind => (
              <tr key={`${ind.year}-${ind.month}`}>
                <td className="px-6 py-4 font-medium">
                  {ind.month.toString().padStart(2, '0')}/{ind.year}
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm">
                    <div>PERS: {ind.bal_personal_count}</div>
                    <div>ORG: {ind.bal_organizational_count}</div>
                    <div>APP: {ind.bal_applicative_count}</div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm">
                    <div>↗️ {ind.messages_sent.toLocaleString()}</div>
                    <div>↙️ {ind.messages_received.toLocaleString()}</div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  {(ind.data_volume_mb / 1024).toFixed(2)} GB
                </td>
                <td className="px-6 py-4">
                  {ind.submitted_at ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      ✓ Soumis le {new Date(ind.submitted_at).toLocaleDateString()}
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                      ⏳ En attente
                    </span>
                  )}
                </td>
                <td className="px-6 py-4">
                  <div className="flex gap-2">
                    <button
                      onClick={() => downloadIndicators(ind.year, ind.month)}
                      className="text-blue-600 hover:underline text-sm"
                    >
                      Télécharger
                    </button>
                    {!ind.submitted_at && (
                      <button
                        onClick={() => submitIndicators(ind.year, ind.month)}
                        className="text-green-600 hover:underline text-sm font-medium"
                      >
                        Soumettre à l'ANS
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default MonthlyIndicators;
```

---

## 4. Checklist opérateur

### ✅ Alimentation Annuaire

- [ ] API d'alimentation configurée
- [ ] Publication automatique à la création de BAL
- [ ] Mise à jour lors de modifications
- [ ] Dépublication lors de suppression
- [ ] Respect de la liste rouge
- [ ] Système de retry en cas d'échec
- [ ] Flux par lot quotidien (si volume important)

### ✅ Compte Rendu

- [ ] Récupération quotidienne des CR
- [ ] Traitement automatique des erreurs
- [ ] Alertes en cas d'erreurs récurrentes
- [ ] Interface de consultation
- [ ] Correction manuelle possible

### ✅ Indicateurs

- [ ] Collecte automatique des statistiques
- [ ] Génération mensuelle automatique
- [ ] Validation des données
- [ ] Export au format requis
- [ ] Soumission avant le 10 du mois suivant
- [ ] Archivage des indicateurs soumis
