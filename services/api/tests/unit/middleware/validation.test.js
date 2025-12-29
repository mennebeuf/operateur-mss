/**
 * Tests unitaires - Middleware de validation
 * services/api/tests/unit/middleware/validation.test.js
 */

const Joi = require('joi');

// Mock du logger
jest.mock('../../../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

const { validate, types, schemas } = require('../../../src/middleware/validation');
const { PATTERNS, validators } = require('../../../src/utils/validators');

describe('Validation Middleware', () => {
  let mockReq, mockRes, mockNext;

  beforeEach(() => {
    mockReq = {
      body: {},
      query: {},
      params: {}
    };
    mockRes = {
      json: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis()
    };
    mockNext = jest.fn();
    jest.clearAllMocks();
  });

  // ==========================================
  // Tests: validate middleware
  // ==========================================
  describe('validate middleware', () => {
    const testSchema = {
      body: Joi.object({
        email: Joi.string().email().required(),
        name: Joi.string().min(2).max(100).required()
      }),
      query: Joi.object({
        page: Joi.number().integer().min(1).default(1)
      }),
      params: Joi.object({
        id: Joi.string().uuid().required()
      })
    };

    it('devrait passer avec des données valides', () => {
      mockReq.body = { email: 'test@test.fr', name: 'Jean Dupont' };
      mockReq.query = { page: '2' };
      mockReq.params = { id: '550e8400-e29b-41d4-a716-446655440000' };

      const middleware = validate(testSchema);
      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect(mockReq.body.email).toBe('test@test.fr');
      expect(mockReq.query.page).toBe(2); // Converti en number
    });

    it('devrait appliquer les valeurs par défaut', () => {
      mockReq.body = { email: 'test@test.fr', name: 'Test' };
      mockReq.params = { id: '550e8400-e29b-41d4-a716-446655440000' };

      const middleware = validate(testSchema);
      middleware(mockReq, mockRes, mockNext);

      expect(mockReq.query.page).toBe(1); // Valeur par défaut
    });

    it('devrait retourner 422 avec des données invalides', () => {
      mockReq.body = { email: 'invalid-email', name: 'A' }; // Email invalide, nom trop court
      mockReq.params = { id: 'not-a-uuid' };

      const middleware = validate(testSchema);
      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 422,
          code: 'VALIDATION_ERROR'
        })
      );
    });

    it('devrait retourner toutes les erreurs (abortEarly: false)', () => {
      mockReq.body = { email: 'invalid', name: '' };
      mockReq.params = { id: 'invalid' };

      const middleware = validate(testSchema);
      middleware(mockReq, mockRes, mockNext);

      const error = mockNext.mock.calls[0][0];
      expect(error.details.length).toBeGreaterThan(1);
    });

    it('devrait supprimer les champs inconnus (stripUnknown: true)', () => {
      mockReq.body = { 
        email: 'test@test.fr', 
        name: 'Test',
        unknownField: 'should be removed'
      };
      mockReq.params = { id: '550e8400-e29b-41d4-a716-446655440000' };

      const middleware = validate(testSchema);
      middleware(mockReq, mockRes, mockNext);

      expect(mockReq.body.unknownField).toBeUndefined();
    });

    it('devrait valider partiellement si schéma partiel', () => {
      const partialSchema = {
        body: Joi.object({
          email: Joi.string().email()
        })
      };

      mockReq.body = { email: 'test@test.fr' };

      const middleware = validate(partialSchema);
      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });
  });

  // ==========================================
  // Tests: PATTERNS
  // ==========================================
  describe('PATTERNS', () => {
    describe('EMAIL_MSSANTE / mssanteEmail', () => {
      const pattern = PATTERNS.mssanteEmail || PATTERNS.EMAIL_MSSANTE;

      it('devrait valider un email MSSanté valide', () => {
        expect(pattern.test('jean.dupont@hopital.mssante.fr')).toBe(true);
        expect(pattern.test('secretariat@clinique-test.mssante.fr')).toBe(true);
        expect(pattern.test('bal.applicative@labo.mssante.fr')).toBe(true);
      });

      it('devrait rejeter un email non MSSanté', () => {
        expect(pattern.test('user@gmail.com')).toBe(false);
        expect(pattern.test('user@hopital.fr')).toBe(false);
        expect(pattern.test('user@mssante.com')).toBe(false);
      });
    });

    describe('RPPS / rpps', () => {
      const pattern = PATTERNS.rpps || PATTERNS.RPPS;

      it('devrait valider un RPPS valide (11 chiffres)', () => {
        expect(pattern.test('10001234567')).toBe(true);
        expect(pattern.test('99999999999')).toBe(true);
      });

      it('devrait rejeter un RPPS invalide', () => {
        expect(pattern.test('1234567890')).toBe(false); // 10 chiffres
        expect(pattern.test('123456789012')).toBe(false); // 12 chiffres
        expect(pattern.test('1000123456a')).toBe(false); // Avec lettre
        expect(pattern.test('abcdefghijk')).toBe(false); // Tout lettres
      });
    });

    describe('FINESS / finess', () => {
      const pattern = PATTERNS.finess || PATTERNS.FINESS;

      it('devrait valider un FINESS valide (9 chiffres)', () => {
        expect(pattern.test('123456789')).toBe(true);
        expect(pattern.test('750000001')).toBe(true);
      });

      it('devrait rejeter un FINESS invalide', () => {
        expect(pattern.test('12345678')).toBe(false); // 8 chiffres
        expect(pattern.test('1234567890')).toBe(false); // 10 chiffres
        expect(pattern.test('12345678a')).toBe(false); // Avec lettre
      });
    });

    describe('DOMAIN_MSSANTE / mssanteDomain', () => {
      const pattern = PATTERNS.mssanteDomain || PATTERNS.DOMAIN_MSSANTE;

      it('devrait valider un domaine MSSanté', () => {
        expect(pattern.test('hopital.mssante.fr')).toBe(true);
        expect(pattern.test('clinique-paris.mssante.fr')).toBe(true);
        expect(pattern.test('labo123.mssante.fr')).toBe(true);
      });

      it('devrait rejeter un domaine non MSSanté', () => {
        expect(pattern.test('hopital.com')).toBe(false);
        expect(pattern.test('mssante.fr')).toBe(false);
        expect(pattern.test('test.mssante.com')).toBe(false);
      });
    });

    describe('strongPassword', () => {
      const pattern = PATTERNS.strongPassword;

      it('devrait valider un mot de passe fort', () => {
        expect(pattern.test('SecurePass123!')).toBe(true);
        expect(pattern.test('MyP@ssw0rd2024')).toBe(true);
        expect(pattern.test('Abc123456789$')).toBe(true);
      });

      it('devrait rejeter un mot de passe faible', () => {
        expect(pattern.test('password')).toBe(false); // Pas de majuscule, chiffre, spécial
        expect(pattern.test('Password123')).toBe(false); // Pas de caractère spécial
        expect(pattern.test('password123!')).toBe(false); // Pas de majuscule
        expect(pattern.test('PASSWORD123!')).toBe(false); // Pas de minuscule
        expect(pattern.test('Short1!')).toBe(false); // Trop court
      });
    });

    describe('UUID / uuid', () => {
      const pattern = PATTERNS.uuid;

      it('devrait valider un UUID v4', () => {
        expect(pattern.test('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
        expect(pattern.test('6ba7b810-9dad-11d1-80b4-00c04fd430c8')).toBe(true);
      });

      it('devrait rejeter un UUID invalide', () => {
        expect(pattern.test('not-a-uuid')).toBe(false);
        expect(pattern.test('550e8400-e29b-41d4-a716')).toBe(false);
        expect(pattern.test('550e8400e29b41d4a716446655440000')).toBe(false);
      });
    });
  });

  // ==========================================
  // Tests: validators functions
  // ==========================================
  describe('validators', () => {
    describe('isValidMSSanteEmail', () => {
      it('devrait valider un email MSSanté', () => {
        expect(validators.isValidMSSanteEmail('test@hopital.mssante.fr')).toBe(true);
      });

      it('devrait rejeter un email non MSSanté', () => {
        expect(validators.isValidMSSanteEmail('test@gmail.com')).toBe(false);
      });
    });

    describe('isValidRPPS', () => {
      it('devrait valider un RPPS', () => {
        expect(validators.isValidRPPS('10001234567')).toBe(true);
      });

      it('devrait rejeter un RPPS invalide', () => {
        expect(validators.isValidRPPS('123')).toBe(false);
      });
    });

    describe('isValidFINESS', () => {
      it('devrait valider un FINESS', () => {
        expect(validators.isValidFINESS('123456789')).toBe(true);
      });

      it('devrait rejeter un FINESS invalide', () => {
        expect(validators.isValidFINESS('12345')).toBe(false);
      });
    });

    describe('extractDomain', () => {
      it('devrait extraire le domaine d\'un email', () => {
        expect(validators.extractDomain('user@hopital.mssante.fr')).toBe('hopital.mssante.fr');
      });

      it('devrait retourner null pour un email invalide', () => {
        expect(validators.extractDomain('not-an-email')).toBeNull();
        expect(validators.extractDomain(null)).toBeNull();
        expect(validators.extractDomain(undefined)).toBeNull();
      });
    });

    describe('isStrongPassword', () => {
      it('devrait valider un mot de passe fort', () => {
        expect(validators.isStrongPassword('SecurePass123!')).toBe(true);
      });

      it('devrait rejeter un mot de passe faible', () => {
        expect(validators.isStrongPassword('weak')).toBe(false);
      });
    });
  });

  // ==========================================
  // Tests: schemas
  // ==========================================
  describe('schemas', () => {
    describe('schemas.user', () => {
      describe('create', () => {
        it('devrait valider une création d\'utilisateur valide', () => {
          const data = {
            email: 'nouveau@hopital.mssante.fr',
            first_name: 'Jean',
            last_name: 'Dupont',
            rpps_id: '10001234567'
          };

          const { error, value } = schemas.user.create.body.validate(data);
          
          expect(error).toBeUndefined();
          expect(value.email).toBe('nouveau@hopital.mssante.fr');
        });

        it('devrait rejeter un email invalide', () => {
          const data = {
            email: 'invalid-email',
            first_name: 'Jean',
            last_name: 'Dupont'
          };

          const { error } = schemas.user.create.body.validate(data);
          
          expect(error).toBeDefined();
        });

        it('devrait rejeter un RPPS invalide', () => {
          const data = {
            email: 'test@hopital.mssante.fr',
            first_name: 'Jean',
            last_name: 'Dupont',
            rpps_id: '123' // Invalide
          };

          const { error } = schemas.user.create.body.validate(data);
          
          expect(error).toBeDefined();
        });
      });

      describe('update', () => {
        it('devrait valider une mise à jour partielle', () => {
          const data = {
            first_name: 'Jean-Pierre'
          };

          const { error, value } = schemas.user.update.body.validate(data);
          
          expect(error).toBeUndefined();
          expect(value.first_name).toBe('Jean-Pierre');
        });
      });
    });

    describe('schemas.mailbox', () => {
      describe('create', () => {
        it('devrait valider une création de BAL valide', () => {
          const data = {
            email: 'secretariat@hopital.mssante.fr',
            type: 'organizational',
            owner_rpps: '10001234567'
          };

          const { error, value } = schemas.mailbox.create.body.validate(data);
          
          expect(error).toBeUndefined();
          expect(value.type).toBe('organizational');
        });

        it('devrait rejeter un type de BAL invalide', () => {
          const data = {
            email: 'test@hopital.mssante.fr',
            type: 'invalid_type'
          };

          const { error } = schemas.mailbox.create.body.validate(data);
          
          expect(error).toBeDefined();
        });

        it('devrait valider tous les types de BAL', () => {
          const validTypes = ['personal', 'organizational', 'applicative'];
          
          validTypes.forEach(type => {
            const data = { email: 'test@hopital.mssante.fr', type };
            const { error } = schemas.mailbox.create.body.validate(data);
            expect(error).toBeUndefined();
          });
        });
      });

      describe('update', () => {
        it('devrait valider un quota valide', () => {
          const data = {
            quota_mb: 2048
          };

          const { error, value } = schemas.mailbox.update.body.validate(data);
          
          expect(error).toBeUndefined();
          expect(value.quota_mb).toBe(2048);
        });

        it('devrait rejeter un quota trop élevé', () => {
          const data = {
            quota_mb: 999999 // Trop grand
          };

          const { error } = schemas.mailbox.update.body.validate(data);
          
          expect(error).toBeDefined();
        });
      });
    });

    describe('schemas.domain', () => {
      describe('create', () => {
        it('devrait valider une création de domaine valide', () => {
          const data = {
            domain_name: 'nouveau-hopital.mssante.fr',
            organization_name: 'Nouveau Hôpital',
            finess_juridique: '123456789',
            admin_email: 'admin@nouveau-hopital.mssante.fr'
          };

          const { error, value } = schemas.domain.create.body.validate(data);
          
          expect(error).toBeUndefined();
          expect(value.domain_name).toBe('nouveau-hopital.mssante.fr');
        });

        it('devrait rejeter un domaine non MSSanté', () => {
          const data = {
            domain_name: 'hopital.com',
            organization_name: 'Test',
            finess_juridique: '123456789',
            admin_email: 'admin@test.fr'
          };

          const { error } = schemas.domain.create.body.validate(data);
          
          expect(error).toBeDefined();
        });
      });
    });

    describe('schemas.auth', () => {
      describe('login', () => {
        it('devrait valider un login valide', () => {
          const data = {
            email: 'admin@hopital.mssante.fr',
            password: 'SecurePassword123!'
          };

          const { error } = schemas.auth.login.body.validate(data);
          
          expect(error).toBeUndefined();
        });

        it('devrait exiger un email', () => {
          const data = {
            password: 'SecurePassword123!'
          };

          const { error } = schemas.auth.login.body.validate(data);
          
          expect(error).toBeDefined();
        });

        it('devrait exiger un mot de passe', () => {
          const data = {
            email: 'admin@hopital.mssante.fr'
          };

          const { error } = schemas.auth.login.body.validate(data);
          
          expect(error).toBeDefined();
        });
      });

      describe('refresh', () => {
        it('devrait valider un refresh token', () => {
          const data = {
            refresh_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
          };

          const { error } = schemas.auth.refresh.body.validate(data);
          
          expect(error).toBeUndefined();
        });
      });
    });

    describe('schemas.email', () => {
      describe('send', () => {
        it('devrait valider un envoi d\'email valide', () => {
          const data = {
            from: 'expediteur@hopital.mssante.fr',
            to: ['destinataire@clinique.mssante.fr'],
            subject: 'Test',
            html: '<p>Contenu</p>'
          };

          const { error } = schemas.email.send.body.validate(data);
          
          expect(error).toBeUndefined();
        });

        it('devrait exiger au moins un destinataire', () => {
          const data = {
            from: 'expediteur@hopital.mssante.fr',
            to: [],
            subject: 'Test',
            text: 'Contenu'
          };

          const { error } = schemas.email.send.body.validate(data);
          
          expect(error).toBeDefined();
        });

        it('devrait exiger html ou text', () => {
          const data = {
            from: 'expediteur@hopital.mssante.fr',
            to: ['dest@test.mssante.fr'],
            subject: 'Test'
            // Ni html ni text
          };

          const { error } = schemas.email.send.body.validate(data);
          
          expect(error).toBeDefined();
        });

        it('devrait valider les pièces jointes', () => {
          const data = {
            from: 'exp@hopital.mssante.fr',
            to: ['dest@test.mssante.fr'],
            subject: 'Test',
            text: 'Voir PJ',
            attachments: [
              { filename: 'doc.pdf', content: 'base64content', contentType: 'application/pdf' }
            ]
          };

          const { error } = schemas.email.send.body.validate(data);
          
          expect(error).toBeUndefined();
        });
      });

      describe('listMessages', () => {
        it('devrait appliquer les valeurs par défaut', () => {
          const data = {};

          const { error, value } = schemas.email.listMessages.query.validate(data);
          
          expect(error).toBeUndefined();
          expect(value.folder).toBe('INBOX');
          expect(value.page).toBe(1);
          expect(value.limit).toBe(20);
        });

        it('devrait valider une pagination personnalisée', () => {
          const data = {
            folder: 'Sent',
            page: 3,
            limit: 50
          };

          const { error, value } = schemas.email.listMessages.query.validate(data);
          
          expect(error).toBeUndefined();
          expect(value.page).toBe(3);
        });
      });
    });

    describe('schemas.certificate', () => {
      describe('upload', () => {
        it('devrait valider un upload de certificat', () => {
          const data = {
            type: 'AUTH_CLI',
            domain_id: '550e8400-e29b-41d4-a716-446655440000',
            certificate_pem: '-----BEGIN CERTIFICATE-----...',
            private_key_pem: '-----BEGIN PRIVATE KEY-----...'
          };

          const { error } = schemas.certificate.upload.body.validate(data);
          
          expect(error).toBeUndefined();
        });

        it('devrait valider tous les types de certificat', () => {
          const validTypes = ['AUTH_CLI', 'AUTH_SRV', 'SIGN'];
          
          validTypes.forEach(type => {
            const data = {
              type,
              domain_id: '550e8400-e29b-41d4-a716-446655440000',
              certificate_pem: 'cert',
              private_key_pem: 'key'
            };
            const { error } = schemas.certificate.upload.body.validate(data);
            expect(error).toBeUndefined();
          });
        });
      });
    });
  });
});