/**
 * Tests unitaires - Modèle Certificate
 * services/api/tests/unit/models/Certificate.test.js
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
const Certificate = require('../../../src/models/Certificate');

describe('Certificate Model', () => {
  let mockClient;

  // Données de test
  const mockCertificate = {
    id: '550e8400-e29b-41d4-a716-446655440004',
    domain_id: 'domain-uuid',
    type: 'SERV_SSL',
    subject: 'CN=hopital.mssante.fr, O=Hôpital Paris, C=FR',
    issuer: 'CN=IGC SANTE SERVEURS APPLICATIFS, O=GIP-CPS, C=FR',
    serial_number: 'ABC123456789',
    issued_at: new Date('2024-01-01'),
    expires_at: new Date('2025-01-01'),
    revoked_at: null,
    certificate_pem: '-----BEGIN CERTIFICATE-----\nMIID...\n-----END CERTIFICATE-----',
    private_key_pem: '-----BEGIN ENCRYPTED PRIVATE KEY-----\nMIIE...\n-----END ENCRYPTED PRIVATE KEY-----',
    chain_pem: '-----BEGIN CERTIFICATE-----\nMIID...\n-----END CERTIFICATE-----',
    fingerprint_sha256: 'AB:CD:EF:12:34:56:78:90:AB:CD:EF:12:34:56:78:90:AB:CD:EF:12:34:56:78:90:AB:CD:EF:12:34:56:78:90',
    key_size: 2048,
    status: 'active',
    created_at: new Date('2024-01-01'),
    created_by: 'admin-uuid'
  };

  const mockAuthClientCert = {
    ...mockCertificate,
    id: 'auth-cert-uuid',
    type: 'ORG_AUTH_CLI',
    subject: 'CN=BAL Applicative, O=Hôpital Paris, C=FR'
  };

  const mockSignCert = {
    ...mockCertificate,
    id: 'sign-cert-uuid',
    type: 'ORG_SIGN',
    subject: 'CN=Signature, O=Hôpital Paris, C=FR'
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
    it('devrait trouver un certificat par ID', async () => {
      pool.query.mockResolvedValueOnce({ rows: [mockCertificate] });

      const cert = await Certificate.findById(mockCertificate.id);

      expect(cert).toBeDefined();
      expect(cert.id).toBe(mockCertificate.id);
      expect(cert.type).toBe('SERV_SSL');
    });

    it('devrait retourner null si certificat non trouvé', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      const cert = await Certificate.findById('unknown-uuid');

      expect(cert).toBeNull();
    });

    it('devrait exclure la clé privée par défaut', async () => {
      pool.query.mockResolvedValueOnce({ 
        rows: [{ ...mockCertificate, private_key_pem: undefined }] 
      });

      const cert = await Certificate.findById(mockCertificate.id);

      expect(cert.private_key_pem).toBeUndefined();
    });

    it('devrait inclure la clé privée si demandé', async () => {
      pool.query.mockResolvedValueOnce({ rows: [mockCertificate] });

      const cert = await Certificate.findById(mockCertificate.id, { includePrivateKey: true });

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('private_key_pem'),
        expect.any(Array)
      );
    });
  });

  // ==========================================
  // Tests: findBySerial
  // ==========================================
  describe('findBySerial', () => {
    it('devrait trouver un certificat par numéro de série', async () => {
      pool.query.mockResolvedValueOnce({ rows: [mockCertificate] });

      const cert = await Certificate.findBySerial('ABC123456789');

      expect(cert).toBeDefined();
      expect(cert.serial_number).toBe('ABC123456789');
    });
  });

  // ==========================================
  // Tests: findByDomain
  // ==========================================
  describe('findByDomain', () => {
    it('devrait lister les certificats d\'un domaine', async () => {
      const certs = [mockCertificate, mockAuthClientCert, mockSignCert];
      pool.query.mockResolvedValueOnce({ rows: certs });

      const result = await Certificate.findByDomain('domain-uuid');

      expect(result).toHaveLength(3);
    });

    it('devrait filtrer par type', async () => {
      pool.query.mockResolvedValueOnce({ rows: [mockCertificate] });

      await Certificate.findByDomain('domain-uuid', { type: 'SERV_SSL' });

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining("type = $"),
        expect.arrayContaining(['SERV_SSL'])
      );
    });

    it('devrait filtrer par statut', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      await Certificate.findByDomain('domain-uuid', { status: 'active' });

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining("status = $"),
        expect.arrayContaining(['active'])
      );
    });

    it('devrait exclure les révoqués par défaut', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      await Certificate.findByDomain('domain-uuid');

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining("status != 'revoked'"),
        expect.any(Array)
      );
    });
  });

  // ==========================================
  // Tests: findExpiring
  // ==========================================
  describe('findExpiring', () => {
    it('devrait trouver les certificats expirant dans N jours', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [
          { ...mockCertificate, days_until_expiry: 15 },
          { ...mockAuthClientCert, days_until_expiry: 25 }
        ]
      });

      const certs = await Certificate.findExpiring(30);

      expect(certs).toHaveLength(2);
      expect(certs[0].days_until_expiry).toBeLessThanOrEqual(30);
    });

    it('devrait trier par date d\'expiration', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      await Certificate.findExpiring(30);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY expires_at ASC'),
        expect.any(Array)
      );
    });

    it('devrait exclure les certificats déjà révoqués', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      await Certificate.findExpiring(30);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining("status = 'active'"),
        expect.any(Array)
      );
    });
  });

  // ==========================================
  // Tests: findExpired
  // ==========================================
  describe('findExpired', () => {
    it('devrait trouver les certificats expirés', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [{ ...mockCertificate, status: 'expired' }]
      });

      const certs = await Certificate.findExpired();

      expect(certs).toHaveLength(1);
    });
  });

  // ==========================================
  // Tests: create
  // ==========================================
  describe('create', () => {
    const newCertData = {
      domainId: 'domain-uuid',
      type: 'SERV_SSL',
      certificatePem: '-----BEGIN CERTIFICATE-----...',
      privateKeyPem: '-----BEGIN PRIVATE KEY-----...',
      chainPem: '-----BEGIN CERTIFICATE-----...'
    };

    it('devrait créer un nouveau certificat', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [] }) // Check existing serial
        .mockResolvedValueOnce({ rows: [{ id: 'new-cert-uuid', ...newCertData }] })
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      const cert = await Certificate.create(newCertData);

      expect(cert.id).toBe('new-cert-uuid');
    });

    it('devrait extraire les informations du certificat PEM', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ 
          id: 'new-cert',
          subject: 'CN=test',
          issuer: 'CN=IGC',
          serial_number: 'EXTRACTED-SERIAL'
        }] })
        .mockResolvedValueOnce({ rows: [] });

      const cert = await Certificate.create(newCertData);

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('subject'),
        expect.any(Array)
      );
    });

    it('devrait rejeter un certificat avec serial déjà existant', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: 'existing' }] }); // Serial exists

      await expect(Certificate.create(newCertData)).rejects.toThrow(/existe|already/i);
    });

    it('devrait valider le type de certificat', async () => {
      const badData = { ...newCertData, type: 'INVALID_TYPE' };

      await expect(Certificate.create(badData)).rejects.toThrow(/type/i);
    });

    it('devrait chiffrer la clé privée', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: 'new-cert' }] })
        .mockResolvedValueOnce({ rows: [] });

      await Certificate.create(newCertData);

      // Vérifier que la clé est chiffrée (pgcrypto)
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('pgp_sym_encrypt'),
        expect.any(Array)
      );
    });
  });

  // ==========================================
  // Tests: revoke
  // ==========================================
  describe('revoke', () => {
    it('devrait révoquer un certificat', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [{ ...mockCertificate, status: 'revoked', revoked_at: new Date() }]
      });

      const cert = await Certificate.revoke(mockCertificate.id, 'Compromis');

      expect(cert.status).toBe('revoked');
      expect(cert.revoked_at).toBeDefined();
    });

    it('devrait enregistrer la raison de révocation', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [{ ...mockCertificate, status: 'revoked', revocation_reason: 'Compromis' }]
      });

      await Certificate.revoke(mockCertificate.id, 'Compromis');

      expect(pool.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['Compromis'])
      );
    });
  });

  // ==========================================
  // Tests: delete
  // ==========================================
  describe('delete', () => {
    it('devrait supprimer un certificat', async () => {
      pool.query.mockResolvedValueOnce({ rowCount: 1 });

      const result = await Certificate.delete(mockCertificate.id);

      expect(result).toBe(true);
    });

    it('devrait retourner false si certificat non trouvé', async () => {
      pool.query.mockResolvedValueOnce({ rowCount: 0 });

      const result = await Certificate.delete('unknown-uuid');

      expect(result).toBe(false);
    });
  });

  // ==========================================
  // Tests: isValid
  // ==========================================
  describe('isValid', () => {
    it('devrait retourner true pour un certificat valide', async () => {
      const futureCert = {
        ...mockCertificate,
        expires_at: new Date(Date.now() + 86400000 * 30), // +30 jours
        status: 'active'
      };
      pool.query.mockResolvedValueOnce({ rows: [futureCert] });

      const isValid = await Certificate.isValid(mockCertificate.id);

      expect(isValid).toBe(true);
    });

    it('devrait retourner false pour un certificat expiré', async () => {
      const expiredCert = {
        ...mockCertificate,
        expires_at: new Date('2020-01-01'),
        status: 'active'
      };
      pool.query.mockResolvedValueOnce({ rows: [expiredCert] });

      const isValid = await Certificate.isValid(mockCertificate.id);

      expect(isValid).toBe(false);
    });

    it('devrait retourner false pour un certificat révoqué', async () => {
      const revokedCert = {
        ...mockCertificate,
        status: 'revoked'
      };
      pool.query.mockResolvedValueOnce({ rows: [revokedCert] });

      const isValid = await Certificate.isValid(mockCertificate.id);

      expect(isValid).toBe(false);
    });
  });

  // ==========================================
  // Tests: getDaysUntilExpiry
  // ==========================================
  describe('getDaysUntilExpiry', () => {
    it('devrait calculer les jours jusqu\'à expiration', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);
      
      pool.query.mockResolvedValueOnce({
        rows: [{ ...mockCertificate, expires_at: futureDate }]
      });

      const days = await Certificate.getDaysUntilExpiry(mockCertificate.id);

      expect(days).toBeCloseTo(30, 0);
    });

    it('devrait retourner un nombre négatif si expiré', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 10);
      
      pool.query.mockResolvedValueOnce({
        rows: [{ ...mockCertificate, expires_at: pastDate }]
      });

      const days = await Certificate.getDaysUntilExpiry(mockCertificate.id);

      expect(days).toBeLessThan(0);
    });
  });

  // ==========================================
  // Tests: getDecryptedPrivateKey
  // ==========================================
  describe('getDecryptedPrivateKey', () => {
    it('devrait déchiffrer la clé privée', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [{ private_key_pem: '-----BEGIN PRIVATE KEY-----\nDECRYPTED\n-----END PRIVATE KEY-----' }]
      });

      const privateKey = await Certificate.getDecryptedPrivateKey(mockCertificate.id);

      expect(privateKey).toContain('BEGIN PRIVATE KEY');
    });

    it('devrait utiliser pgp_sym_decrypt', async () => {
      pool.query.mockResolvedValueOnce({ rows: [{ private_key_pem: 'key' }] });

      await Certificate.getDecryptedPrivateKey(mockCertificate.id);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('pgp_sym_decrypt'),
        expect.any(Array)
      );
    });
  });

  // ==========================================
  // Tests: count
  // ==========================================
  describe('count', () => {
    it('devrait compter les certificats d\'un domaine', async () => {
      pool.query.mockResolvedValueOnce({ rows: [{ count: '5' }] });

      const count = await Certificate.count('domain-uuid');

      expect(count).toBe(5);
    });

    it('devrait compter par type', async () => {
      pool.query.mockResolvedValueOnce({ rows: [{ count: '2' }] });

      const count = await Certificate.count('domain-uuid', { type: 'SERV_SSL' });

      expect(count).toBe(2);
    });

    it('devrait compter uniquement les actifs', async () => {
      pool.query.mockResolvedValueOnce({ rows: [{ count: '4' }] });

      await Certificate.count('domain-uuid', { status: 'active' });

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining("status = $"),
        expect.any(Array)
      );
    });
  });

  // ==========================================
  // Tests: Validation du type
  // ==========================================
  describe('Type validation', () => {
    const validTypes = ['SERV_SSL', 'ORG_AUTH_CLI', 'ORG_SIGN', 'ORG_CONF'];

    validTypes.forEach(type => {
      it(`devrait accepter le type ${type}`, async () => {
        pool.query.mockResolvedValueOnce({ rows: [{ ...mockCertificate, type }] });

        const cert = await Certificate.findById(mockCertificate.id);

        expect(cert.type).toBe(type);
      });
    });
  });

  // ==========================================
  // Tests: updateStatus
  // ==========================================
  describe('updateStatus', () => {
    it('devrait mettre à jour le statut', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [{ ...mockCertificate, status: 'expired' }]
      });

      const cert = await Certificate.updateStatus(mockCertificate.id, 'expired');

      expect(cert.status).toBe('expired');
    });
  });

  // ==========================================
  // Tests: getChain
  // ==========================================
  describe('getChain', () => {
    it('devrait retourner la chaîne de certification', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [{ chain_pem: '-----BEGIN CERTIFICATE-----\nCHAIN\n-----END CERTIFICATE-----' }]
      });

      const chain = await Certificate.getChain(mockCertificate.id);

      expect(chain).toContain('BEGIN CERTIFICATE');
    });
  });
});