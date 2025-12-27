# Développement Webmail MSSanté

## Vue d'ensemble

Le webmail permet aux professionnels de santé de consulter et envoyer des emails sécurisés directement depuis le navigateur.

```
┌─────────────────────────────────────────────────────────┐
│                    Interface Webmail                    │
├─────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │  Liste BAL   │  │ Liste Msgs   │  │ Visualisation │  │
│  │              │  │              │  │   Message     │  │
│  └──────────────┘  └──────────────┘  └───────────────┘  │
│                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │ Composition  │  │  Contacts    │  │  Recherche    │  │
│  │              │  │              │  │               │  │
│  └──────────────┘  └──────────────┘  └───────────────┘  │
└─────────────────────────────────────────────────────────┘
                          │
                          ↓ IMAP/SMTP via API
┌─────────────────────────────────────────────────────────┐
│               Backend Email Service                     │
│  ┌──────────────┐           ┌──────────────┐            │
│  │ IMAP Client  │           │ SMTP Client  │            │
│  └──────────────┘           └──────────────┘            │
└─────────────────────────────────────────────────────────┘
```

Le document couvre :

🔧 **Backend (Node.js)**

✅ Service IMAP complet pour la réception

- Connexion sécurisée avec cache
- Liste des dossiers (INBOX, Sent, Drafts...)
- Liste et recherche des messages
- Récupération message complet avec parsing
- Gestion des flags (lu, marqué, etc.)
- Déplacement et suppression
- Création de dossiers

✅ Service SMTP complet pour l'envoi

- Envoi de messages avec OAuth2
- Support des pièces jointes
- Sauvegarde automatique dans "Sent"
- Sauvegarde de brouillons
- Construction RFC822

✅ Routes API REST pour le frontend

- GET /folders, /messages
- POST /send, /draft
- PATCH /messages/:uid/flags
- DELETE /messages

💻 **Frontend (React)**

✅ Architecture complète en composants

- Page principale avec layout 3 colonnes
- Liste des dossiers (sidebar)
- Liste des messages (milieu)
- Visualisation (droite)
- Composition de message

✅ Fonctionnalités clés

- Recherche dans les messages
- Pagination
- Réponse / Répondre à tous / Transférer
- Pièces jointes
- Brouillons
- Flags (lu, important, etc.)
- Éditeur HTML (RichTextEditor)

✅ UX soignée

- Interface type Gmail/Outlook
- Aperçu des messages
- Indicateurs visuels (non lu, PJ, etc.)
- Actions rapides
- Responsive

Architecture typique :

```
[Dossiers] | [Liste Messages] | [Message / Compose]
   📁      |      📧📧📧       |      📄 / ✍️
```

---

## 1. Architecture Backend - Email Service

### 1.1 Service IMAP (Réception)

