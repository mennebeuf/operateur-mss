// services/api/src/controllers/admin/settingsController.js
/**
 * Contrôleur de configuration système (Super Admin)
 */

const { pool } = require('../../config/database');
const logger = require('../../utils/logger');
const redis = require('../../config/redis');

/**
 * GET /api/v1/admin/settings
 * Récupérer la configuration système
 */
const getSettings = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM system_settings ORDER BY category, key');

    const settings = {};
    result.rows.forEach(row => {
      if (!settings[row.category]) {
        settings[row.category] = {};
      }
      settings[row.category][row.key] = row.value;
    });

    res.json({
      success: true,
      data: settings
    });
  } catch (error) {
    logger.error('Erreur get settings:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur récupération paramètres'
    });
  }
};

/**
 * PUT /api/v1/admin/settings
 * Mettre à jour la configuration
 */
const updateSettings = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { category, settings } = req.body;

    for (const [key, value] of Object.entries(settings)) {
      await client.query(
        `INSERT INTO system_settings (category, key, value)
         VALUES ($1, $2, $3)
         ON CONFLICT (category, key)
         DO UPDATE SET value = $3, updated_at = NOW()`,
        [category, key, value]
      );
    }

    await client.query('COMMIT');

    // Invalider le cache Redis
    await redis.del(`settings:${category}`);

    logger.info('Paramètres mis à jour:', { category, keys: Object.keys(settings) });

    res.json({
      success: true,
      message: 'Paramètres mis à jour'
    });
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Erreur update settings:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur mise à jour paramètres'
    });
  } finally {
    client.release();
  }
};

/**
 * GET /api/v1/admin/settings/:category/:key
 * Récupérer un paramètre spécifique
 */
const getSetting = async (req, res) => {
  try {
    const { category, key } = req.params;

    const result = await pool.query(
      'SELECT * FROM system_settings WHERE category = $1 AND key = $2',
      [category, key]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Paramètre non trouvé'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    logger.error('Erreur get setting:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur récupération paramètre'
    });
  }
};

module.exports = {
  getSettings,
  updateSettings,
  getSetting
};