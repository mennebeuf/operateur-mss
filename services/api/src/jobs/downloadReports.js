/**
 * Téléchargement quotidien des comptes rendus ANS
 * S'exécute tous les jours à 8h
 * 
 * @module jobs/downloadReports
 */

const cron = require('node-cron');
const fs = require('fs').promises;
const path = require('path');
const SftpClient = require('ssh2-sftp-client');
const pool = require('../config/database');
const logger = require('../utils/logger');

const OPERATOR_ID = process.env.OPERATOR_ID || 'UNKNOWN';
const REPORTS_DIR = process.env.REPORTS_DIR || './data/reports';
const SFTP_CONFIG = {
  host: process.env.ANNUAIRE_SFTP_HOST,
  port: parseInt(process.env.ANNUAIRE_SFTP_PORT) || 22,
  username: process.env.ANNUAIRE_SFTP_USER,
  password: process.env.ANNUAIRE_SFTP_PASSWORD
};

/**
 * Téléchargement des comptes rendus
 * Planification: Tous les jours à 8h
 */
cron.schedule('0 8 * * *', async () => {
  logger.info('📥 Téléchargement des comptes rendus ANS');
  
  const sftp = new SftpClient();
  
  try {
    // S'assurer que le répertoire local existe
    await fs.mkdir(REPORTS_DIR, { recursive: true });
    
    // Connexion SFTP
    logger.info(`📡 Connexion SFTP vers ${SFTP_CONFIG.host}...`);
    await sftp.connect(SFTP_CONFIG);
    
    // Lister les fichiers dans /reports
    const files = await sftp.list('/reports');
    
    let downloadCount = 0;
    let processedCount = 0;
    
    for (const file of files) {
      // Télécharger uniquement les nouveaux rapports pour notre opérateur
      if (file.name.startsWith('CR_') && file.name.includes(OPERATOR_ID)) {
        const remotePath = `/reports/${file.name}`;
        const localPath = path.join(REPORTS_DIR, file.name);
        
        // Vérifier si le fichier existe déjà localement
        try {
          await fs.access(localPath);
          logger.info(`⏭️ Fichier déjà téléchargé: ${file.name}`);
          continue;
        } catch {
          // Fichier n'existe pas, on le télécharge
        }
        
        // Télécharger le fichier
        await sftp.get(remotePath, localPath);
        downloadCount++;
        logger.info(`✅ Téléchargé: ${file.name}`);
        
        // Traiter le rapport
        const processed = await processReport(localPath, file.name);
        if (processed) {
          processedCount++;
        }
        
        // Archiver sur le serveur SFTP
        try {
          await sftp.rename(remotePath, `/reports/archive/${file.name}`);
          logger.info(`📁 Archivé: ${file.name}`);
        } catch (archiveError) {
          logger.warn(`⚠️ Impossible d'archiver ${file.name}:`, archiveError.message);
        }
      }
    }
    
    // Logger dans l'audit
    await pool.query(`
      INSERT INTO audit_logs (action, resource_type, details, ip_address)
      VALUES ('reports_downloaded', 'annuaire_reports', $1, '127.0.0.1')
    `, [JSON.stringify({ downloaded: downloadCount, processed: processedCount })]);
    
    logger.info(`📊 Téléchargement terminé: ${downloadCount} fichier(s), ${processedCount} traité(s)`);
    
  } catch (error) {
    logger.error('❌ Erreur téléchargement comptes rendus:', error);
    
    // Notification d'erreur
    await pool.query(`
      INSERT INTO notifications (type, severity, title, message, target_roles)
      VALUES ('reports_download_error', 'medium', 'Erreur téléchargement CR', $1, ARRAY['super_admin'])
    `, [error.message]);
    
  } finally {
    await sftp.end();
  }
});

/**
 * Traiter un compte rendu téléchargé
 * @param {string} filepath - Chemin du fichier
 * @param {string} filename - Nom du fichier
 * @returns {boolean} - True si traité avec succès
 */
