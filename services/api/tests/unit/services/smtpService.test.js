// ============================================================
// services/api/tests/unit/services/smtpService.test.js
// ============================================================

const SmtpService = require('../../../src/services/email/smtpService');

jest.mock('nodemailer');
jest.mock('html-to-text');
jest.mock('../../../src/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  mail: jest.fn()
}));

const nodemailer = require('nodemailer');
const { htmlToText } = require('html-to-text');

describe('SmtpService', () => {
  let mockTransporter;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockTransporter = {
      sendMail: jest.fn().mockResolvedValue({
        messageId: '<test-id@domain.fr>',
        accepted: ['dest@test.fr'],
        rejected: []
      }),
      verify: jest.fn().mockResolvedValue(true)
    };
    
    nodemailer.createTransport.mockReturnValue(mockTransporter);
    htmlToText.mockReturnValue('Texte brut');
  });

  describe('createTransport', () => {
    it('devrait créer un transport avec OAuth2', () => {
      const transport = SmtpService.createTransport('user@test.fr', 'access_token');
      
      expect(nodemailer.createTransport).toHaveBeenCalledWith(expect.objectContaining({
        auth: expect.objectContaining({
          type: 'OAuth2',
          user: 'user@test.fr',
          accessToken: 'access_token'
        })
      }));
    });

    it('devrait configurer TLS 1.2 minimum', () => {
      SmtpService.createTransport('user@test.fr', 'token');
      
      expect(nodemailer.createTransport).toHaveBeenCalledWith(expect.objectContaining({
        tls: expect.objectContaining({
          minVersion: 'TLSv1.2'
        })
      }));
    });
  });

  describe('sendMail', () => {
    it('devrait envoyer un email avec succès', async () => {
      const mailOptions = {
        to: ['dest@test.fr'],
        subject: 'Test',
        html: '<p>Contenu</p>'
      };
      
      const result = await SmtpService.sendMail('user@test.fr', 'token', mailOptions);
      
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(expect.objectContaining({
        from: 'user@test.fr',
        to: ['dest@test.fr'],
        subject: 'Test',
        html: '<p>Contenu</p>'
      }));
      expect(result.messageId).toBeDefined();
      expect(result.accepted).toContain('dest@test.fr');
    });

    it('devrait convertir HTML en texte brut automatiquement', async () => {
      const mailOptions = {
        to: ['dest@test.fr'],
        subject: 'Test',
        html: '<p>Contenu HTML</p>'
      };
      
      await SmtpService.sendMail('user@test.fr', 'token', mailOptions);
      
      expect(htmlToText).toHaveBeenCalledWith('<p>Contenu HTML</p>');
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(expect.objectContaining({
        text: 'Texte brut'
      }));
    });

    it('devrait gérer les pièces jointes', async () => {
      const mailOptions = {
        to: ['dest@test.fr'],
        subject: 'Avec PJ',
        html: '<p>Test</p>',
        attachments: [{ filename: 'doc.pdf', content: 'base64content' }]
      };
      
      await SmtpService.sendMail('user@test.fr', 'token', mailOptions);
      
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(expect.objectContaining({
        attachments: expect.arrayContaining([
          expect.objectContaining({ filename: 'doc.pdf' })
        ])
      }));
    });

    it('devrait gérer les erreurs d\'envoi', async () => {
      mockTransporter.sendMail.mockRejectedValue(new Error('SMTP error'));
      
      await expect(SmtpService.sendMail('user@test.fr', 'token', { to: ['dest@test.fr'] }))
        .rejects.toThrow('SMTP error');
    });

    it('devrait inclure les headers de réponse', async () => {
      const mailOptions = {
        to: ['dest@test.fr'],
        subject: 'Re: Test',
        html: '<p>Réponse</p>',
        inReplyTo: '<original-id@test.fr>',
        references: '<original-id@test.fr>'
      };
      
      await SmtpService.sendMail('user@test.fr', 'token', mailOptions);
      
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(expect.objectContaining({
        inReplyTo: '<original-id@test.fr>',
        references: '<original-id@test.fr>'
      }));
    });
  });
});