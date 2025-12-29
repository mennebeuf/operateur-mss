// services/api/tests/unit/utils/index.test.js

/**
 * Tests unitaires pour le point d'entrée des utilitaires
 * Vérifie que tous les modules sont correctement exportés
 */

// Mocks nécessaires
jest.mock('winston', () => {
  const mockFormat = {
    combine: jest.fn(() => mockFormat),
    timestamp: jest.fn(() => mockFormat),
    errors: jest.fn(() => mockFormat),
    printf: jest.fn(() => mockFormat),
    json: jest.fn(() => mockFormat),
    colorize: jest.fn(() => mockFormat)
  };

  return {
    format: mockFormat,
    transports: {
      Console: jest.fn(),
      File: jest.fn()
    },
    createLogger: jest.fn(() => ({
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      add: jest.fn()
    }))
  };
});

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({
    sendMail: jest.fn(),
    verify: jest.fn(),
    close: jest.fn()
  }))
}));

jest.mock('../../../src/config/database', () => ({
  pool: { query: jest.fn() }
}));

// Configuration de l'environnement
process.env.ENCRYPTION_KEY = 'test-key-for-utils-index-tests';
process.env.NODE_ENV = 'test';

describe('Utils Index - Exports', () => {
  let utils;

  beforeAll(() => {
    utils = require('../../../src/utils');
  });

  describe('Logger', () => {
    it('devrait exporter le logger', () => {
      expect(utils.logger).toBeDefined();
      expect(typeof utils.logger.info).toBe('function');
      expect(typeof utils.logger.error).toBe('function');
      expect(typeof utils.logger.warn).toBe('function');
      expect(typeof utils.logger.debug).toBe('function');
    });

    it('devrait exporter les méthodes personnalisées du logger', () => {
      expect(typeof utils.logger.security).toBe('function');
      expect(typeof utils.logger.request).toBe('function');
      expect(typeof utils.logger.mailbox).toBe('function');
      expect(typeof utils.logger.mail).toBe('function');
      expect(typeof utils.logger.auth).toBe('function');
    });
  });

  describe('SMTP', () => {
    it('devrait exporter le service SMTP', () => {
      expect(utils.smtp).toBeDefined();
      expect(typeof utils.smtp.sendMail).toBe('function');
      expect(typeof utils.smtp.createTransport).toBe('function');
      expect(typeof utils.smtp.verifyConnection).toBe('function');
    });
  });

  describe('Crypto', () => {
    it('devrait exporter les utilitaires crypto', () => {
      expect(utils.crypto).toBeDefined();
      expect(typeof utils.crypto.encrypt).toBe('function');
      expect(typeof utils.crypto.decrypt).toBe('function');
      expect(typeof utils.crypto.hashPassword).toBe('function');
      expect(typeof utils.crypto.verifyPassword).toBe('function');
      expect(typeof utils.crypto.generateToken).toBe('function');
      expect(typeof utils.crypto.generateUUID).toBe('function');
      expect(typeof utils.crypto.sha256).toBe('function');
      expect(typeof utils.crypto.sha512).toBe('function');
    });
  });

  describe('Validators', () => {
    it('devrait exporter PATTERNS', () => {
      expect(utils.PATTERNS).toBeDefined();
      expect(utils.PATTERNS.mssanteEmail).toBeDefined();
      expect(utils.PATTERNS.mssanteDomain).toBeDefined();
      expect(utils.PATTERNS.rpps).toBeDefined();
      expect(utils.PATTERNS.adeli).toBeDefined();
      expect(utils.PATTERNS.finess).toBeDefined();
      expect(utils.PATTERNS.uuid).toBeDefined();
    });

    it('devrait exporter les schémas Joi', () => {
      expect(utils.schemas).toBeDefined();
      expect(utils.schemas.user).toBeDefined();
      expect(utils.schemas.mailbox).toBeDefined();
      expect(utils.schemas.domain).toBeDefined();
      expect(utils.schemas.auth).toBeDefined();
      expect(utils.schemas.email).toBeDefined();
    });

    it('devrait exporter les fonctions de validation', () => {
      expect(utils.validators).toBeDefined();
      expect(typeof utils.validators.isValidMSSanteEmail).toBe('function');
      expect(typeof utils.validators.isValidMSSanteDomain).toBe('function');
      expect(typeof utils.validators.isValidRPPS).toBe('function');
      expect(typeof utils.validators.extractDomain).toBe('function');
      expect(typeof utils.validators.validate).toBe('function');
    });

    it('devrait exporter Joi personnalisé', () => {
      expect(utils.Joi).toBeDefined();
      expect(typeof utils.Joi.object).toBe('function');
      expect(typeof utils.Joi.string).toBe('function');
    });
  });

  describe('Helpers', () => {
    it('devrait exporter le module helpers complet', () => {
      expect(utils.helpers).toBeDefined();
    });

    it('devrait re-exporter les fonctions helpers au niveau racine', () => {
      // Fonctions de date
      expect(typeof utils.formatDate).toBe('function');
      expect(typeof utils.dateDiff).toBe('function');
      expect(typeof utils.getFirstDayOfMonth).toBe('function');
      expect(typeof utils.getLastDayOfMonth).toBe('function');

      // Fonctions de formatage
      expect(typeof utils.formatBytes).toBe('function');
      expect(typeof utils.mbToBytes).toBe('function');
      expect(typeof utils.bytesToMb).toBe('function');
      expect(typeof utils.slugify).toBe('function');
      expect(typeof utils.truncate).toBe('function');
      expect(typeof utils.capitalize).toBe('function');
      expect(typeof utils.formatName).toBe('function');

      // Fonctions utilitaires
      expect(typeof utils.sleep).toBe('function');
      expect(typeof utils.retry).toBe('function');
      expect(typeof utils.parseBoolean).toBe('function');
      expect(typeof utils.cleanObject).toBe('function');
      expect(typeof utils.paginate).toBe('function');
      expect(typeof utils.apiResponse).toBe('function');
      expect(typeof utils.apiError).toBe('function');
      expect(typeof utils.getClientIp).toBe('function');
      expect(typeof utils.shortId).toBe('function');
      expect(typeof utils.isEmpty).toBe('function');
      expect(typeof utils.groupBy).toBe('function');
    });
  });
});

