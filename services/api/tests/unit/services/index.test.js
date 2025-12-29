// ============================================================
// services/api/tests/unit/services/index.test.js
// ============================================================

/**
 * Tests d'intégration des services
 * Vérifie que tous les services s'exportent correctement
 */

describe('Services Index', () => {
  describe('Email Services', () => {
    it('devrait exporter imapService', () => {
      const imapService = require('../../../src/services/email/imapService');
      expect(imapService).toBeDefined();
      expect(typeof imapService.getConnection).toBe('function');
      expect(typeof imapService.listFolders).toBe('function');
      expect(typeof imapService.listMessages).toBe('function');
    });

    it('devrait exporter smtpService', () => {
      const smtpService = require('../../../src/services/email/smtpService');
      expect(smtpService).toBeDefined();
      expect(typeof smtpService.createTransport).toBe('function');
      expect(typeof smtpService.sendMail).toBe('function');
    });
  });

  describe('Annuaire Services', () => {
    it('devrait exporter annuaireService', () => {
      const annuaireService = require('../../../src/services/annuaireService');
      expect(annuaireService).toBeDefined();
      expect(typeof annuaireService.registerMailbox).toBe('function');
      expect(typeof annuaireService.searchDirectory).toBe('function');
    });

    it('devrait exporter indicatorsService', () => {
      const indicatorsService = require('../../../src/services/indicatorsService');
      expect(indicatorsService).toBeDefined();
      expect(typeof indicatorsService.generateMonthlyIndicators).toBe('function');
    });
  });

  describe('Certificate Services', () => {
    it('devrait exporter certificateService', () => {
      const certificateService = require('../../../src/services/certificateService');
      expect(certificateService).toBeDefined();
      expect(typeof certificateService.parseCertificate).toBe('function');
      expect(typeof certificateService.validateCertificate).toBe('function');
      expect(typeof certificateService.installCertificate).toBe('function');
    });
  });
});