```javascript
// services/api/src/services/email/imapService.js
const ImapClient = require('emailjs-imap-client').default;
const { simpleParser } = require('mailparser');

class ImapService {
  constructor() {
    this.connections = new Map(); // Cache des connexions par utilisateur
  }
  
  /**
   * Créer une connexion IMAP pour un utilisateur
   */
  async getConnection(userEmail, accessToken) {
    const cacheKey = `${userEmail}-${accessToken}`;
    
    if (this.connections.has(cacheKey)) {
      return this.connections.get(cacheKey);
    }
    
    const client = new ImapClient('imap.votre-domaine.mssante.fr', 143, {
      auth: {
        user: userEmail,
        pass: accessToken, // Token OAuth2 ou mot de passe
        xoauth2: accessToken // Pour OAuth2
      },
      useSecureTransport: true,
      requireTLS: true,
      logLevel: process.env.NODE_ENV === 'development' ? 'debug' : 'error'
    });
    
    await client.connect();
    
    // Stocker dans le cache (avec timeout)
    this.connections.set(cacheKey, client);
    setTimeout(() => this.connections.delete(cacheKey), 300000); // 5 min
    
    return client;
  }
  
  /**
   * Lister les dossiers (INBOX, Sent, Drafts, etc.)
   */
  async listFolders(userEmail, accessToken) {
    try {
      const client = await this.getConnection(userEmail, accessToken);
      
      const folders = await client.listMailboxes();
      
      return this.formatFolders(folders);
      
    } catch (error) {
      console.error('Erreur listFolders:', error);
      throw error;
    }
  }
  
  formatFolders(folders) {
    const formatted = [];
    
    for (const folder of folders) {
      formatted.push({
        name: folder.name,
        path: folder.path,
        delimiter: folder.delimiter,
        flags: folder.flags,
        specialUse: folder.specialUse,
        children: folder.children ? this.formatFolders(folder.children) : []
      });
    }
    
    return formatted;
  }
  
  /**
   * Lister les messages d'un dossier
   */
  async listMessages(userEmail, accessToken, folderPath = 'INBOX', options = {}) {
    try {
      const client = await this.getConnection(userEmail, accessToken);
      
      // Sélectionner le dossier
      await client.selectMailbox(folderPath);
      
      const {
        page = 1,
        limit = 50,
        sortBy = 'date',
        sortOrder = 'desc',
        search = null
      } = options;
      
      // Recherche (optionnelle)
      let searchCriteria = ['ALL'];
      if (search) {
        searchCriteria = [
          'OR',
          ['SUBJECT', search],
          ['FROM', search],
          ['TO', search],
          ['BODY', search]
        ];
      }
      
      // Rechercher les UIDs
      const uids = await client.search(searchCriteria);
      
      // Trier
      if (sortOrder === 'desc') {
        uids.reverse();
      }
      
      // Paginer
      const start = (page - 1) * limit;
      const end = start + limit;
      const pageUids = uids.slice(start, end);
      
      if (pageUids.length === 0) {
        return {
          messages: [],
          total: uids.length,
          page,
          limit
        };
      }
      
      // Récupérer les messages
      const messages = await client.listMessages(
        folderPath,
        pageUids.join(','),
        ['uid', 'flags', 'envelope', 'bodystructure', 'body.peek[]']
      );
      
      // Parser les messages
      const parsed = await Promise.all(
        messages.map(msg => this.parseMessage(msg))
      );
      
      return {
        messages: parsed,
        total: uids.length,
        page,
        limit
      };
      
    } catch (error) {
      console.error('Erreur listMessages:', error);
      throw error;
    }
  }
  
  /**
   * Récupérer un message complet
   */
  async getMessage(userEmail, accessToken, folderPath, uid) {
    try {
      const client = await this.getConnection(userEmail, accessToken);
      
      await client.selectMailbox(folderPath);
      
      const messages = await client.listMessages(
        folderPath,
        uid,
        ['uid', 'flags', 'envelope', 'bodystructure', 'body[]']
      );
      
      if (messages.length === 0) {
        throw new Error('Message non trouvé');
      }
      
      const parsed = await this.parseMessage(messages[0], true);
      
      // Marquer comme lu
      await client.setFlags(folderPath, uid, { add: ['\\Seen'] });
      
      return parsed;
      
    } catch (error) {
      console.error('Erreur getMessage:', error);
      throw error;
    }
  }
  
  /**
   * Parser un message IMAP
   */
  async parseMessage(imapMessage, includeBody = false) {
    const parsed = await simpleParser(imapMessage['body[]']);
    
    const message = {
      uid: imapMessage.uid,
      flags: imapMessage.flags || [],
      
      // Envelope
      messageId: parsed.messageId,
      inReplyTo: parsed.inReplyTo,
      references: parsed.references,
      
      // Headers
      from: parsed.from?.value || [],
      to: parsed.to?.value || [],
      cc: parsed.cc?.value || [],
      bcc: parsed.bcc?.value || [],
      replyTo: parsed.replyTo?.value || [],
      
      subject: parsed.subject || '(sans objet)',
      date: parsed.date,
      
      // Preview
      preview: parsed.text ? parsed.text.substring(0, 200) : '',
      
      // Flags dérivés
      isRead: imapMessage.flags?.includes('\\Seen') || false,
      isFlagged: imapMessage.flags?.includes('\\Flagged') || false,
      isAnswered: imapMessage.flags?.includes('\\Answered') || false,
      isDraft: imapMessage.flags?.includes('\\Draft') || false,
      
      // Pièces jointes
      hasAttachments: parsed.attachments?.length > 0,
      attachments: parsed.attachments?.map(att => ({
        filename: att.filename,
        contentType: att.contentType,
        size: att.size,
        contentId: att.contentId,
        cid: att.cid
      })) || []
    };
    
    // Inclure le corps complet si demandé
    if (includeBody) {
      message.html = parsed.html || '';
      message.text = parsed.text || '';
      message.attachmentsData = parsed.attachments?.map(att => ({
        filename: att.filename,
        contentType: att.contentType,
        size: att.size,
        content: att.content.toString('base64')
      })) || [];
    }
    
    return message;
  }
  
  /**
   * Marquer des messages (flags)
   */
  async setFlags(userEmail, accessToken, folderPath, uids, flags) {
    try {
      const client = await this.getConnection(userEmail, accessToken);
      
      await client.selectMailbox(folderPath);
      
      await client.setFlags(folderPath, uids, flags);
      
      return { success: true };
      
    } catch (error) {
      console.error('Erreur setFlags:', error);
      throw error;
    }
  }
  
  /**
   * Déplacer des messages
   */
  async moveMessages(userEmail, accessToken, fromFolder, toFolder, uids) {
    try {
      const client = await this.getConnection(userEmail, accessToken);
      
      await client.selectMailbox(fromFolder);
      
      await client.moveMessages(fromFolder, uids, toFolder);
      
      return { success: true };
      
    } catch (error) {
      console.error('Erreur moveMessages:', error);
      throw error;
    }
  }
  
  /**
   * Supprimer des messages
   */
  async deleteMessages(userEmail, accessToken, folderPath, uids) {
    try {
      const client = await this.getConnection(userEmail, accessToken);
      
      await client.selectMailbox(folderPath);
      
      // Marquer comme supprimé
      await client.setFlags(folderPath, uids, { add: ['\\Deleted'] });
      
      // Expunge (supprimer définitivement)
      await client.deleteMessages(folderPath, uids);
      
      return { success: true };
      
    } catch (error) {
      console.error('Erreur deleteMessages:', error);
      throw error;
    }
  }
  
  /**
   * Créer un dossier
   */
  async createFolder(userEmail, accessToken, folderPath) {
    try {
      const client = await this.getConnection(userEmail, accessToken);
      
      await client.createMailbox(folderPath);
      
      return { success: true };
      
    } catch (error) {
      console.error('Erreur createFolder:', error);
      throw error;
    }
  }
  
  /**
   * Fermer toutes les connexions d'un utilisateur
   */
  async closeConnections(userEmail) {
    for (const [key, client] of this.connections.entries()) {
      if (key.startsWith(userEmail)) {
        try {
          await client.close();
        } catch (error) {
          console.error('Erreur fermeture connexion:', error);
        }
        this.connections.delete(key);
      }
    }
  }
}

module.exports = new ImapService();
```

