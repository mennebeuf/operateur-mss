// ============================================
// services/api/tests/unit/controllers/mailboxController.test.js
// ============================================

jest.mock('../../src/config/database');
jest.mock('../../src/config/redis');
jest.mock('../../src/services/annuaire/annuaireService');

const mailboxController = require('../../src/controllers/mailboxController');
const { pool } = require('../../src/config/database');

describe('MailboxController', () => {
  let mockReq, mockRes, mockClient;

  beforeEach(() => {
    mockClient = { query: jest.fn(), release: jest.fn() };
    pool.connect.mockResolvedValue(mockClient);
    pool.query = jest.fn();

    mockReq = {
      params: {},
      query: {},
      body: {},
      user: { userId: 'user-id', domainId: 'domain-id' },
      domain: { id: 'domain-id', domain_name: 'hopital.mssante.fr' }
    };
    mockRes = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis()
    };

    jest.clearAllMocks();
  });

  describe('list', () => {
    it('devrait lister les BAL du domaine', async () => {
      const mockMailboxes = [
        { id: '1', email: 'bal1@test.mssante.fr', type: 'personal', status: 'active' },
        { id: '2', email: 'bal2@test.mssante.fr', type: 'organizational', status: 'active' }
      ];

      pool.query
        .mockResolvedValueOnce({ rows: [{ count: '2' }] })
        .mockResolvedValueOnce({ rows: mockMailboxes });

      await mailboxController.list(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            mailboxes: expect.arrayContaining([
              expect.objectContaining({ email: 'bal1@test.mssante.fr' })
            ])
          })
        })
      );
    });

    it('devrait paginer les résultats', async () => {
      mockReq.query = { page: '2', limit: '10' };
      pool.query
        .mockResolvedValueOnce({ rows: [{ count: '25' }] })
        .mockResolvedValueOnce({ rows: [] });

      await mailboxController.list(mockReq, mockRes);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('OFFSET'),
        expect.arrayContaining([10]) // offset = (page-1) * limit
      );
    });

    it('devrait filtrer par type', async () => {
      mockReq.query = { type: 'PER' };
      pool.query
        .mockResolvedValueOnce({ rows: [{ count: '5' }] })
        .mockResolvedValueOnce({ rows: [] });

      await mailboxController.list(mockReq, mockRes);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('type = $'),
        expect.arrayContaining(['personal'])
      );
    });
  });

  describe('create', () => {
    it('devrait créer une BAL personnelle', async () => {
      mockReq.body = {
        email: 'jean.dupont@hopital.mssante.fr',
        type: 'PER',
        ownerRpps: '10001234567'
      };

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: 'owner-id' }] }) // Find owner
        .mockResolvedValueOnce({ rows: [] }) // Check existing
        .mockResolvedValueOnce({ 
          rows: [{ 
            id: 'new-bal-id', 
            email: 'jean.dupont@hopital.mssante.fr',
            type: 'personal',
            status: 'active'
          }] 
        }) // INSERT
        .mockResolvedValueOnce({ rows: [] }) // Audit log
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      await mailboxController.create(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({ email: 'jean.dupont@hopital.mssante.fr' })
        })
      );
    });

    it('devrait rejeter un email déjà existant', async () => {
      mockReq.body = { email: 'existing@hopital.mssante.fr', type: 'PER' };

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: 'existing-id' }] }); // Check existing

      await mailboxController.create(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(409);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'EMAIL_EXISTS' })
      );
    });

    it('devrait rejeter un email hors domaine', async () => {
      mockReq.body = { email: 'user@autre-domaine.mssante.fr', type: 'PER' };

      await mailboxController.create(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'INVALID_DOMAIN' })
      );
    });
  });

  describe('get', () => {
    it('devrait récupérer une BAL par ID', async () => {
      mockReq.params = { id: 'bal-uuid' };
      const mockMailbox = {
        id: 'bal-uuid',
        email: 'test@hopital.mssante.fr',
        type: 'personal',
        status: 'active',
        quota_mb: 1024,
        storage_used_mb: 256
      };

      pool.query.mockResolvedValueOnce({ rows: [mockMailbox] });

      await mailboxController.get(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({ id: 'bal-uuid' })
        })
      );
    });

    it('devrait retourner 404 si BAL non trouvée', async () => {
      mockReq.params = { id: 'nonexistent-uuid' };
      pool.query.mockResolvedValueOnce({ rows: [] });

      await mailboxController.get(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });
  });

  describe('update', () => {
    it('devrait mettre à jour une BAL', async () => {
      mockReq.params = { id: 'bal-uuid' };
      mockReq.body = { displayName: 'Nouveau Nom', quotaMb: 2048 };

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: 'bal-uuid' }] }) // Check exists
        .mockResolvedValueOnce({ 
          rows: [{ id: 'bal-uuid', display_name: 'Nouveau Nom', quota_mb: 2048 }] 
        }) // UPDATE
        .mockResolvedValueOnce({ rows: [] }) // Audit
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      await mailboxController.update(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true })
      );
    });
  });

  describe('delete', () => {
    it('devrait supprimer (soft delete) une BAL', async () => {
      mockReq.params = { id: 'bal-uuid' };
      mockReq.query = { permanent: 'false' };

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: 'bal-uuid', email: 'test@test.fr' }] })
        .mockResolvedValueOnce({ rows: [{ id: 'bal-uuid', status: 'deleted' }] })
        .mockResolvedValueOnce({ rows: [] }) // Audit
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      await mailboxController.delete(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true })
      );
    });
  });

  describe('suspend', () => {
    it('devrait suspendre une BAL', async () => {
      mockReq.params = { id: 'bal-uuid' };
      mockReq.body = { reason: 'Violation des conditions' };

      mockClient.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: 'bal-uuid', status: 'active' }] })
        .mockResolvedValueOnce({ rows: [{ id: 'bal-uuid', status: 'suspended' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      await mailboxController.suspend(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true })
      );
    });
  });

  describe('activate', () => {
    it('devrait réactiver une BAL suspendue', async () => {
      mockReq.params = { id: 'bal-uuid' };

      mockClient.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: 'bal-uuid', status: 'suspended' }] })
        .mockResolvedValueOnce({ rows: [{ id: 'bal-uuid', status: 'active' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      await mailboxController.activate(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true })
      );
    });
  });
});