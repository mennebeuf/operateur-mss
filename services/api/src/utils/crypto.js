// services/api/src/utils/crypto.js
const crypto = require('crypto');
const bcrypt = require('bcrypt');

const ALGORITHM = 'aes-256-gcm';
const SALT_ROUNDS = 12;
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * Utilitaires cryptographiques pour MSSanté
 * Conformes aux exigences ANSSI
 */
class CryptoUtils {
  constructor() {
    this.encryptionKey = process.env.ENCRYPTION_KEY;
    
    if (process.env.NODE_ENV === 'production' && !this.encryptionKey) {
      throw new Error('ENCRYPTION_KEY must be set in production');
    }
  }

  /**
   * Obtenir la clé de chiffrement (32 bytes pour AES-256)
   * @returns {Buffer}
   */
  getKey() {
    if (!this.encryptionKey) {
      throw new Error('Encryption key not configured');
    }
    return crypto.scryptSync(this.encryptionKey, 'mssante-salt', 32);
  }

  /**
   * Chiffrer une chaîne
   * @param {string} text - Texte à chiffrer
   * @returns {string} Texte chiffré (format: iv:authTag:encrypted)
   */
  encrypt(text) {
    if (!text) return null;
    
    const iv = crypto.randomBytes(IV_LENGTH);
    const key = this.getKey();
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  /**
   * Déchiffrer une chaîne
   * @param {string} encryptedText - Texte chiffré
   * @returns {string} Texte déchiffré
   */
  decrypt(encryptedText) {
    if (!encryptedText) return null;
    
    const parts = encryptedText.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted text format');
    }

    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];
    
    const key = this.getKey();
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  /**
   * Hasher un mot de passe avec bcrypt
   * @param {string} password - Mot de passe en clair
   * @returns {Promise<string>} Hash bcrypt
   */
  async hashPassword(password) {
    return bcrypt.hash(password, SALT_ROUNDS);
  }

  /**
   * Vérifier un mot de passe
   * @param {string} password - Mot de passe à vérifier
   * @param {string} hash - Hash bcrypt
   * @returns {Promise<boolean>}
   */
  async verifyPassword(password, hash) {
    return bcrypt.compare(password, hash);
  }

  /**
   * Générer un token aléatoire sécurisé
   * @param {number} length - Longueur en bytes (défaut: 32)
   * @returns {string} Token en hexadécimal
   */
  generateToken(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Générer un ID unique (UUID v4)
   * @returns {string}
   */
  generateUUID() {
    return crypto.randomUUID();
  }

  /**
   * Calculer le hash SHA-256 d'une chaîne
   * @param {string} text - Texte à hasher
   * @returns {string} Hash en hexadécimal
   */
  sha256(text) {
    return crypto.createHash('sha256').update(text).digest('hex');
  }

  /**
   * Calculer le hash SHA-512 d'une chaîne
   * @param {string} text - Texte à hasher
   * @returns {string} Hash en hexadécimal
   */
  sha512(text) {
    return crypto.createHash('sha512').update(text).digest('hex');
  }

  /**
   * Générer un HMAC SHA-256
   * @param {string} data - Données à signer
   * @param {string} secret - Clé secrète
   * @returns {string} HMAC en hexadécimal
   */
  hmacSha256(data, secret) {
    return crypto.createHmac('sha256', secret).update(data).digest('hex');
  }

  /**
   * Générer un code de vérification numérique
   * @param {number} digits - Nombre de chiffres (défaut: 6)
   * @returns {string}
   */
  generateVerificationCode(digits = 6) {
    const max = Math.pow(10, digits);
    const code = crypto.randomInt(0, max);
    return code.toString().padStart(digits, '0');
  }

  /**
   * Générer un mot de passe aléatoire sécurisé
   * @param {number} length - Longueur (défaut: 16)
   * @returns {string}
   */
  generateSecurePassword(length = 16) {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    
    const bytes = crypto.randomBytes(length);
    for (let i = 0; i < length; i++) {
      password += chars[bytes[i] % chars.length];
    }
    
    return password;
  }

  /**
   * Masquer partiellement une adresse email
   * @param {string} email - Email à masquer
   * @returns {string}
   */
  maskEmail(email) {
    if (!email || !email.includes('@')) return email;
    
    const [local, domain] = email.split('@');
    const masked = local.length > 2 
      ? local[0] + '*'.repeat(local.length - 2) + local[local.length - 1]
      : local[0] + '*';
    
    return `${masked}@${domain}`;
  }

  /**
   * Vérifier l'intégrité d'un fichier via checksum
   * @param {Buffer} fileBuffer - Contenu du fichier
   * @param {string} expectedHash - Hash attendu
   * @param {string} algorithm - Algorithme (défaut: sha256)
   * @returns {boolean}
   */
  verifyFileIntegrity(fileBuffer, expectedHash, algorithm = 'sha256') {
    const actualHash = crypto.createHash(algorithm).update(fileBuffer).digest('hex');
    return actualHash === expectedHash.toLowerCase();
  }

  /**
   * Calculer le checksum d'un fichier
   * @param {Buffer} fileBuffer - Contenu du fichier
   * @param {string} algorithm - Algorithme (défaut: sha256)
   * @returns {string}
   */
  calculateChecksum(fileBuffer, algorithm = 'sha256') {
    return crypto.createHash(algorithm).update(fileBuffer).digest('hex');
  }
}

module.exports = new CryptoUtils();