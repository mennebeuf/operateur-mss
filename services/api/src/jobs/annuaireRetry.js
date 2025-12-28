/**
 * Job de retry pour les publications annuaire échouées
 * S'exécute toutes les heures
 * 
 * @module jobs/annuaireRetry
 */

const cron = require('node-cron');
const pool = require('../config/database');
const annuaireService = require('../services/annuaire/annuaireService');
const logger = require('../utils/logger');

const MAX_RETRY_ATTEMPTS = 5;
const BATCH_SIZE = 50;

/**
 * Job de retry pour les publications échouées
 * Planification: Toutes les heures
 */
cron.schedule('0 * * * *', async () => {
  logger.info('🔄 Lancement du job de retry annuaire');
  
  const client = await pool.connect();
  
  try {
    // Récupérer les publications en erreur ou en attente
    const { rows: pendingPublications } = await client.query(`
      SELECT 
        ap.*,
        m.email,
        m.type as mailbox_type,
        m.hide_from_directory,
        u.rpps_id,
        u.first_name,
        u.last_name,
        u.profession,
        u.specialty,
        d.domain_name,
        d.finess_juridique,
        d.organization_name
      FROM annuaire_publications ap
      JOIN mailboxes m ON ap.mailbox_id = m.id
      LEFT JOIN users u ON m.owner_id = u.id
      JOIN domains d ON m.domain_id = d.id
      WHERE ap.status IN ('pending', 'error')
      AND ap.retry_count < $1
      AND (ap.next_retry_at IS NULL OR ap.next_retry_at <= NOW())
      ORDER BY ap.created_at ASC
      LIMIT $2
    `, [MAX_RETRY_ATTEMPTS, BATCH_SIZE]);
    
    if (pendingPublications.length === 0) {
      logger.info('✅ Aucune publication en attente');
      return;
    }
    
    logger.info(`📋 ${pendingPublications.length} publication(s) à traiter`);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const pub of pendingPublications) {
      try {
        // Préparer les données pour l'annuaire
        const mailboxData = {
          email: pub.email,
          type: pub.mailbox_type,
          hideFromDirectory: pub.hide_from_directory,
          owner: pub.rpps_id ? {
            rpps: pub.rpps_id,
            firstName: pub.first_name,
            lastName: pub.last_name,
            profession: pub.profession,
            specialty: pub.specialty
          } : null,
          organization: {
            finessJuridique: pub.finess_juridique,
            name: pub.organization_name
          }
        };
        
        let result;
        
        if (pub.operation === 'publish') {
          result = await annuaireService.publishMailbox(mailboxData);
        } else if (pub.operation === 'unpublish') {
          result = await annuaireService.unpublishMailbox(pub.email);
        } else if (pub.operation === 'update') {
          result = await annuaireService.updateMailbox(mailboxData);
        }
        
        if (result.success) {
          // Marquer comme succès
          await client.query(`
            UPDATE annuaire_publications
            SET 
              status = 'success',
              completed_at = NOW(),
              response_data = $2
            WHERE id = $1
          `, [pub.id, JSON.stringify(result.data)]);
          
          successCount++;
          logger.info(`✅ Publication réussie: ${pub.email} (${pub.operation})`);
        } else {
          throw new Error(result.error || 'Erreur inconnue');
        }
        
      } catch (error) {
        errorCount++;
        
        // Calculer le prochain retry avec backoff exponentiel
        const nextRetryDelay = Math.pow(2, pub.retry_count + 1) * 60; // En minutes
        const nextRetryAt = new Date(Date.now() + nextRetryDelay * 60 * 1000);
        
        await client.query(`
          UPDATE annuaire_publications
          SET 
            status = 'error',
            retry_count = retry_count + 1,
            last_error = $2,
            next_retry_at = $3
          WHERE id = $1
        `, [pub.id, error.message, nextRetryAt]);
        
        logger.error(`❌ Échec publication ${pub.email}: ${error.message}`);
        
        // Si max retries atteint, notifier
        if (pub.retry_count + 1 >= MAX_RETRY_ATTEMPTS) {
          await notifyMaxRetriesReached(pub);
        }
      }
    }
    
    logger.info(`📊 Retry terminé: ${successCount} succès, ${errorCount} erreurs`);
    
  } catch (error) {
    logger.error('❌ Erreur job retry annuaire:', error);
  } finally {
    client.release();
  }
});

/**
 * Notifier quand le nombre max de retries est atteint
 * @param {Object} publication - Publication concernée
 */
async function notifyMaxRetriesReached(publication) {
  try {
    // Créer une alerte dans la table des notifications
    await pool.query(`
      INSERT INTO notifications (
        type,
        severity,
        title,
        message,
        metadata,
        target_roles
      ) VALUES (
        'annuaire_failure',
        'high',
        'Échec publication annuaire',
        $1,
        $2,
        ARRAY['super_admin', 'domain_admin']
      )
    `, [
      `La publication de ${publication.email} a échoué après ${MAX_RETRY_ATTEMPTS} tentatives`,
      JSON.stringify({
        mailbox_id: publication.mailbox_id,
        email: publication.email,
        operation: publication.operation,
        last_error: publication.last_error
      })
    ]);
    
    logger.warn(`⚠️ Notification créée pour ${publication.email} - max retries atteint`);
  } catch (error) {
    logger.error('Erreur création notification:', error);
  }
}

logger.info('✅ Job annuaireRetry initialisé (0 * * * *)');

module.exports = {};