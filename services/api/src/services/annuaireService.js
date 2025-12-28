// services/api/src/services/annuaire.js
const axios = require('axios');
const fs = require('fs').promises;
const https = require('https');
const { pool } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Service d'interaction avec l'Annuaire National MSSanté
 * Gère la publication, mise à jour et suppression des BAL
 */
class AnnuaireService {
  constructor() {
    this.baseUrl = process.env.ANNUAIRE_API_URL || 'https://annuaire-api.mssante.esante.gouv.fr/api/v1';
    this.operatorId = process.env.OPERATOR_ID;
    this.apiKey = process.env.ANNUAIRE_API_KEY;
    
    // Client HTTP avec certificat mTLS
    this.client = null;
    this.initClient();
  }

  /**
   * Initialise le client HTTP avec authentification mTLS
   */
  async initClient() {
    try {
      const certPath = process.env.ANNUAIRE_CERT_PATH || '/etc/ssl/certs/annuaire-client.pem';
      const keyPath = process.env.ANNUAIRE_KEY_PATH || '/etc/ssl/certs/annuaire-client.key';
      const caPath = process.env.IGC_CA_PATH || '/etc/ssl/igc-sante/ca-bundle.pem';

      const [cert, key, ca] = await Promise.all([
        fs.readFile(certPath),
        fs.readFile(keyPath),
        fs.readFile(caPath)
      ]);

      this.client = axios.create({
        baseURL: this.baseUrl,
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-Operator-ID': this.operatorId,
          'X-API-Key': this.apiKey
        },
        httpsAgent: new https.Agent({
          cert,
          key,
          ca,
          rejectUnauthorized: true,
          minVersion: 'TLSv1.2'
        })
      });

      logger.info('Client Annuaire initialisé avec succès');
    } catch (error) {
      logger.error('Erreur initialisation client Annuaire:', error);
      // Fallback sans mTLS pour dev
      this.client = axios.create({
        baseURL: this.baseUrl,
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json',
          'X-Operator-ID': this.operatorId,
          'X-API-Key': this.apiKey
        }
      });
    }
  }

  /**
   * Publie une BAL personnelle dans l'annuaire
   */
  async publishPersonalMailbox(mailbox, owner) {
    try {
      const payload = {
        idOperateur: this.operatorId,
        typeBAL: 'PER',
        adresseBAL: mailbox.email,
        titulaire: {
          idNational: owner.rpps_id || owner.adeli_id,
          typeIdNational: owner.rpps_id ? 'RPPS' : 'ADELI',
          nom: owner.last_name,
          prenom: owner.first_name,
          civilite: owner.civility || 'M',
          profession: owner.profession,
          specialite: owner.specialty
        },
        publication: !mailbox.hide_from_directory,
        dateCreation: new Date().toISOString()
      };

      const response = await this.client.post('/bal', payload);

      // Mettre à jour la BAL avec l'ID annuaire
      await pool.query(
        `UPDATE mailboxes 
         SET annuaire_id = $1, published_to_annuaire = true, annuaire_updated_at = NOW()
         WHERE id = $2`,
        [response.data.idBAL, mailbox.id]
      );

      logger.info(`BAL ${mailbox.email} publiée dans l'annuaire`, {
        annuaireId: response.data.idBAL
      });

      return response.data;
    } catch (error) {
      logger.error(`Erreur publication BAL ${mailbox.email}:`, error.response?.data || error.message);
      throw this.handleError(error);
    }
  }

  /**
   * Publie une BAL organisationnelle dans l'annuaire
   */
  async publishOrganizationalMailbox(mailbox, domain) {
    try {
      const payload = {
        idOperateur: this.operatorId,
        typeBAL: 'ORG',
        adresseBAL: mailbox.email,
        organisation: {
          idFiness: domain.finess_juridique,
          idFinessGeo: domain.finess_geographique,
          raisonSociale: domain.organization_name,
          service: mailbox.service_name,
          fonction: mailbox.function_name
        },
        publication: !mailbox.hide_from_directory,
        dateCreation: new Date().toISOString()
      };

      const response = await this.client.post('/bal', payload);

      await pool.query(
        `UPDATE mailboxes 
         SET annuaire_id = $1, published_to_annuaire = true, annuaire_updated_at = NOW()
         WHERE id = $2`,
        [response.data.idBAL, mailbox.id]
      );

      logger.info(`BAL ORG ${mailbox.email} publiée dans l'annuaire`);
      return response.data;
    } catch (error) {
      logger.error(`Erreur publication BAL ORG ${mailbox.email}:`, error.response?.data || error.message);
      throw this.handleError(error);
    }
  }

  /**
   * Publie une BAL applicative dans l'annuaire
   */
  async publishApplicativeMailbox(mailbox, domain) {
    try {
      const payload = {
        idOperateur: this.operatorId,
        typeBAL: 'APP',
        adresseBAL: mailbox.email,
        application: {
          idFiness: domain.finess_juridique,
          raisonSociale: domain.organization_name,
          nomApplication: mailbox.application_name,
          editeur: mailbox.editor_name,
          versionApplication: mailbox.application_version
        },
        publication: !mailbox.hide_from_directory,
        dateCreation: new Date().toISOString()
      };

      const response = await this.client.post('/bal', payload);

      await pool.query(
        `UPDATE mailboxes 
         SET annuaire_id = $1, published_to_annuaire = true, annuaire_updated_at = NOW()
         WHERE id = $2`,
        [response.data.idBAL, mailbox.id]
      );

      logger.info(`BAL APP ${mailbox.email} publiée dans l'annuaire`);
      return response.data;
    } catch (error) {
      logger.error(`Erreur publication BAL APP ${mailbox.email}:`, error.response?.data || error.message);
      throw this.handleError(error);
    }
  }

  /**
   * Met à jour une BAL dans l'annuaire
   */
  async updateMailbox(mailbox, updates) {
    if (!mailbox.annuaire_id) {
      throw new Error('BAL non publiée dans l\'annuaire');
    }

    try {
      const payload = {
        idBAL: mailbox.annuaire_id,
        ...updates,
        dateModification: new Date().toISOString()
      };

      const response = await this.client.put(`/bal/${mailbox.annuaire_id}`, payload);

      await pool.query(
        'UPDATE mailboxes SET annuaire_updated_at = NOW() WHERE id = $1',
        [mailbox.id]
      );

      logger.info(`BAL ${mailbox.email} mise à jour dans l'annuaire`);
      return response.data;
    } catch (error) {
      logger.error(`Erreur mise à jour BAL ${mailbox.email}:`, error.response?.data || error.message);
      throw this.handleError(error);
    }
  }

  /**
   * Dépublie une BAL de l'annuaire (liste rouge ou suppression)
   */
  async unpublishMailbox(mailbox) {
    if (!mailbox.annuaire_id) {
      logger.warn(`BAL ${mailbox.email} non présente dans l'annuaire`);
      return;
    }

    try {
      await this.client.delete(`/bal/${mailbox.annuaire_id}`);

      await pool.query(
        `UPDATE mailboxes 
         SET published_to_annuaire = false, annuaire_updated_at = NOW()
         WHERE id = $1`,
        [mailbox.id]
      );

      logger.info(`BAL ${mailbox.email} dépubliée de l'annuaire`);
    } catch (error) {
      logger.error(`Erreur dépublication BAL ${mailbox.email}:`, error.response?.data || error.message);
      throw this.handleError(error);
    }
  }

  /**
   * Recherche dans l'annuaire national
   */
  async search(query, options = {}) {
    try {
      const params = {
        q: query,
        page: options.page || 1,
        limit: options.limit || 20,
        type: options.type, // PER, ORG, APP
        domaine: options.domain
      };

      const response = await this.client.get('/search', { params });
      return response.data;
    } catch (error) {
      logger.error('Erreur recherche annuaire:', error.response?.data || error.message);
      throw this.handleError(error);
    }
  }

  /**
   * Récupère les informations d'une BAL depuis l'annuaire
   */
  async getMailboxInfo(email) {
    try {
      const response = await this.client.get(`/bal/email/${encodeURIComponent(email)}`);
      return response.data;
    } catch (error) {
      if (error.response?.status === 404) {
        return null;
      }
      throw this.handleError(error);
    }
  }

  /**
   * Synchronise la liste blanche des opérateurs
   */
  async syncWhitelist() {
    try {
      const response = await this.client.get('/operateurs/whitelist');
      
      // Stocker dans Redis pour accès rapide
      const { redisClient } = require('../config/redis');
      await redisClient.set(
        'mssante:whitelist',
        JSON.stringify(response.data),
        'EX',
        3600 // 1 heure
      );

      logger.info('Liste blanche opérateurs synchronisée');
      return response.data;
    } catch (error) {
      logger.error('Erreur sync liste blanche:', error.message);
      throw this.handleError(error);
    }
  }

  /**
   * Soumet les indicateurs mensuels à l'ANS
   */
  async submitMonthlyIndicators(year, month) {
    try {
      const indicatorsService = require('./indicatorsService');
      const csvContent = await indicatorsService.exportCSV(year, month);

      const filename = `indicateurs_${this.operatorId}_${year}_${String(month).padStart(2, '0')}.csv`;

      const response = await this.client.post('/indicateurs', {
        filename,
        content: Buffer.from(csvContent).toString('base64'),
        year,
        month,
        operatorId: this.operatorId
      });

      // Marquer comme soumis
      await pool.query(
        `UPDATE monthly_indicators 
         SET submitted_at = NOW() 
         WHERE year = $1 AND month = $2`,
        [year, month]
      );

      logger.info(`Indicateurs ${year}-${month} soumis à l'ANS`);
      return response.data;
    } catch (error) {
      logger.error('Erreur soumission indicateurs:', error.response?.data || error.message);
      throw this.handleError(error);
    }
  }

  /**
   * Gestion des erreurs API
   */
  handleError(error) {
    if (error.response) {
      const { status, data } = error.response;
      const message = data?.message || data?.error || 'Erreur API Annuaire';
      
      switch (status) {
        case 400:
          return new Error(`Requête invalide: ${message}`);
        case 401:
          return new Error('Authentification annuaire échouée');
        case 403:
          return new Error('Accès non autorisé à l\'annuaire');
        case 404:
          return new Error('Ressource non trouvée dans l\'annuaire');
        case 409:
          return new Error(`Conflit: ${message}`);
        case 429:
          return new Error('Trop de requêtes vers l\'annuaire');
        default:
          return new Error(`Erreur annuaire (${status}): ${message}`);
      }
    }
    return error;
  }
}

module.exports = new AnnuaireService();