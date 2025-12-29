/**
 * Tests unitaires - Middleware de gestion des erreurs
 * services/api/tests/unit/middleware/errorHandler.test.js
 */

// Mock du logger
jest.mock('../../../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

const logger = require('../../../src/utils/logger');
const errorHandler = require('../../../src/middleware/errorHandler');
const { ApiError, Errors, asyncHandler, notFoundHandler } = errorHandler;

describe('ErrorHandler Middleware', () => {
  let mockReq, mockRes, mockNext;

  beforeEach(() => {
    mockReq = {
      requestId: 'test-request-id',
      method: 'GET',
      originalUrl: '/api/v1/test',
      ip: '127.0.0.1',
      user: { id: 'user-uuid' },
      headers: { 'user-agent': 'Jest Test' }
    };
    mockRes = {
      json: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis(),
      headersSent: false
    };
    mockNext = jest.fn();
    jest.clearAllMocks();
    process.env.NODE_ENV = 'test';
  });

  // ==========================================
  // Tests: ApiError class
  // ==========================================
  describe('ApiError', () => {
    it('devrait créer une erreur avec les propriétés correctes', () => {
      const error = new ApiError(400, 'Message d\'erreur', 'CUSTOM_CODE');

      expect(error).toBeInstanceOf(Error);
      expect(error.statusCode).toBe(400);
      expect(error.message).toBe('Message d\'erreur');
      expect(error.code).toBe('CUSTOM_CODE');
      expect(error.isOperational).toBe(true);
    });

    it('devrait utiliser le code par défaut selon le statusCode', () => {
      const error400 = new ApiError(400, 'Bad request');
      const error401 = new ApiError(401, 'Unauthorized');
      const error403 = new ApiError(403, 'Forbidden');
      const error404 = new ApiError(404, 'Not found');
      const error409 = new ApiError(409, 'Conflict');
      const error422 = new ApiError(422, 'Validation error');
      const error429 = new ApiError(429, 'Rate limit');
      const error500 = new ApiError(500, 'Internal error');

      expect(error400.code).toBe('BAD_REQUEST');
      expect(error401.code).toBe('UNAUTHORIZED');
      expect(error403.code).toBe('FORBIDDEN');
      expect(error404.code).toBe('NOT_FOUND');
      expect(error409.code).toBe('CONFLICT');
      expect(error422.code).toBe('VALIDATION_ERROR');
      expect(error429.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(error500.code).toBe('INTERNAL_ERROR');
    });

    it('devrait accepter des détails supplémentaires', () => {
      const details = { field: 'email', reason: 'invalide' };
      const error = new ApiError(422, 'Validation', 'VALIDATION_ERROR', details);

      expect(error.details).toEqual(details);
    });

    it('devrait capturer la stack trace', () => {
      const error = new ApiError(500, 'Test');

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('ApiError');
    });
  });

  // ==========================================
  // Tests: Errors factory
  // ==========================================
  describe('Errors factory', () => {
    it('devrait créer une erreur badRequest', () => {
      const error = Errors.badRequest('Requête invalide', { field: 'test' });

      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('BAD_REQUEST');
      expect(error.details).toEqual({ field: 'test' });
    });

    it('devrait créer une erreur unauthorized', () => {
      const error = Errors.unauthorized('Token invalide');

      expect(error.statusCode).toBe(401);
      expect(error.code).toBe('UNAUTHORIZED');
    });

    it('devrait créer une erreur unauthorized avec message par défaut', () => {
      const error = Errors.unauthorized();

      expect(error.message).toBe('Non authentifié');
    });

    it('devrait créer une erreur forbidden', () => {
      const error = Errors.forbidden('Accès refusé');

      expect(error.statusCode).toBe(403);
      expect(error.code).toBe('FORBIDDEN');
    });

    it('devrait créer une erreur notFound', () => {
      const error = Errors.notFound('Utilisateur');

      expect(error.statusCode).toBe(404);
      expect(error.message).toBe('Utilisateur non trouvé(e)');
    });

    it('devrait créer une erreur notFound avec message par défaut', () => {
      const error = Errors.notFound();

      expect(error.message).toBe('Ressource non trouvé(e)');
    });

    it('devrait créer une erreur conflict', () => {
      const error = Errors.conflict('Email déjà utilisé');

      expect(error.statusCode).toBe(409);
      expect(error.code).toBe('CONFLICT');
    });

    it('devrait créer une erreur validation', () => {
      const details = [{ field: 'email', message: 'invalide' }];
      const error = Errors.validation(details);

      expect(error.statusCode).toBe(422);
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.details).toEqual(details);
    });

    it('devrait créer une erreur tooManyRequests', () => {
      const error = Errors.tooManyRequests();

      expect(error.statusCode).toBe(429);
      expect(error.code).toBe('RATE_LIMIT_EXCEEDED');
    });

    it('devrait créer une erreur internal', () => {
      const error = Errors.internal('Erreur DB');

      expect(error.statusCode).toBe(500);
      expect(error.code).toBe('INTERNAL_ERROR');
    });

    it('devrait créer une erreur serviceUnavailable', () => {
      const error = Errors.serviceUnavailable('Redis');

      expect(error.statusCode).toBe(503);
      expect(error.message).toContain('Redis');
    });
  });

  // ==========================================
  // Tests: errorHandler middleware
  // ==========================================
  describe('errorHandler middleware', () => {
    describe('ApiError', () => {
      it('devrait formater une ApiError correctement', () => {
        const error = new ApiError(400, 'Test error', 'TEST_ERROR');

        errorHandler(error, mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.json).toHaveBeenCalledWith(
          expect.objectContaining({
            error: 'Test error',
            code: 'TEST_ERROR',
            requestId: 'test-request-id'
          })
        );
      });

      it('devrait inclure les détails dans la réponse', () => {
        const error = new ApiError(422, 'Validation', 'VALIDATION_ERROR', [
          { field: 'email', message: 'invalide' }
        ]);

        errorHandler(error, mockReq, mockRes, mockNext);

        expect(mockRes.json).toHaveBeenCalledWith(
          expect.objectContaining({
            details: expect.arrayContaining([
              expect.objectContaining({ field: 'email' })
            ])
          })
        );
      });
    });

    describe('Erreurs Joi / Validation', () => {
      it('devrait gérer les erreurs Joi', () => {
        const joiError = {
          isJoi: true,
          details: [
            { path: ['email'], message: '"email" doit être valide' },
            { path: ['name'], message: '"name" est requis' }
          ]
        };

        errorHandler(joiError, mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(422);
        expect(mockRes.json).toHaveBeenCalledWith(
          expect.objectContaining({
            code: 'VALIDATION_ERROR'
          })
        );
      });

      it('devrait gérer ValidationError', () => {
        const error = new Error('Validation failed');
        error.name = 'ValidationError';
        error.details = [{ path: ['field'], message: 'error' }];

        errorHandler(error, mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(422);
      });
    });

    describe('Erreurs PostgreSQL', () => {
      it('devrait gérer unique_violation (23505)', () => {
        const pgError = {
          code: '23505',
          constraint: 'users_email_key'
        };

        errorHandler(pgError, mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(409);
        expect(mockRes.json).toHaveBeenCalledWith(
          expect.objectContaining({
            code: 'DUPLICATE_ENTRY'
          })
        );
      });

      it('devrait gérer foreign_key_violation (23503)', () => {
        const pgError = { code: '23503' };

        errorHandler(pgError, mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(409);
        expect(mockRes.json).toHaveBeenCalledWith(
          expect.objectContaining({
            code: 'REFERENCE_ERROR'
          })
        );
      });

      it('devrait gérer not_null_violation (23502)', () => {
        const pgError = { code: '23502', column: 'email' };

        errorHandler(pgError, mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(409);
        expect(mockRes.json).toHaveBeenCalledWith(
          expect.objectContaining({
            code: 'REQUIRED_FIELD',
            details: expect.objectContaining({ field: 'email' })
          })
        );
      });
    });

    describe('Erreurs JWT', () => {
      it('devrait gérer JsonWebTokenError', () => {
        const error = new Error('invalid token');
        error.name = 'JsonWebTokenError';

        errorHandler(error, mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(401);
        expect(mockRes.json).toHaveBeenCalledWith(
          expect.objectContaining({
            code: 'INVALID_TOKEN'
          })
        );
      });

      it('devrait gérer TokenExpiredError', () => {
        const error = new Error('jwt expired');
        error.name = 'TokenExpiredError';

        errorHandler(error, mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(401);
        expect(mockRes.json).toHaveBeenCalledWith(
          expect.objectContaining({
            code: 'TOKEN_EXPIRED'
          })
        );
      });
    });

    describe('Erreurs JSON', () => {
      it('devrait gérer les erreurs de parsing JSON', () => {
        const error = new SyntaxError('Unexpected token');
        error.status = 400;
        error.body = '{ invalid json }';

        errorHandler(error, mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.json).toHaveBeenCalledWith(
          expect.objectContaining({
            code: 'INVALID_JSON'
          })
        );
      });
    });

    describe('Erreurs génériques', () => {
      it('devrait retourner 500 pour une erreur non gérée', () => {
        const error = new Error('Unknown error');

        errorHandler(error, mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.json).toHaveBeenCalledWith(
          expect.objectContaining({
            code: 'INTERNAL_ERROR'
          })
        );
      });

      it('devrait utiliser le statusCode de l\'erreur si présent', () => {
        const error = new Error('Custom error');
        error.statusCode = 418;

        errorHandler(error, mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(418);
      });
    });

    describe('Logging', () => {
      it('devrait logger en error pour les erreurs 5xx', () => {
        const error = new ApiError(500, 'Server error');

        errorHandler(error, mockReq, mockRes, mockNext);

        expect(logger.error).toHaveBeenCalled();
      });

      it('devrait logger en warn pour les erreurs 4xx', () => {
        const error = new ApiError(400, 'Client error');

        errorHandler(error, mockReq, mockRes, mockNext);

        expect(logger.warn).toHaveBeenCalled();
      });
    });

    describe('Mode développement', () => {
      it('devrait inclure la stack trace en développement', () => {
        process.env.NODE_ENV = 'development';
        const error = new Error('Test');

        errorHandler(error, mockReq, mockRes, mockNext);

        expect(mockRes.json).toHaveBeenCalledWith(
          expect.objectContaining({
            stack: expect.any(Array)
          })
        );
      });
    });

    describe('Mode production', () => {
      it('ne devrait pas inclure la stack trace en production', () => {
        process.env.NODE_ENV = 'production';
        const error = new Error('Test');

        errorHandler(error, mockReq, mockRes, mockNext);

        const response = mockRes.json.mock.calls[0][0];
        expect(response.stack).toBeUndefined();
      });

      it('ne devrait pas inclure les détails des erreurs 500 en production', () => {
        process.env.NODE_ENV = 'production';
        const error = new ApiError(500, 'Server error', 'INTERNAL', { sensitive: 'data' });

        errorHandler(error, mockReq, mockRes, mockNext);

        const response = mockRes.json.mock.calls[0][0];
        expect(response.details).toBeUndefined();
      });
    });

    describe('Headers déjà envoyés', () => {
      it('devrait déléguer à Express si headers déjà envoyés', () => {
        mockRes.headersSent = true;
        const error = new Error('Test');

        errorHandler(error, mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalledWith(error);
        expect(mockRes.json).not.toHaveBeenCalled();
      });
    });
  });

  // ==========================================
  // Tests: asyncHandler
  // ==========================================
  describe('asyncHandler', () => {
    it('devrait passer le résultat pour une fonction sync', async () => {
      const handler = asyncHandler((req, res) => {
        res.json({ success: true });
      });

      await handler(mockReq, mockRes, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith({ success: true });
    });

    it('devrait passer le résultat pour une fonction async', async () => {
      const handler = asyncHandler(async (req, res) => {
        await Promise.resolve();
        res.json({ success: true });
      });

      await handler(mockReq, mockRes, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith({ success: true });
    });

    it('devrait catcher les erreurs async et appeler next', async () => {
      const error = new Error('Async error');
      const handler = asyncHandler(async () => {
        throw error;
      });

      await handler(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });

    it('devrait catcher les rejets de promesse', async () => {
      const handler = asyncHandler(async () => {
        return Promise.reject(new Error('Rejected'));
      });

      await handler(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  // ==========================================
  // Tests: notFoundHandler
  // ==========================================
  describe('notFoundHandler', () => {
    it('devrait créer une erreur 404', () => {
      notFoundHandler(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 404,
          code: 'ROUTE_NOT_FOUND'
        })
      );
    });
  });
});