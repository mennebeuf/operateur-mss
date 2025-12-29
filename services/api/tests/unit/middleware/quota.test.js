/**
 * Tests unitaires - Middleware de gestion des quotas
 * services/api/tests/unit/middleware/quota.test.js
 */

// Mocks
jest.mock('../../../src/config/database', () => ({
  pool: { query: jest.fn() }
}));

jest.mock('../../../src/config/redis', () => ({
  redisClient: {
    get: jest.fn(),
    setEx: jest.fn()
  }
}));

jest.mock('../../../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  security: jest.fn()
}));

const { pool } = require('../../../src/config/database');
const { redisClient } = require('../../../src/config/redis');
const {
  checkMailboxQuota,
  checkStorageQuota,
  checkMessageQuota,
  getQuotaInfo
} = require('../../../src/middleware/quota');

describe('Quota Middleware', () => {
  let mockReq, mockRes, mockNext;

  beforeEach(() => {
    mockReq = {
      user: { id: 'user-uuid', email: 'user@test.mssante.fr' },
      domain: {
        id: 'domain-uuid',
        domain_name: 'hopital.mssante.fr',
        quotas: {
          max_mailboxes: 100,
          max_storage_gb: 50,
          max_message_size_mb: 25,
          max_messages_per_day: 10000
        }
      },
      params: {},
      body: {}
    };
    mockRes = {
      json: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis()
    };
    mockNext = jest.fn();
    jest.clearAllMocks();
  });

  // ==========================================
  // Tests: checkMailboxQuota
  // ==========================================
  describe('checkMailboxQuota', () => {
    it('devrait autoriser si quota non atteint', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [{ count: '50' }] // 50 BAL sur 100
      });

      await checkMailboxQuota(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect(mockReq.quotaInfo).toBeDefined();
      expect(mockReq.quotaInfo.mailboxes.current).toBe(50);
      expect(mockReq.quotaInfo.mailboxes.remaining).toBe(50);
    });

    it('devrait bloquer si quota atteint', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [{ count: '100' }] // 100 BAL sur 100
      });

      await checkMailboxQuota(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 403,
          code: 'MAILBOX_QUOTA_EXCEEDED'
        })
      );
    });

    it('devrait bloquer si quota dépassé', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [{ count: '150' }] // Plus que le quota
      });

      await checkMailboxQuota(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 403,
          code: 'MAILBOX_QUOTA_EXCEEDED'
        })
      );
    });

    it('devrait utiliser le quota par défaut si non défini', async () => {
      mockReq.domain.quotas = {}; // Pas de quota défini
      pool.query.mockResolvedValueOnce({
        rows: [{ count: '500' }]
      });

      await checkMailboxQuota(mockReq, mockRes, mockNext);

      // Devrait utiliser la valeur par défaut (1000)
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('devrait compter uniquement les BAL actives et pending', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [{ count: '30' }]
      });

      await checkMailboxQuota(mockReq, mockRes, mockNext);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining("status IN ('active', 'pending')"),
        expect.any(Array)
      );
    });

    it('devrait échouer si pas de contexte domaine', async () => {
      mockReq.domain = null;

      await checkMailboxQuota(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 400,
          code: 'DOMAIN_CONTEXT_REQUIRED'
        })
      );
    });

    it('devrait inclure les informations de quota dans la réponse d\'erreur', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [{ count: '100' }]
      });

      await checkMailboxQuota(mockReq, mockRes, mockNext);

      const error = mockNext.mock.calls[0][0];
      expect(error.details).toEqual(
        expect.objectContaining({
          current: 100,
          max: 100,
          domain: 'hopital.mssante.fr'
        })
      );
    });
  });

  // ==========================================
  // Tests: checkStorageQuota
  // ==========================================
  describe('checkStorageQuota', () => {
    it('devrait autoriser si stockage disponible', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [{ total_storage_mb: '20000' }] // 20 GB utilisés sur 50 GB
      });

      const middleware = checkStorageQuota(100); // Besoin de 100 MB
      await middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('devrait bloquer si stockage insuffisant', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [{ total_storage_mb: '51000' }] // 51 GB utilisés sur 50 GB
      });

      const middleware = checkStorageQuota(1000);
      await middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 403,
          code: 'STORAGE_QUOTA_EXCEEDED'
        })
      );
    });

    it('devrait vérifier avec 0 MB requis (vérification globale)', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [{ total_storage_mb: '40000' }]
      });

      const middleware = checkStorageQuota(0);
      await middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('devrait attacher les infos de stockage à la requête', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [{ total_storage_mb: '25000' }] // 25 GB
      });

      const middleware = checkStorageQuota(100);
      await middleware(mockReq, mockRes, mockNext);

      expect(mockReq.quotaInfo.storage).toEqual(
        expect.objectContaining({
          usedMb: 25000,
          maxMb: 51200, // 50 GB
          remainingMb: 26200
        })
      );
    });

    it('devrait échouer si pas de domaine', async () => {
      mockReq.domain = null;

      const middleware = checkStorageQuota(100);
      await middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 400
        })
      );
    });
  });

  // ==========================================
  // Tests: checkMessageQuota
  // ==========================================
  describe('checkMessageQuota', () => {
    it('devrait autoriser si sous la limite journalière', async () => {
      redisClient.get.mockResolvedValueOnce('5000'); // 5000 messages envoyés

      const middleware = checkMessageQuota();
      await middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('devrait bloquer si limite journalière atteinte', async () => {
      redisClient.get.mockResolvedValueOnce('10000'); // 10000 messages (max)

      const middleware = checkMessageQuota();
      await middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 429,
          code: 'MESSAGE_QUOTA_EXCEEDED'
        })
      );
    });

    it('devrait autoriser si pas de compteur (0 messages)', async () => {
      redisClient.get.mockResolvedValueOnce(null);

      const middleware = checkMessageQuota();
      await middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('devrait vérifier par BAL si mailboxId fourni', async () => {
      mockReq.params.mailboxId = 'bal-uuid';
      redisClient.get.mockResolvedValueOnce('100');

      const middleware = checkMessageQuota();
      await middleware(mockReq, mockRes, mockNext);

      expect(redisClient.get).toHaveBeenCalledWith(
        expect.stringContaining('bal-uuid')
      );
    });
  });

  // ==========================================
  // Tests: getQuotaInfo
  // ==========================================
  describe('getQuotaInfo', () => {
    it('devrait retourner les informations complètes de quota', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [{ count: '50' }] }) // BAL count
        .mockResolvedValueOnce({ rows: [{ total_storage_mb: '20000' }] }); // Storage

      redisClient.get.mockResolvedValueOnce('1000'); // Messages

      const info = await getQuotaInfo('domain-uuid');

      expect(info).toEqual(
        expect.objectContaining({
          mailboxes: expect.objectContaining({
            used: 50,
            limit: expect.any(Number),
            percentage: expect.any(Number)
          }),
          storage: expect.objectContaining({
            usedMb: 20000,
            limitMb: expect.any(Number),
            percentage: expect.any(Number)
          }),
          messages: expect.objectContaining({
            sentToday: 1000,
            dailyLimit: expect.any(Number)
          })
        })
      );
    });

    it('devrait calculer les pourcentages correctement', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [{ count: '50' }] })
        .mockResolvedValueOnce({ rows: [{ total_storage_mb: '25600' }] }); // 50% de 50GB

      redisClient.get.mockResolvedValueOnce('5000'); // 50% de 10000

      const info = await getQuotaInfo('domain-uuid');

      expect(info.mailboxes.percentage).toBe(50);
      expect(info.storage.percentage).toBe(50);
      expect(info.messages.percentage).toBe(50);
    });

    it('devrait utiliser les quotas personnalisés du domaine', async () => {
      pool.query
        .mockResolvedValueOnce({ 
          rows: [{ 
            quotas: { max_mailboxes: 200, max_storage_gb: 100 },
            id: 'domain-uuid'
          }] 
        })
        .mockResolvedValueOnce({ rows: [{ count: '50' }] })
        .mockResolvedValueOnce({ rows: [{ total_storage_mb: '20000' }] });

      redisClient.get.mockResolvedValueOnce('1000');

      const info = await getQuotaInfo('domain-uuid');

      expect(info.mailboxes.limit).toBe(200);
      expect(info.storage.limitMb).toBe(102400); // 100 GB
    });
  });

  // ==========================================
  // Tests: Cas limites
  // ==========================================
  describe('Cas limites', () => {
    it('devrait gérer les quotas à 0 (illimité)', async () => {
      mockReq.domain.quotas = { max_mailboxes: 0 }; // 0 = illimité
      pool.query.mockResolvedValueOnce({
        rows: [{ count: '999999' }]
      });

      await checkMailboxQuota(mockReq, mockRes, mockNext);

      // Devrait utiliser la valeur par défaut, pas 0
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('devrait gérer les erreurs de base de données', async () => {
      pool.query.mockRejectedValueOnce(new Error('DB Error'));

      await checkMailboxQuota(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.any(Error)
      );
    });

    it('devrait gérer les erreurs Redis gracieusement', async () => {
      redisClient.get.mockRejectedValueOnce(new Error('Redis Error'));

      const middleware = checkMessageQuota();
      await middleware(mockReq, mockRes, mockNext);

      // Devrait continuer (fail-open) ou propager l'erreur
      expect(mockNext).toHaveBeenCalled();
    });
  });

  // ==========================================
  // Tests: Logging sécurité
  // ==========================================
  describe('Logging sécurité', () => {
    const logger = require('../../../src/utils/logger');

    it('devrait logger les dépassements de quota', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [{ count: '100' }]
      });

      await checkMailboxQuota(mockReq, mockRes, mockNext);

      expect(logger.security).toHaveBeenCalledWith(
        'quota_exceeded',
        expect.objectContaining({
          type: 'mailbox',
          domain: 'hopital.mssante.fr'
        })
      );
    });
  });
});