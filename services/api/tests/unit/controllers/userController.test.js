// ============================================
// services/api/tests/unit/controllers/userController.test.js
// ============================================

jest.mock('../../src/config/database');
const userController = require('../../src/controllers/userController');
const { pool } = require('../../src/config/database');

describe('UserController', () => {
  let mockReq, mockRes, mockClient;

  beforeEach(() => {
    mockClient = { query: jest.fn(), release: jest.fn() };
    pool.connect.mockResolvedValue(mockClient);
    pool.query = jest.fn();

    mockReq = {
      params: {},
      query: {},
      body: {},
      user: { userId: 'admin-id', domainId: 'domain-id' },
      domain: { id: 'domain-id' }
    };
    mockRes = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis()
    };

    jest.clearAllMocks();
  });

  describe('list', () => {
    it('devrait lister les utilisateurs du domaine', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [{ count: '3' }] })
        .mockResolvedValueOnce({ 
          rows: [
            { id: '1', email: 'user1@test.fr', first_name: 'Jean', last_name: 'Dupont' },
            { id: '2', email: 'user2@test.fr', first_name: 'Marie', last_name: 'Martin' }
          ] 
        });

      await userController.list(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            users: expect.any(Array),
            pagination: expect.any(Object)
          })
        })
      );
    });

    it('devrait rechercher par terme', async () => {
      mockReq.query = { search: 'dupont' };
      pool.query
        .mockResolvedValueOnce({ rows: [{ count: '1' }] })
        .mockResolvedValueOnce({ rows: [{ id: '1', email: 'jean.dupont@test.fr' }] });

      await userController.list(mockReq, mockRes);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('ILIKE'),
        expect.arrayContaining(['%dupont%'])
      );
    });
  });

  describe('create', () => {
    it('devrait créer un utilisateur', async () => {
      mockReq.body = {
        email: 'nouveau@hopital.mssante.fr',
        firstName: 'Nouveau',
        lastName: 'Utilisateur',
        rppsId: '10001234567',
        role: 'user'
      };

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [] }) // Check existing
        .mockResolvedValueOnce({ rows: [{ id: 'role-uuid' }] }) // Get role
        .mockResolvedValueOnce({ 
          rows: [{ id: 'new-user-id', email: 'nouveau@hopital.mssante.fr' }] 
        })
        .mockResolvedValueOnce({ rows: [] }) // Audit
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      await userController.create(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(201);
    });

    it('devrait rejeter un RPPS invalide', async () => {
      mockReq.body = {
        email: 'test@hopital.mssante.fr',
        firstName: 'Test',
        lastName: 'User',
        rppsId: '123' // Invalide - doit être 11 chiffres
      };

      await userController.create(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });
  });

  describe('get', () => {
    it('devrait récupérer un utilisateur', async () => {
      mockReq.params = { id: 'user-uuid' };
      pool.query.mockResolvedValueOnce({
        rows: [{
          id: 'user-uuid',
          email: 'test@test.fr',
          first_name: 'Test',
          last_name: 'User',
          status: 'active'
        }]
      });

      await userController.get(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({ id: 'user-uuid' })
        })
      );
    });

    it('devrait retourner 404 si utilisateur non trouvé', async () => {
      mockReq.params = { id: 'unknown-uuid' };
      pool.query.mockResolvedValueOnce({ rows: [] });

      await userController.get(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });
  });

  describe('update', () => {
    it('devrait mettre à jour un utilisateur', async () => {
      mockReq.params = { id: 'user-uuid' };
      mockReq.body = { firstName: 'Nouveau', lastName: 'Nom' };

      mockClient.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: 'user-uuid' }] })
        .mockResolvedValueOnce({ rows: [{ id: 'user-uuid', first_name: 'Nouveau' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      await userController.update(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true })
      );
    });
  });

  describe('delete', () => {
    it('devrait désactiver un utilisateur', async () => {
      mockReq.params = { id: 'user-uuid' };

      mockClient.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: 'user-uuid' }] })
        .mockResolvedValueOnce({ rows: [{ id: 'user-uuid', status: 'inactive' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      await userController.delete(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true })
      );
    });
  });
});