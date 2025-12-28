// services/api/src/services/certificateService.js
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { exec } = require('child_process');
const util = require('util');
const { pool } = require('../config/database');
const logger = require('../utils/logger');

const execPromise = util.promisify(exec);

/**
 * Service de gestion des certificats IGC Santé
 * Gestion des certificats serveur, organisation et utilisateur
 */
class CertificateService {
  constructor() {
    this.certDir = process.env.CERT_DIR || '/etc/ssl/mssante';
    this.igcCaPath = process.env.IGC_CA_PATH || '/etc/ssl/igc-sante/ca-bundle.pem';
    this.crlDir = process.env.CRL_DIR || '/etc/ssl/crl';
    this.crlUrls = {
      classe4: 'http://igc-sante.esante.gouv.fr/AC-CLASSE-4/crl/AC-CLASSE-4.crl'
    };
  }

  /**
   * Parse un certificat PEM et extrait ses informations
   */
  async parseCertificate(certPem) {
    try {
      const tempFile = `/tmp/cert_${Date.now()}.pem`;
      await fs.writeFile(tempFile, certPem);

      const { stdout } = await execPromise(
        `openssl x509 -in ${tempFile} -noout -subject -issuer -dates -serial -fingerprint -ext subjectAltName 2>/dev/null`
      );

      await fs.unlink(tempFile);

      const lines = stdout.split('\n');
      const info = {};

      for (const line of lines) {
        if (line.startsWith('subject=')) {
          info.subject = this.parseX509Name(line.substring(8));
        } else if (line.startsWith('issuer=')) {
          info.issuer = this.parseX509Name(line.substring(7));
        } else if (line.startsWith('notBefore=')) {
          info.validFrom = new Date(line.substring(10));
        } else if (line.startsWith('notAfter=')) {
          info.validTo = new Date(line.substring(9));
        } else if (line.startsWith('serial=')) {
          info.serialNumber = line.substring(7);
        } else if (line.includes('Fingerprint=')) {
          info.fingerprint = line.split('=')[1].replace(/:/g, '').toLowerCase();
        } else if (line.includes('DNS:')) {
          info.altNames = line.match(/DNS:[^,\s]+/g)?.map(d => d.substring(4)) || [];
        }
      }

      // Calculer les jours restants
      info.daysUntilExpiry = Math.ceil((info.validTo - new Date()) / (1000 * 60 * 60 * 24));
      info.isExpired = info.daysUntilExpiry < 0;
      info.isExpiringSoon = info.daysUntilExpiry <= 30;

      return info;
    } catch (error) {
      logger.error('Erreur parsing certificat:', error);
      throw new Error('Certificat invalide');
    }
  }

  /**
   * Parse un nom X.509 (CN, O, OU, etc.)
   */
  parseX509Name(nameStr) {
    const result = {};
    const parts = nameStr.split(',').map(p => p.trim());
    
    for (const part of parts) {
      const [key, ...valueParts] = part.split('=');
      const value = valueParts.join('=').trim();
      
      switch (key.trim().toUpperCase()) {
        case 'CN': result.commonName = value; break;
        case 'O': result.organization = value; break;
        case 'OU': result.organizationalUnit = value; break;
        case 'C': result.country = value; break;
        case 'ST': result.state = value; break;
        case 'L': result.locality = value; break;
      }
    }
    
    return result;
  }

  /**
   * Vérifie un certificat contre la chaîne IGC Santé
   */
  async verifyCertificate(certPem) {
    try {
      const tempFile = `/tmp/verify_${Date.now()}.pem`;
      await fs.writeFile(tempFile, certPem);

      // Vérifier la chaîne de confiance
      const { stdout, stderr } = await execPromise(
        `openssl verify -CAfile ${this.igcCaPath} ${tempFile} 2>&1`
      );

      await fs.unlink(tempFile);

      const isValid = stdout.includes(': OK');

      // Vérifier la révocation via CRL
      const crlValid = await this.checkCRL(certPem);

      return {
        valid: isValid && crlValid,
        chainValid: isValid,
        crlValid,
        message: isValid ? 'Certificat valide' : stderr.trim()
      };
    } catch (error) {
      logger.error('Erreur vérification certificat:', error);
      return { valid: false, message: error.message };
    }
  }

  /**
   * Vérifie si un certificat est révoqué
   */
  async checkCRL(certPem) {
    try {
      const tempFile = `/tmp/crl_check_${Date.now()}.pem`;
      await fs.writeFile(tempFile, certPem);

      // Récupérer le numéro de série
      const { stdout: serialOut } = await execPromise(
        `openssl x509 -in ${tempFile} -noout -serial`
      );
      const serial = serialOut.split('=')[1].trim();

      // Vérifier contre la CRL
      const crlFile = path.join(this.crlDir, 'ac-classe-4.pem');
      
      try {
        await fs.access(crlFile);
        const { stdout } = await execPromise(
          `openssl crl -in ${crlFile} -text -noout | grep -i ${serial}`
        );
        
        await fs.unlink(tempFile);
        
        // Si le serial est trouvé, le certificat est révoqué
        return !stdout.includes(serial);
      } catch (e) {
        // CRL non disponible ou serial non trouvé = non révoqué
        await fs.unlink(tempFile);
        return true;
      }
    } catch (error) {
      logger.warn('Erreur vérification CRL:', error.message);
      return true; // Par défaut, considérer comme non révoqué
    }
  }

