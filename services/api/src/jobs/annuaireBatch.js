/**
 * Génération du flux quotidien pour l'annuaire ANS
 * S'exécute tous les jours à 2h du matin
 * 
 * @module jobs/annuaireBatch
 */

const cron = require('node-cron');
const fs = require('fs').promises;
const path = require('path');
const SftpClient = require('ssh2-sftp-client');
const pool = require('../config/database');
const logger = require('../utils/logger');

const OPERATOR_ID = process.env.OPERATOR_ID || 'UNKNOWN';
const SFTP_CONFIG = {
  host: process.env.ANNUAIRE_SFTP_HOST,
  port: parseInt(process.env.ANNUAIRE_SFTP_PORT) || 22,
  username: process.env.ANNUAIRE_SFTP_USER,
  password: process.env.ANNUAIRE_SFTP_PASSWORD
};

/**
 * Génération d'un flux quotidien pour l'annuaire
 * Planification: Tous les jours à 2h du matin
 */
cron.schedule('0 2 * * *', async () => {
  logger.info('📦 Génération du flux annuaire quotidien');
  
  const client = await pool.connect();
  
  try {
    const date = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const filename = `flux_annuaire_${OPERATOR_ID}_${date}.csv`;
    const filepath = path.join('/tmp', filename);
    
    // Récupérer toutes les opérations de la journée
    const { rows } = await client.query(`
      SELECT 
        ap.operation as type_operation,
        m.email as adresse_bal,
        CASE m.type 
          WHEN 'personal' THEN 'PERS'
          WHEN 'organizational' THEN 'ORG'
          WHEN 'applicative' THEN 'APP'
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
        END as liste_rouge,
        m.created_at as date_creation
      FROM annuaire_publications ap
      JOIN mailboxes m ON ap.mailbox_id = m.id
      LEFT JOIN users u ON m.owner_id = u.id
      JOIN domains d ON m.domain_id = d.id
      WHERE DATE(ap.created_at) = CURRENT_DATE - INTERVAL '1 day'
      AND ap.status = 'pending'
      ORDER BY ap.created_at ASC
    `);
    
    logger.info(`📊 ${rows.length} opération(s) à inclure dans le flux`);
    
    if (rows.length === 0) {
      logger.info('ℹ️ Aucune opération à traiter, flux non généré');
      return;
    }
    
    // Générer le fichier CSV
    const header = [
      'type_operation',
      'adresse_bal',
      'type_bal',
      'identifiant_pp',
      'nom',
      'prenom',
      'profession',
      'specialite',
      'finess_rattachement',
      'liste_rouge',
      'date_creation'
    ].join(';');
    
    const lines = rows.map(row => [
      row.type_operation,
      row.adresse_bal,
      row.type_bal,
      row.identifiant_pp || '',
      row.nom || '',
      row.prenom || '',
      row.profession || '',
      row.specialite || '',
      row.finess_rattachement,
      row.liste_rouge,
      row.date_creation ? new Date(row.date_creation).toISOString() : ''
    ].join(';'));
    
    const csvContent = header + '\n' + lines.join('\n');
    
    // Écrire le fichier localement
    await fs.writeFile(filepath, csvContent, 'utf8');
    logger.info(`📄 Fichier généré: ${filepath}`);
    
    // Upload via SFTP
    await uploadToSftp(filepath, filename);
    
    // Mettre à jour le statut des publications
    await client.query(`
      UPDATE annuaire_publications
      SET 
        status = 'submitted',
        submitted_at = NOW(),
        batch_filename = $1
      WHERE DATE(created_at) = CURRENT_DATE - INTERVAL '1 day'
      AND status = 'pending'
    `, [filename]);
    
    // Nettoyer le fichier local
    await fs.unlink(filepath);
    
    // Logger dans l'audit
    await client.query(`
      INSERT INTO audit_logs (action, resource_type, details, ip_address)
      VALUES ('annuaire_batch_upload', 'annuaire', $1, '127.0.0.1')
    `, [JSON.stringify({ filename, records_count: rows.length })]);
    
    logger.info(`✅ Flux déposé: ${filename} (${rows.length} enregistrements)`);
    
  } catch (error) {
    logger.error('❌ Erreur génération flux annuaire:', error);
    
    // Créer une notification d'erreur
    await pool.query(`
      INSERT INTO notifications (type, severity, title, message, target_roles)
      VALUES ('annuaire_batch_error', 'critical', 'Erreur flux annuaire', $1, ARRAY['super_admin'])
    `, [error.message]);
    
  } finally {
    client.release();
  }
});

/**
 * Upload d'un fichier vers le serveur SFTP ANS
 * @param {string} localPath - Chemin local du fichier
 * @param {string} remoteFilename - Nom du fichier distant
 */
async function uploadToSftp(localPath, remoteFilename) {
  const sftp = new SftpClient();
  
  try {
    logger.info(`📤 Connexion SFTP vers ${SFTP_CONFIG.host}...`);
    
    await sftp.connect(SFTP_CONFIG);
    
    const remotePath = `/incoming/${remoteFilename}`;
    await sftp.put(localPath, remotePath);
    
    logger.info(`✅ Fichier uploadé: ${remotePath}`);
    
  } catch (error) {
    logger.error('❌ Erreur SFTP:', error);
    throw error;
  } finally {
    await sftp.end();
  }
}

/**
 * Exécution manuelle du job (pour tests ou rattrapage)
 * @param {string} date - Date au format YYYY-MM-DD (optionnel)
 */
async function runManually(date = null) {
  logger.info(`🔧 Exécution manuelle du batch annuaire${date ? ` pour ${date}` : ''}`);
  // Implémenter la logique pour une date spécifique si nécessaire
}

logger.info('✅ Job annuaireBatch initialisé (0 2 * * *)');

module.exports = { runManually };