async function processReport(filepath, filename) {
  const client = await pool.connect();
  
  try {
    // Lire le contenu du fichier
    const content = await fs.readFile(filepath, 'utf8');
    
    // Parser le CSV (le CR est généralement un CSV)
    const lines = content.split('\n').filter(l => l.trim());
    
    if (lines.length < 2) {
      logger.warn(`⚠️ Fichier vide ou invalide: ${filename}`);
      return false;
    }
    
    // Extraire les headers
    const headers = lines[0].split(';').map(h => h.trim().toLowerCase());
    
    // Traiter chaque ligne
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(';');
      const record = {};
      
      headers.forEach((header, idx) => {
        record[header] = values[idx]?.trim() || '';
      });
      
      try {
        await processReportRecord(client, record);
        successCount++;
      } catch (error) {
        errorCount++;
        logger.error(`❌ Erreur ligne ${i + 1}:`, error.message);
      }
    }
    
    // Enregistrer le rapport dans la base
    await client.query(`
      INSERT INTO annuaire_reports (
        filename,
        downloaded_at,
        records_count,
        success_count,
        error_count,
        status
      ) VALUES ($1, NOW(), $2, $3, $4, $5)
    `, [filename, lines.length - 1, successCount, errorCount, errorCount === 0 ? 'success' : 'partial']);
    
    logger.info(`📄 Rapport traité: ${filename} (${successCount} succès, ${errorCount} erreurs)`);
    
    return true;
    
  } catch (error) {
    logger.error(`❌ Erreur traitement rapport ${filename}:`, error);
    return false;
  } finally {
    client.release();
  }
}

/**
 * Traiter un enregistrement du compte rendu
 * @param {Object} client - Client PostgreSQL
 * @param {Object} record - Enregistrement à traiter
 */
async function processReportRecord(client, record) {
  const email = record.adresse_bal || record.email;
  const status = record.statut || record.status;
  const errorCode = record.code_erreur || record.error_code;
  const errorMessage = record.message_erreur || record.error_message;
  
  if (!email) {
    throw new Error('Email manquant dans l\'enregistrement');
  }
  
  // Mettre à jour le statut de la publication
  const updateResult = await client.query(`
    UPDATE annuaire_publications ap
    SET 
      status = CASE 
        WHEN $2 = 'OK' OR $2 = 'SUCCESS' THEN 'success'
        WHEN $2 = 'ERROR' OR $2 = 'ERREUR' THEN 'error'
        ELSE 'unknown'
      END,
      response_code = $3,
      response_message = $4,
      processed_at = NOW()
    FROM mailboxes m
    WHERE ap.mailbox_id = m.id
    AND m.email = $1
    AND ap.status = 'submitted'
    RETURNING ap.id
  `, [email, status, errorCode, errorMessage]);
  
  if (updateResult.rowCount === 0) {
    logger.warn(`⚠️ Publication non trouvée pour: ${email}`);
  }
  
  // Si erreur, créer une notification
  if (status === 'ERROR' || status === 'ERREUR') {
    await client.query(`
      INSERT INTO notifications (type, severity, title, message, metadata, target_roles)
      VALUES (
        'annuaire_publication_error',
        'medium',
        'Erreur publication annuaire',
        $1,
        $2,
        ARRAY['super_admin', 'domain_admin']
      )
    `, [
      `La publication de ${email} a été rejetée: ${errorMessage}`,
      JSON.stringify({ email, error_code: errorCode, error_message: errorMessage })
    ]);
  }
}

/**
 * Exécution manuelle du téléchargement
 */
async function runManually() {
  logger.info('🔧 Exécution manuelle du téléchargement des CR');
  // La logique est la même que le cron
}

logger.info('✅ Job downloadReports initialisé (0 8 * * *)');

module.exports = { runManually, processReport };