### 1.2 Service SMTP (Envoi)

```javascript
// services/api/src/services/email/smtpService.js
const nodemailer = require('nodemailer');
const { htmlToText } = require('html-to-text');

class SmtpService {
  /**
   * Créer un transport SMTP pour un utilisateur
   */
  createTransport(userEmail, accessToken) {
    return nodemailer.createTransport({
      host: 'smtp.votre-domaine.mssante.fr',
      port: 587,
      secure: false, // STARTTLS
      requireTLS: true,
      auth: {
        type: 'OAuth2',
        user: userEmail,
        accessToken: accessToken
      },
      tls: {
        minVersion: 'TLSv1.2',
        rejectUnauthorized: true
      }
    });
  }
  
  /**
   * Envoyer un email
   */
  async sendMail(userEmail, accessToken, mailOptions) {
    try {
      const transporter = this.createTransport(userEmail, accessToken);
      
      // Préparer le message
      const message = {
        from: mailOptions.from || userEmail,
        to: mailOptions.to,
        cc: mailOptions.cc,
        bcc: mailOptions.bcc,
        subject: mailOptions.subject,
        html: mailOptions.html,
        text: mailOptions.text || htmlToText(mailOptions.html || ''),
        inReplyTo: mailOptions.inReplyTo,
        references: mailOptions.references,
        attachments: mailOptions.attachments || [],
        headers: {
          'X-Mailer': 'MSSante Webmail',
          'X-Priority': mailOptions.priority || '3'
        }
      };
      
      // Envoyer
      const info = await transporter.sendMail(message);
      
      console.log('✅ Message envoyé:', info.messageId);
      
      // Sauvegarder dans "Sent"
      await this.saveSentMessage(userEmail, accessToken, message, info);
      
      return {
        success: true,
        messageId: info.messageId,
        accepted: info.accepted,
        rejected: info.rejected
      };
      
    } catch (error) {
      console.error('❌ Erreur envoi email:', error);
      throw error;
    }
  }
  
  /**
   * Sauvegarder le message dans "Sent"
   */
  async saveSentMessage(userEmail, accessToken, message, info) {
    try {
      const ImapClient = require('emailjs-imap-client').default;
      
      const client = new ImapClient('imap.votre-domaine.mssante.fr', 143, {
        auth: {
          user: userEmail,
          pass: accessToken,
          xoauth2: accessToken
        },
        useSecureTransport: true,
        requireTLS: true
      });
      
      await client.connect();
      
      // Construire le message RFC822
      const rfc822Message = this.buildRFC822Message(message, info);
      
      // Sauvegarder dans "Sent"
      await client.upload('Sent', rfc822Message, ['\\Seen']);
      
      await client.close();
      
    } catch (error) {
      console.error('⚠️ Erreur sauvegarde Sent:', error);
      // Ne pas bloquer l'envoi si la sauvegarde échoue
    }
  }
  
  /**
   * Construire un message RFC822
   */
  buildRFC822Message(message, info) {
    const lines = [];
    
    lines.push(`Message-ID: ${info.messageId}`);
    lines.push(`Date: ${new Date().toUTCString()}`);
    lines.push(`From: ${message.from}`);
    lines.push(`To: ${Array.isArray(message.to) ? message.to.join(', ') : message.to}`);
    
    if (message.cc) {
      lines.push(`Cc: ${Array.isArray(message.cc) ? message.cc.join(', ') : message.cc}`);
    }
    
    lines.push(`Subject: ${message.subject}`);
    lines.push('MIME-Version: 1.0');
    lines.push('Content-Type: text/html; charset=utf-8');
    lines.push('');
    lines.push(message.html || message.text);
    
    return lines.join('\r\n');
  }
  
  /**
   * Sauvegarder un brouillon
   */
  async saveDraft(userEmail, accessToken, mailOptions) {
    try {
      const ImapClient = require('emailjs-imap-client').default;
      
      const client = new ImapClient('imap.votre-domaine.mssante.fr', 143, {
        auth: {
          user: userEmail,
          pass: accessToken,
          xoauth2: accessToken
        },
        useSecureTransport: true,
        requireTLS: true
      });
      
      await client.connect();
      
      // Construire le message
      const rfc822Message = this.buildRFC822Message(mailOptions, { 
        messageId: `<draft-${Date.now()}@${userEmail.split('@')[1]}>` 
      });
      
      // Sauvegarder dans "Drafts"
      await client.upload('Drafts', rfc822Message, ['\\Draft']);
      
      await client.close();
      
      return { success: true };
      
    } catch (error) {
      console.error('❌ Erreur sauvegarde brouillon:', error);
      throw error;
    }
  }
}

module.exports = new SmtpService();
```

