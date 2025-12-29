/**
 * Tests unitaires - Modèle User
 * services/api/tests/unit/models/User.test.js
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
const User = require('../../../src/models/User');

describe('User Model', () => {
  let mockClient;

  // Données de test
  const mockUser = {
    id: '550e8400-e29b-41d4-a716-446655440001',
    rpps_id: '10001234567',
    adeli_id: null,
    psc_subject: 'f:abc:10001234567',
    first_name: 'Jean',
    last_name: 'Dupont',
    email: 'jean.dupont@hopital.mssante.fr',
    phone: '+33612345678',
    profession: 'Médecin',
    specialty: 'Cardiologie',
    password_hash: '$2b$12$hashedpassword',
    is_super_admin: false,
    role_id: 'role-uuid',
    role_name: 'user',
    domain_id: 'domain-uuid',
    domain_name: 'hopital.mssante.fr',
    settings: { theme: 'light', notifications: true },
    locale: 'fr_FR',
    timezone: 'Europe/Paris',
    status: 'active',
    email_verified: true,
    email_verified_at: new Date('2024-01-01'),
    created_at: new Date('2024-01-01'),
    updated_at: new Date('2024-01-15'),
    last_login: new Date('2024-01-20'),
    last_login_ip: '192.168.1.1'
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
    it('devrait trouver un utilisateur par ID', async () => {
      pool.query.mockResolvedValueOnce({ rows: [mockUser] });

      const user = await User.findById(mockUser.id);

      expect(user).toBeDefined();
      expect(user.id).toBe(mockUser.id);
      expect(user.email).toBe(mockUser.email);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        [mockUser.id]
      );
    });

    it('devrait retourner null si utilisateur non trouvé', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      const user = await User.findById('unknown-uuid');

      expect(user).toBeNull();
    });

    it('devrait inclure les informations de rôle et domaine', async () => {
      pool.query.mockResolvedValueOnce({ rows: [mockUser] });

      const user = await User.findById(mockUser.id);

      expect(user.role_name).toBe('user');
      expect(user.domain_name).toBe('hopital.mssante.fr');
    });

    it('devrait utiliser le cache Redis si disponible', async () => {
      redisClient.get.mockResolvedValueOnce(JSON.stringify(mockUser));

      const user = await User.findById(mockUser.id, { useCache: true });

      expect(user).toBeDefined();
      expect(pool.query).not.toHaveBeenCalled();
    });
  });

  // ==========================================
  // Tests: findByEmail
  // ==========================================
  describe('findByEmail', () => {
    it('devrait trouver un utilisateur par email', async () => {
      pool.query.mockResolvedValueOnce({ rows: [mockUser] });

      const user = await User.findByEmail('jean.dupont@hopital.mssante.fr');

      expect(user).toBeDefined();
      expect(user.email).toBe('jean.dupont@hopital.mssante.fr');
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('email = $1'),
        ['jean.dupont@hopital.mssante.fr']
      );
    });

    it('devrait retourner null si email non trouvé', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      const user = await User.findByEmail('unknown@test.fr');

      expect(user).toBeNull();
    });

    it('devrait normaliser l\'email en minuscules', async () => {
      pool.query.mockResolvedValueOnce({ rows: [mockUser] });

      await User.findByEmail('JEAN.DUPONT@Hopital.mssante.fr');

      expect(pool.query).toHaveBeenCalledWith(
        expect.any(String),
        ['jean.dupont@hopital.mssante.fr']
      );
    });
  });

  // ==========================================
  // Tests: findByRpps
  // ==========================================
  describe('findByRpps', () => {
    it('devrait trouver un utilisateur par RPPS', async () => {
      pool.query.mockResolvedValueOnce({ rows: [mockUser] });

      const user = await User.findByRpps('10001234567');

      expect(user).toBeDefined();
      expect(user.rpps_id).toBe('10001234567');
    });

    it('devrait retourner null si RPPS non trouvé', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      const user = await User.findByRpps('99999999999');

      expect(user).toBeNull();
    });
  });

  // ==========================================
  // Tests: findByPscSubject
  // ==========================================
  describe('findByPscSubject', () => {
    it('devrait trouver un utilisateur par PSC subject', async () => {
      pool.query.mockResolvedValueOnce({ rows: [mockUser] });

      const user = await User.findByPscSubject('f:abc:10001234567');

      expect(user).toBeDefined();
      expect(user.psc_subject).toBe('f:abc:10001234567');
    });
  });

  // ==========================================
  // Tests: findByDomain
  // ==========================================
  describe('findByDomain', () => {
    it('devrait lister les utilisateurs d\'un domaine', async () => {
      const users = [mockUser, { ...mockUser, id: 'user-2', email: 'user2@test.fr' }];
      pool.query.mockResolvedValueOnce({ rows: users });

      const result = await User.findByDomain('domain-uuid');

      expect(result).toHaveLength(2);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('domain_id = $1'),
        expect.arrayContaining(['domain-uuid'])
      );
    });

    it('devrait paginer les résultats', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      await User.findByDomain('domain-uuid', { page: 2, limit: 10 });

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT'),
        expect.arrayContaining([10, 10]) // limit, offset
      );
    });

    it('devrait filtrer par statut', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      await User.findByDomain('domain-uuid', { status: 'active' });

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining("status = $"),
        expect.arrayContaining(['active'])
      );
    });
  });

  // ==========================================
  // Tests: create
  // ==========================================
  describe('create', () => {
    const newUserData = {
      email: 'nouveau@hopital.mssante.fr',
      firstName: 'Nouveau',
      lastName: 'Utilisateur',
      rppsId: '10009876543',
      domainId: 'domain-uuid',
      roleId: 'role-uuid'
    };

    it('devrait créer un nouvel utilisateur', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [] }) // Check existing
        .mockResolvedValueOnce({ rows: [{ id: 'new-user-uuid', ...newUserData }] }) // INSERT
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      const user = await User.create(newUserData);

      expect(user.id).toBe('new-user-uuid');
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO users'),
        expect.any(Array)
      );
    });

    it('devrait rejeter un email déjà existant', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: 'existing-user' }] }); // Email existe

      await expect(User.create(newUserData)).rejects.toThrow(/existe déjà|already exists/i);
    });

    it('devrait rejeter un RPPS déjà existant', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] }) // Email OK
        .mockResolvedValueOnce({ rows: [{ id: 'existing-user' }] }); // RPPS existe

      await expect(User.create({ ...newUserData, rppsId: '10001234567' }))
        .rejects.toThrow(/rpps|déjà utilisé/i);
    });

    it('devrait définir le statut par défaut à "active"', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: 'new-user', status: 'active' }] })
        .mockResolvedValueOnce({ rows: [] });

      const user = await User.create(newUserData);

      expect(user.status).toBe('active');
    });

    it('devrait hasher le mot de passe si fourni', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: 'new-user' }] })
        .mockResolvedValueOnce({ rows: [] });

      await User.create({ ...newUserData, password: 'SecurePass123!' });

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('password_hash'),
        expect.arrayContaining([expect.stringMatching(/^\$2[aby]\$/)]) // bcrypt hash
      );
    });
  });

  // ==========================================
  // Tests: update
  // ==========================================
  describe('update', () => {
    it('devrait mettre à jour un utilisateur', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [{ ...mockUser, first_name: 'Jean-Pierre' }]
      });

      const user = await User.update(mockUser.id, { firstName: 'Jean-Pierre' });

      expect(user.first_name).toBe('Jean-Pierre');
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users'),
        expect.any(Array)
      );
    });

    it('devrait retourner null si utilisateur non trouvé', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      const user = await User.update('unknown-uuid', { firstName: 'Test' });

      expect(user).toBeNull();
    });

    it('devrait mettre à jour uniquement les champs fournis', async () => {
      pool.query.mockResolvedValueOnce({ rows: [mockUser] });

      await User.update(mockUser.id, { firstName: 'Nouveau' });

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('first_name'),
        expect.any(Array)
      );
      expect(pool.query).not.toHaveBeenCalledWith(
        expect.stringContaining('last_name ='),
        expect.any(Array)
      );
    });

    it('devrait invalider le cache après mise à jour', async () => {
      pool.query.mockResolvedValueOnce({ rows: [mockUser] });

      await User.update(mockUser.id, { firstName: 'Test' });

      expect(redisClient.del).toHaveBeenCalledWith(`user:${mockUser.id}`);
    });

    it('devrait mettre à jour updated_at automatiquement', async () => {
      pool.query.mockResolvedValueOnce({ 
        rows: [{ ...mockUser, updated_at: new Date() }] 
      });

      const user = await User.update(mockUser.id, { firstName: 'Test' });

      expect(new Date(user.updated_at).getTime()).toBeGreaterThan(
        new Date(mockUser.updated_at).getTime()
      );
    });
  });

  // ==========================================
  // Tests: delete (soft delete)
  // ==========================================
  describe('delete', () => {
    it('devrait soft delete un utilisateur (status = inactive)', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [{ ...mockUser, status: 'deleted' }]
      });

      const result = await User.delete(mockUser.id);

      expect(result.status).toBe('deleted');
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining("status = 'deleted'"),
        expect.any(Array)
      );
    });

    it('devrait permettre une suppression permanente', async () => {
      pool.query.mockResolvedValueOnce({ rowCount: 1 });

      const result = await User.delete(mockUser.id, { permanent: true });

      expect(result).toBe(true);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM users'),
        [mockUser.id]
      );
    });

    it('devrait invalider le cache après suppression', async () => {
      pool.query.mockResolvedValueOnce({ rows: [{ status: 'deleted' }] });

      await User.delete(mockUser.id);

      expect(redisClient.del).toHaveBeenCalledWith(`user:${mockUser.id}`);
    });
  });

  // ==========================================
  // Tests: updateLastLogin
  // ==========================================
  describe('updateLastLogin', () => {
    it('devrait mettre à jour last_login et last_login_ip', async () => {
      pool.query.mockResolvedValueOnce({ rows: [{ id: mockUser.id }] });

      await User.updateLastLogin(mockUser.id, '192.168.1.100');

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('last_login = NOW()'),
        expect.arrayContaining(['192.168.1.100', mockUser.id])
      );
    });
  });

  // ==========================================
  // Tests: search
  // ==========================================
  describe('search', () => {
    it('devrait rechercher par terme', async () => {
      pool.query.mockResolvedValueOnce({ rows: [mockUser] });

      const results = await User.search('domain-uuid', 'dupont');

      expect(results).toHaveLength(1);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('ILIKE'),
        expect.arrayContaining(['%dupont%'])
      );
    });

    it('devrait rechercher dans email, nom, prénom et RPPS', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      await User.search('domain-uuid', 'jean');

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringMatching(/email ILIKE|first_name ILIKE|last_name ILIKE|rpps_id ILIKE/),
        expect.any(Array)
      );
    });

    it('devrait limiter les résultats', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      await User.search('domain-uuid', 'test', { limit: 5 });

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT'),
        expect.arrayContaining([5])
      );
    });
  });

  // ==========================================
  // Tests: count
  // ==========================================
  describe('count', () => {
    it('devrait compter les utilisateurs d\'un domaine', async () => {
      pool.query.mockResolvedValueOnce({ rows: [{ count: '42' }] });

      const count = await User.count('domain-uuid');

      expect(count).toBe(42);
    });

    it('devrait compter par statut', async () => {
      pool.query.mockResolvedValueOnce({ rows: [{ count: '30' }] });

      const count = await User.count('domain-uuid', { status: 'active' });

      expect(count).toBe(30);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining("status = $"),
        expect.any(Array)
      );
    });
  });

  // ==========================================
  // Tests: getPermissions
  // ==========================================
  describe('getPermissions', () => {
    it('devrait retourner les permissions de l\'utilisateur', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [
          { name: 'mailbox.read' },
          { name: 'mailbox.create' },
          { name: 'user.read' }
        ]
      });

      const permissions = await User.getPermissions(mockUser.id);

      expect(permissions).toContain('mailbox.read');
      expect(permissions).toContain('mailbox.create');
      expect(permissions).toHaveLength(3);
    });

    it('devrait utiliser le cache Redis', async () => {
      redisClient.get.mockResolvedValueOnce(
        JSON.stringify(['mailbox.read', 'user.read'])
      );

      const permissions = await User.getPermissions(mockUser.id);

      expect(permissions).toHaveLength(2);
      expect(pool.query).not.toHaveBeenCalled();
    });
  });

  // ==========================================
  // Tests: verifyPassword
  // ==========================================
  describe('verifyPassword', () => {
    it('devrait valider un mot de passe correct', async () => {
      const bcrypt = require('bcrypt');
      const hash = await bcrypt.hash('CorrectPassword123!', 12);
      pool.query.mockResolvedValueOnce({ rows: [{ password_hash: hash }] });

      const isValid = await User.verifyPassword(mockUser.id, 'CorrectPassword123!');

      expect(isValid).toBe(true);
    });

    it('devrait rejeter un mot de passe incorrect', async () => {
      const bcrypt = require('bcrypt');
      const hash = await bcrypt.hash('CorrectPassword', 12);
      pool.query.mockResolvedValueOnce({ rows: [{ password_hash: hash }] });

      const isValid = await User.verifyPassword(mockUser.id, 'WrongPassword');

      expect(isValid).toBe(false);
    });

    it('devrait retourner false si utilisateur non trouvé', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      const isValid = await User.verifyPassword('unknown', 'password');

      expect(isValid).toBe(false);
    });
  });
});