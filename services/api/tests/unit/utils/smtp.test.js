// services/api/tests/unit/utils/smtp.test.js

/**
 * Tests unitaires pour le service SMTP
 */

// Mock de nodemailer
const mockSendMail = jest.fn();
const mockVerify = jest.fn();
const mockClose = jest.fn();

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({
    sendMail: mockSendMail,
    verify: mockVerify,
    close: mockClose
  }))
}));

// Mock du pool PostgreSQL
jest.mock('../../../src/config/database', () => ({
  pool: {
    query: jest.fn().mockResolvedValue({ rows: [{ id: 'domain-123' }] })
  }
}));

// Mock du logger
jest.mock('../../../src/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  mail: jest.fn()
}));

const nodemailer = require('nodemailer');
const logger = require('../../../src/utils/logger');

describe('SmtpService', () => {
  let smtpService;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    
    process.env.SMTP_HOST = 'smtp.test.mssante.fr';
    process.env.SMTP_PORT = '587';
    process.env.SMTP_SECURE = 'false';
    process.env.NODE_ENV = 'test';
    
    smtpService = require('../../../src/services/email/smtpService');
  });

  afterEach(() => {
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_PORT;
    delete process.env.SMTP_SECURE;
  });

  describe('createTransport', () => {
    it('devrait créer un transport avec les bonnes options', () => {
      smtpService.createTransport('user@test.mssante.fr', 'token123');

      expect(nodemailer.createTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          host: 'smtp.test.mssante.fr',
          port: 587,
          secure: false,
          requireTLS: true
        })
      );
    });

    it('devrait configurer l\'authentification', () => {
      smtpService.createTransport('user@test.mssante.fr', 'mytoken');

      const callArgs = nodemailer.createTransport.mock.calls[0][0];
      expect(callArgs.auth).toEqual({
        type: expect.any(String),
        user: 'user@test.mssante.fr',
        pass: 'mytoken'
      });
    });

    it('devrait configurer TLS 1.2 minimum', () => {
      smtpService.createTransport('user@test.mssante.fr', 'token');

      const callArgs = nodemailer.createTransport.mock.calls[0][0];
      expect(callArgs.tls.minVersion).toBe('TLSv1.2');
    });
  });

  describe('sendMail', () => {
    beforeEach(() => {
      mockSendMail.mockResolvedValue({
        messageId: '<test-message-id@mssante.fr>',
        accepted: ['dest@example.com'],
        rejected: []
      });
    });

    it('devrait envoyer un email simple', async () => {
      const mailOptions = {
        to: 'destinataire@example.com',
        subject: 'Test',
        html: '<p>Contenu de test</p>'
      };

      const result = await smtpService.sendMail(
        'user@test.mssante.fr',
        'token',
        mailOptions
      );

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('<test-message-id@mssante.fr>');
      expect(mockSendMail).toHaveBeenCalled();
    });

    it('devrait fermer le transport après envoi', async () => {
      await smtpService.sendMail('user@test.mssante.fr', 'token', {
        to: 'dest@example.com',
        subject: 'Test',
        text: 'Texte'
      });

      expect(mockClose).toHaveBeenCalled();
    });

    it('devrait logger l\'envoi', async () => {
      await smtpService.sendMail('user@test.mssante.fr', 'token', {
        to: 'dest@example.com',
        subject: 'Test',
        html: '<p>Test</p>'
      });

      expect(logger.mail).toHaveBeenCalledWith(
        'SMTP',
        'send',
        expect.objectContaining({
          from: 'user@test.mssante.fr'
        })
      );
    });

    it('devrait gérer les destinataires multiples', async () => {
      const mailOptions = {
        to: ['dest1@example.com', 'dest2@example.com'],
        cc: 'cc@example.com',
        bcc: ['bcc1@example.com'],
        subject: 'Multi-dest',
        html: '<p>Test</p>'
      };

      await smtpService.sendMail('user@test.mssante.fr', 'token', mailOptions);

      const sendMailCall = mockSendMail.mock.calls[0][0];
      expect(sendMailCall.to).toBeDefined();
      expect(sendMailCall.cc).toBeDefined();
      expect(sendMailCall.bcc).toBeDefined();
    });

    it('devrait ajouter les headers MSSanté', async () => {
      await smtpService.sendMail('user@test.mssante.fr', 'token', {
        to: 'dest@example.com',
        subject: 'Test',
        text: 'Contenu'
      });

      const sendMailCall = mockSendMail.mock.calls[0][0];
      expect(sendMailCall.headers['X-Mailer']).toBe('MSSante Webmail');
    });

    it('devrait gérer les erreurs d\'envoi', async () => {
      mockSendMail.mockRejectedValue(new Error('SMTP connection failed'));

      await expect(
        smtpService.sendMail('user@test.mssante.fr', 'token', {
          to: 'dest@example.com',
          subject: 'Test',
          text: 'Contenu'
        })
      ).rejects.toThrow('SMTP connection failed');

      expect(logger.error).toHaveBeenCalled();
      expect(mockClose).toHaveBeenCalled();
    });

    it('devrait convertir HTML en texte si text non fourni', async () => {
      await smtpService.sendMail('user@test.mssante.fr', 'token', {
        to: 'dest@example.com',
        subject: 'Test',
        html: '<p>Contenu HTML</p>'
      });

      const sendMailCall = mockSendMail.mock.calls[0][0];
      expect(sendMailCall.text).toBeDefined();
    });
  });

  describe('formatRecipients', () => {
    it('devrait formater un destinataire string', () => {
      const result = smtpService.formatRecipients('user@example.com');
      expect(result).toBe('user@example.com');
    });

    it('devrait formater un tableau de destinataires', () => {
      const result = smtpService.formatRecipients(['a@ex.com', 'b@ex.com']);
      expect(result).toContain('a@ex.com');
    });

    it('devrait formater des objets avec name et address', () => {
      const recipients = [
        { name: 'Jean Dupont', address: 'jean@example.com' },
        { address: 'simple@example.com' }
      ];
      const result = smtpService.formatRecipients(recipients);
      
      expect(result).toContain('Jean Dupont');
      expect(result).toContain('jean@example.com');
    });

    it('devrait retourner undefined pour entrée null', () => {
      expect(smtpService.formatRecipients(null)).toBeUndefined();
      expect(smtpService.formatRecipients(undefined)).toBeUndefined();
    });
  });

  describe('formatAttachments', () => {
    it('devrait formater les pièces jointes', () => {
      const attachments = [
        { filename: 'doc.pdf', content: 'base64content', contentType: 'application/pdf' }
      ];

      const result = smtpService.formatAttachments(attachments);

      expect(result).toEqual([
        expect.objectContaining({
          filename: 'doc.pdf',
          content: expect.any(Buffer),
          contentType: 'application/pdf'
        })
      ]);
    });

    it('devrait retourner un tableau vide pour entrée vide', () => {
      expect(smtpService.formatAttachments(null)).toEqual([]);
      expect(smtpService.formatAttachments(undefined)).toEqual([]);
      expect(smtpService.formatAttachments([])).toEqual([]);
    });
  });

  describe('verifyConnection', () => {
    it('devrait vérifier la connexion avec succès', async () => {
      mockVerify.mockResolvedValue(true);

      const result = await smtpService.verifyConnection('user@test.mssante.fr', 'token');

      expect(result.success).toBe(true);
      expect(result.message).toBe('Connexion SMTP OK');
    });

    it('devrait retourner une erreur si la vérification échoue', async () => {
      mockVerify.mockRejectedValue(new Error('Auth failed'));

      const result = await smtpService.verifyConnection('user@test.mssante.fr', 'token');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Auth failed');
    });

    it('devrait fermer le transport après vérification', async () => {
      mockVerify.mockResolvedValue(true);

      await smtpService.verifyConnection('user@test.mssante.fr', 'token');

      expect(mockClose).toHaveBeenCalled();
    });
  });

  describe('sendTestEmail', () => {
    beforeEach(() => {
      mockSendMail.mockResolvedValue({
        messageId: '<test@mssante.fr>',
        accepted: ['recipient@example.com'],
        rejected: []
      });
    });

    it('devrait envoyer un email de test', async () => {
      const result = await smtpService.sendTestEmail(
        'sender@test.mssante.fr',
        'token',
        'recipient@example.com'
      );

      expect(result.success).toBe(true);
      
      const sendMailCall = mockSendMail.mock.calls[0][0];
      expect(sendMailCall.subject).toContain('Test MSSanté');
      expect(sendMailCall.html).toContain('Email de vérification');
    });
  });

  describe('sendSystemNotification', () => {
    beforeEach(() => {
      process.env.SYSTEM_EMAIL = 'noreply@mssante.fr';
      process.env.SYSTEM_EMAIL_TOKEN = 'system-token';
      
      mockSendMail.mockResolvedValue({
        messageId: '<notif@mssante.fr>',
        accepted: ['admin@example.com'],
        rejected: []
      });
    });

    afterEach(() => {
      delete process.env.SYSTEM_EMAIL;
      delete process.env.SYSTEM_EMAIL_TOKEN;
    });

    it('devrait envoyer une notification système', async () => {
      const result = await smtpService.sendSystemNotification(
        ['admin@example.com'],
        'Alerte',
        '<p>Message important</p>'
      );

      expect(result.success).toBe(true);
      
      const sendMailCall = mockSendMail.mock.calls[0][0];
      expect(sendMailCall.subject).toContain('[MSSanté]');
      expect(sendMailCall.subject).toContain('Alerte');
    });

    it('devrait ne rien faire si le token système n\'est pas configuré', async () => {
      delete process.env.SYSTEM_EMAIL_TOKEN;
      jest.resetModules();
      smtpService = require('../../../src/services/email/smtpService');

      const result = await smtpService.sendSystemNotification(
        ['admin@example.com'],
        'Test',
        '<p>Content</p>'
      );

      expect(result).toBeUndefined();
      expect(logger.warn).toHaveBeenCalled();
    });
  });
});

describe('SmtpService - Configuration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  it('devrait utiliser les valeurs par défaut si non configurées', () => {
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_PORT;
    
    const smtpService = require('../../../src/services/email/smtpService');
    smtpService.createTransport('user@test.fr', 'token');

    const callArgs = nodemailer.createTransport.mock.calls[0][0];
    expect(callArgs.host).toBe('localhost');
    expect(callArgs.port).toBe(587);
  });

  it('devrait configurer SMTP secure si demandé', () => {
    process.env.SMTP_SECURE = 'true';
    jest.resetModules();
    
    const smtpService = require('../../../src/services/email/smtpService');
    smtpService.createTransport('user@test.fr', 'token');

    const callArgs = nodemailer.createTransport.mock.calls[0][0];
    expect(callArgs.secure).toBe(true);
  });

  it('devrait rejeter les certificats non autorisés en production', () => {
    process.env.NODE_ENV = 'production';
    jest.resetModules();
    
    const smtpService = require('../../../src/services/email/smtpService');
    smtpService.createTransport('user@test.fr', 'token');

    const callArgs = nodemailer.createTransport.mock.calls[0][0];
    expect(callArgs.tls.rejectUnauthorized).toBe(true);
  });
});