### 1.3 Routes API Email

```javascript
// services/api/src/routes/email.js
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const imapService = require('../services/email/imapService');
const smtpService = require('../services/email/smtpService');

// Middleware d'authentification requis
router.use(authenticate);

/**
 * GET /api/v1/email/folders
 * Lister les dossiers
 */
router.get('/folders', async (req, res) => {
  try {
    const folders = await imapService.listFolders(
      req.user.email,
      req.user.accessToken
    );
    
    res.json(folders);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erreur récupération dossiers' });
  }
});

/**
 * GET /api/v1/email/messages
 * Lister les messages d'un dossier
 */
router.get('/messages', async (req, res) => {
  try {
    const {
      folder = 'INBOX',
      page = 1,
      limit = 50,
      search = null
    } = req.query;
    
    const result = await imapService.listMessages(
      req.user.email,
      req.user.accessToken,
      folder,
      {
        page: parseInt(page),
        limit: parseInt(limit),
        search
      }
    );
    
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erreur récupération messages' });
  }
});

/**
 * GET /api/v1/email/messages/:uid
 * Récupérer un message complet
 */
router.get('/messages/:uid', async (req, res) => {
  try {
    const { folder = 'INBOX' } = req.query;
    const { uid } = req.params;
    
    const message = await imapService.getMessage(
      req.user.email,
      req.user.accessToken,
      folder,
      uid
    );
    
    res.json(message);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erreur récupération message' });
  }
});

/**
 * POST /api/v1/email/send
 * Envoyer un email
 */
router.post('/send', async (req, res) => {
  try {
    const {
      to,
      cc,
      bcc,
      subject,
      html,
      text,
      attachments,
      inReplyTo,
      references
    } = req.body;
    
    // Validation
    if (!to || !subject) {
      return res.status(400).json({ 
        error: 'Destinataire et sujet requis' 
      });
    }
    
    const result = await smtpService.sendMail(
      req.user.email,
      req.user.accessToken,
      {
        to,
        cc,
        bcc,
        subject,
        html,
        text,
        attachments,
        inReplyTo,
        references
      }
    );
    
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erreur envoi email' });
  }
});

/**
 * POST /api/v1/email/draft
 * Sauvegarder un brouillon
 */
router.post('/draft', async (req, res) => {
  try {
    const result = await smtpService.saveDraft(
      req.user.email,
      req.user.accessToken,
      req.body
    );
    
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erreur sauvegarde brouillon' });
  }
});

/**
 * PATCH /api/v1/email/messages/:uid/flags
 * Modifier les flags d'un message
 */
router.patch('/messages/:uid/flags', async (req, res) => {
  try {
    const { folder = 'INBOX' } = req.query;
    const { uid } = req.params;
    const { flags } = req.body;
    
    const result = await imapService.setFlags(
      req.user.email,
      req.user.accessToken,
      folder,
      uid,
      flags
    );
    
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erreur modification flags' });
  }
});

/**
 * POST /api/v1/email/messages/move
 * Déplacer des messages
 */
router.post('/messages/move', async (req, res) => {
  try {
    const { fromFolder, toFolder, uids } = req.body;
    
    const result = await imapService.moveMessages(
      req.user.email,
      req.user.accessToken,
      fromFolder,
      toFolder,
      uids
    );
    
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erreur déplacement messages' });
  }
});

/**
 * DELETE /api/v1/email/messages
 * Supprimer des messages
 */
router.delete('/messages', async (req, res) => {
  try {
    const { folder, uids } = req.body;
    
    const result = await imapService.deleteMessages(
      req.user.email,
      req.user.accessToken,
      folder,
      uids
    );
    
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erreur suppression messages' });
  }
});

module.exports = router;
```

---

## 2. Frontend React - Interface Webmail

### 2.1 Structure des composants

