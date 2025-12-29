/**
 * Tests unitaires - Middleware d'authentification
 * services/api/tests/unit/middleware/auth.test.js
 */

const jwt = require('jsonwebtoken');

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
  auth: jest.fn(),
  security: jest.fn(),
  serviceError: jest.fn()
}));

const { pool } = require('../../../src/config/database');
const { redisClient } = require('../../../src/config/redis');
const { 
  authenticate, 
  authenticateOptional, 
  authorize 
} = require('../../../src/middleware/auth');

// Configuration JWT pour les tests
const JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key';
const JWT_ISSUER = process.env.JWT_ISSUER || 'mssante-api';
const JWT_AUDIENCE = process.env.JWT_AUDIENCE || 'mssante-client';

describe('Auth Middleware', () => {
  let mockReq, mockRes, mockNext;

  beforeEach(() => {
    mockReq = {
      headers: {},
      cookies: {},
      ip: '127.0.0.1'
    };
    mockRes = {
      json: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis()
    };
    mockNext = jest.fn();
    jest.clearAllMocks();
  });

  // ==========================================
  // Tests: authenticate
  // ==========================================
  describe('authenticate', () => {
    const createValidToken = (payload = {}) => {
      return jwt.sign(
        { 
          sub: 'user-uuid',
          userId: 'user-uuid',
          email: 'test@hopital.mssante.fr', 
          role: 'user',
          ...payload 
        },
        JWT_SECRET,
        { 
          expiresIn: '1h',
          issuer: JWT_ISSUER,
          audience: JWT_AUDIENCE
        }
      );
    };

    const mockUserData = {
      id: 'user-uuid',
      email: 'test@hopital.mssante.fr',
      first_name: 'Jean',
      last_name: 'Dupont',
      status: 'active',
      is_super_admin: false,
      domain_id: 'domain-uuid',
      domain_name: 'hopital.mssante.fr',
      role: { name: 'user' }
    };

    describe('Token valide', () => {
      it('devrait authentifier avec un token JWT valide', async () => {
        const token = createValidToken();
        mockReq.headers.authorization = `Bearer ${token}`;
        
        redisClient.get.mockResolvedValueOnce(null); // Token non blacklisté
        redisClient.get.mockResolvedValueOnce(null); // User pas en cache
        pool.query.mockResolvedValueOnce({ rows: [mockUserData] });
        redisClient.setEx.mockResolvedValue('OK');

        await authenticate(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalled();
        expect(mockReq.user).toBeDefined();
        expect(mockReq.user.id).toBe('user-uuid');
        expect(mockReq.user.email).toBe('test@hopital.mssante.fr');
        expect(mockReq.token).toBe(token);
      });

      it('devrait récupérer l\'utilisateur depuis le cache Redis', async () => {
        const token = createValidToken();
        mockReq.headers.authorization = `Bearer ${token}`;
        
        redisClient.get
          .mockResolvedValueOnce(null) // Token non blacklisté
          .mockResolvedValueOnce(JSON.stringify(mockUserData)); // User en cache

        await authenticate(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalled();
        expect(pool.query).not.toHaveBeenCalled();
        expect(mockReq.user.email).toBe('test@hopital.mssante.fr');
      });

      it('devrait attacher les données du token à la requête', async () => {
        const token = createValidToken({ domainId: 'domain-123' });
        mockReq.headers.authorization = `Bearer ${token}`;
        
        redisClient.get.mockResolvedValue(null);
        pool.query.mockResolvedValueOnce({ rows: [mockUserData] });

        await authenticate(mockReq, mockRes, mockNext);

        expect(mockReq.tokenPayload).toBeDefined();
        expect(mockReq.tokenPayload.domainId).toBe('domain-123');
      });
    });

    describe('Token absent', () => {
      it('devrait rejeter sans header Authorization', async () => {
        await authenticate(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(401);
        expect(mockRes.json).toHaveBeenCalledWith(
          expect.objectContaining({
            code: 'AUTH_TOKEN_MISSING'
          })
        );
        expect(mockNext).not.toHaveBeenCalled();
      });

      it('devrait rejeter avec un header vide', async () => {
        mockReq.headers.authorization = '';

        await authenticate(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(401);
      });
    });

    describe('Format de token invalide', () => {
      it('devrait rejeter sans préfixe Bearer', async () => {
        mockReq.headers.authorization = 'InvalidToken';

        await authenticate(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(401);
        expect(mockRes.json).toHaveBeenCalledWith(
          expect.objectContaining({
            code: 'AUTH_TOKEN_INVALID_FORMAT'
          })
        );
      });

      it('devrait rejeter avec un mauvais préfixe', async () => {
        mockReq.headers.authorization = 'Basic sometoken';

        await authenticate(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(401);
        expect(mockRes.json).toHaveBeenCalledWith(
          expect.objectContaining({
            code: 'AUTH_TOKEN_INVALID_FORMAT'
          })
        );
      });

      it('devrait rejeter avec plusieurs espaces', async () => {
        mockReq.headers.authorization = 'Bearer token extra';

        await authenticate(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(401);
      });
    });

    describe('Token blacklisté', () => {
      it('devrait rejeter un token révoqué (blacklisté)', async () => {
        const token = createValidToken();
        mockReq.headers.authorization = `Bearer ${token}`;
        
        redisClient.get.mockResolvedValueOnce('revoked'); // Token blacklisté

        await authenticate(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(401);
        expect(mockRes.json).toHaveBeenCalledWith(
          expect.objectContaining({
            code: 'AUTH_TOKEN_REVOKED'
          })
        );
      });
    });

    describe('Token expiré', () => {
      it('devrait rejeter un token expiré', async () => {
        const token = jwt.sign(
          { sub: 'user-uuid', email: 'test@test.fr' },
          JWT_SECRET,
          { expiresIn: '-1h', issuer: JWT_ISSUER, audience: JWT_AUDIENCE }
        );
        mockReq.headers.authorization = `Bearer ${token}`;
        redisClient.get.mockResolvedValueOnce(null);

        await authenticate(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(401);
        expect(mockRes.json).toHaveBeenCalledWith(
          expect.objectContaining({
            code: 'AUTH_TOKEN_EXPIRED'
          })
        );
      });
    });

    describe('Token invalide', () => {
      it('devrait rejeter un token mal formé', async () => {
        mockReq.headers.authorization = 'Bearer invalid.token.here';
        redisClient.get.mockResolvedValueOnce(null);

        await authenticate(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(401);
        expect(mockRes.json).toHaveBeenCalledWith(
          expect.objectContaining({
            code: 'AUTH_TOKEN_INVALID'
          })
        );
      });

      it('devrait rejeter un token signé avec une mauvaise clé', async () => {
        const token = jwt.sign(
          { sub: 'user-uuid' },
          'wrong-secret-key',
          { expiresIn: '1h' }
        );
        mockReq.headers.authorization = `Bearer ${token}`;
        redisClient.get.mockResolvedValueOnce(null);

        await authenticate(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(401);
      });
    });

    describe('Utilisateur non trouvé ou inactif', () => {
      it('devrait rejeter si l\'utilisateur n\'existe pas', async () => {
        const token = createValidToken();
        mockReq.headers.authorization = `Bearer ${token}`;
        
        redisClient.get.mockResolvedValue(null);
        pool.query.mockResolvedValueOnce({ rows: [] });

        await authenticate(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(401);
        expect(mockRes.json).toHaveBeenCalledWith(
          expect.objectContaining({
            code: 'AUTH_USER_NOT_FOUND'
          })
        );
      });

      it('devrait rejeter un utilisateur désactivé', async () => {
        const token = createValidToken();
        mockReq.headers.authorization = `Bearer ${token}`;
        
        redisClient.get.mockResolvedValue(null);
        pool.query.mockResolvedValueOnce({ 
          rows: [{ ...mockUserData, status: 'inactive' }] 
        });

        await authenticate(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(403);
        expect(mockRes.json).toHaveBeenCalledWith(
          expect.objectContaining({
            code: 'AUTH_USER_DISABLED'
          })
        );
      });

      it('devrait rejeter un utilisateur suspendu', async () => {
        const token = createValidToken();
        mockReq.headers.authorization = `Bearer ${token}`;
        
        redisClient.get.mockResolvedValue(null);
        pool.query.mockResolvedValueOnce({ 
          rows: [{ ...mockUserData, status: 'suspended' }] 
        });

        await authenticate(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(403);
      });
    });

    describe('Gestion des erreurs', () => {
      it('devrait gérer les erreurs Redis gracieusement', async () => {
        const token = createValidToken();
        mockReq.headers.authorization = `Bearer ${token}`;
        
        redisClient.get.mockRejectedValueOnce(new Error('Redis down'));
        pool.query.mockResolvedValueOnce({ rows: [mockUserData] });

        await authenticate(mockReq, mockRes, mockNext);

        // Devrait continuer malgré l'erreur Redis
        expect(mockNext).toHaveBeenCalled();
      });

      it('devrait retourner 500 pour les erreurs serveur', async () => {
        const token = createValidToken();
        mockReq.headers.authorization = `Bearer ${token}`;
        
        redisClient.get.mockResolvedValue(null);
        pool.query.mockRejectedValueOnce(new Error('Database error'));

        await authenticate(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.json).toHaveBeenCalledWith(
          expect.objectContaining({
            code: 'AUTH_ERROR'
          })
        );
      });
    });
  });

  // ==========================================
  // Tests: authenticateOptional
  // ==========================================
  describe('authenticateOptional', () => {
    it('devrait continuer sans token', async () => {
      await authenticateOptional(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.user).toBeUndefined();
    });

    it('devrait attacher l\'utilisateur si token valide', async () => {
      const token = jwt.sign(
        { sub: 'user-uuid', email: 'test@test.fr' },
        JWT_SECRET,
        { expiresIn: '1h', issuer: JWT_ISSUER, audience: JWT_AUDIENCE }
      );
      mockReq.headers.authorization = `Bearer ${token}`;
      
      redisClient.get.mockResolvedValue(null);
      pool.query.mockResolvedValueOnce({ 
        rows: [{ id: 'user-uuid', email: 'test@test.fr', status: 'active' }] 
      });

      await authenticateOptional(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.user).toBeDefined();
    });

    it('devrait continuer même avec un token invalide', async () => {
      mockReq.headers.authorization = 'Bearer invalid-token';
      redisClient.get.mockResolvedValue(null);

      await authenticateOptional(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.user).toBeUndefined();
    });
  });

  // ==========================================
  // Tests: authorize
  // ==========================================
  describe('authorize', () => {
    it('devrait autoriser un utilisateur avec le bon rôle', () => {
      mockReq.user = { 
        id: 'user-uuid', 
        role: { name: 'domain_admin' },
        is_super_admin: false 
      };

      const middleware = authorize('domain_admin', 'super_admin');
      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('devrait autoriser un super admin pour tous les rôles', () => {
      mockReq.user = { 
        id: 'user-uuid', 
        role: { name: 'user' },
        is_super_admin: true 
      };

      const middleware = authorize('domain_admin');
      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('devrait refuser un utilisateur sans le bon rôle', () => {
      mockReq.user = { 
        id: 'user-uuid', 
        role: { name: 'user' },
        is_super_admin: false 
      };

      const middleware = authorize('domain_admin', 'super_admin');
      middleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'AUTH_FORBIDDEN'
        })
      );
    });

    it('devrait refuser si pas d\'utilisateur', () => {
      const middleware = authorize('user');
      middleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it('devrait gérer le rôle comme string directement', () => {
      mockReq.user = { 
        id: 'user-uuid', 
        role: 'domain_admin', // String au lieu d'objet
        is_super_admin: false 
      };

      const middleware = authorize('domain_admin');
      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });
});