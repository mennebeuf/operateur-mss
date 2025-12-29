/**
 * Tests unitaires - Modèle Mailbox
 * services/api/tests/unit/models/Mailbox.test.js
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
const Mailbox = require('../../../src/models/Mailbox');

describe('Mailbox Model', () => {
  let mockClient;

  // Données de test
  const mockMailbox = {
    id: '550e8400-e29b-41d4-a716-446655440002',
    email: 'secretariat.cardio@hopital.mssante.fr',
    type: 'organizational',
    owner_id: 'user-uuid',
    domain_id: 'domain-uuid',
    service_name: 'Secrétariat Cardiologie',
    service_type: 'secretariat',
    application_name: null,
    application_type: null,
    quota_mb: 2048,
    max_message_size_mb: 25,
    hide_from_directory: false,
    publication_id: 'pub-123',
    published_at: new Date('2024-01-15'),
    unpublished_at: null,
    storage_used_mb: 512,
    message_count: 1250,
    last_activity: new Date('2024-01-20'),
    status: 'active',
    activated_at: new Date('2024-01-01'),
    suspended_at: null,
    suspension_reason: null,
    created_at: new Date('2024-01-01'),
    updated_at: new Date('2024-01-15'),
    created_by: 'admin-uuid'
  };

  const mockPersonalMailbox = {
    ...mockMailbox,
    id: 'personal-bal-uuid',
    email: 'jean.dupont@hopital.mssante.fr',
    type: 'personal',
    service_name: null,
    service_type: null
  };

  const mockApplicativeMailbox = {
    ...mockMailbox,
    id: 'app-bal-uuid',
    email: 'dpi@hopital.mssante.fr',
    type: 'applicative',
    owner_id: null,
    application_name: 'DPI Hôpital',
    application_type: 'dpi',
    service_name: null
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
    it('devrait trouver une BAL par ID', async () => {
      pool.query.mockResolvedValueOnce({ rows: [mockMailbox] });

      const mailbox = await Mailbox.findById(mockMailbox.id);

      expect(mailbox).toBeDefined();
      expect(mailbox.id).toBe(mockMailbox.id);
      expect(mailbox.email).toBe(mockMailbox.email);
    });

    it('devrait retourner null si BAL non trouvée', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      const mailbox = await Mailbox.findById('unknown-uuid');

      expect(mailbox).toBeNull();
    });

    it('devrait inclure les relations (owner, domain)', async () => {
      pool.query.mockResolvedValueOnce({ 
        rows: [{
          ...mockMailbox,
          owner_email: 'owner@test.fr',
          owner_first_name: 'Jean',
          owner_last_name: 'Dupont',
          domain_name: 'hopital.mssante.fr'
        }] 
      });

      const mailbox = await Mailbox.findById(mockMailbox.id, { includeRelations: true });

      expect(mailbox.owner_email).toBe('owner@test.fr');
      expect(mailbox.domain_name).toBe('hopital.mssante.fr');
    });
  });

  // ==========================================
  // Tests: findByEmail
  // ==========================================
  describe('findByEmail', () => {
    it('devrait trouver une BAL par email', async () => {
      pool.query.mockResolvedValueOnce({ rows: [mockMailbox] });

      const mailbox = await Mailbox.findByEmail('secretariat.cardio@hopital.mssante.fr');

      expect(mailbox).toBeDefined();
      expect(mailbox.email).toBe('secretariat.cardio@hopital.mssante.fr');
    });

    it('devrait normaliser l\'email en minuscules', async () => {
      pool.query.mockResolvedValueOnce({ rows: [mockMailbox] });

      await Mailbox.findByEmail('SECRETARIAT.CARDIO@Hopital.mssante.fr');

      expect(pool.query).toHaveBeenCalledWith(
        expect.any(String),
        ['secretariat.cardio@hopital.mssante.fr']
      );
    });
  });

  // ==========================================
  // Tests: findByDomain
  // ==========================================
  describe('findByDomain', () => {
    it('devrait lister les BAL d\'un domaine', async () => {
      const mailboxes = [mockMailbox, mockPersonalMailbox];
      pool.query.mockResolvedValueOnce({ rows: mailboxes });

      const result = await Mailbox.findByDomain('domain-uuid');

      expect(result).toHaveLength(2);
    });

    it('devrait filtrer par type', async () => {
      pool.query.mockResolvedValueOnce({ rows: [mockPersonalMailbox] });

      await Mailbox.findByDomain('domain-uuid', { type: 'personal' });

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining("type = $"),
        expect.arrayContaining(['personal'])
      );
    });

    it('devrait filtrer par statut', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      await Mailbox.findByDomain('domain-uuid', { status: 'active' });

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining("status = $"),
        expect.arrayContaining(['active'])
      );
    });

    it('devrait paginer les résultats', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      await Mailbox.findByDomain('domain-uuid', { page: 3, limit: 20 });

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT'),
        expect.arrayContaining([20, 40]) // limit, offset
      );
    });

    it('devrait exclure les BAL en liste rouge si demandé', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      await Mailbox.findByDomain('domain-uuid', { excludeHidden: true });

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('hide_from_directory = FALSE'),
        expect.any(Array)
      );
    });
  });

  // ==========================================
  // Tests: findByOwner
  // ==========================================
  describe('findByOwner', () => {
    it('devrait lister les BAL d\'un propriétaire', async () => {
      pool.query.mockResolvedValueOnce({ rows: [mockMailbox, mockPersonalMailbox] });

      const result = await Mailbox.findByOwner('user-uuid');

      expect(result).toHaveLength(2);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('owner_id = $1'),
        ['user-uuid']
      );
    });
  });

  // ==========================================
  // Tests: create
  // ==========================================
  describe('create', () => {
    const newMailboxData = {
      email: 'nouvelle.bal@hopital.mssante.fr',
      type: 'personal',
      ownerId: 'user-uuid',
      domainId: 'domain-uuid',
      quotaMb: 1024
    };

    it('devrait créer une BAL personnelle', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [] }) // Check existing
        .mockResolvedValueOnce({ rows: [{ id: 'new-bal-uuid', ...newMailboxData }] })
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      const mailbox = await Mailbox.create(newMailboxData);

      expect(mailbox.id).toBe('new-bal-uuid');
      expect(mailbox.type).toBe('personal');
    });

    it('devrait créer une BAL organisationnelle', async () => {
      const orgData = {
        ...newMailboxData,
        email: 'service@hopital.mssante.fr',
        type: 'organizational',
        serviceName: 'Urgences',
        serviceType: 'urgences'
      };

      mockClient.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: 'new-org-bal', ...orgData }] })
        .mockResolvedValueOnce({ rows: [] });

      const mailbox = await Mailbox.create(orgData);

      expect(mailbox.type).toBe('organizational');
    });

    it('devrait créer une BAL applicative sans propriétaire', async () => {
      const appData = {
        email: 'application@hopital.mssante.fr',
        type: 'applicative',
        domainId: 'domain-uuid',
        applicationName: 'DPI',
        applicationType: 'dpi'
      };

      mockClient.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: 'new-app-bal', owner_id: null, ...appData }] })
        .mockResolvedValueOnce({ rows: [] });

      const mailbox = await Mailbox.create(appData);

      expect(mailbox.owner_id).toBeNull();
    });

    it('devrait rejeter un email déjà existant', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: 'existing' }] }); // Email existe

      await expect(Mailbox.create(newMailboxData)).rejects.toThrow(/existe|already/i);
    });

    it('devrait vérifier que l\'email correspond au domaine', async () => {
      const badData = {
        ...newMailboxData,
        email: 'test@autre-domaine.mssante.fr'
      };

      mockClient.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ domain_name: 'hopital.mssante.fr' }] });

      await expect(Mailbox.create(badData)).rejects.toThrow(/domaine/i);
    });

    it('devrait définir le statut initial à "active"', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: 'new', status: 'active' }] })
        .mockResolvedValueOnce({ rows: [] });

      const mailbox = await Mailbox.create(newMailboxData);

      expect(mailbox.status).toBe('active');
    });
  });

  // ==========================================
  // Tests: update
  // ==========================================
  describe('update', () => {
    it('devrait mettre à jour une BAL', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [{ ...mockMailbox, quota_mb: 4096 }]
      });

      const mailbox = await Mailbox.update(mockMailbox.id, { quotaMb: 4096 });

      expect(mailbox.quota_mb).toBe(4096);
    });

    it('devrait mettre à jour le service pour BAL organisationnelle', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [{ ...mockMailbox, service_name: 'Nouveau Service' }]
      });

      const mailbox = await Mailbox.update(mockMailbox.id, { serviceName: 'Nouveau Service' });

      expect(mailbox.service_name).toBe('Nouveau Service');
    });

    it('devrait invalider le cache après mise à jour', async () => {
      pool.query.mockResolvedValueOnce({ rows: [mockMailbox] });

      await Mailbox.update(mockMailbox.id, { quotaMb: 2048 });

      expect(redisClient.del).toHaveBeenCalledWith(`mailbox:${mockMailbox.id}`);
    });
  });

  // ==========================================
  // Tests: delete
  // ==========================================
  describe('delete', () => {
    it('devrait soft delete une BAL', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [{ ...mockMailbox, status: 'deleted' }]
      });

      const result = await Mailbox.delete(mockMailbox.id);

      expect(result.status).toBe('deleted');
    });

    it('devrait permettre une suppression permanente', async () => {
      pool.query.mockResolvedValueOnce({ rowCount: 1 });

      const result = await Mailbox.delete(mockMailbox.id, { permanent: true });

      expect(result).toBe(true);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM mailboxes'),
        [mockMailbox.id]
      );
    });
  });

  // ==========================================
  // Tests: suspend / activate
  // ==========================================
  describe('suspend', () => {
    it('devrait suspendre une BAL', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [{ ...mockMailbox, status: 'suspended', suspension_reason: 'Abus' }]
      });

      const mailbox = await Mailbox.suspend(mockMailbox.id, 'Abus');

      expect(mailbox.status).toBe('suspended');
      expect(mailbox.suspension_reason).toBe('Abus');
    });
  });

  describe('activate', () => {
    it('devrait réactiver une BAL suspendue', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [{ ...mockMailbox, status: 'active', suspended_at: null }]
      });

      const mailbox = await Mailbox.activate(mockMailbox.id);

      expect(mailbox.status).toBe('active');
    });
  });

  // ==========================================
  // Tests: updateStorageUsed
  // ==========================================
  describe('updateStorageUsed', () => {
    it('devrait mettre à jour le stockage utilisé', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [{ id: mockMailbox.id, storage_used_mb: 768 }]
      });

      const result = await Mailbox.updateStorageUsed(mockMailbox.id, 768);

      expect(result.storage_used_mb).toBe(768);
    });

    it('devrait incrémenter le stockage', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [{ id: mockMailbox.id, storage_used_mb: 612 }]
      });

      await Mailbox.updateStorageUsed(mockMailbox.id, 100, { increment: true });

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('storage_used_mb + $'),
        expect.any(Array)
      );
    });
  });

  // ==========================================
  // Tests: checkQuotaExceeded
  // ==========================================
  describe('checkQuotaExceeded', () => {
    it('devrait détecter un quota dépassé', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [{ quota_mb: 1024, storage_used_mb: 1100 }]
      });

      const exceeded = await Mailbox.checkQuotaExceeded(mockMailbox.id);

      expect(exceeded).toBe(true);
    });

    it('devrait retourner false si quota OK', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [{ quota_mb: 1024, storage_used_mb: 500 }]
      });

      const exceeded = await Mailbox.checkQuotaExceeded(mockMailbox.id);

      expect(exceeded).toBe(false);
    });

    it('devrait retourner le pourcentage d\'utilisation', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [{ quota_mb: 1000, storage_used_mb: 750 }]
      });

      const { exceeded, percentage } = await Mailbox.checkQuotaExceeded(
        mockMailbox.id, 
        { returnDetails: true }
      );

      expect(exceeded).toBe(false);
      expect(percentage).toBe(75);
    });
  });

  // ==========================================
  // Tests: getStatistics
  // ==========================================
  describe('getStatistics', () => {
    it('devrait retourner les statistiques d\'une BAL', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [{
          storage_used_mb: 512,
          quota_mb: 2048,
          message_count: 1250,
          last_activity: new Date()
        }]
      });

      const stats = await Mailbox.getStatistics(mockMailbox.id);

      expect(stats.storage_used_mb).toBe(512);
      expect(stats.message_count).toBe(1250);
    });
  });

  // ==========================================
  // Tests: Délégations
  // ==========================================
  describe('getDelegations', () => {
    it('devrait lister les délégations d\'une BAL', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [
          { id: 'del-1', user_id: 'user-1', role: 'read', email: 'user1@test.fr' },
          { id: 'del-2', user_id: 'user-2', role: 'write', email: 'user2@test.fr' }
        ]
      });

      const delegations = await Mailbox.getDelegations(mockMailbox.id);

      expect(delegations).toHaveLength(2);
    });
  });

  describe('addDelegation', () => {
    it('devrait ajouter une délégation', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [{ id: 'new-del', mailbox_id: mockMailbox.id, user_id: 'user-uuid', role: 'read' }]
      });

      const delegation = await Mailbox.addDelegation(mockMailbox.id, 'user-uuid', 'read');

      expect(delegation.role).toBe('read');
    });

    it('devrait rejeter une délégation en double', async () => {
      pool.query.mockRejectedValueOnce({ code: '23505' }); // unique_violation

      await expect(
        Mailbox.addDelegation(mockMailbox.id, 'user-uuid', 'read')
      ).rejects.toThrow(/existe|already/i);
    });
  });

  describe('removeDelegation', () => {
    it('devrait supprimer une délégation', async () => {
      pool.query.mockResolvedValueOnce({ rowCount: 1 });

      const result = await Mailbox.removeDelegation('delegation-uuid');

      expect(result).toBe(true);
    });
  });

  // ==========================================
  // Tests: Publication annuaire
  // ==========================================
  describe('setPublished', () => {
    it('devrait marquer comme publiée', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [{ ...mockMailbox, publication_id: 'pub-456', published_at: new Date() }]
      });

      const mailbox = await Mailbox.setPublished(mockMailbox.id, 'pub-456');

      expect(mailbox.publication_id).toBe('pub-456');
      expect(mailbox.published_at).toBeDefined();
    });
  });

  describe('setUnpublished', () => {
    it('devrait marquer comme dépubliée', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [{ ...mockMailbox, publication_id: null, unpublished_at: new Date() }]
      });

      const mailbox = await Mailbox.setUnpublished(mockMailbox.id);

      expect(mailbox.publication_id).toBeNull();
      expect(mailbox.unpublished_at).toBeDefined();
    });
  });

  // ==========================================
  // Tests: count
  // ==========================================
  describe('count', () => {
    it('devrait compter les BAL d\'un domaine', async () => {
      pool.query.mockResolvedValueOnce({ rows: [{ count: '150' }] });

      const count = await Mailbox.count('domain-uuid');

      expect(count).toBe(150);
    });

    it('devrait compter par type', async () => {
      pool.query.mockResolvedValueOnce({ rows: [{ count: '45' }] });

      const count = await Mailbox.count('domain-uuid', { type: 'personal' });

      expect(count).toBe(45);
    });

    it('devrait compter uniquement les actives', async () => {
      pool.query.mockResolvedValueOnce({ rows: [{ count: '140' }] });

      await Mailbox.count('domain-uuid', { status: 'active' });

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining("status = $"),
        expect.any(Array)
      );
    });
  });

  // ==========================================
  // Tests: search
  // ==========================================
  describe('search', () => {
    it('devrait rechercher par terme', async () => {
      pool.query.mockResolvedValueOnce({ rows: [mockMailbox] });

      const results = await Mailbox.search('domain-uuid', 'cardio');

      expect(results).toHaveLength(1);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('ILIKE'),
        expect.arrayContaining(['%cardio%'])
      );
    });

    it('devrait rechercher dans email et service_name', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      await Mailbox.search('domain-uuid', 'secretariat');

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringMatching(/email ILIKE|service_name ILIKE/),
        expect.any(Array)
      );
    });
  });
});