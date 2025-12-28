// ============================================
// services/api/tests/unit/controllers/domainController.test.js
// ============================================

jest.mock('../../src/config/database');
const domainController = require('../../src/controllers/domainController');
const { pool } = require('../../src/config/database');

describe('DomainController', () => {
  let mockReq, mockRes, mockClient;

  beforeEach(() => {
    mockClient = { query: jest.fn(), release: jest.fn() };
    pool.connect.mockResolvedValue(mockClient);
    pool.query = jest.fn();

    mockReq = {
      params: {},
      query: {},
      body: {},
      user: { userId: 'admin-id', isSuperAdmin: true }
    };
    mockRes = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis()
    };

    jest.clearAllMocks();
  });

  describe('list', () => {
    it('devrait lister tous les domaines pour super admin', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [{ count: '2' }] })
        .mockResolvedValueOnce({
          rows: [
            { id: '1', domain_name: 'hopital1.mssante.fr', status: 'active' },
            { id: '2', domain_name: 'hopital2.mssante.fr', status: 'active' }
          ]
        });

      await domainController.list(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            domains: expect.arrayContaining([
              expect.objectContaining({ domain_name: 'hopital1.mssante.fr' })
            ])
          })
        })
      );
    });
  });

  describe('create', () => {
    it('devrait créer un nouveau domaine', async () => {
      mockReq.body = {
        domainName: 'nouveau-hopital.mssante.fr',
        organizationName: 'Nouvel Hôpital',
        finessJuridique: '123456789',
        organizationType: 'hospital'
      };

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [] }) // Check existing
        .mockResolvedValueOnce({
          rows: [{
            id: 'new-domain-id',
            domain_name: 'nouveau-hopital.mssante.fr',
            status: 'pending'
          }]
        })
        .mockResolvedValueOnce({ rows: [] }) // Audit
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      await domainController.create(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(201);
    });

    it('devrait rejeter un domaine déjà existant', async () => {
      mockReq.body = { domainName: 'existing.mssante.fr', organizationName: 'Test' };

      mockClient.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: 'existing-id' }] });

      await domainController.create(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(409);
    });

    it('devrait valider le format du domaine MSSanté', async () => {
      mockReq.body = { domainName: 'invalid-domain.com', organizationName: 'Test' };

      await domainController.create(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });
  });

  describe('get', () => {
    it('devrait récupérer un domaine par ID', async () => {
      mockReq.params = { id: 'domain-uuid' };
      pool.query.mockResolvedValueOnce({
        rows: [{
          id: 'domain-uuid',
          domain_name: 'hopital.mssante.fr',
          organization_name: 'Hôpital Test',
          status: 'active'
        }]
      });

      await domainController.get(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({ id: 'domain-uuid' })
        })
      );
    });
  });

  describe('getStatistics', () => {
    it('devrait retourner les statistiques du domaine', async () => {
      mockReq.params = { id: 'domain-uuid' };
      pool.query
        .mockResolvedValueOnce({ rows: [{ id: 'domain-uuid' }] }) // Check domain
        .mockResolvedValueOnce({ rows: [{ count: '50' }] }) // Total BAL
        .mockResolvedValueOnce({ rows: [{ count: '45' }] }) // Active BAL
        .mockResolvedValueOnce({ rows: [{ count: '10' }] }) // Users
        .mockResolvedValueOnce({ rows: [{ total: '5000' }] }); // Storage

      await domainController.getStatistics(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            totalMailboxes: expect.any(Number),
            activeMailboxes: expect.any(Number)
          })
        })
      );
    });
  });
});