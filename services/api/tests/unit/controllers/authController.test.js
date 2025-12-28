// ============================================
// services/api/tests/unit/controllers/authController.test.js
// ============================================

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// Mocks
jest.mock('../../src/config/database', () => ({
  pool: {
    connect: jest.fn(),
    query: jest.fn()
  }
}));

jest.mock('../../src/config/redis', () => ({
  redisClient: {
    get: jest.fn(),
    setEx: jest.fn(),
    del: jest.fn()
  }
}));

const { pool } = require('../../src/config/database');
const { redisClient } = require('../../src/config/redis');
const authController = require('../../src/controllers/authController');

describe('AuthController', () => {
  let mockReq, mockRes, mockClient;

  beforeEach(() => {
    mockClient = {
      query: jest.fn(),
      release: jest.fn()
    };
    pool.connect.mockResolvedValue(mockClient);

    mockReq = {
      body: {},
      ip: '127.0.0.1',
      user: { userId: 'test-user-id' }
    };
    mockRes = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis()
    };

    jest.clearAllMocks();
  });

  describe('login', () => {
    const validUser = {
      id: 'user-uuid',
      email: 'admin@hopital.mssante.fr',
      password_hash: '$2b$12$hashedpassword',
      status: 'active',
      role_name: 'domain_admin',
      domain_id: 'domain-uuid',
      domain_name: 'hopital.mssante.fr',
      is_super_admin: false
    };

    it('devrait authentifier un utilisateur valide', async () => {
      mockReq.body = { email: 'admin@hopital.mssante.fr', password: 'ValidPassword123!' };
      mockClient.query
        .mockResolvedValueOnce({ rows: [validUser] }) // SELECT user
        .mockResolvedValueOnce({ rows: [] }); // UPDATE last_login
      
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);
      redisClient.setEx.mockResolvedValue('OK');

      await authController.login(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            token: expect.any(String),
            refreshToken: expect.any(String)
          })
        })
      );
    });

    it('devrait rejeter un email invalide', async () => {
      mockReq.body = { email: 'invalid@email.com', password: 'password' };
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await authController.login(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, code: 'INVALID_CREDENTIALS' })
      );
    });

    it('devrait rejeter un mot de passe incorrect', async () => {
      mockReq.body = { email: 'admin@hopital.mssante.fr', password: 'wrongpassword' };
      mockClient.query.mockResolvedValueOnce({ rows: [validUser] });
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(false);

      await authController.login(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it('devrait rejeter un compte inactif', async () => {
      mockReq.body = { email: 'admin@hopital.mssante.fr', password: 'ValidPassword123!' };
      mockClient.query.mockResolvedValueOnce({ 
        rows: [{ ...validUser, status: 'suspended' }] 
      });
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);

      await authController.login(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'ACCOUNT_INACTIVE' })
      );
    });
  });

  describe('logout', () => {
    it('devrait déconnecter l\'utilisateur', async () => {
      mockReq.user = { userId: 'test-user-id' };
      redisClient.del.mockResolvedValue(1);
      mockClient.query.mockResolvedValue({ rows: [] });

      await authController.logout(mockReq, mockRes);

      expect(redisClient.del).toHaveBeenCalledWith('refresh_token:test-user-id');
      expect(mockRes.json).toHaveBeenCalledWith({ success: true, message: expect.any(String) });
    });
  });

  describe('refresh', () => {
    it('devrait rafraîchir un token valide', async () => {
      const refreshToken = jwt.sign(
        { userId: 'test-user-id', type: 'refresh' },
        process.env.JWT_REFRESH_SECRET
      );
      mockReq.body = { refreshToken };
      
      redisClient.get.mockResolvedValue(refreshToken);
      mockClient.query.mockResolvedValueOnce({ 
        rows: [{ id: 'test-user-id', email: 'test@test.fr', status: 'active', role_name: 'user' }] 
      });

      await authController.refresh(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({ token: expect.any(String) })
        })
      );
    });

    it('devrait rejeter un refresh token invalide', async () => {
      mockReq.body = { refreshToken: 'invalid-token' };
      redisClient.get.mockResolvedValue(null);

      await authController.refresh(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });
  });

  describe('changePassword', () => {
    it('devrait changer le mot de passe', async () => {
      mockReq.body = { currentPassword: 'OldPass123!', newPassword: 'NewPass456!' };
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ password_hash: '$2b$12$hash' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });
      
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);
      jest.spyOn(bcrypt, 'hash').mockResolvedValue('$2b$12$newhash');
      redisClient.del.mockResolvedValue(1);

      await authController.changePassword(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true })
      );
    });

    it('devrait rejeter un ancien mot de passe incorrect', async () => {
      mockReq.body = { currentPassword: 'WrongPass', newPassword: 'NewPass456!' };
      mockClient.query.mockResolvedValueOnce({ rows: [{ password_hash: '$2b$12$hash' }] });
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(false);

      await authController.changePassword(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'INVALID_PASSWORD' })
      );
    });
  });
});