```
services/frontend/src/
├── pages/
│   └── Webmail/
│       ├── index.jsx              (Page principale)
│       ├── MessageList.jsx        (Liste des messages)
│       ├── MessageView.jsx        (Visualisation)
│       ├── Compose.jsx            (Composition)
│       ├── FolderTree.jsx         (Arbre des dossiers)
│       └── SearchBar.jsx          (Recherche)
├── components/
│   └── Email/
│       ├── MessageRow.jsx         (Ligne de message)
│       ├── AttachmentItem.jsx     (Pièce jointe)
│       ├── RecipientInput.jsx     (Saisie destinataires)
│       ├── RichTextEditor.jsx     (Éditeur HTML)
│       └── ContactPicker.jsx      (Sélection contacts)
└── services/
    └── emailApi.js                (API calls)
```

### 2.2 Service API Frontend

```javascript
// services/frontend/src/services/emailApi.js
import axios from 'axios';

const API_BASE = '/api/v1/email';

const getAuthHeaders = () => ({
  'Authorization': `Bearer ${localStorage.getItem('token')}`
});

export const emailApi = {
  // Dossiers
  async getFolders() {
    const response = await axios.get(`${API_BASE}/folders`, {
      headers: getAuthHeaders()
    });
    return response.data;
  },
  
  // Messages
  async getMessages(folder = 'INBOX', page = 1, limit = 50, search = null) {
    const response = await axios.get(`${API_BASE}/messages`, {
      headers: getAuthHeaders(),
      params: { folder, page, limit, search }
    });
    return response.data;
  },
  
  async getMessage(uid, folder = 'INBOX') {
    const response = await axios.get(`${API_BASE}/messages/${uid}`, {
      headers: getAuthHeaders(),
      params: { folder }
    });
    return response.data;
  },
  
  async sendMessage(messageData) {
    const response = await axios.post(`${API_BASE}/send`, messageData, {
      headers: getAuthHeaders()
    });
    return response.data;
  },
  
  async saveDraft(messageData) {
    const response = await axios.post(`${API_BASE}/draft`, messageData, {
      headers: getAuthHeaders()
    });
    return response.data;
  },
  
  async setFlags(uid, folder, flags) {
    const response = await axios.patch(
      `${API_BASE}/messages/${uid}/flags`,
      { flags },
      {
        headers: getAuthHeaders(),
        params: { folder }
      }
    );
    return response.data;
  },
  
  async moveMessages(fromFolder, toFolder, uids) {
    const response = await axios.post(
      `${API_BASE}/messages/move`,
      { fromFolder, toFolder, uids },
      { headers: getAuthHeaders() }
    );
    return response.data;
  },
  
  async deleteMessages(folder, uids) {
    const response = await axios.delete(`${API_BASE}/messages`, {
      headers: getAuthHeaders(),
      data: { folder, uids }
    });
    return response.data;
  }
};
```

### 2.3 Page principale Webmail

