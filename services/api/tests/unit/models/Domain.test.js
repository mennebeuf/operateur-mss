/**
 * Tests unitaires - Modèle Domain
 * services/api/tests/unit/models/Domain.test.js
 */

// Mocks
jest.mock('../../../src/config/database', () => ({
  pool: { query: jest.fn(), connect: jest.fn() }
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
  debug: jest.fn()
}));

const { pool } = require('../../../src/config/database');
const { redisClient } = require('../../../src/config/redis');
const Domain = require('../../../src/models/Domain');

describe('Domain Model', () => {
  let mockClient;

  // Données de test
  const mockDomain = {
    id: '550e8400-e29b-41d4-a716-446655440003',
    domain_name: 'hopital-paris.mssante.fr',
    finess_juridique: '750000001',
    finess_geographique: '750000002',
    organization_name: 'Hôpital de Paris',
    organization_type: 'hospital',
    contact_name: 'Admin IT',
    contact_email: 'admin@hopital-paris.mssante.fr',
    contact_phone: '+33140000000',
    address_line1: '1 Rue de la Santé',
    address_line2: null,
    postal_code: '75013',
    city: 'Paris',
    country: 'FR',
    quotas: {
      max_mailboxes: 500,
      max_storage_gb: 100,
      max_message_size_mb: 25,
      max_messages_per_day: 50000
    },
    certificate_serial: 'ABC123456',
    certificate_expires_at: new Date('2025-06-15'),
    settings: {
      auto_publish_directory: true,
      default_quota_per_mailbox_mb: 1024,
      retention_days: 365
    },
    status: 'active',
    activated_at: new Date('2024-01-01'),
    suspended_at: null,
    suspension_reason: null,
    created_at: new Date('2024-01-01'),
    updated_at: new Date('2024-01-15'),
    created_by: 'super-admin-uuid'
  };

  beforeEach(() => {
    mockClient = {
      query: jest.fn(),
      release: jest.fn()
    };
    pool.connect.mockResolvedValue(mockClient);
    pool.query = jest.fn();
    jest.clearAllMocks();
  });

  // ==========================================
  // Tests: findById
  // ==========================================
  describe('findById', () => {
    it('devrait trouver un domaine par ID', async () => {
      pool.query.mockResolvedValueOnce({ rows: [mockDomain] });

      const domain = await Domain.findById(mockDomain.id);

      expect(domain).toBeDefined();
      expect(domain.id).toBe(mockDomain.id);
      expect(domain.domain_name).toBe('hopital-paris.mssante.fr');
    });

    it('devrait retourner null si domaine non trouvé', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      const domain = await Domain.findById('unknown-uuid');

      expect(domain).toBeNull();
    });

    it('devrait utiliser le cache Redis si disponible', async () => {
      redisClient.get.mockResolvedValueOnce(JSON.stringify(mockDomain));

      const domain = await Domain.findById(mockDomain.id, { useCache: true });

      expect(domain).toBeDefined();
      expect(pool.query).not.toHaveBeenCalled();
    });
  });

  // ==========================================
  // Tests: findByName
  // ==========================================
  describe('findByName', () => {
    it('devrait trouver un domaine par nom', async () => {
      pool.query.mockResolvedValueOnce({ rows: [mockDomain] });

      const domain = await Domain.findByName('hopital-paris.mssante.fr');

      expect(domain).toBeDefined();
      expect(domain.domain_name).toBe('hopital-paris.mssante.fr');
    });

    it('devrait normaliser le nom en minuscules', async () => {
      pool.query.mockResolvedValueOnce({ rows: [mockDomain] });

      await Domain.findByName('HOPITAL-PARIS.MSSANTE.FR');

      expect(pool.query).toHaveBeenCalledWith(
        expect.any(String),
        ['hopital-paris.mssante.fr']
      );
    });

    it('devrait retourner null si domaine non trouvé', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      const domain = await Domain.findByName('unknown.mssante.fr');

      expect(domain).toBeNull();
    });
  });

  // ==========================================
  // Tests: findByFiness
  // ==========================================
  describe('findByFiness', () => {
    it('devrait trouver un domaine par FINESS juridique', async () => {
      pool.query.mockResolvedValueOnce({ rows: [mockDomain] });

      const domain = await Domain.findByFiness('750000001');

      expect(domain).toBeDefined();
      expect(domain.finess_juridique).toBe('750000001');
    });
  });

  // ==========================================
  // Tests: findAll
  // ==========================================
  describe('findAll', () => {
    it('devrait lister tous les domaines', async () => {
      const domains = [mockDomain, { ...mockDomain, id: 'domain-2' }];
      pool.query.mockResolvedValueOnce({ rows: domains });

      const result = await Domain.findAll();

      expect(result).toHaveLength(2);
    });

    it('devrait filtrer par statut', async () => {
      pool.query.mockResolvedValueOnce({ rows: [mockDomain] });

      await Domain.findAll({ status: 'active' });

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining("status = $"),
        expect.arrayContaining(['active'])
      );
    });

    it('devrait filtrer par type d\'organisation', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      await Domain.findAll({ organizationType: 'hospital' });

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining("organization_type = $"),
        expect.arrayContaining(['hospital'])
      );
    });

    it('devrait paginer les résultats', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      await Domain.findAll({ page: 2, limit: 10 });

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT'),
        expect.arrayContaining([10, 10]) // limit, offset
      );
    });

    it('devrait trier par nom par défaut', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      await Domain.findAll();

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY domain_name'),
        expect.any(Array)
      );
    });
  });

  // ==========================================
  // Tests: create
  // ==========================================
  describe('create', () => {
    const newDomainData = {
      domainName: 'nouvelle-clinique.mssante.fr',
      finessJuridique: '690000001',
      organizationName: 'Nouvelle Clinique',
      organizationType: 'clinic',
      contactEmail: 'admin@nouvelle-clinique.mssante.fr'
    };

    it('devrait créer un nouveau domaine', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [] }) // Check existing name
        .mockResolvedValueOnce({ rows: [] }) // Check existing FINESS
        .mockResolvedValueOnce({ rows: [{ id: 'new-domain-uuid', ...newDomainData }] })
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      const domain = await Domain.create(newDomainData);

      expect(domain.id).toBe('new-domain-uuid');
    });

    it('devrait rejeter un nom de domaine déjà existant', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: 'existing' }] }); // Name exists

      await expect(Domain.create(newDomainData)).rejects.toThrow(/existe|already/i);
    });

    it('devrait rejeter un FINESS déjà utilisé', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] }) // Name OK
        .mockResolvedValueOnce({ rows: [{ id: 'existing' }] }); // FINESS exists

      await expect(Domain.create(newDomainData)).rejects.toThrow(/finess|déjà utilisé/i);
    });

    it('devrait valider le format du domaine MSSanté', async () => {
      const badData = { ...newDomainData, domainName: 'test.com' };

      await expect(Domain.create(badData)).rejects.toThrow(/mssante\.fr/i);
    });

    it('devrait définir le statut initial à "pending"', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: 'new', status: 'pending' }] })
        .mockResolvedValueOnce({ rows: [] });

      const domain = await Domain.create(newDomainData);

      expect(domain.status).toBe('pending');
    });

    it('devrait appliquer les quotas par défaut', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ 
          id: 'new', 
          quotas: { max_mailboxes: 100, max_storage_gb: 100 } 
        }] })
        .mockResolvedValueOnce({ rows: [] });

      const domain = await Domain.create(newDomainData);

      expect(domain.quotas.max_mailboxes).toBeDefined();
    });
  });

  // ==========================================
  // Tests: update
  // ==========================================
  describe('update', () => {
    it('devrait mettre à jour un domaine', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [{ ...mockDomain, organization_name: 'Nouveau Nom' }]
      });

      const domain = await Domain.update(mockDomain.id, { organizationName: 'Nouveau Nom' });

      expect(domain.organization_name).toBe('Nouveau Nom');
    });

    it('devrait mettre à jour les quotas', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [{ ...mockDomain, quotas: { max_mailboxes: 1000 } }]
      });

      const domain = await Domain.update(mockDomain.id, {
        quotas: { max_mailboxes: 1000 }
      });

      expect(domain.quotas.max_mailboxes).toBe(1000);
    });

    it('devrait invalider le cache après mise à jour', async () => {
      pool.query.mockResolvedValueOnce({ rows: [mockDomain] });

      await Domain.update(mockDomain.id, { organizationName: 'Test' });

      expect(redisClient.del).toHaveBeenCalledWith(`domain:${mockDomain.id}`);
    });
  });

  // ==========================================
  // Tests: activate / suspend
  // ==========================================
  describe('activate', () => {
    it('devrait activer un domaine', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [{ ...mockDomain, status: 'active', activated_at: new Date() }]
      });

      const domain = await Domain.activate(mockDomain.id);

      expect(domain.status).toBe('active');
      expect(domain.activated_at).toBeDefined();
    });
  });

  describe('suspend', () => {
    it('devrait suspendre un domaine', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [{ ...mockDomain, status: 'suspended', suspension_reason: 'Non-paiement' }]
      });

      const domain = await Domain.suspend(mockDomain.id, 'Non-paiement');

      expect(domain.status).toBe('suspended');
      expect(domain.suspension_reason).toBe('Non-paiement');
    });
  });

  // ==========================================
  // Tests: getQuotas
  // ==========================================
  describe('getQuotas', () => {
    it('devrait retourner les quotas du domaine', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [{ quotas: mockDomain.quotas }]
      });

      const quotas = await Domain.getQuotas(mockDomain.id);

      expect(quotas.max_mailboxes).toBe(500);
      expect(quotas.max_storage_gb).toBe(100);
    });
  });

  // ==========================================
  // Tests: checkMailboxQuota
  // ==========================================
  describe('checkMailboxQuota', () => {
    it('devrait vérifier si le quota de BAL est atteint', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [{ quotas: { max_mailboxes: 100 } }] })
        .mockResolvedValueOnce({ rows: [{ count: '100' }] });

      const exceeded = await Domain.checkMailboxQuota(mockDomain.id);

      expect(exceeded).toBe(false);
    });

    it('devrait retourner les détails d\'utilisation', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [{ quotas: { max_mailboxes: 100 } }] })
        .mockResolvedValueOnce({ rows: [{ count: '75' }] });

      const { exceeded, current, max, remaining } = await Domain.checkMailboxQuota(
        mockDomain.id,
        { returnDetails: true }
      );

      expect(exceeded).toBe(false);
      expect(current).toBe(75);
      expect(max).toBe(100);
      expect(remaining).toBe(25);
    });
  });

  // ==========================================
  // Tests: checkStorageQuota
  // ==========================================
  describe('checkStorageQuota', () => {
    it('devrait vérifier le quota de stockage', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [{ quotas: { max_storage_gb: 100 } }] })
        .mockResolvedValueOnce({ rows: [{ total_mb: '51200' }] }); // 50 GB

      const exceeded = await Domain.checkStorageQuota(mockDomain.id);

      expect(exceeded).toBe(false);
    });

    it('devrait détecter un dépassement de stockage', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [{ quotas: { max_storage_gb: 50 } }] })
        .mockResolvedValueOnce({ rows: [{ total_mb: '52224' }] }); // 51 GB

      const exceeded = await Domain.checkStorageQuota(mockDomain.id);

      expect(exceeded).toBe(true);
    });
  });

  // ==========================================
  // Tests: getStatistics
  // ==========================================
  describe('getStatistics', () => {
    it('devrait retourner les statistiques du domaine', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [{ count: '150' }] }) // Total mailboxes
        .mockResolvedValueOnce({ rows: [{ count: '140' }] }) // Active mailboxes
        .mockResolvedValueOnce({ rows: [{ count: '25' }] }) // Users
        .mockResolvedValueOnce({ rows: [{ total: '25600' }] }); // Storage MB

      const stats = await Domain.getStatistics(mockDomain.id);

      expect(stats.totalMailboxes).toBe(150);
      expect(stats.activeMailboxes).toBe(140);
      expect(stats.totalUsers).toBe(25);
      expect(stats.storageUsedMb).toBe(25600);
    });

    it('devrait inclure la répartition par type de BAL', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [
          { type: 'personal', count: '100' },
          { type: 'organizational', count: '40' },
          { type: 'applicative', count: '10' }
        ]});

      const stats = await Domain.getStatistics(mockDomain.id, { byType: true });

      expect(stats.mailboxesByType.personal).toBe(100);
      expect(stats.mailboxesByType.organizational).toBe(40);
      expect(stats.mailboxesByType.applicative).toBe(10);
    });
  });

  // ==========================================
  // Tests: updateCertificateInfo
  // ==========================================
  describe('updateCertificateInfo', () => {
    it('devrait mettre à jour les infos du certificat', async () => {
      const certInfo = {
        serial: 'NEW-SERIAL-123',
        expiresAt: new Date('2026-01-01')
      };

      pool.query.mockResolvedValueOnce({
        rows: [{ 
          ...mockDomain, 
          certificate_serial: 'NEW-SERIAL-123',
          certificate_expires_at: new Date('2026-01-01')
        }]
      });

      const domain = await Domain.updateCertificateInfo(mockDomain.id, certInfo);

      expect(domain.certificate_serial).toBe('NEW-SERIAL-123');
    });
  });

  // ==========================================
  // Tests: getAdmins
  // ==========================================
  describe('getAdmins', () => {
    it('devrait lister les administrateurs du domaine', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [
          { user_id: 'admin-1', email: 'admin1@test.fr', role: 'admin' },
          { user_id: 'admin-2', email: 'admin2@test.fr', role: 'super_admin' }
        ]
      });

      const admins = await Domain.getAdmins(mockDomain.id);

      expect(admins).toHaveLength(2);
    });
  });

  // ==========================================
  // Tests: addAdmin
  // ==========================================
  describe('addAdmin', () => {
    it('devrait ajouter un administrateur', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [{ id: 'admin-link-id', domain_id: mockDomain.id, user_id: 'user-uuid', role: 'admin' }]
      });

      const result = await Domain.addAdmin(mockDomain.id, 'user-uuid', 'admin');

      expect(result.role).toBe('admin');
    });
  });

  // ==========================================
  // Tests: removeAdmin
  // ==========================================
  describe('removeAdmin', () => {
    it('devrait supprimer un administrateur', async () => {
      pool.query.mockResolvedValueOnce({ rowCount: 1 });

      const result = await Domain.removeAdmin(mockDomain.id, 'user-uuid');

      expect(result).toBe(true);
    });
  });

  // ==========================================
  // Tests: count
  // ==========================================
  describe('count', () => {
    it('devrait compter tous les domaines', async () => {
      pool.query.mockResolvedValueOnce({ rows: [{ count: '25' }] });

      const count = await Domain.count();

      expect(count).toBe(25);
    });

    it('devrait compter par statut', async () => {
      pool.query.mockResolvedValueOnce({ rows: [{ count: '20' }] });

      const count = await Domain.count({ status: 'active' });

      expect(count).toBe(20);
    });
  });

  // ==========================================
  // Tests: getExpiringCertificates
  // ==========================================
  describe('getExpiringCertificates', () => {
    it('devrait lister les domaines avec certificats expirant', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [
          { id: 'domain-1', domain_name: 'test1.mssante.fr', certificate_expires_at: new Date(), days_until: 15 },
          { id: 'domain-2', domain_name: 'test2.mssante.fr', certificate_expires_at: new Date(), days_until: 25 }
        ]
      });

      const domains = await Domain.getExpiringCertificates(30);

      expect(domains).toHaveLength(2);
      expect(domains[0].days_until).toBeLessThanOrEqual(30);
    });
  });

  // ==========================================
  // Tests: search
  // ==========================================
  describe('search', () => {
    it('devrait rechercher par terme', async () => {
      pool.query.mockResolvedValueOnce({ rows: [mockDomain] });

      const results = await Domain.search('paris');

      expect(results).toHaveLength(1);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('ILIKE'),
        expect.arrayContaining(['%paris%'])
      );
    });

    it('devrait rechercher dans domain_name et organization_name', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      await Domain.search('hopital');

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringMatching(/domain_name ILIKE|organization_name ILIKE/),
        expect.any(Array)
      );
    });
  });
});d = await Domain.checkMailboxQuota(mockDomain.id);

      expect(exceeded).toBe(true);
    });

    it('devrait retourner false si quota non atteint', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [{ quotas: { max_mailboxes: 100 } }] })
        .mockResolvedValueOnce({ rows: [{ count: '50' }] });

      const exceede