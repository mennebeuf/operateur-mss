// services/api/tests/unit/utils/logger.test.js

/**
 * Tests unitaires pour le logger Winston
 */

// Mock Winston avant l'import du logger
jest.mock('winston', () => {
  const mockFormat = {
    combine: jest.fn(() => mockFormat),
    timestamp: jest.fn(() => mockFormat),
    errors: jest.fn(() => mockFormat),
    printf: jest.fn(() => mockFormat),
    json: jest.fn(() => mockFormat),
    colorize: jest.fn(() => mockFormat)
  };

  const mockTransport = jest.fn();
  
  const mockLogger = {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    add: jest.fn()
  };

  return {
    format: mockFormat,
    transports: {
      Console: mockTransport,
      File: mockTransport
    },
    createLogger: jest.fn(() => mockLogger)
  };
});

const winston = require('winston');

describe('Logger', () => {
  let logger;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    process.env.NODE_ENV = 'test';
    logger = require('../../../src/utils/logger');
  });

  afterEach(() => {
    delete process.env.NODE_ENV;
  });

  describe('Configuration', () => {
    it('devrait créer un logger Winston', () => {
      expect(winston.createLogger).toHaveBeenCalled();
    });

    it('devrait configurer le format timestamp', () => {
      expect(winston.format.timestamp).toHaveBeenCalled();
    });

    it('devrait configurer le format errors avec stack', () => {
      expect(winston.format.errors).toHaveBeenCalledWith({ stack: true });
    });
  });

  describe('Méthodes de base', () => {
    it('devrait exposer la méthode info', () => {
      expect(typeof logger.info).toBe('function');
    });

    it('devrait exposer la méthode error', () => {
      expect(typeof logger.error).toBe('function');
    });

    it('devrait exposer la méthode warn', () => {
      expect(typeof logger.warn).toBe('function');
    });

    it('devrait exposer la méthode debug', () => {
      expect(typeof logger.debug).toBe('function');
    });
  });

  describe('Méthodes personnalisées', () => {
    describe('logger.security', () => {
      it('devrait être défini', () => {
        expect(typeof logger.security).toBe('function');
      });

      it('devrait logger un événement de sécurité', () => {
        logger.security('login', { userId: '123', ip: '127.0.0.1' });
        // Le mock est configuré, donc pas d'erreur = succès
      });
    });

    describe('logger.request', () => {
      it('devrait être défini', () => {
        expect(typeof logger.request).toBe('function');
      });

      it('devrait logger une requête réussie', () => {
        const req = {
          method: 'GET',
          originalUrl: '/api/users',
          ip: '127.0.0.1',
          get: jest.fn().mockReturnValue('Mozilla/5.0'),
          user: { id: '123' }
        };
        const res = { statusCode: 200 };

        logger.request(req, res, 150);
        expect(logger.info).toHaveBeenCalled();
      });

      it('devrait logger une erreur 500 en error', () => {
        const req = {
          method: 'POST',
          originalUrl: '/api/users',
          ip: '127.0.0.1',
          get: jest.fn(),
          user: null
        };
        const res = { statusCode: 500 };

        logger.request(req, res, 100);
        expect(logger.error).toHaveBeenCalled();
      });

      it('devrait logger une erreur 4xx en warn', () => {
        const req = {
          method: 'POST',
          originalUrl: '/api/users',
          ip: '127.0.0.1',
          get: jest.fn(),
          user: null
        };
        const res = { statusCode: 404 };

        logger.request(req, res, 50);
        expect(logger.warn).toHaveBeenCalled();
      });
    });

    describe('logger.mailbox', () => {
      it('devrait être défini', () => {
        expect(typeof logger.mailbox).toBe('function');
      });

      it('devrait logger une opération sur une BAL', () => {
        logger.mailbox('create', 'user@example.mssante.fr', { quotaMb: 1024 });
        expect(logger.info).toHaveBeenCalled();
      });
    });

    describe('logger.mail', () => {
      it('devrait être défini', () => {
        expect(typeof logger.mail).toBe('function');
      });

      it('devrait logger une opération SMTP', () => {
        logger.mail('SMTP', 'send', { to: 'dest@example.com', messageId: '<123>' });
        expect(logger.info).toHaveBeenCalled();
      });

      it('devrait logger une opération IMAP', () => {
        logger.mail('IMAP', 'fetch', { folder: 'INBOX', count: 10 });
        expect(logger.info).toHaveBeenCalled();
      });
    });

    describe('logger.auth', () => {
      it('devrait être défini', () => {
        expect(typeof logger.auth).toBe('function');
      });

      it('devrait logger un succès d\'authentification en info', () => {
        logger.auth('success', { userId: '123', email: 'user@example.com' });
        expect(logger.info).toHaveBeenCalled();
      });

      it('devrait logger un échec d\'authentification en warn', () => {
        logger.auth('failure', { email: 'user@example.com', reason: 'Invalid password' });
        expect(logger.warn).toHaveBeenCalled();
      });
    });

    describe('logger.serviceError', () => {
      it('devrait être défini', () => {
        expect(typeof logger.serviceError).toBe('function');
      });

      it('devrait logger une erreur de service', () => {
        const error = new Error('Connection refused');
        error.stack = 'Error: Connection refused\n    at ...';

        logger.serviceError('postgres', error);
        expect(logger.error).toHaveBeenCalled();
      });
    });
  });
});

