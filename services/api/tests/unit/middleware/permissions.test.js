/**
 * Tests unitaires - Middleware de permissions RBAC
 * services/api/tests/unit/middleware/permissions.test.js
 */

// Mocks
jest.mock('../../../src/config/database', () => ({
  pool: { query: jest.fn() }
}));

jest.mock('../../../src/config/redis', () => ({
  redisClient: {
    get: jest.fn(),
    setEx: jest.fn(),
    del: jest.fn()
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
  checkPermission,
  isSuperAdmin,
  isDomainAdmin,
  requirePermission,
  requireSuperAdmin,
  requireDomainAdmin,
  requireOwnerOrAdmin,
  invalidatePermissionsCache
} = require('../../../src/middleware/permissions');

describe('Permissions Middleware', () => {
  let mockReq, mockRes, mockNext;

  beforeEach(() => {
    mockReq = {
      user: { 
        id: 'user-uuid', 
        email: 'user@test.mssante.fr',
        role: 'user',
        is_super_admin: false 
      },
      domain: { id: 'domain-uuid', domain_name: 'hopital.mssante.fr' },
      params: {},
      body: {},
      originalUrl: '/api/v1/mailboxes'
    };
    mockRes = {
      json: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis()
    };
    mockNext = jest.fn();
    jest.clearAllMocks();
  });

  // ==========================================
  // Tests: checkPermission
  // ==========================================
  describe('checkPermission', () => {
    it('devrait retourner true si la permission est en cache', async () => {
      redisClient.get.mockResolvedValueOnce(
        JSON.stringify(['mailbox.create', 'mailbox.read', 'mailbox.update'])
      );

      const result = await checkPermission('user-uuid', 'mailbox.read');

      expect(result).toBe(true);
      expect(pool.query).not.toHaveBeenCalled();
    });

    it('devrait retourner false si la permission n\'est pas en cache', async () => {
      redisClient.get.mockResolvedValueOnce(
        JSON.stringify(['mailbox.read'])
      );

      const result = await checkPermission('user-uuid', 'mailbox.delete');

      expect(result).toBe(false);
    });

    it('devrait autoriser avec la permission wildcard (*)', async () => {
      redisClient.get.mockResolvedValueOnce(JSON.stringify(['*']));

      const result = await checkPermission('user-uuid', 'any.permission');

      expect(result).toBe(true);
    });

    it('devrait interroger la DB si pas en cache', async () => {
      redisClient.get.mockResolvedValueOnce(null);
      pool.query.mockResolvedValueOnce({
        rows: [
          { name: 'mailbox.create' },
          { name: 'mailbox.read' }
        ]
      });
      redisClient.setEx.mockResolvedValue('OK');

      const result = await checkPermission('user-uuid', 'mailbox.read');

      expect(result).toBe(true);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT DISTINCT p.name'),
        ['user-uuid']
      );
      expect(redisClient.setEx).toHaveBeenCalledWith(
        'perms:user-uuid',
        600,
        expect.any(String)
      );
    });

    it('devrait gérer les erreurs Redis gracieusement', async () => {
      redisClient.get.mockRejectedValueOnce(new Error('Redis error'));
      pool.query.mockResolvedValueOnce({
        rows: [{ name: 'mailbox.read' }]
      });

      const result = await checkPermission('user-uuid', 'mailbox.read');

      expect(result).toBe(true);
    });
  });

  // ==========================================
  // Tests: isSuperAdmin
  // ==========================================
  describe('isSuperAdmin', () => {
    it('devrait retourner true depuis le cache', async () => {
      redisClient.get.mockResolvedValueOnce('true');

      const result = await isSuperAdmin('admin-uuid');

      expect(result).toBe(true);
      expect(pool.query).not.toHaveBeenCalled();
    });

    it('devrait retourner false depuis le cache', async () => {
      redisClient.get.mockResolvedValueOnce('false');

      const result = await isSuperAdmin('user-uuid');

      expect(result).toBe(false);
    });

    it('devrait interroger la DB si pas en cache', async () => {
      redisClient.get.mockResolvedValueOnce(null);
      pool.query.mockResolvedValueOnce({
        rows: [{ is_super_admin: true }]
      });
      redisClient.setEx.mockResolvedValue('OK');

      const result = await isSuperAdmin('admin-uuid');

      expect(result).toBe(true);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('is_super_admin'),
        ['admin-uuid']
      );
    });

    it('devrait retourner false si utilisateur non trouvé', async () => {
      redisClient.get.mockResolvedValueOnce(null);
      pool.query.mockResolvedValueOnce({ rows: [] });

      const result = await isSuperAdmin('unknown-uuid');

      expect(result).toBe(false);
    });
  });

  // ==========================================
  // Tests: isDomainAdmin
  // ==========================================
  describe('isDomainAdmin', () => {
    it('devrait retourner true si admin du domaine', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [{ id: 'user-uuid' }]
      });

      const result = await isDomainAdmin('user-uuid', 'domain-uuid');

      expect(result).toBe(true);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining("r.name = 'domain_admin'"),
        ['user-uuid', 'domain-uuid']
      );
    });

    it('devrait retourner false si pas admin du domaine', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      const result = await isDomainAdmin('user-uuid', 'domain-uuid');

      expect(result).toBe(false);
    });

    it('devrait vérifier le statut actif', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      await isDomainAdmin('user-uuid', 'domain-uuid');

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining("u.status = 'active'"),
        expect.any(Array)
      );
    });
  });

  // ==========================================
  // Tests: requirePermission
  // ==========================================
  describe('requirePermission', () => {
    describe('Permission unique', () => {
      it('devrait autoriser avec la permission', async () => {
        redisClient.get.mockResolvedValueOnce(JSON.stringify(['mailboxes:read']));

        const middleware = requirePermission('mailboxes:read');
        await middleware(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalled();
        expect(mockNext).toHaveBeenCalledWith(); // Sans erreur
      });

      it('devrait refuser sans la permission', async () => {
        redisClient.get.mockResolvedValueOnce(JSON.stringify(['mailboxes:read']));

        const middleware = requirePermission('mailboxes:delete');
        await middleware(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalledWith(
          expect.objectContaining({
            statusCode: 403,
            code: 'PERMISSION_DENIED'
          })
        );
      });
    });

    describe('Super admin', () => {
      it('devrait autoriser un super admin sans vérifier les permissions', async () => {
        mockReq.user.is_super_admin = true;

        const middleware = requirePermission('any:permission');
        await middleware(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalledWith();
        expect(redisClient.get).not.toHaveBeenCalled();
      });
    });

    describe('Permissions multiples (OR)', () => {
      it('devrait autoriser si au moins une permission', async () => {
        redisClient.get.mockResolvedValue(JSON.stringify(['mailboxes:read']));

        const middleware = requirePermission(['mailboxes:read', 'mailboxes:write']);
        await middleware(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalledWith();
      });

      it('devrait refuser si aucune permission', async () => {
        redisClient.get.mockResolvedValue(JSON.stringify(['other:permission']));

        const middleware = requirePermission(['mailboxes:read', 'mailboxes:write']);
        await middleware(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalledWith(
          expect.objectContaining({
            statusCode: 403
          })
        );
      });
    });

    describe('Permissions multiples (AND)', () => {
      it('devrait autoriser si toutes les permissions', async () => {
        redisClient.get.mockResolvedValue(
          JSON.stringify(['mailboxes:read', 'mailboxes:write', 'mailboxes:delete'])
        );

        const middleware = requirePermission(
          ['mailboxes:read', 'mailboxes:write'], 
          { requireAll: true }
        );
        await middleware(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalledWith();
      });

      it('devrait refuser si permission manquante', async () => {
        redisClient.get.mockResolvedValue(JSON.stringify(['mailboxes:read']));

        const middleware = requirePermission(
          ['mailboxes:read', 'mailboxes:write'], 
          { requireAll: true }
        );
        await middleware(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalledWith(
          expect.objectContaining({
            statusCode: 403
          })
        );
      });
    });

    describe('Sans authentification', () => {
      it('devrait refuser si pas d\'utilisateur', async () => {
        mockReq.user = null;

        const middleware = requirePermission('mailboxes:read');
        await middleware(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalledWith(
          expect.objectContaining({
            statusCode: 401,
            code: 'AUTH_REQUIRED'
          })
        );
      });
    });
  });

  // ==========================================
  // Tests: requireSuperAdmin
  // ==========================================
  describe('requireSuperAdmin', () => {
    it('devrait autoriser un super admin', async () => {
      redisClient.get.mockResolvedValueOnce('true');

      await requireSuperAdmin(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('devrait refuser un utilisateur normal', async () => {
      redisClient.get.mockResolvedValueOnce('false');

      await requireSuperAdmin(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 403,
          code: 'SUPER_ADMIN_REQUIRED'
        })
      );
    });

    it('devrait refuser si pas d\'utilisateur', async () => {
      mockReq.user = null;

      await requireSuperAdmin(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 401
        })
      );
    });
  });

  // ==========================================
  // Tests: requireDomainAdmin
  // ==========================================
  describe('requireDomainAdmin', () => {
    it('devrait autoriser un admin du domaine', async () => {
      redisClient.get.mockResolvedValueOnce('false'); // Pas super admin
      pool.query.mockResolvedValueOnce({ rows: [{ id: 'user-uuid' }] }); // Est domain admin

      await requireDomainAdmin(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('devrait autoriser un super admin', async () => {
      redisClient.get.mockResolvedValueOnce('true'); // Est super admin

      await requireDomainAdmin(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect(pool.query).not.toHaveBeenCalled(); // Pas besoin de vérifier domain admin
    });

    it('devrait refuser un utilisateur non admin', async () => {
      redisClient.get.mockResolvedValueOnce('false'); // Pas super admin
      pool.query.mockResolvedValueOnce({ rows: [] }); // Pas domain admin

      await requireDomainAdmin(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 403,
          code: 'DOMAIN_ADMIN_REQUIRED'
        })
      );
    });

    it('devrait utiliser le domainId des params si pas de domaine', async () => {
      mockReq.domain = null;
      mockReq.params.domainId = 'param-domain-uuid';
      
      redisClient.get.mockResolvedValueOnce('false');
      pool.query.mockResolvedValueOnce({ rows: [{ id: 'user-uuid' }] });

      await requireDomainAdmin(mockReq, mockRes, mockNext);

      expect(pool.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['param-domain-uuid'])
      );
    });

    it('devrait refuser si domaine non spécifié', async () => {
      mockReq.domain = null;
      mockReq.params = {};
      mockReq.body = {};
      mockReq.user.domain_id = null;

      redisClient.get.mockResolvedValueOnce('false');

      await requireDomainAdmin(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 400,
          code: 'DOMAIN_REQUIRED'
        })
      );
    });
  });

  // ==========================================
  // Tests: requireOwnerOrAdmin
  // ==========================================
  describe('requireOwnerOrAdmin', () => {
    const getOwnerId = jest.fn();

    beforeEach(() => {
      getOwnerId.mockReset();
    });

    it('devrait autoriser le propriétaire de la ressource', async () => {
      getOwnerId.mockResolvedValueOnce('user-uuid');
      redisClient.get.mockResolvedValueOnce('false'); // Pas super admin

      const middleware = requireOwnerOrAdmin(getOwnerId);
      await middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('devrait autoriser un super admin', async () => {
      redisClient.get.mockResolvedValueOnce('true'); // Est super admin

      const middleware = requireOwnerOrAdmin(getOwnerId);
      await middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect(getOwnerId).not.toHaveBeenCalled();
    });

    it('devrait autoriser un admin du domaine', async () => {
      getOwnerId.mockResolvedValueOnce('other-user-uuid'); // Pas le propriétaire
      redisClient.get.mockResolvedValueOnce('false'); // Pas super admin
      pool.query.mockResolvedValueOnce({ rows: [{ id: 'user-uuid' }] }); // Est domain admin

      const middleware = requireOwnerOrAdmin(getOwnerId);
      await middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('devrait refuser si ni propriétaire ni admin', async () => {
      getOwnerId.mockResolvedValueOnce('other-user-uuid');
      redisClient.get.mockResolvedValueOnce('false'); // Pas super admin
      pool.query.mockResolvedValueOnce({ rows: [] }); // Pas domain admin

      const middleware = requireOwnerOrAdmin(getOwnerId);
      await middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 403,
          code: 'ACCESS_DENIED'
        })
      );
    });
  });

  // ==========================================
  // Tests: invalidatePermissionsCache
  // ==========================================
  describe('invalidatePermissionsCache', () => {
    it('devrait supprimer le cache des permissions', async () => {
      redisClient.del.mockResolvedValue(1);

      await invalidatePermissionsCache('user-uuid');

      expect(redisClient.del).toHaveBeenCalledWith('perms:user-uuid');
      expect(redisClient.del).toHaveBeenCalledWith('superadmin:user-uuid');
    });

    it('devrait gérer les erreurs silencieusement', async () => {
      redisClient.del.mockRejectedValue(new Error('Redis error'));

      // Ne devrait pas throw
      await expect(invalidatePermissionsCache('user-uuid')).resolves.not.toThrow();
    });
  });
});