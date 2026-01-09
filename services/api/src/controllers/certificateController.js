// services/api/src/controllers/certificateController.js
const forge = require('node-forge');
const { pool } = require('../config/database');
const { redisClient } = require('../config/redis');
const certificateService = require('../services/certificateService');
const logger = require('../utils/logger');

/**
 * GET /api/v1/certificates
 * Liste des certificats du domaine
 */
const list = async (req, res) => {
  try {
    const { page = 1, limit = 20, type, status, expiringDays } = req.query;
    const offset = (page - 1) * limit;
    const domainId = req.domain?.id || req.user.domainId;

    let query = `
      SELECT c.*, m.email as mailbox_email
      FROM certificates c
      LEFT JOIN mailboxes m ON c.mailbox_id = m.id
      WHERE c.domain_id = $1
    `;
    const params = [domainId];
    let paramIndex = 2;

    // Filtre par type
    if (type) {
      query += ` AND c.type = $${paramIndex++}`;
      params.push(type);
    }

    // Filtre par statut
    if (status) {
      query += ` AND c.status = $${paramIndex++}`;
      params.push(status);
    }

    // Filtre par expiration proche
    if (expiringDays) {
      query += ` AND c.valid_to <= NOW() + INTERVAL '${parseInt(expiringDays)} days'`;
      query += ` AND c.valid_to > NOW()`;
    }

    // Comptage total
    const countQuery = query.replace(
      'SELECT c.*, m.email as mailbox_email',
      'SELECT COUNT(DISTINCT c.id) as total'
    );
    const countResult = await pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0].total);

    // Récupération paginée
    query += ` ORDER BY c.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    res.json({
      success: true,
      data: result.rows.map(row => ({
        id: row.id,
        type: row.type,
        serialNumber: row.serial_number,
        subject: row.subject,
        issuer: row.issuer,
        fingerprint: row.fingerprint,
        validFrom: row.valid_from,
        validTo: row.valid_to,
        status: row.status,
        mailboxEmail: row.mailbox_email,
        daysUntilExpiry: Math.ceil((new Date(row.valid_to) - new Date()) / (1000 * 60 * 60 * 24)),
        createdAt: row.created_at
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    logger.error('Erreur list certificates:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur récupération certificats'
    });
  }
};

/**
 * GET /api/v1/certificates/:id
 * Récupérer un certificat
 */
const get = async (req, res) => {
  try {
    const { id } = req.params;
    const domainId = req.domain?.id || req.user.domainId;

    const result = await pool.query(
      `SELECT c.*, m.email as mailbox_email, d.domain_name
       FROM certificates c
       LEFT JOIN mailboxes m ON c.mailbox_id = m.id
       LEFT JOIN domains d ON c.domain_id = d.id
       WHERE c.id = $1 AND c.domain_id = $2`,
      [id, domainId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Certificat non trouvé',
        code: 'CERTIFICATE_NOT_FOUND'
      });
    }

    const cert = result.rows[0];

    res.json({
      success: true,
      data: {
        id: cert.id,
        type: cert.type,
        serialNumber: cert.serial_number,
        subject: cert.subject,
        issuer: cert.issuer,
        fingerprint: cert.fingerprint,
        validFrom: cert.valid_from,
        validTo: cert.valid_to,
        status: cert.status,
        domainName: cert.domain_name,
        mailboxEmail: cert.mailbox_email,
        extensions: cert.extensions,
        daysUntilExpiry: Math.ceil((new Date(cert.valid_to) - new Date()) / (1000 * 60 * 60 * 24)),
        createdAt: cert.created_at,
        updatedAt: cert.updated_at
      }
    });
  } catch (error) {
    logger.error('Erreur get certificate:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur récupération certificat'
    });
  }
};

/**
 * POST /api/v1/certificates/upload
 * Uploader un certificat
 */
const upload = async (req, res) => {
  const client = await pool.connect();

  try {
    const { type, mailboxId, passphrase } = req.body;
    const domainId = req.domain?.id || req.user.domainId;

    if (!req.files || !req.files.certificate) {
      return res.status(400).json({
        success: false,
        error: 'Fichier certificat requis',
        code: 'MISSING_CERTIFICATE'
      });
    }

    const certBuffer = req.files.certificate[0].buffer;
    const keyBuffer = req.files.privateKey ? req.files.privateKey[0].buffer : null;

    // Parser le certificat
    let certificate;
    try {
      const certPem = certBuffer.toString('utf8');
      certificate = forge.pki.certificateFromPem(certPem);
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: 'Format de certificat invalide',
        code: 'INVALID_CERTIFICATE_FORMAT'
      });
    }

    // Vérifier la clé privée si fournie
    if (keyBuffer) {
      try {
        const keyPem = keyBuffer.toString('utf8');
        const privateKey = forge.pki.privateKeyFromPem(keyPem);

        // Vérifier que la clé correspond au certificat
        const publicKey = certificate.publicKey;
        const match = publicKey.n.toString() === privateKey.n.toString();

        if (!match) {
          return res.status(400).json({
            success: false,
            error: 'La clé privée ne correspond pas au certificat',
            code: 'KEY_MISMATCH'
          });
        }
      } catch (error) {
        return res.status(400).json({
          success: false,
          error: 'Format de clé privée invalide',
          code: 'INVALID_KEY_FORMAT'
        });
      }
    }

    // Extraire les informations du certificat
    const subject = certificate.subject.attributes.reduce((acc, attr) => {
      acc[attr.shortName] = attr.value;
      return acc;
    }, {});

    const issuer = certificate.issuer.attributes.reduce((acc, attr) => {
      acc[attr.shortName] = attr.value;
      return acc;
    }, {});

    const serialNumber = certificate.serialNumber;
    const fingerprint = forge.md.sha256
      .create()
      .update(forge.asn1.toDer(forge.pki.certificateToAsn1(certificate)).getBytes())
      .digest()
      .toHex();

    const validFrom = certificate.validity.notBefore;
    const validTo = certificate.validity.notAfter;

    // Vérifier si le certificat n'existe pas déjà
    const existingResult = await client.query(
      'SELECT id FROM certificates WHERE fingerprint = $1 AND domain_id = $2',
      [fingerprint, domainId]
    );

    if (existingResult.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'Ce certificat existe déjà',
        code: 'CERTIFICATE_EXISTS'
      });
    }

    await client.query('BEGIN');

    // Insérer le certificat
    const insertResult = await client.query(
      `INSERT INTO certificates 
       (domain_id, mailbox_id, type, serial_number, subject, issuer, 
        fingerprint, valid_from, valid_to, certificate_pem, private_key_pem, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'active')
       RETURNING *`,
      [
        domainId,
        mailboxId || null,
        type,
        serialNumber,
        JSON.stringify(subject),
        JSON.stringify(issuer),
        fingerprint,
        validFrom,
        validTo,
        certBuffer.toString('utf8'),
        keyBuffer ? keyBuffer.toString('utf8') : null
      ]
    );

    // Log d'audit
    await client.query(
      `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details, ip_address)
       VALUES ($1, 'upload', 'certificate', $2, $3, $4)`,
      [req.user.userId, insertResult.rows[0].id, JSON.stringify({ type, serialNumber }), req.ip]
    );

    await client.query('COMMIT');

    logger.info(`Certificat uploadé: ${type} - ${serialNumber}`);

    res.status(201).json({
      success: true,
      message: 'Certificat uploadé avec succès',
      data: {
        id: insertResult.rows[0].id,
        type,
        serialNumber,
        validFrom,
        validTo
      }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Erreur upload certificate:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur upload certificat'
    });
  } finally {
    client.release();
  }
};

/**
 * DELETE /api/v1/certificates/:id
 * Supprimer un certificat
 */
const deleteCertificate = async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const domainId = req.domain?.id || req.user.domainId;

    // Vérifier que le certificat existe
    const certResult = await client.query(
      'SELECT * FROM certificates WHERE id = $1 AND domain_id = $2',
      [id, domainId]
    );

    if (certResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Certificat non trouvé',
        code: 'CERTIFICATE_NOT_FOUND'
      });
    }

    await client.query('BEGIN');

    // Supprimer le certificat
    await client.query('DELETE FROM certificates WHERE id = $1', [id]);

    // Log d'audit
    await client.query(
      `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, ip_address)
       VALUES ($1, 'delete', 'certificate', $2, $3)`,
      [req.user.userId, id, req.ip]
    );

    await client.query('COMMIT');

    logger.info(`Certificat supprimé: ${id}`);

    res.json({
      success: true,
      message: 'Certificat supprimé avec succès'
    });
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Erreur delete certificate:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur suppression certificat'
    });
  } finally {
    client.release();
  }
};

/**
 * POST /api/v1/certificates/verify
 * Vérifier un certificat sans l'importer
 */
const verify = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Fichier certificat requis'
      });
    }

    const certBuffer = req.file.buffer;
    const certPem = certBuffer.toString('utf8');

    let certificate;
    try {
      certificate = forge.pki.certificateFromPem(certPem);
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: 'Format de certificat invalide'
      });
    }

    const now = new Date();
    const isValid = now >= certificate.validity.notBefore && now <= certificate.validity.notAfter;

    const subject = certificate.subject.attributes.reduce((acc, attr) => {
      acc[attr.shortName] = attr.value;
      return acc;
    }, {});

    const issuer = certificate.issuer.attributes.reduce((acc, attr) => {
      acc[attr.shortName] = attr.value;
      return acc;
    }, {});

    res.json({
      success: true,
      data: {
        isValid,
        subject,
        issuer,
        serialNumber: certificate.serialNumber,
        validFrom: certificate.validity.notBefore,
        validTo: certificate.validity.notAfter,
        daysUntilExpiry: Math.ceil((certificate.validity.notAfter - now) / (1000 * 60 * 60 * 24))
      }
    });
  } catch (error) {
    logger.error('Erreur verify certificate:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur vérification certificat'
    });
  }
};

/**
 * GET /api/v1/certificates/:id/chain
 * Récupérer la chaîne de certificats
 */
const getChain = async (req, res) => {
  try {
    const { id } = req.params;
    const domainId = req.domain?.id || req.user.domainId;

    const result = await pool.query(
      'SELECT certificate_pem FROM certificates WHERE id = $1 AND domain_id = $2',
      [id, domainId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Certificat non trouvé'
      });
    }

    // TODO: Implémenter la construction de la chaîne complète
    // Pour l'instant, retourner juste le certificat
    const certificate = forge.pki.certificateFromPem(result.rows[0].certificate_pem);

    res.json({
      success: true,
      data: {
        certificates: [
          {
            subject: certificate.subject.attributes.reduce((acc, attr) => {
              acc[attr.shortName] = attr.value;
              return acc;
            }, {}),
            issuer: certificate.issuer.attributes.reduce((acc, attr) => {
              acc[attr.shortName] = attr.value;
              return acc;
            }, {}),
            validFrom: certificate.validity.notBefore,
            validTo: certificate.validity.notAfter
          }
        ]
      }
    });
  } catch (error) {
    logger.error('Erreur get chain:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur récupération chaîne'
    });
  }
};

/**
 * GET /api/v1/certificates/:id/validate
 * Validation complète d'un certificat
 */
const validateCertificate = async (req, res) => {
  try {
    const { id } = req.params;
    const domainId = req.domain?.id || req.user.domainId;

    const result = await pool.query('SELECT * FROM certificates WHERE id = $1 AND domain_id = $2', [
      id,
      domainId
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Certificat non trouvé'
      });
    }

    const cert = result.rows[0];
    const certificate = forge.pki.certificateFromPem(cert.certificate_pem);
    const now = new Date();

    const checks = [];
    let isValid = true;

    // Vérifier la validité temporelle
    if (now < certificate.validity.notBefore) {
      checks.push({ name: 'Validité temporelle', passed: false, message: 'Pas encore valide' });
      isValid = false;
    } else if (now > certificate.validity.notAfter) {
      checks.push({ name: 'Validité temporelle', passed: false, message: 'Expiré' });
      isValid = false;
    } else {
      checks.push({ name: 'Validité temporelle', passed: true });
    }

    // Vérifier le statut
    if (cert.status !== 'active') {
      checks.push({ name: 'Statut', passed: false, message: `Statut: ${cert.status}` });
      isValid = false;
    } else {
      checks.push({ name: 'Statut', passed: true });
    }

    // TODO: Ajouter d'autres vérifications (CRL, OCSP, chaîne de confiance)

    res.json({
      success: true,
      data: {
        isValid,
        checks,
        message: isValid ? 'Certificat valide' : 'Certificat invalide'
      }
    });
  } catch (error) {
    logger.error('Erreur validate certificate:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur validation certificat'
    });
  }
};

/**
 * POST /api/v1/certificates/:id/revoke
 * Révoquer un certificat
 */
const revoke = async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const { reason } = req.body;
    const domainId = req.domain?.id || req.user.domainId;

    const certResult = await client.query(
      'SELECT * FROM certificates WHERE id = $1 AND domain_id = $2',
      [id, domainId]
    );

    if (certResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Certificat non trouvé'
      });
    }

    await client.query('BEGIN');

    await client.query(
      `UPDATE certificates 
       SET status = 'revoked', revoked_at = NOW(), revocation_reason = $1, updated_at = NOW()
       WHERE id = $2`,
      [reason, id]
    );

    await client.query(
      `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details, ip_address)
       VALUES ($1, 'revoke', 'certificate', $2, $3, $4)`,
      [req.user.userId, id, JSON.stringify({ reason }), req.ip]
    );

    await client.query('COMMIT');

    logger.security(`Certificat révoqué: ${id}`, { reason });

    res.json({
      success: true,
      message: 'Certificat révoqué avec succès'
    });
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Erreur revoke certificate:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur révocation certificat'
    });
  } finally {
    client.release();
  }
};

/**
 * POST /api/v1/certificates/:id/renew
 * Initier le renouvellement
 */
const initiateRenewal = async (req, res) => {
  try {
    const { id } = req.params;
    const domainId = req.domain?.id || req.user.domainId;

    const result = await pool.query('SELECT * FROM certificates WHERE id = $1 AND domain_id = $2', [
      id,
      domainId
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Certificat non trouvé'
      });
    }

    // TODO: Implémenter la génération de CSR et l'intégration avec l'AC

    res.json({
      success: true,
      message: 'Processus de renouvellement initié',
      data: {
        status: 'pending',
        instructions: 'Contactez votre autorité de certification pour compléter le renouvellement'
      }
    });
  } catch (error) {
    logger.error('Erreur renew certificate:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur renouvellement certificat'
    });
  }
};

/**
 * GET /api/v1/certificates/:id/download
 * Télécharger un certificat
 */
const download = async (req, res) => {
  try {
    const { id } = req.params;
    const { format = 'pem' } = req.query;
    const domainId = req.domain?.id || req.user.domainId;

    const result = await pool.query(
      'SELECT certificate_pem, serial_number FROM certificates WHERE id = $1 AND domain_id = $2',
      [id, domainId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Certificat non trouvé'
      });
    }

    const cert = result.rows[0];
    let content = cert.certificate_pem;
    let contentType = 'application/x-pem-file';
    let extension = 'pem';

    if (format === 'der') {
      const certificate = forge.pki.certificateFromPem(cert.certificate_pem);
      const der = forge.asn1.toDer(forge.pki.certificateToAsn1(certificate));
      content = Buffer.from(der.getBytes(), 'binary');
      contentType = 'application/x-x509-ca-cert';
      extension = 'der';
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="certificate_${cert.serial_number}.${extension}"`
    );
    res.send(content);
  } catch (error) {
    logger.error('Erreur download certificate:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur téléchargement certificat'
    });
  }
};

