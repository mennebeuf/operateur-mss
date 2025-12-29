// ============================================================
// services/api/tests/unit/services/certificateService.test.js
// ============================================================

const CertificateService = require('../../../src/services/certificates/certificateService');

jest.mock('fs/promises');
jest.mock('crypto');
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

const fs = require('fs/promises');
const crypto = require('crypto');
const { pool } = require('../../../src/config/database');

describe('CertificateService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('parseCertificate', () => {
    it('devrait parser un certificat PEM valide', async () => {
      const mockCert = `-----BEGIN CERTIFICATE-----
MIICpDCCAYwCCQC...
-----END CERTIFICATE-----`;
      
      const mockX509 = {
        subject: 'CN=test.mssante.fr',
        issuer: 'CN=IGC SANTE',
        serialNumber: '1234567890',
        validFrom: '2025-01-01T00:00:00Z',
        validTo: '2026-01-01T00:00:00Z'
      };
      
      crypto.X509Certificate = jest.fn().mockImplementation(() => mockX509);
      
      const result = await CertificateService.parseCertificate(mockCert);
      
      expect(result).toHaveProperty('subject');
      expect(result).toHaveProperty('issuer');
      expect(result).toHaveProperty('serialNumber');
    });

    it('devrait rejeter un certificat invalide', async () => {
      crypto.X509Certificate = jest.fn().mockImplementation(() => {
        throw new Error('Invalid certificate');
      });
      
      await expect(CertificateService.parseCertificate('invalid'))
        .rejects.toThrow();
    });
  });

  describe('validateCertificate', () => {
    it('devrait valider un certificat non expiré', async () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      
      const certInfo = {
        validTo: futureDate.toISOString(),
        issuer: 'CN=IGC SANTE'
      };
      
      const result = await CertificateService.validateCertificate(certInfo);
      
      expect(result.valid).toBe(true);
      expect(result.daysUntilExpiry).toBeGreaterThan(0);
    });

    it('devrait détecter un certificat expiré', async () => {
      const pastDate = new Date();
      pastDate.setFullYear(pastDate.getFullYear() - 1);
      
      const certInfo = {
        validTo: pastDate.toISOString(),
        issuer: 'CN=IGC SANTE'
      };
      
      const result = await CertificateService.validateCertificate(certInfo);
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('expiré');
    });

    it('devrait alerter si expiration proche (< 30 jours)', async () => {
      const nearFuture = new Date();
      nearFuture.setDate(nearFuture.getDate() + 15);
      
      const certInfo = {
        validTo: nearFuture.toISOString(),
        issuer: 'CN=IGC SANTE'
      };
      
      const result = await CertificateService.validateCertificate(certInfo);
      
      expect(result.valid).toBe(true);
      expect(result.warning).toBeDefined();
      expect(result.daysUntilExpiry).toBeLessThan(30);
    });
  });

  describe('installCertificate', () => {
    it('devrait installer un certificat pour un domaine', async () => {
      const certData = {
        domain: 'hopital.mssante.fr',
        certificate: '-----BEGIN CERTIFICATE-----...',
        privateKey: '-----BEGIN PRIVATE KEY-----...',
        type: 'domain'
      };
      
      fs.writeFile.mockResolvedValue(undefined);
      pool.query.mockResolvedValue({ rows: [{ id: 'cert-123' }] });
      
      crypto.X509Certificate = jest.fn().mockImplementation(() => ({
        subject: 'CN=hopital.mssante.fr',
        issuer: 'CN=IGC SANTE',
        serialNumber: '123',
        validFrom: new Date().toISOString(),
        validTo: new Date(Date.now() + 365*24*60*60*1000).toISOString()
      }));
      
      const result = await CertificateService.installCertificate(certData);
      
      expect(fs.writeFile).toHaveBeenCalled();
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO certificates'),
        expect.any(Array)
      );
      expect(result.id).toBeDefined();
    });

    it('devrait rejeter un certificat dont le domaine ne correspond pas', async () => {
      const certData = {
        domain: 'hopital.mssante.fr',
        certificate: '-----BEGIN CERTIFICATE-----...',
        privateKey: '-----BEGIN PRIVATE KEY-----...'
      };
      
      crypto.X509Certificate = jest.fn().mockImplementation(() => ({
        subject: 'CN=autre-domaine.fr'
      }));
      
      await expect(CertificateService.installCertificate(certData))
        .rejects.toThrow('domaine');
    });
  });

  describe('getExpiringCertificates', () => {
    it('devrait retourner les certificats expirant dans N jours', async () => {
      pool.query.mockResolvedValue({
        rows: [
          { id: 'cert-1', domain: 'test1.fr', days_until_expiry: 15 },
          { id: 'cert-2', domain: 'test2.fr', days_until_expiry: 25 }
        ]
      });
      
      const result = await CertificateService.getExpiringCertificates(30);
      
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('valid_to'),
        expect.arrayContaining([30])
      );
      expect(result).toHaveLength(2);
    });
  });

  describe('deleteCertificate', () => {
    it('devrait supprimer un certificat', async () => {
      pool.query.mockResolvedValue({ rows: [{ id: 'cert-123', path: '/certs/test.pem' }] });
      fs.unlink.mockResolvedValue(undefined);
      
      await CertificateService.deleteCertificate('cert-123');
      
      expect(fs.unlink).toHaveBeenCalled();
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE'),
        ['cert-123']
      );
    });
  });
});