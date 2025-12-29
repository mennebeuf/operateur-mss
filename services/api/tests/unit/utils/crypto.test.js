// services/api/tests/unit/utils/crypto.test.js

/**
 * Tests unitaires pour les utilitaires cryptographiques
 */

// Mock des variables d'environnement
process.env.ENCRYPTION_KEY = 'test-encryption-key-for-unit-tests';

const crypto = require('../../../src/utils/crypto');

describe('CryptoUtils', () => {
  describe('encrypt / decrypt', () => {
    it('devrait chiffrer et déchiffrer correctement une chaîne', () => {
      const original = 'Mon texte secret à chiffrer';
      const encrypted = crypto.encrypt(original);
      const decrypted = crypto.decrypt(encrypted);

      expect(decrypted).toBe(original);
      expect(encrypted).not.toBe(original);
    });

    it('devrait retourner null pour une entrée null', () => {
      expect(crypto.encrypt(null)).toBeNull();
      expect(crypto.decrypt(null)).toBeNull();
    });

    it('devrait retourner null pour une entrée undefined', () => {
      expect(crypto.encrypt(undefined)).toBeNull();
      expect(crypto.decrypt(undefined)).toBeNull();
    });

    it('devrait générer un chiffrement différent à chaque appel (IV aléatoire)', () => {
      const original = 'Même texte';
      const encrypted1 = crypto.encrypt(original);
      const encrypted2 = crypto.encrypt(original);

      expect(encrypted1).not.toBe(encrypted2);
      expect(crypto.decrypt(encrypted1)).toBe(original);
      expect(crypto.decrypt(encrypted2)).toBe(original);
    });

    it('devrait lever une erreur pour un format de chiffrement invalide', () => {
      expect(() => crypto.decrypt('invalid-format')).toThrow('Invalid encrypted text format');
      expect(() => crypto.decrypt('part1:part2')).toThrow('Invalid encrypted text format');
    });

    it('devrait gérer les caractères spéciaux et Unicode', () => {
      const original = '🔐 Données sensibles: éàü @#$%';
      const encrypted = crypto.encrypt(original);
      const decrypted = crypto.decrypt(encrypted);

      expect(decrypted).toBe(original);
    });

    it('devrait gérer les longues chaînes', () => {
      const original = 'A'.repeat(10000);
      const encrypted = crypto.encrypt(original);
      const decrypted = crypto.decrypt(encrypted);

      expect(decrypted).toBe(original);
    });
  });

  describe('hashPassword / verifyPassword', () => {
    it('devrait hasher un mot de passe et le vérifier correctement', async () => {
      const password = 'MonMotDePasse123!';
      const hash = await crypto.hashPassword(password);

      expect(hash).not.toBe(password);
      expect(hash).toMatch(/^\$2[aby]?\$/);
      expect(await crypto.verifyPassword(password, hash)).toBe(true);
    });

    it('devrait rejeter un mauvais mot de passe', async () => {
      const password = 'MonMotDePasse123!';
      const hash = await crypto.hashPassword(password);

      expect(await crypto.verifyPassword('MauvaisMotDePasse', hash)).toBe(false);
    });

    it('devrait générer des hashes différents pour le même mot de passe', async () => {
      const password = 'MonMotDePasse123!';
      const hash1 = await crypto.hashPassword(password);
      const hash2 = await crypto.hashPassword(password);

      expect(hash1).not.toBe(hash2);
      expect(await crypto.verifyPassword(password, hash1)).toBe(true);
      expect(await crypto.verifyPassword(password, hash2)).toBe(true);
    });
  });

  describe('generateToken', () => {
    it('devrait générer un token de 64 caractères par défaut (32 bytes en hex)', () => {
      const token = crypto.generateToken();
      expect(token).toHaveLength(64);
      expect(token).toMatch(/^[a-f0-9]+$/);
    });

    it('devrait générer un token de longueur personnalisée', () => {
      const token16 = crypto.generateToken(16);
      const token64 = crypto.generateToken(64);

      expect(token16).toHaveLength(32);
      expect(token64).toHaveLength(128);
    });

    it('devrait générer des tokens uniques', () => {
      const tokens = new Set();
      for (let i = 0; i < 100; i++) {
        tokens.add(crypto.generateToken());
      }
      expect(tokens.size).toBe(100);
    });
  });

  describe('generateUUID', () => {
    it('devrait générer un UUID v4 valide', () => {
      const uuid = crypto.generateUUID();
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      
      expect(uuid).toMatch(uuidRegex);
    });

    it('devrait générer des UUIDs uniques', () => {
      const uuids = new Set();
      for (let i = 0; i < 100; i++) {
        uuids.add(crypto.generateUUID());
      }
      expect(uuids.size).toBe(100);
    });
  });

  describe('sha256 / sha512', () => {
    it('devrait calculer un hash SHA-256 correct', () => {
      const hash = crypto.sha256('test');
      expect(hash).toBe('9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08');
      expect(hash).toHaveLength(64);
    });

    it('devrait calculer un hash SHA-512 correct', () => {
      const hash = crypto.sha512('test');
      expect(hash).toHaveLength(128);
      expect(hash).toMatch(/^[a-f0-9]+$/);
    });

    it('devrait retourner le même hash pour la même entrée', () => {
      const hash1 = crypto.sha256('identique');
      const hash2 = crypto.sha256('identique');
      expect(hash1).toBe(hash2);
    });

    it('devrait retourner des hashes différents pour des entrées différentes', () => {
      const hash1 = crypto.sha256('texte1');
      const hash2 = crypto.sha256('texte2');
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('hmacSha256', () => {
    it('devrait calculer un HMAC SHA-256 correct', () => {
      const hmac = crypto.hmacSha256('data', 'secret');
      expect(hmac).toHaveLength(64);
      expect(hmac).toMatch(/^[a-f0-9]+$/);
    });

    it('devrait retourner des HMAC différents pour des secrets différents', () => {
      const hmac1 = crypto.hmacSha256('data', 'secret1');
      const hmac2 = crypto.hmacSha256('data', 'secret2');
      expect(hmac1).not.toBe(hmac2);
    });
  });

  describe('generateVerificationCode', () => {
    it('devrait générer un code à 6 chiffres par défaut', () => {
      const code = crypto.generateVerificationCode();
      expect(code).toMatch(/^\d{6}$/);
    });

    it('devrait générer un code avec le nombre de chiffres spécifié', () => {
      const code4 = crypto.generateVerificationCode(4);
      const code8 = crypto.generateVerificationCode(8);

      expect(code4).toMatch(/^\d{4}$/);
      expect(code8).toMatch(/^\d{8}$/);
    });

    it('devrait padder avec des zéros si nécessaire', () => {
      // Tester plusieurs fois pour augmenter les chances d'avoir un code commençant par 0
      let foundLeadingZero = false;
      for (let i = 0; i < 1000 && !foundLeadingZero; i++) {
        const code = crypto.generateVerificationCode(6);
        if (code.startsWith('0')) {
          foundLeadingZero = true;
          expect(code).toHaveLength(6);
        }
      }
    });
  });

  describe('generateSecurePassword', () => {
    it('devrait générer un mot de passe de 16 caractères par défaut', () => {
      const password = crypto.generateSecurePassword();
      expect(password).toHaveLength(16);
    });

    it('devrait générer un mot de passe de longueur personnalisée', () => {
      const password = crypto.generateSecurePassword(24);
      expect(password).toHaveLength(24);
    });

    it('devrait contenir différents types de caractères', () => {
      const password = crypto.generateSecurePassword(32);
      // Vérifier la présence de différents types (probabiliste sur 32 chars)
      expect(password).toMatch(/[a-z]/);
      expect(password).toMatch(/[A-Z]/);
      expect(password).toMatch(/[0-9]/);
    });
  });

  describe('maskEmail', () => {
    it('devrait masquer correctement une adresse email standard', () => {
      expect(crypto.maskEmail('jean.dupont@example.com')).toBe('j*********t@example.com');
    });

    it('devrait gérer les emails courts', () => {
      expect(crypto.maskEmail('ab@test.fr')).toBe('a*@test.fr');
    });

    it('devrait retourner null pour une entrée null', () => {
      expect(crypto.maskEmail(null)).toBeNull();
    });

    it('devrait retourner l\'entrée si pas de @', () => {
      expect(crypto.maskEmail('pasunemail')).toBe('pasunemail');
    });
  });

  describe('verifyFileIntegrity / calculateChecksum', () => {
    it('devrait calculer et vérifier le checksum d\'un fichier', () => {
      const fileContent = Buffer.from('Contenu du fichier test');
      const checksum = crypto.calculateChecksum(fileContent);

      expect(crypto.verifyFileIntegrity(fileContent, checksum)).toBe(true);
    });

    it('devrait échouer pour un checksum incorrect', () => {
      const fileContent = Buffer.from('Contenu du fichier test');
      const wrongChecksum = 'a'.repeat(64);

      expect(crypto.verifyFileIntegrity(fileContent, wrongChecksum)).toBe(false);
    });

    it('devrait supporter différents algorithmes', () => {
      const fileContent = Buffer.from('Test content');
      const sha256 = crypto.calculateChecksum(fileContent, 'sha256');
      const sha512 = crypto.calculateChecksum(fileContent, 'sha512');

      expect(sha256).toHaveLength(64);
      expect(sha512).toHaveLength(128);
    });
  });
});