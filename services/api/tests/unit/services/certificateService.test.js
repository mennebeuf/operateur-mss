// tests/unit/services/certificateService.test.js

// Mock child_process pour openssl
jest.mock('child_process', () => ({
  exec: jest.fn()
}));
jest.mock('util', () => ({
  promisify: jest.fn((fn) => fn)
}));

jest.mock('fs', () => ({
  promises: {
    writeFile: jest.fn().mockResolvedValue(undefined),
    unlink: jest.fn().mockResolvedValue(undefined),
    mkdir: jest.fn().mockResolvedValue(undefined),
    readFile: jest.fn().mockResolvedValue('cert-content')
  }
}));

jest.mock('crypto', () => ({
  randomUUID: jest.fn().mockReturnValue('test-uuid-123')
}));

// Mock pool SANS mockClient dans l'initialisation
jest.mock('../../../src/config/database', () => ({
  pool: {
    query: jest.fn(),
    connect: jest.fn()
  }
}));

jest.mock('../../../src/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  security: jest.fn()
}));

const CertificateService = require('../../../src/services/certificateService');
const { exec } = require('child_process');
const fs = require('fs').promises;
const { pool } = require('../../../src/config/database');

describe('CertificateService', () => {
  let mockClient;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Créer le mockClient dans beforeEach
    mockClient = {
      query: jest.fn(),
      release: jest.fn()
    };
    
    // Configurer pool.connect pour retourner mockClient
    pool.connect.mockResolvedValue(mockClient);
  });

  describe('parseCertificate', () => {
    it('devrait parser un certificat PEM valide', async () => {
      const mockCert = `-----BEGIN CERTIFICATE-----
MIICpDCCAYwCCQC...
-----END CERTIFICATE-----`;

      exec.mockResolvedValue({
        stdout: `subject=CN=test.mssante.fr, O=Hopital Test
issuer=CN=IGC SANTE, O=ANS
notBefore=Jan  1 00:00:00 2025 GMT
notAfter=Jan  1 00:00:00 2026 GMT
serial=1234567890ABCDEF
SHA256 Fingerprint=AA:BB:CC:DD:EE:FF
DNS:test.mssante.fr, DNS:mail.test.mssante.fr`,
        stderr: ''
      });

      const result = await CertificateService.parseCertificate(mockCert);

      expect(result).toHaveProperty('subject');
      expect(result).toHaveProperty('issuer');
      expect(result).toHaveProperty('serialNumber');
      expect(result).toHaveProperty('validFrom');
      expect(result).toHaveProperty('validTo');
      expect(result).toHaveProperty('daysUntilExpiry');
    });

    it('devrait rejeter un certificat invalide', async () => {
      exec.mockRejectedValue(new Error('unable to load certificate'));

      await expect(CertificateService.parseCertificate('invalid'))
        .rejects.toThrow('Certificat invalide');
    });
  });

  describe('verifyCertificate', () => {
    it('devrait valider un certificat valide', async () => {
      const mockCert = '-----BEGIN CERTIFICATE-----...-----END CERTIFICATE-----';

      exec.mockResolvedValue({
        stdout: '/tmp/cert.pem: OK',
        stderr: ''
      });

      jest.spyOn(CertificateService, 'checkCRL').mockResolvedValue(true);

      const result = await CertificateService.verifyCertificate(mockCert);

      expect(result.valid).toBe(true);
      expect(result.chainValid).toBe(true);
    });

    it('devrait détecter un certificat invalide', async () => {
      const mockCert = '-----BEGIN CERTIFICATE-----...-----END CERTIFICATE-----';

      exec.mockResolvedValue({
        stdout: 'error: certificate has expired',
        stderr: ''
      });

      jest.spyOn(CertificateService, 'checkCRL').mockResolvedValue(true);

      const result = await CertificateService.verifyCertificate(mockCert);

      expect(result.valid).toBe(false);
    });
  });

  describe('installCertificate', () => {
    it('devrait installer un certificat pour un domaine', async () => {
      const certPem = '-----BEGIN CERTIFICATE-----...-----END CERTIFICATE-----';
      const keyPem = '-----BEGIN PRIVATE KEY-----...-----END PRIVATE KEY-----';
      const domainId = 'domain-123';

      jest.spyOn(CertificateService, 'parseCertificate').mockResolvedValue({
        subject: { commonName: 'hopital.mssante.fr' },
        issuer: { commonName: 'IGC SANTE' },
        serialNumber: '123456',
        fingerprint: 'aabbccdd',
        validFrom: new Date(),
        validTo: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        daysUntilExpiry: 365
      });

      jest.spyOn(CertificateService, 'verifyCertificate').mockResolvedValue({
        valid: true,
        chainValid: true,
        crlValid: true
      });

      jest.spyOn(CertificateService, 'verifyKeyPair').mockResolvedValue(true);

      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({}) // UPDATE
        .mockResolvedValueOnce({ rows: [{ id: 'test-uuid-123' }] }) // INSERT
        .mockResolvedValueOnce({}); // COMMIT

      const result = await CertificateService.installCertificate(certPem, keyPem, domainId, 'server');

      expect(result.id).toBe('test-uuid-123');
      expect(fs.writeFile).toHaveBeenCalled();
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    });

    it('devrait rejeter si la clé ne correspond pas', async () => {
      const certPem = '-----BEGIN CERTIFICATE-----...-----END CERTIFICATE-----';
      const keyPem = '-----BEGIN PRIVATE KEY-----...-----END PRIVATE KEY-----';

      jest.spyOn(CertificateService, 'parseCertificate').mockResolvedValue({
        subject: { commonName: 'hopital.mssante.fr' },
        validFrom: new Date(),
        validTo: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
      });

      jest.spyOn(CertificateService, 'verifyCertificate').mockResolvedValue({ valid: true });
      jest.spyOn(CertificateService, 'verifyKeyPair').mockResolvedValue(false);

      mockClient.query.mockResolvedValueOnce({}); // BEGIN

      await expect(CertificateService.installCertificate(certPem, keyPem, 'domain-123'))
        .rejects.toThrow('clé privée ne correspond pas');
    });
  });

  describe('checkExpirations', () => {
    it('devrait retourner les certificats expirant bientôt', async () => {
      const futureDate = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000);

      pool.query.mockResolvedValue({
        rows: [{
          id: 'cert-1',
          domain_name: 'hopital.mssante.fr',
          type: 'server',
          subject: 'CN=hopital.mssante.fr',
          valid_to: futureDate
        }]
      });

      const result = await CertificateService.checkExpirations();

      expect(result).toHaveLength(1);
      expect(result[0].severity).toBe('warning');
    });
  });

  describe('listCertificates', () => {
    it('devrait lister les certificats d\'un domaine', async () => {
      pool.query.mockResolvedValue({
        rows: [{
          id: 'cert-1',
          type: 'server',
          subject: 'CN=test.mssante.fr',
          issuer: 'CN=IGC SANTE',
          serial_number: '123',
          fingerprint: 'aabb',
          valid_from: new Date(),
          valid_to: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          status: 'active',
          created_at: new Date()
        }]
      });

      const result = await CertificateService.listCertificates('domain-123');

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('id', 'cert-1');
    });
  });

  describe('revokeCertificate', () => {
    it('devrait révoquer un certificat', async () => {
      pool.query.mockResolvedValue({ rowCount: 1 });

      await CertificateService.revokeCertificate('cert-123', 'compromised');

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE certificates'),
        ['cert-123', 'compromised']
      );
    });
  });
});