describe('Utils Index - Fonctionnalité', () => {
  let utils;

  beforeAll(() => {
    utils = require('../../../src/utils');
  });

  it('devrait permettre d\'utiliser les fonctions helpers directement', () => {
    const formatted = utils.formatBytes(1024);
    expect(formatted).toBe('1 KB');
  });

  it('devrait permettre d\'utiliser les fonctions crypto', () => {
    const token = utils.crypto.generateToken(16);
    expect(token).toHaveLength(32);
  });

  it('devrait permettre d\'utiliser les validateurs', () => {
    const isValid = utils.validators.isValidMSSanteEmail('user@hopital.mssante.fr');
    expect(isValid).toBe(true);
  });

  it('devrait permettre de créer des schémas avec Joi personnalisé', () => {
    const schema = utils.Joi.object({
      name: utils.Joi.string().required()
    });

    const { error, value } = schema.validate({ name: 'Test' });
    expect(error).toBeUndefined();
    expect(value.name).toBe('Test');
  });

  it('devrait permettre de valider avec PATTERNS', () => {
    expect(utils.PATTERNS.rpps.test('12345678901')).toBe(true);
    expect(utils.PATTERNS.uuid.test('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
  });
});

describe('Utils Index - Import alternatif', () => {
  it('devrait permettre l\'import direct des modules', () => {
    const logger = require('../../../src/utils/logger');
    const crypto = require('../../../src/utils/crypto');
    const helpers = require('../../../src/utils/helpers');
    const validators = require('../../../src/utils/validators');

    expect(logger).toBeDefined();
    expect(crypto).toBeDefined();
    expect(helpers).toBeDefined();
    expect(validators).toBeDefined();
  });

  it('devrait exporter les mêmes fonctions via index et import direct', () => {
    const utilsIndex = require('../../../src/utils');
    const helpersDirect = require('../../../src/utils/helpers');

    expect(utilsIndex.formatBytes).toBe(helpersDirect.formatBytes);
    expect(utilsIndex.slugify).toBe(helpersDirect.slugify);
    expect(utilsIndex.paginate).toBe(helpersDirect.paginate);
  });
});

describe('Utils Index - Robustesse', () => {
  let utils;

  beforeAll(() => {
    utils = require('../../../src/utils');
  });

  it('devrait gérer les entrées invalides dans formatDate', () => {
    expect(utils.formatDate(null)).toBeNull();
    expect(utils.formatDate('invalid')).toBeNull();
  });

  it('devrait gérer les entrées invalides dans isEmpty', () => {
    expect(utils.isEmpty(null)).toBe(true);
    expect(utils.isEmpty(undefined)).toBe(true);
    expect(utils.isEmpty('')).toBe(true);
    expect(utils.isEmpty([])).toBe(true);
    expect(utils.isEmpty({})).toBe(true);
  });

  it('devrait gérer les entrées invalides dans cleanObject', () => {
    expect(utils.cleanObject(null)).toBeNull();
    expect(utils.cleanObject(undefined)).toBeUndefined();
  });

  it('devrait gérer les validations avec schémas stricts', () => {
    const result = utils.validators.validate({}, utils.schemas.auth.login);
    expect(result.error).toBeDefined();
  });
});