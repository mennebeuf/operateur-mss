/**
 * Surveillance des certificats IGC Santé
 * S'exécute tous les jours à 6h
 * 
 * @module jobs/certificateMonitor
 */

const cron = require('node-cron');
const { execSync } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const pool = require('../config/database');
const logger = require('../utils/logger');

// Seuils d'alerte en jours
const THRESHOLDS = {
  critical: 7,   // Alerte critique
  high: 30,      // Alerte haute
  medium: 60,    // Alerte moyenne
  low: 90        // Alerte basse (information)
};

const CERTIFICATES_DIR = process.env.CERTIFICATES_DIR || './config/certificates';

/**
 * Vérification des certificats
 * Planification: Tous les jours à 6h
 */
cron.schedule('0 6 * * *', async () => {
  logger.info('🔐 Vérification des certificats IGC Santé');
  
  try {
    const alerts = [];
    
    // 1. Vérifier les certificats en base de données
    const dbAlerts = await checkDatabaseCertificates();
    alerts.push(...dbAlerts);
    
    // 2. Vérifier les certificats fichiers (serveur)
    const fileAlerts = await checkFileCertificates();
    alerts.push(...fileAlerts);
    
    // 3. Créer les notifications
    for (const alert of alerts) {
      await createCertificateAlert(alert);
    }
    
    // 4. Logger dans l'audit
    await pool.query(`
      INSERT INTO audit_logs (action, resource_type, details, ip_address)
      VALUES ('certificates_checked', 'certificates', $1, '127.0.0.1')
    `, [JSON.stringify({ alerts_count: alerts.length })]);
    
    logger.info(`✅ Vérification terminée: ${alerts.length} alerte(s)`);
    
  } catch (error) {
    logger.error('❌ Erreur vérification certificats:', error);
  }
});

/**
 * Vérifier les certificats stockés en base de données
 * @returns {Array} Liste des alertes
 */
async function checkDatabaseCertificates() {
  const alerts = [];
  
  const { rows: certificates } = await pool.query(`
    SELECT 
      c.id,
      c.type,
      c.subject,
      c.serial_number,
      c.expires_at,
      c.status,
      d.domain_name,
      d.id as domain_id,
      EXTRACT(DAY FROM (c.expires_at - NOW())) as days_remaining
    FROM certificates c
    LEFT JOIN domains d ON c.domain_id = d.id
    WHERE c.status = 'active'
    AND c.expires_at > NOW()
    ORDER BY c.expires_at ASC
  `);
  
  for (const cert of certificates) {
    const daysRemaining = Math.floor(cert.days_remaining);
    let severity = null;
    
    if (daysRemaining <= THRESHOLDS.critical) {
      severity = 'critical';
    } else if (daysRemaining <= THRESHOLDS.high) {
      severity = 'high';
    } else if (daysRemaining <= THRESHOLDS.medium) {
      severity = 'medium';
    } else if (daysRemaining <= THRESHOLDS.low) {
      severity = 'low';
    }
    
    if (severity) {
      alerts.push({
        type: 'database',
        certificateId: cert.id,
        certificateType: cert.type,
        subject: cert.subject,
        serialNumber: cert.serial_number,
        domainName: cert.domain_name,
        domainId: cert.domain_id,
        expiresAt: cert.expires_at,
        daysRemaining,
        severity
      });
    }
  }
  
  // Vérifier aussi les certificats expirés non marqués
  const { rows: expiredCerts } = await pool.query(`
    UPDATE certificates
    SET status = 'expired'
    WHERE status = 'active'
    AND expires_at < NOW()
    RETURNING id, subject, type
  `);
  
  if (expiredCerts.length > 0) {
    logger.warn(`⚠️ ${expiredCerts.length} certificat(s) marqué(s) comme expiré(s)`);
    
    for (const cert of expiredCerts) {
      alerts.push({
        type: 'expired',
        certificateId: cert.id,
        certificateType: cert.type,
        subject: cert.subject,
        daysRemaining: 0,
        severity: 'critical'
      });
    }
  }
  
  return alerts;
}

/**
 * Vérifier les certificats fichiers (serveur)
 * @returns {Array} Liste des alertes
 */