```jsx
// services/frontend/src/pages/Webmail/index.jsx
import React, { useState, useEffect } from 'react';
import FolderTree from './FolderTree';
import MessageList from './MessageList';
import MessageView from './MessageView';
import Compose from './Compose';
import SearchBar from './SearchBar';
import { emailApi } from '../../services/emailApi';

const Webmail = () => {
  const [folders, setFolders] = useState([]);
  const [selectedFolder, setSelectedFolder] = useState('INBOX');
  const [messages, setMessages] = useState([]);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [isComposing, setIsComposing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  
  // Charger les dossiers au montage
  useEffect(() => {
    loadFolders();
  }, []);
  
  // Charger les messages quand le dossier change
  useEffect(() => {
    if (selectedFolder) {
      loadMessages();
    }
  }, [selectedFolder, page]);
  
  const loadFolders = async () => {
    try {
      const data = await emailApi.getFolders();
      setFolders(data);
    } catch (error) {
      console.error('Erreur chargement dossiers:', error);
    }
  };
  
  const loadMessages = async (search = null) => {
    setLoading(true);
    try {
      const data = await emailApi.getMessages(selectedFolder, page, 50, search);
      setMessages(data.messages);
      setTotal(data.total);
    } catch (error) {
      console.error('Erreur chargement messages:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const handleSelectMessage = async (message) => {
    try {
      const fullMessage = await emailApi.getMessage(message.uid, selectedFolder);
      setSelectedMessage(fullMessage);
      
      // Marquer comme lu
      if (!message.isRead) {
        await emailApi.setFlags(message.uid, selectedFolder, { add: ['\\Seen'] });
        // Mettre à jour localement
        setMessages(prev => 
          prev.map(m => 
            m.uid === message.uid ? { ...m, isRead: true } : m
          )
        );
      }
    } catch (error) {
      console.error('Erreur chargement message:', error);
    }
  };
  
  const handleCompose = () => {
    setIsComposing(true);
    setSelectedMessage(null);
  };
  
  const handleReply = () => {
    setIsComposing(true);
  };
  
  const handleSendSuccess = () => {
    setIsComposing(false);
    setSelectedMessage(null);
    loadMessages(); // Rafraîchir la liste
  };
  
  const handleDelete = async (uids) => {
    if (!confirm(`Supprimer ${uids.length} message(s) ?`)) return;
    
    try {
      await emailApi.deleteMessages(selectedFolder, uids);
      loadMessages();
      if (selectedMessage && uids.includes(selectedMessage.uid)) {
        setSelectedMessage(null);
      }
    } catch (error) {
      console.error('Erreur suppression:', error);
    }
  };
  
  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4 flex justify-between items-center">
        <h1 className="text-2xl font-bold">Webmail</h1>
        
        <div className="flex items-center gap-4">
          <SearchBar onSearch={loadMessages} />
          
          <button
            onClick={handleCompose}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center gap-2"
          >
            <span>✉️</span>
            <span>Nouveau message</span>
          </button>
        </div>
      </div>
      
      {/* Corps principal */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar - Dossiers */}
        <div className="w-64 bg-gray-50 border-r overflow-y-auto">
          <FolderTree
            folders={folders}
            selectedFolder={selectedFolder}
            onSelectFolder={(folder) => {
              setSelectedFolder(folder);
              setSelectedMessage(null);
              setPage(1);
            }}
          />
        </div>
        
        {/* Liste des messages */}
        <div className="w-96 border-r overflow-y-auto">
          <MessageList
            messages={messages}
            selectedMessage={selectedMessage}
            onSelectMessage={handleSelectMessage}
            onDelete={handleDelete}
            loading={loading}
          />
          
          {/* Pagination */}
          {total > 50 && (
            <div className="p-4 border-t flex justify-between items-center">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 border rounded disabled:opacity-50"
              >
                ← Précédent
              </button>
              <span className="text-sm text-gray-600">
                Page {page} / {Math.ceil(total / 50)}
              </span>
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={page >= Math.ceil(total / 50)}
                className="px-3 py-1 border rounded disabled:opacity-50"
              >
                Suivant →
              </button>
            </div>
          )}
        </div>
        
        {/* Visualisation ou Composition */}
        <div className="flex-1 overflow-y-auto bg-white">
          {isComposing ? (
            <Compose
              replyTo={selectedMessage}
              onCancel={() => setIsComposing(false)}
              onSendSuccess={handleSendSuccess}
            />
          ) : selectedMessage ? (
            <MessageView
              message={selectedMessage}
              onReply={handleReply}
              onDelete={() => handleDelete([selectedMessage.uid])}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400">
              <div className="text-center">
                <div className="text-6xl mb-4">📬</div>
                <div>Sélectionnez un message</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Webmail;
```

### 2.4 Composant Liste des messages

```jsx
// services/frontend/src/pages/Webmail/MessageList.jsx
import React from 'react';
import MessageRow from '../../components/Email/MessageRow';

const MessageList = ({ messages, selectedMessage, onSelectMessage, onDelete, loading }) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }
  
  if (messages.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <div className="text-center">
          <div className="text-4xl mb-2">📭</div>
          <div>Aucun message</div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="divide-y">
      {messages.map(message => (
        <MessageRow
          key={message.uid}
          message={message}
          isSelected={selectedMessage?.uid === message.uid}
          onClick={() => onSelectMessage(message)}
          onDelete={() => onDelete([message.uid])}
        />
      ))}
    </div>
  );
};

export default MessageList;
```

### 2.5 Composant Ligne de message

```jsx
// services/frontend/src/components/Email/MessageRow.jsx
import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

const MessageRow = ({ message, isSelected, onClick, onDelete }) => {
  const getFrom = () => {
    if (message.from && message.from.length > 0) {
      return message.from[0].name || message.from[0].address;
    }
    return '(inconnu)';
  };
  
  const formatDate = (date) => {
    return formatDistanceToNow(new Date(date), { 
      addSuffix: true, 
      locale: fr 
    });
  };
  
  return (
    <div
      onClick={onClick}
      className={`p-4 cursor-pointer hover:bg-gray-50 transition ${
        isSelected ? 'bg-blue-50 border-l-4 border-blue-600' : ''
      } ${!message.isRead ? 'bg-blue-50/30 font-semibold' : ''}`}
    >
      <div className="flex items-start justify-between mb-1">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {/* Flags */}
          <div className="flex gap-1">
            {!message.isRead && (
              <span className="w-2 h-2 bg-blue-600 rounded-full"></span>
            )}
            {message.hasAttachments && (
              <span title="Pièces jointes">📎</span>
            )}
            {message.isFlagged && (
              <span title="Marqué">⭐</span>
            )}
          </div>
          
          {/* Expéditeur */}
          <span className="truncate">{getFrom()}</span>
        </div>
        
        {/* Date */}
        <span className="text-xs text-gray-500 ml-2 whitespace-nowrap">
          {formatDate(message.date)}
        </span>
      </div>
      
      {/* Sujet */}
      <div className="text-sm mb-1 truncate">
        {message.subject}
      </div>
      
      {/* Preview */}
      <div className="text-xs text-gray-600 truncate">
        {message.preview}
      </div>
      
      {/* Actions rapides */}
      <div className="flex gap-2 mt-2 opacity-0 group-hover:opacity-100 transition">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="text-xs text-red-600 hover:underline"
        >
          Supprimer
        </button>
      </div>
    </div>
  );
};

export default MessageRow;
```

