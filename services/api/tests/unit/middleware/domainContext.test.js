/**
 * Tests unitaires - Middleware de contexte domaine
 * services/api/tests/unit/middleware/domainContext.test.js
 */

// Mocks
jest.mock('../../../src/config/database', () => ({
  pool: { query: jest.fn() }
}));

jest.mock('../../../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

const { pool } = require('../../../src/config/database');
const { domainContext } = require('../../../src/middleware/domainContext');

describe('DomainContext Middleware', () => {
  let mockReq, mockRes, mockNext;

  const mockDomain = {
    id: 'domain-uuid',
    domain_name: 'hopital.mssante.fr',
    organization_name: 'Hôpital Test',
    status: 'active',
    quotas: {
      max_mailboxes: 100,
      max_storage_gb: 50
    }
  };

  beforeEach(() => {
    mockReq = {
      headers: {},
      hostname: '',
      user: null,
      params: {},
      query: {}
    };
    mockRes = {
      json: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis()
    };
    mockNext = jest.fn();
    jest.clearAllMocks();
  });

  // ==========================================
  // Tests: Extraction du domaine via header X-Domain
  // ==========================================
  describe('Header X-Domain', () => {
    it('devrait extraire le domaine depuis le header X-Domain', async () => {
      mockReq.headers['x-domain'] = 'hopital.mssante.fr';
      pool.query.mockResolvedValueOnce({ rows: [mockDomain] });

      await domainContext(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.domain).toEqual(mockDomain);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('domain_name = $1'),
        ['hopital.mssante.fr', 'active']
      );
    });

    it('devrait être insensible à la casse du header', async () => {
      mockReq.headers['X-DOMAIN'] = 'hopital.mssante.fr';
      pool.query.mockResolvedValueOnce({ rows: [mockDomain] });

      await domainContext(mockReq, mockRes, mockNext);

      expect(mockReq.domain).toBeDefined();
    });
  });

  // ==========================================
  // Tests: Extraction du domaine via subdomain
  // ==========================================
  describe('Subdomain', () => {
    it('devrait extraire le domaine depuis le subdomain', async () => {
      mockReq.hostname = 'api.hopital.mssante.fr';
      pool.query.mockResolvedValueOnce({ rows: [mockDomain] });

      await domainContext(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.domain).toBeDefined();
    });

    it('devrait extraire correctement le domaine MSSanté', async () => {
      mockReq.hostname = 'portal.clinique.mssante.fr';
      pool.query.mockResolvedValueOnce({ rows: [mockDomain] });

      await domainContext(mockReq, mockRes, mockNext);

      // Devrait extraire 'clinique.mssante.fr'
      expect(pool.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['clinique.mssante.fr'])
      );
    });

    it('devrait gérer les hostnames complexes', async () => {
      mockReq.hostname = 'app.sub.hopital.mssante.fr';
      pool.query.mockResolvedValueOnce({ rows: [mockDomain] });

      await domainContext(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  // ==========================================
  // Tests: Extraction du domaine via token utilisateur
  // ==========================================
  describe('Token utilisateur', () => {
    it('devrait extraire le domaine depuis l\'utilisateur authentifié', async () => {
      mockReq.user = {
        id: 'user-uuid',
        domain: 'hopital.mssante.fr',
        domainId: 'domain-uuid'
      };
      pool.query.mockResolvedValueOnce({ rows: [mockDomain] });

      await domainContext(mockReq, mockRes, mockNext);

      expect(mockReq.domain).toBeDefined();
    });

    it('devrait prioritiser X-Domain sur le token', async () => {
      mockReq.headers['x-domain'] = 'clinique.mssante.fr';
      mockReq.user = { domain: 'hopital.mssante.fr' };
      
      pool.query.mockResolvedValueOnce({ 
        rows: [{ ...mockDomain, domain_name: 'clinique.mssante.fr' }] 
      });

      await domainContext(mockReq, mockRes, mockNext);

      expect(pool.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['clinique.mssante.fr'])
      );
    });
  });

  // ==========================================
  // Tests: Domaine non spécifié
  // ==========================================
  describe('Domaine non spécifié', () => {
    it('devrait retourner 400 si aucun domaine n\'est trouvable', async () => {
      await domainContext(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.stringContaining('Domaine non spécifié')
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  // ==========================================
  // Tests: Domaine non trouvé ou inactif
  // ==========================================
  describe('Domaine non trouvé ou inactif', () => {
    it('devrait retourner 404 si le domaine n\'existe pas', async () => {
      mockReq.headers['x-domain'] = 'inexistant.mssante.fr';
      pool.query.mockResolvedValueOnce({ rows: [] });

      await domainContext(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.stringContaining('non trouvé')
        })
      );
    });

    it('devrait vérifier que le domaine est actif', async () => {
      mockReq.headers['x-domain'] = 'hopital.mssante.fr';
      pool.query.mockResolvedValueOnce({ rows: [] }); // Pas de résultat car status != 'active'

      await domainContext(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining("status = $"),
        expect.arrayContaining(['active'])
      );
    });
  });

  // ==========================================
  // Tests: Attachement du domaine
  // ==========================================
  describe('Attachement du domaine', () => {
    it('devrait attacher toutes les propriétés du domaine', async () => {
      mockReq.headers['x-domain'] = 'hopital.mssante.fr';
      pool.query.mockResolvedValueOnce({ rows: [mockDomain] });

      await domainContext(mockReq, mockRes, mockNext);

      expect(mockReq.domain.id).toBe('domain-uuid');
      expect(mockReq.domain.domain_name).toBe('hopital.mssante.fr');
      expect(mockReq.domain.organization_name).toBe('Hôpital Test');
      expect(mockReq.domain.quotas).toBeDefined();
    });
  });

  // ==========================================
  // Tests: Gestion des erreurs
  // ==========================================
  describe('Gestion des erreurs', () => {
    it('devrait gérer les erreurs de base de données', async () => {
      mockReq.headers['x-domain'] = 'hopital.mssante.fr';
      pool.query.mockRejectedValueOnce(new Error('Database error'));

      await domainContext(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Erreur serveur'
        })
      );
    });
  });

  // ==========================================
  // Tests: Validation du format de domaine
  // ==========================================
  describe('Validation du format de domaine', () => {
    it('devrait accepter un domaine MSSanté valide', async () => {
      mockReq.headers['x-domain'] = 'hopital-paris.mssante.fr';
      pool.query.mockResolvedValueOnce({ rows: [mockDomain] });

      await domainContext(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('devrait normaliser le domaine en minuscules', async () => {
      mockReq.headers['x-domain'] = 'HOPITAL.MSSANTE.FR';
      pool.query.mockResolvedValueOnce({ rows: [mockDomain] });

      await domainContext(mockReq, mockRes, mockNext);

      expect(pool.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['hopital.mssante.fr'])
      );
    });
  });

  // ==========================================
  // Tests: Cas particuliers
  // ==========================================
  describe('Cas particuliers', () => {
    it('devrait gérer les headers avec espaces', async () => {
      mockReq.headers['x-domain'] = '  hopital.mssante.fr  ';
      pool.query.mockResolvedValueOnce({ rows: [mockDomain] });

      await domainContext(mockReq, mockRes, mockNext);

      expect(pool.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['hopital.mssante.fr'])
      );
    });

    it('devrait extraire le domaine du params si présent', async () => {
      mockReq.params.domain = 'hopital.mssante.fr';
      pool.query.mockResolvedValueOnce({ rows: [mockDomain] });

      await domainContext(mockReq, mockRes, mockNext);

      expect(mockReq.domain).toBeDefined();
    });

    it('devrait gérer les domaines avec plusieurs niveaux de sous-domaines', async () => {
      mockReq.hostname = 'webmail.secure.hopital.mssante.fr';
      pool.query.mockResolvedValueOnce({ rows: [mockDomain] });

      await domainContext(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  // ==========================================
  // Tests: Ordre de priorité
  // ==========================================
  describe('Ordre de priorité', () => {
    it('devrait respecter l\'ordre: X-Domain > subdomain > user', async () => {
      mockReq.headers['x-domain'] = 'domain1.mssante.fr';
      mockReq.hostname = 'api.domain2.mssante.fr';
      mockReq.user = { domain: 'domain3.mssante.fr' };

      pool.query.mockResolvedValueOnce({ 
        rows: [{ ...mockDomain, domain_name: 'domain1.mssante.fr' }] 
      });

      await domainContext(mockReq, mockRes, mockNext);

      expect(pool.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['domain1.mssante.fr'])
      );
    });

    it('devrait utiliser subdomain si X-Domain absent', async () => {
      mockReq.hostname = 'api.domain2.mssante.fr';
      mockReq.user = { domain: 'domain3.mssante.fr' };

      pool.query.mockResolvedValueOnce({ 
        rows: [{ ...mockDomain, domain_name: 'domain2.mssante.fr' }] 
      });

      await domainContext(mockReq, mockRes, mockNext);

      // Devrait extraire domain2 du hostname
      expect(mockNext).toHaveBeenCalled();
    });

    it('devrait utiliser user.domain si autres sources absentes', async () => {
      mockReq.user = { domain: 'domain3.mssante.fr' };

      pool.query.mockResolvedValueOnce({ 
        rows: [{ ...mockDomain, domain_name: 'domain3.mssante.fr' }] 
      });

      await domainContext(mockReq, mockRes, mockNext);

      expect(pool.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['domain3.mssante.fr'])
      );
    });
  });
});