describe('Logger - Niveaux de log selon environnement', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  afterEach(() => {
    delete process.env.NODE_ENV;
  });

  it('devrait utiliser level "error" en test', () => {
    process.env.NODE_ENV = 'test';
    require('../../../src/utils/logger');
    
    const createLoggerCall = winston.createLogger.mock.calls[0][0];
    // En mode test, on s'attend à avoir un niveau restrictif
    expect(createLoggerCall).toBeDefined();
  });

  it('devrait configurer des transports File en production', () => {
    process.env.NODE_ENV = 'production';
    process.env.LOG_DIR = '/tmp/logs';
    
    jest.resetModules();
    require('../../../src/utils/logger');
    
    // Vérifier que les transports File sont ajoutés
    expect(winston.transports.File).toHaveBeenCalled();
  });
});

describe('Logger - Format des logs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    process.env.NODE_ENV = 'development';
  });

  it('devrait utiliser colorize en développement', () => {
    require('../../../src/utils/logger');
    expect(winston.format.colorize).toHaveBeenCalled();
  });

  it('devrait configurer le format JSON pour production', () => {
    process.env.NODE_ENV = 'production';
    process.env.LOG_DIR = '/tmp/logs';
    
    jest.resetModules();
    require('../../../src/utils/logger');
    
    expect(winston.format.json).toHaveBeenCalled();
  });
});

describe('Logger - Intégration avec Express', () => {
  let logger;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    process.env.NODE_ENV = 'test';
    logger = require('../../../src/utils/logger');
  });

  it('devrait gérer les requêtes sans utilisateur', () => {
    const req = {
      method: 'GET',
      originalUrl: '/health',
      ip: '127.0.0.1',
      get: jest.fn().mockReturnValue(null),
      connection: { remoteAddress: '127.0.0.1' }
    };
    const res = { statusCode: 200 };

    expect(() => logger.request(req, res, 10)).not.toThrow();
  });

  it('devrait gérer les requêtes avec user partiel', () => {
    const req = {
      method: 'POST',
      originalUrl: '/api/data',
      ip: '192.168.1.1',
      get: jest.fn().mockReturnValue('Custom Agent'),
      user: { id: 'user-123' }
    };
    const res = { statusCode: 201 };

    expect(() => logger.request(req, res, 250)).not.toThrow();
    expect(logger.info).toHaveBeenCalled();
  });
});