  /**
   * Met à jour les CRL depuis les serveurs IGC Santé
   */
  async updateCRLs() {
    try {
      for (const [name, url] of Object.entries(this.crlUrls)) {
        const derFile = path.join(this.crlDir, `${name}.crl`);
        const pemFile = path.join(this.crlDir, `${name}.pem`);

        // Télécharger la CRL
        await execPromise(`wget -q -O ${derFile} ${url}`);

        // Convertir DER en PEM
        await execPromise(
          `openssl crl -inform DER -in ${derFile} -outform PEM -out ${pemFile}`
        );

        logger.info(`CRL ${name} mise à jour`);
      }

      return { success: true, updated: Object.keys(this.crlUrls) };
    } catch (error) {
      logger.error('Erreur mise à jour CRL:', error);
      throw error;
    }
  }

  /**
   * Installe un nouveau certificat
   */
  async installCertificate(certPem, keyPem, domainId, type = 'server') {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Parser le certificat
      const certInfo = await this.parseCertificate(certPem);

      // Vérifier le certificat
      const verification = await this.verifyCertificate(certPem);
      if (!verification.valid) {
        throw new Error(`Certificat invalide: ${verification.message}`);
      }

      // Vérifier que la clé correspond au certificat
      const keyMatch = await this.verifyKeyPair(certPem, keyPem);
      if (!keyMatch) {
        throw new Error('La clé privée ne correspond pas au certificat');
      }

      // Générer un ID unique
      const certId = crypto.randomUUID();

      // Sauvegarder les fichiers
      const certPath = path.join(this.certDir, domainId, `${type}_${certId}.pem`);
      const keyPath = path.join(this.certDir, domainId, `${type}_${certId}.key`);

      await fs.mkdir(path.dirname(certPath), { recursive: true });
      await fs.writeFile(certPath, certPem, { mode: 0o644 });
      await fs.writeFile(keyPath, keyPem, { mode: 0o600 });

      // Désactiver les anciens certificats du même type
      await client.query(
        `UPDATE certificates SET status = 'replaced', updated_at = NOW()
         WHERE domain_id = $1 AND type = $2 AND status = 'active'`,
        [domainId, type]
      );

      // Insérer le nouveau certificat
      const result = await client.query(
        `INSERT INTO certificates (
          id, domain_id, type, subject, issuer, serial_number,
          fingerprint, valid_from, valid_to, cert_path, key_path,
          status, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'active', NOW())
        RETURNING *`,
        [
          certId, domainId, type,
          JSON.stringify(certInfo.subject),
          JSON.stringify(certInfo.issuer),
          certInfo.serialNumber,
          certInfo.fingerprint,
          certInfo.validFrom,
          certInfo.validTo,
          certPath, keyPath
        ]
      );

      await client.query('COMMIT');

      logger.info(`Certificat ${type} installé pour domaine ${domainId}`, {
        certId,
        subject: certInfo.subject.commonName,
        expiresIn: certInfo.daysUntilExpiry
      });

      return {
        id: certId,
        ...certInfo,
        status: 'active'
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Vérifie qu'une clé privée correspond à un certificat
   */
  async verifyKeyPair(certPem, keyPem) {
    try {
      const certFile = `/tmp/cert_${Date.now()}.pem`;
      const keyFile = `/tmp/key_${Date.now()}.pem`;

      await fs.writeFile(certFile, certPem);
      await fs.writeFile(keyFile, keyPem);

      const { stdout: certMod } = await execPromise(
        `openssl x509 -in ${certFile} -noout -modulus | openssl md5`
      );
      const { stdout: keyMod } = await execPromise(
        `openssl rsa -in ${keyFile} -noout -modulus | openssl md5`
      );

      await fs.unlink(certFile);
      await fs.unlink(keyFile);

      return certMod.trim() === keyMod.trim();
    } catch (error) {
      return false;
    }
  }

  /**
   * Liste les certificats d'un domaine
   */
  async listCertificates(domainId) {
    const { rows } = await pool.query(
      `SELECT * FROM certificates WHERE domain_id = $1 ORDER BY created_at DESC`,
      [domainId]
    );

    return rows.map(row => ({
      id: row.id,
      type: row.type,
      subject: row.subject,
      issuer: row.issuer,
      serialNumber: row.serial_number,
      fingerprint: row.fingerprint,
      validFrom: row.valid_from,
      validTo: row.valid_to,
      status: row.status,
      daysUntilExpiry: Math.ceil((new Date(row.valid_to) - new Date()) / (1000 * 60 * 60 * 24)),
      createdAt: row.created_at
    }));
  }

  /**
   * Vérifie tous les certificats et alerte si expiration proche
   */
  async checkExpirations() {
    const { rows } = await pool.query(
      `SELECT c.*, d.domain_name, d.organization_name
       FROM certificates c
       JOIN domains d ON c.domain_id = d.id
       WHERE c.status = 'active'
       AND c.valid_to < NOW() + INTERVAL '30 days'`
    );

    const alerts = [];
    for (const cert of rows) {
      const daysLeft = Math.ceil((new Date(cert.valid_to) - new Date()) / (1000 * 60 * 60 * 24));
      
      alerts.push({
        certId: cert.id,
        domain: cert.domain_name,
        type: cert.type,
        subject: cert.subject,
        expiresAt: cert.valid_to,
        daysLeft,
        severity: daysLeft <= 7 ? 'critical' : daysLeft <= 14 ? 'warning' : 'info'
      });

      logger.warn(`Certificat expire bientôt: ${cert.domain_name} (${cert.type})`, {
        daysLeft,
        expiresAt: cert.valid_to
      });
    }

    return alerts;
  }

  /**
   * Révoque un certificat
   */
  async revokeCertificate(certId, reason = 'unspecified') {
    await pool.query(
      `UPDATE certificates 
       SET status = 'revoked', revoked_at = NOW(), revocation_reason = $2, updated_at = NOW()
       WHERE id = $1`,
      [certId, reason]
    );

    logger.security('certificate_revoked', { certId, reason });
  }
}

module.exports = new CertificateService();