async function checkFileCertificates() {
  const alerts = [];
  
  const certPaths = [
    { path: path.join(CERTIFICATES_DIR, 'server/server.crt'), name: 'Serveur principal' },
    { path: path.join(CERTIFICATES_DIR, 'server/fullchain.pem'), name: 'Chaîne complète' }
  ];
  
  // Ajouter les certificats de domaines
  try {
    const domainsDir = path.join(CERTIFICATES_DIR, 'domains');
    const domains = await fs.readdir(domainsDir);
    
    for (const domain of domains) {
      const certPath = path.join(domainsDir, domain, 'cert.pem');
      certPaths.push({ path: certPath, name: `Domaine ${domain}` });
    }
  } catch {
    // Répertoire domains n'existe pas
  }
  
  for (const { path: certPath, name } of certPaths) {
    try {
      await fs.access(certPath);
      
      // Utiliser openssl pour vérifier la date d'expiration
      const output = execSync(
        `openssl x509 -in "${certPath}" -noout -enddate 2>/dev/null || echo "error"`,
        { encoding: 'utf8' }
      );
      
      if (output.includes('error')) {
        logger.warn(`⚠️ Impossible de lire le certificat: ${name}`);
        continue;
      }
      
      // Parser la date d'expiration
      const match = output.match(/notAfter=(.+)/);
      if (match) {
        const expiresAt = new Date(match[1]);
        const daysRemaining = Math.floor((expiresAt - new Date()) / (1000 * 60 * 60 * 24));
        
        let severity = null;
        
        if (daysRemaining <= THRESHOLDS.critical) {
          severity = 'critical';
        } else if (daysRemaining <= THRESHOLDS.high) {
          severity = 'high';
        } else if (daysRemaining <= THRESHOLDS.medium) {
          severity = 'medium';
        } else if (daysRemaining <= THRESHOLDS.low) {
          severity = 'low';
        }
        
        if (severity) {
          alerts.push({
            type: 'file',
            path: certPath,
            name,
            expiresAt,
            daysRemaining,
            severity
          });
        }
      }
    } catch {
      // Fichier n'existe pas
    }
  }
  
  return alerts;
}

/**
 * Créer une alerte pour un certificat
 * @param {Object} alert - Données de l'alerte
 */
async function createCertificateAlert(alert) {
  const severityMap = {
    critical: 'critical',
    high: 'high',
    medium: 'medium',
    low: 'low'
  };
  
  const title = alert.daysRemaining === 0
    ? `🚨 Certificat expiré: ${alert.name || alert.subject}`
    : `⚠️ Certificat expire dans ${alert.daysRemaining} jour(s): ${alert.name || alert.subject}`;
  
  const message = alert.type === 'file'
    ? `Le certificat fichier "${alert.name}" (${alert.path}) expire le ${new Date(alert.expiresAt).toLocaleDateString('fr-FR')}`
    : `Le certificat ${alert.certificateType} pour ${alert.domainName || 'serveur'} expire le ${new Date(alert.expiresAt).toLocaleDateString('fr-FR')}`;
  
  // Vérifier si une notification existe déjà pour ce certificat
  const { rows: existing } = await pool.query(`
    SELECT id FROM notifications
    WHERE type = 'certificate_expiry'
    AND metadata->>'certificate_id' = $1
    AND created_at > NOW() - INTERVAL '24 hours'
  `, [alert.certificateId || alert.path]);
  
  if (existing.length > 0) {
    logger.info(`ℹ️ Notification déjà existante pour ${alert.name || alert.subject}`);
    return;
  }
  
  await pool.query(`
    INSERT INTO notifications (
      type,
      severity,
      title,
      message,
      metadata,
      target_roles
    ) VALUES (
      'certificate_expiry',
      $1,
      $2,
      $3,
      $4,
      ARRAY['super_admin']
    )
  `, [
    severityMap[alert.severity],
    title,
    message,
    JSON.stringify({
      certificate_id: alert.certificateId || null,
      certificate_path: alert.path || null,
      certificate_type: alert.certificateType || null,
      domain_id: alert.domainId || null,
      domain_name: alert.domainName || null,
      expires_at: alert.expiresAt,
      days_remaining: alert.daysRemaining
    })
  ]);
  
  logger.info(`📧 Notification créée: ${title}`);
}

/**
 * Exécution manuelle de la vérification
 * @returns {Object} Résultats de la vérification
 */
async function runManually() {
  logger.info('🔧 Vérification manuelle des certificats');
  
  const dbAlerts = await checkDatabaseCertificates();
  const fileAlerts = await checkFileCertificates();
  
  return {
    database_alerts: dbAlerts,
    file_alerts: fileAlerts,
    total: dbAlerts.length + fileAlerts.length
  };
}

logger.info('✅ Job certificateMonitor initialisé (0 6 * * *)');

module.exports = { runManually, checkDatabaseCertificates, checkFileCertificates };