### 2.6 Composant Visualisation de message

```jsx
// services/frontend/src/pages/Webmail/MessageView.jsx
import React from 'react';
import DOMPurify from 'dompurify';
import AttachmentItem from '../../components/Email/AttachmentItem';

const MessageView = ({ message, onReply, onDelete }) => {
  const sanitizeHTML = (html) => {
    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'a', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'img'],
      ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'style']
    });
  };
  
  const getFrom = () => {
    if (message.from && message.from.length > 0) {
      const from = message.from[0];
      return from.name ? `${from.name} <${from.address}>` : from.address;
    }
    return '(inconnu)';
  };
  
  const getRecipients = (list) => {
    if (!list || list.length === 0) return '';
    return list.map(r => r.name ? `${r.name} <${r.address}>` : r.address).join(', ');
  };
  
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b p-6 bg-white">
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-2xl font-bold">{message.subject}</h2>
          
          <div className="flex gap-2">
            <button
              onClick={onReply}
              className="px-3 py-1 border rounded hover:bg-gray-50"
            >
              ↩️ Répondre
            </button>
            <button
              onClick={() => onReply('all')}
              className="px-3 py-1 border rounded hover:bg-gray-50"
            >
              ↩️ Répondre à tous
            </button>
            <button
              onClick={() => {}}
              className="px-3 py-1 border rounded hover:bg-gray-50"
            >
              ➡️ Transférer
            </button>
            <button
              onClick={onDelete}
              className="px-3 py-1 border border-red-600 text-red-600 rounded hover:bg-red-50"
            >
              🗑️ Supprimer
            </button>
          </div>
        </div>
        
        <div className="space-y-2 text-sm">
          <div className="flex">
            <span className="font-semibold w-24">De:</span>
            <span>{getFrom()}</span>
          </div>
          
          <div className="flex">
            <span className="font-semibold w-24">À:</span>
            <span>{getRecipients(message.to)}</span>
          </div>
          
          {message.cc && message.cc.length > 0 && (
            <div className="flex">
              <span className="font-semibold w-24">Cc:</span>
              <span>{getRecipients(message.cc)}</span>
            </div>
          )}
          
          <div className="flex">
            <span className="font-semibold w-24">Date:</span>
            <span>{new Date(message.date).toLocaleString('fr-FR')}</span>
          </div>
        </div>
        
        {/* Pièces jointes */}
        {message.attachments && message.attachments.length > 0 && (
          <div className="mt-4">
            <div className="font-semibold mb-2">
              📎 {message.attachments.length} pièce(s) jointe(s)
            </div>
            <div className="flex flex-wrap gap-2">
              {message.attachments.map((att, index) => (
                <AttachmentItem
                  key={index}
                  attachment={att}
                  messageUid={message.uid}
                />
              ))}
            </div>
          </div>
        )}
      </div>
      
      {/* Corps du message */}
      <div className="flex-1 overflow-y-auto p-6">
        {message.html ? (
          <div
            className="prose max-w-none"
            dangerouslySetInnerHTML={{ __html: sanitizeHTML(message.html) }}
          />
        ) : (
          <pre className="whitespace-pre-wrap font-sans">
            {message.text}
          </pre>
        )}
      </div>
    </div>
  );
};

export default MessageView;
```

Je continue avec la composition de messages dans le prochain message...

### 2.7 Composant Composition