/**
 * GET /api/v1/certificates/expiring
 * Certificats arrivant à expiration
 */
const getExpiring = async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const domainId = req.domain?.id || req.user.domainId;

    const result = await pool.query(
      `SELECT c.*, m.email as mailbox_email
       FROM certificates c
       LEFT JOIN mailboxes m ON c.mailbox_id = m.id
       WHERE c.domain_id = $1
         AND c.status = 'active'
         AND c.valid_to <= NOW() + INTERVAL '${parseInt(days)} days'
         AND c.valid_to > NOW()
       ORDER BY c.valid_to ASC`,
      [domainId]
    );

    res.json({
      success: true,
      data: result.rows.map(row => ({
        id: row.id,
        type: row.type,
        subject: row.subject,
        mailboxEmail: row.mailbox_email,
        validTo: row.valid_to,
        daysUntilExpiry: Math.ceil((new Date(row.valid_to) - new Date()) / (1000 * 60 * 60 * 24))
      }))
    });
  } catch (error) {
    logger.error('Erreur get expiring:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur récupération certificats'
    });
  }
};

/**
 * POST /api/v1/certificates/:id/alert
 * Configurer les alertes
 */
const configureAlert = async (req, res) => {
  // TODO: Implémenter la configuration des alertes
  res.status(501).json({
    success: false,
    error: 'Fonctionnalité en cours de développement'
  });
};

/**
 * GET /api/v1/certificates/all
 * Liste tous les certificats (Super Admin)
 */
const listAll = async (req, res) => {
  // TODO: Implémenter pour super admin
  res.status(501).json({
    success: false,
    error: 'Fonctionnalité en cours de développement'
  });
};

module.exports = {
  list,
  get,
  upload,
  delete: deleteCertificate,
  verify,
  getChain,
  validateCertificate,
  revoke,
  initiateRenewal,
  download,
  getExpiring,
  configureAlert,
  listAll
};
