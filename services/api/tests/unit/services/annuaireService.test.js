// ============================================================
// services/api/tests/unit/services/annuaireService.test.js
// ============================================================

const AnnuaireService = require('../../../src/services/annuaire/annuaireService');

jest.mock('axios');
jest.mock('../../../src/config/database', () => ({
  pool: {
    query: jest.fn()
  }
}));
jest.mock('../../../src/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
}));

const axios = require('axios');
const { pool } = require('../../../src/config/database');

describe('AnnuaireService', () => {
  let mockAxiosInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockAxiosInstance = {
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn()
    };
    
    axios.create.mockReturnValue(mockAxiosInstance);
  });

  describe('registerMailbox', () => {
    it('devrait enregistrer une BAL personnelle dans l\'annuaire', async () => {
      const mailboxData = {
        email: 'medecin@hopital.mssante.fr',
        type: 'personal',
        rpps: '12345678901',
        firstName: 'Jean',
        lastName: 'Dupont',
        profession: 'Médecin'
      };
      
      mockAxiosInstance.post.mockResolvedValue({
        data: { id: 'bal-123', status: 'registered' }
      });
      
      pool.query.mockResolvedValue({ rows: [] });
      
      const result = await AnnuaireService.registerMailbox(mailboxData);
      
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/bal',
        expect.objectContaining({
          email: 'medecin@hopital.mssante.fr',
          type: 'personal'
        })
      );
      expect(result.status).toBe('registered');
    });

    it('devrait enregistrer une BAL organisationnelle', async () => {
      const mailboxData = {
        email: 'secretariat@hopital.mssante.fr',
        type: 'organizational',
        finessId: '123456789',
        organizationName: 'Hôpital Central',
        serviceName: 'Secrétariat'
      };
      
      mockAxiosInstance.post.mockResolvedValue({
        data: { id: 'bal-456', status: 'registered' }
      });
      
      pool.query.mockResolvedValue({ rows: [] });
      
      const result = await AnnuaireService.registerMailbox(mailboxData);
      
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/bal',
        expect.objectContaining({
          finessId: '123456789',
          type: 'organizational'
        })
      );
    });

    it('devrait gérer les erreurs de doublon', async () => {
      mockAxiosInstance.post.mockRejectedValue({
        response: { status: 409, data: { message: 'BAL déjà existante' } }
      });
      
      await expect(AnnuaireService.registerMailbox({ email: 'existing@test.fr' }))
        .rejects.toThrow('Conflit');
    });
  });

  describe('unregisterMailbox', () => {
    it('devrait supprimer une BAL de l\'annuaire', async () => {
      mockAxiosInstance.delete.mockResolvedValue({ data: { success: true } });
      pool.query.mockResolvedValue({ rows: [] });
      
      const result = await AnnuaireService.unregisterMailbox('test@hopital.mssante.fr');
      
      expect(mockAxiosInstance.delete).toHaveBeenCalledWith(
        expect.stringContaining('test@hopital.mssante.fr')
      );
    });
  });

  describe('searchDirectory', () => {
    it('devrait rechercher dans l\'annuaire par nom', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: {
          results: [
            { email: 'jean.dupont@hopital.mssante.fr', name: 'Jean Dupont' },
            { email: 'jean.martin@clinique.mssante.fr', name: 'Jean Martin' }
          ],
          total: 2
        }
      });
      
      const result = await AnnuaireService.searchDirectory({ name: 'Jean' });
      
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/search',
        expect.objectContaining({ params: expect.objectContaining({ name: 'Jean' }) })
      );
      expect(result.results).toHaveLength(2);
    });

    it('devrait rechercher par RPPS', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: { results: [{ rpps: '12345678901', email: 'medecin@test.fr' }], total: 1 }
      });
      
      await AnnuaireService.searchDirectory({ rpps: '12345678901' });
      
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/search',
        expect.objectContaining({ params: expect.objectContaining({ rpps: '12345678901' }) })
      );
    });
  });

  describe('syncWhitelist', () => {
    it('devrait synchroniser la liste blanche des domaines', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: {
          domains: ['hopital.mssante.fr', 'clinique.mssante.fr'],
          updatedAt: '2025-01-01T00:00:00Z'
        }
      });
      
      const result = await AnnuaireService.syncWhitelist();
      
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/whitelist');
      expect(result.domains).toContain('hopital.mssante.fr');
    });
  });

  describe('submitMonthlyIndicators', () => {
    it('devrait soumettre les indicateurs mensuels', async () => {
      jest.mock('../../../src/services/annuaire/indicatorsService', () => ({
        exportCSV: jest.fn().mockResolvedValue('csv,content')
      }));
      
      mockAxiosInstance.post.mockResolvedValue({ data: { submitted: true } });
      pool.query.mockResolvedValue({ rows: [] });
      
      const result = await AnnuaireService.submitMonthlyIndicators(2025, 1);
      
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/indicateurs',
        expect.objectContaining({ year: 2025, month: 1 })
      );
    });
  });

  describe('handleError', () => {
    it('devrait formater les erreurs 400', () => {
      const error = AnnuaireService.handleError({
        response: { status: 400, data: { message: 'Données invalides' } }
      });
      
      expect(error.message).toContain('Requête invalide');
    });

    it('devrait formater les erreurs 401', () => {
      const error = AnnuaireService.handleError({
        response: { status: 401, data: {} }
      });
      
      expect(error.message).toContain('Authentification');
    });

    it('devrait formater les erreurs 429', () => {
      const error = AnnuaireService.handleError({
        response: { status: 429, data: {} }
      });
      
      expect(error.message).toContain('Trop de requêtes');
    });
  });
});