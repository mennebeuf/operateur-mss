// tests/unit/services/annuaireService.test.js

const AnnuaireService = require('../../../src/services/annuaireService');

jest.mock('axios');
jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn().mockResolvedValue(Buffer.from('fake-cert'))
  }
}));
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

  beforeEach(async () => {
    jest.clearAllMocks();
    
    mockAxiosInstance = {
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn()
    };
    
    axios.create.mockReturnValue(mockAxiosInstance);
    
    // Réinitialiser le client manuellement
    AnnuaireService.client = mockAxiosInstance;
  });

  describe('publishPersonalMailbox', () => {
    it('devrait publier une BAL personnelle dans l\'annuaire', async () => {
      const mailbox = {
        id: 'mailbox-123',
        email: 'medecin@hopital.mssante.fr',
        hide_from_directory: false
      };
      
      const owner = {
        rpps_id: '12345678901',
        last_name: 'Dupont',
        first_name: 'Jean',
        profession: 'Médecin'
      };
      
      mockAxiosInstance.post.mockResolvedValue({
        data: { idBAL: 'bal-123' }
      });
      
      pool.query.mockResolvedValue({ rows: [] });
      
      const result = await AnnuaireService.publishPersonalMailbox(mailbox, owner);
      
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/bal',
        expect.objectContaining({
          typeBAL: 'PER',
          adresseBAL: 'medecin@hopital.mssante.fr'
        })
      );
      expect(result.idBAL).toBe('bal-123');
    });
  });

  describe('publishOrganizationalMailbox', () => {
    it('devrait publier une BAL organisationnelle', async () => {
      const mailbox = {
        id: 'mailbox-456',
        email: 'secretariat@hopital.mssante.fr',
        hide_from_directory: false,
        service_name: 'Secrétariat'
      };
      
      const domain = {
        finess_juridique: '123456789',
        organization_name: 'Hôpital Central'
      };
      
      mockAxiosInstance.post.mockResolvedValue({
        data: { idBAL: 'bal-456' }
      });
      
      pool.query.mockResolvedValue({ rows: [] });
      
      const result = await AnnuaireService.publishOrganizationalMailbox(mailbox, domain);
      
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/bal',
        expect.objectContaining({
          typeBAL: 'ORG',
          adresseBAL: 'secretariat@hopital.mssante.fr'
        })
      );
    });
  });

  describe('unpublishMailbox', () => {
    it('devrait supprimer une BAL de l\'annuaire', async () => {
      const mailbox = {
        id: 'mailbox-123',
        email: 'test@hopital.mssante.fr',
        annuaire_id: 'annuaire-123'
      };
      
      mockAxiosInstance.delete.mockResolvedValue({ data: { success: true } });
      pool.query.mockResolvedValue({ rows: [] });
      
      await AnnuaireService.unpublishMailbox(mailbox);
      
      expect(mockAxiosInstance.delete).toHaveBeenCalledWith('/bal/annuaire-123');
    });
  });

  describe('search', () => {
    it('devrait rechercher dans l\'annuaire par nom', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: {
          results: [{ email: 'jean.dupont@test.fr', name: 'Jean Dupont' }],
          total: 1
        }
      });
      
      const result = await AnnuaireService.search('Jean', { page: 1, limit: 20 });
      
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/search',
        expect.objectContaining({
          params: expect.objectContaining({ q: 'Jean' })
        })
      );
      expect(result.results).toHaveLength(1);
    });
  });

  describe('syncWhitelist', () => {
    it('devrait synchroniser la liste blanche des domaines', async () => {
      // Mock redis
      jest.mock('../../../src/config/redis', () => ({
        redisClient: {
          set: jest.fn().mockResolvedValue('OK')
        }
      }));
      
      mockAxiosInstance.get.mockResolvedValue({
        data: ['domain1.mssante.fr', 'domain2.mssante.fr']
      });
      
      const result = await AnnuaireService.syncWhitelist();
      
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/operateurs/whitelist');
    });
  });

  describe('handleError', () => {
    it('devrait formater les erreurs 400', () => {
      const error = {
        response: { status: 400, data: { message: 'Bad Request' } }
      };
      
      const result = AnnuaireService.handleError(error);
      
      expect(result.message).toContain('Requête invalide');
    });

    it('devrait formater les erreurs 401', () => {
      const error = {
        response: { status: 401, data: { message: 'Unauthorized' } }
      };
      
      const result = AnnuaireService.handleError(error);
      
      expect(result.message).toContain('Authentification');
    });

    it('devrait formater les erreurs 429', () => {
      const error = {
        response: { status: 429, data: { message: 'Too Many Requests' } }
      };
      
      const result = AnnuaireService.handleError(error);
      
      expect(result.message).toContain('Trop de requêtes');
    });
  });
});