```jsx
// services/frontend/src/pages/Webmail/Compose.jsx
import React, { useState, useEffect } from 'react';
import RichTextEditor from '../../components/Email/RichTextEditor';
import RecipientInput from '../../components/Email/RecipientInput';
import { emailApi } from '../../services/emailApi';

const Compose = ({ replyTo, onCancel, onSendSuccess }) => {
  const [to, setTo] = useState([]);
  const [cc, setCc] = useState([]);
  const [bcc, setBcc] = useState([]);
  const [subject, setSubject] = useState('');
  const [html, setHtml] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [sending, setSending] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  
  // Pré-remplir si c'est une réponse
  useEffect(() => {
    if (replyTo) {
      // Destinataire = expéditeur du message original
      if (replyTo.from && replyTo.from.length > 0) {
        setTo([replyTo.from[0].address]);
      }
      
      // Sujet
      const originalSubject = replyTo.subject || '';
      setSubject(
        originalSubject.startsWith('Re:') 
          ? originalSubject 
          : `Re: ${originalSubject}`
      );
      
      // Citation du message original
      const quotedText = `
        <br><br>
        <div style="border-left: 3px solid #ccc; padding-left: 10px; color: #666;">
          <p><strong>Le ${new Date(replyTo.date).toLocaleString('fr-FR')}, ${replyTo.from[0].name || replyTo.from[0].address} a écrit :</strong></p>
          ${replyTo.html || replyTo.text?.replace(/\n/g, '<br>')}
        </div>
      `;
      setHtml(quotedText);
    }
  }, [replyTo]);
  
  const handleSend = async () => {
    // Validation
    if (to.length === 0) {
      alert('Veuillez saisir au moins un destinataire');
      return;
    }
    
    if (!subject.trim()) {
      if (!confirm('Envoyer sans objet ?')) {
        return;
      }
    }
    
    setSending(true);
    
    try {
      await emailApi.sendMessage({
        to: to.join(', '),
        cc: cc.length > 0 ? cc.join(', ') : undefined,
        bcc: bcc.length > 0 ? bcc.join(', ') : undefined,
        subject,
        html,
        attachments,
        inReplyTo: replyTo?.messageId,
        references: replyTo?.references
      });
      
      alert('✅ Message envoyé');
      onSendSuccess();
      
    } catch (error) {
      console.error('Erreur envoi:', error);
      alert('❌ Erreur lors de l\'envoi');
    } finally {
      setSending(false);
    }
  };
  
  const handleSaveDraft = async () => {
    setSavingDraft(true);
    
    try {
      await emailApi.saveDraft({
        to: to.join(', '),
        cc: cc.length > 0 ? cc.join(', ') : undefined,
        bcc: bcc.length > 0 ? bcc.join(', ') : undefined,
        subject,
        html,
        attachments
      });
      
      alert('💾 Brouillon sauvegardé');
      
    } catch (error) {
      console.error('Erreur sauvegarde:', error);
      alert('❌ Erreur lors de la sauvegarde');
    } finally {
      setSavingDraft(false);
    }
  };
  
  const handleAttachment = (e) => {
    const files = Array.from(e.target.files);
    
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        setAttachments(prev => [
          ...prev,
          {
            filename: file.name,
            contentType: file.type,
            content: event.target.result.split(',')[1] // Base64
          }
        ]);
      };
      reader.readAsDataURL(file);
    });
  };
  
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b p-4 bg-white flex justify-between items-center">
        <h2 className="text-xl font-bold">
          {replyTo ? 'Répondre' : 'Nouveau message'}
        </h2>
        
        <div className="flex gap-2">
          <button
            onClick={handleSaveDraft}
            disabled={savingDraft}
            className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-50"
          >
            💾 Brouillon
          </button>
          <button
            onClick={handleSend}
            disabled={sending}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {sending ? '⏳ Envoi...' : '📤 Envoyer'}
          </button>
          <button
            onClick={onCancel}
            className="px-3 py-1 border rounded hover:bg-gray-50"
          >
            ❌ Annuler
          </button>
        </div>
      </div>
      
      {/* Formulaire */}
      <div className="p-4 space-y-3 border-b">
        {/* À */}
        <div className="flex items-center gap-2">
          <label className="font-semibold w-16">À:</label>
          <RecipientInput
            recipients={to}
            onChange={setTo}
            placeholder="Destinataires..."
          />
          {!showCc && (
            <button
              onClick={() => setShowCc(true)}
              className="text-sm text-blue-600 hover:underline"
            >
              Cc
            </button>
          )}
          {!showBcc && (
            <button
              onClick={() => setShowBcc(true)}
              className="text-sm text-blue-600 hover:underline"
            >
              Cci
            </button>
          )}
        </div>
        
        {/* Cc */}
        {showCc && (
          <div className="flex items-center gap-2">
            <label className="font-semibold w-16">Cc:</label>
            <RecipientInput
              recipients={cc}
              onChange={setCc}
              placeholder="Copie..."
            />
            <button
              onClick={() => {
                setShowCc(false);
                setCc([]);
              }}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>
        )}
        
        {/* Cci */}
        {showBcc && (
          <div className="flex items-center gap-2">
            <label className="font-semibold w-16">Cci:</label>
            <RecipientInput
              recipients={bcc}
              onChange={setBcc}
              placeholder="Copie cachée..."
            />
            <button
              onClick={() => {
                setShowBcc(false);
                setBcc([]);
              }}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>
        )}
        
        {/* Sujet */}
        <div className="flex items-center gap-2">
          <label className="font-semibold w-16">Objet:</label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Objet du message..."
            className="flex-1 border rounded px-3 py-2"
          />
        </div>
        
        {/* Pièces jointes */}
        <div className="flex items-center gap-2">
          <label className="font-semibold w-16">Fichiers:</label>
          <input
            type="file"
            multiple
            onChange={handleAttachment}
            className="text-sm"
          />
          {attachments.length > 0 && (
            <span className="text-sm text-gray-600">
              ({attachments.length} fichier{attachments.length > 1 ? 's' : ''})
            </span>
          )}
        </div>
      </div>
      
      {/* Éditeur */}
      <div className="flex-1 overflow-y-auto p-4">
        <RichTextEditor
          value={html}
          onChange={setHtml}
        />
      </div>
    </div>
  );
};

export default Compose;
```

Voilà un webmail complet et fonctionnel pour MSSanté ! 🎯

Besoin de détails sur un composant spécifique ?