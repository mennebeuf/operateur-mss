// services/api/tests/unit/utils/validators.test.js

/**
 * Tests unitaires pour les validateurs
 */

const { PATTERNS, schemas, validators, Joi } = require('../../../src/utils/validators');

describe('PATTERNS', () => {
  describe('mssanteEmail', () => {
    it('devrait valider les emails MSSanté corrects', () => {
      expect(PATTERNS.mssanteEmail.test('user@example.mssante.fr')).toBe(true);
      expect(PATTERNS.mssanteEmail.test('jean.dupont@hopital.mssante.fr')).toBe(true);
      expect(PATTERNS.mssanteEmail.test('contact@chu-paris.mssante.fr')).toBe(true);
    });

    it('devrait rejeter les emails non-MSSanté', () => {
      expect(PATTERNS.mssanteEmail.test('user@gmail.com')).toBe(false);
      expect(PATTERNS.mssanteEmail.test('user@mssante.com')).toBe(false);
      expect(PATTERNS.mssanteEmail.test('user@example.fr')).toBe(false);
    });

    it('devrait rejeter les emails malformés', () => {
      expect(PATTERNS.mssanteEmail.test('invalid')).toBe(false);
      expect(PATTERNS.mssanteEmail.test('@mssante.fr')).toBe(false);
      expect(PATTERNS.mssanteEmail.test('user@')).toBe(false);
    });
  });

  describe('mssanteDomain', () => {
    it('devrait valider les domaines MSSanté corrects', () => {
      expect(PATTERNS.mssanteDomain.test('hopital.mssante.fr')).toBe(true);
      expect(PATTERNS.mssanteDomain.test('chu-paris.mssante.fr')).toBe(true);
      expect(PATTERNS.mssanteDomain.test('clinique.groupe.mssante.fr')).toBe(true);
    });

    it('devrait rejeter les domaines non-MSSanté', () => {
      expect(PATTERNS.mssanteDomain.test('example.com')).toBe(false);
      expect(PATTERNS.mssanteDomain.test('mssante.com')).toBe(false);
    });
  });

  describe('rpps', () => {
    it('devrait valider les numéros RPPS corrects (11 chiffres)', () => {
      expect(PATTERNS.rpps.test('12345678901')).toBe(true);
      expect(PATTERNS.rpps.test('00000000000')).toBe(true);
    });

    it('devrait rejeter les numéros RPPS invalides', () => {
      expect(PATTERNS.rpps.test('1234567890')).toBe(false); // 10 chiffres
      expect(PATTERNS.rpps.test('123456789012')).toBe(false); // 12 chiffres
      expect(PATTERNS.rpps.test('1234567890A')).toBe(false); // avec lettre
    });
  });

  describe('adeli', () => {
    it('devrait valider les numéros ADELI corrects (9 chiffres)', () => {
      expect(PATTERNS.adeli.test('123456789')).toBe(true);
      expect(PATTERNS.adeli.test('000000000')).toBe(true);
    });

    it('devrait rejeter les numéros ADELI invalides', () => {
      expect(PATTERNS.adeli.test('12345678')).toBe(false);
      expect(PATTERNS.adeli.test('1234567890')).toBe(false);
    });
  });

  describe('finess', () => {
    it('devrait valider les numéros FINESS corrects (9 chiffres)', () => {
      expect(PATTERNS.finess.test('123456789')).toBe(true);
    });

    it('devrait rejeter les numéros FINESS invalides', () => {
      expect(PATTERNS.finess.test('12345678')).toBe(false);
      expect(PATTERNS.finess.test('1234567890')).toBe(false);
    });
  });

  describe('siret', () => {
    it('devrait valider les numéros SIRET corrects (14 chiffres)', () => {
      expect(PATTERNS.siret.test('12345678901234')).toBe(true);
    });

    it('devrait rejeter les numéros SIRET invalides', () => {
      expect(PATTERNS.siret.test('1234567890123')).toBe(false);
      expect(PATTERNS.siret.test('123456789012345')).toBe(false);
    });
  });

  describe('phoneNumber', () => {
    it('devrait valider les numéros de téléphone français', () => {
      expect(PATTERNS.phoneNumber.test('0612345678')).toBe(true);
      expect(PATTERNS.phoneNumber.test('06 12 34 56 78')).toBe(true);
      expect(PATTERNS.phoneNumber.test('+33612345678')).toBe(true);
      expect(PATTERNS.phoneNumber.test('0033612345678')).toBe(true);
    });

    it('devrait rejeter les numéros invalides', () => {
      expect(PATTERNS.phoneNumber.test('061234567')).toBe(false);
      expect(PATTERNS.phoneNumber.test('123456789')).toBe(false);
    });
  });

  describe('strongPassword', () => {
    it('devrait valider les mots de passe forts', () => {
      expect(PATTERNS.strongPassword.test('MonPassword123!')).toBe(true);
      expect(PATTERNS.strongPassword.test('Abcdefgh1234@#')).toBe(true);
    });

    it('devrait rejeter les mots de passe faibles', () => {
      expect(PATTERNS.strongPassword.test('password')).toBe(false); // pas de majuscule, chiffre, spécial
      expect(PATTERNS.strongPassword.test('Password123')).toBe(false); // pas de spécial
      expect(PATTERNS.strongPassword.test('Short1!')).toBe(false); // trop court
    });
  });

  describe('uuid', () => {
    it('devrait valider les UUIDs v4', () => {
      expect(PATTERNS.uuid.test('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
      expect(PATTERNS.uuid.test('6ba7b810-9dad-41d4-80b4-00c04fd430c8')).toBe(true);
    });

    it('devrait rejeter les UUIDs invalides', () => {
      expect(PATTERNS.uuid.test('invalid-uuid')).toBe(false);
      expect(PATTERNS.uuid.test('550e8400-e29b-31d4-a716-446655440000')).toBe(false); // v3
    });
  });
});

describe('validators', () => {
  describe('isValidMSSanteEmail', () => {
    it('devrait valider les emails MSSanté', () => {
      expect(validators.isValidMSSanteEmail('user@hopital.mssante.fr')).toBe(true);
    });

    it('devrait rejeter les emails non-MSSanté', () => {
      expect(validators.isValidMSSanteEmail('user@gmail.com')).toBe(false);
    });
  });

  describe('isValidMSSanteDomain', () => {
    it('devrait valider les domaines MSSanté', () => {
      expect(validators.isValidMSSanteDomain('hopital.mssante.fr')).toBe(true);
    });

    it('devrait rejeter les domaines non-MSSanté', () => {
      expect(validators.isValidMSSanteDomain('example.com')).toBe(false);
    });
  });

  describe('isValidRPPS', () => {
    it('devrait valider les numéros RPPS', () => {
      expect(validators.isValidRPPS('12345678901')).toBe(true);
    });

    it('devrait rejeter les numéros invalides', () => {
      expect(validators.isValidRPPS('123')).toBe(false);
    });
  });

  describe('isValidADELI', () => {
    it('devrait valider les numéros ADELI', () => {
      expect(validators.isValidADELI('123456789')).toBe(true);
    });

    it('devrait rejeter les numéros invalides', () => {
      expect(validators.isValidADELI('12345')).toBe(false);
    });
  });

  describe('isValidFINESS', () => {
    it('devrait valider les numéros FINESS', () => {
      expect(validators.isValidFINESS('123456789')).toBe(true);
    });

    it('devrait rejeter les numéros invalides', () => {
      expect(validators.isValidFINESS('12345')).toBe(false);
    });
  });

  describe('isStrongPassword', () => {
    it('devrait valider les mots de passe forts', () => {
      expect(validators.isStrongPassword('MonPassword123!')).toBe(true);
    });

    it('devrait rejeter les mots de passe faibles', () => {
      expect(validators.isStrongPassword('weak')).toBe(false);
    });
  });

  describe('isValidUUID', () => {
    it('devrait valider les UUIDs', () => {
      expect(validators.isValidUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    });

    it('devrait rejeter les UUIDs invalides', () => {
      expect(validators.isValidUUID('not-a-uuid')).toBe(false);
    });
  });

  describe('extractDomain', () => {
    it('devrait extraire le domaine d\'un email', () => {
      expect(validators.extractDomain('user@example.com')).toBe('example.com');
      expect(validators.extractDomain('User@EXAMPLE.COM')).toBe('example.com');
    });

    it('devrait retourner null pour une entrée invalide', () => {
      expect(validators.extractDomain(null)).toBeNull();
      expect(validators.extractDomain('invalid')).toBeNull();
      expect(validators.extractDomain('')).toBeNull();
    });
  });

  describe('validate', () => {
    it('devrait valider avec un schéma Joi', () => {
      const schema = Joi.object({ name: Joi.string().required() });
      const result = validators.validate({ name: 'Test' }, schema);

      expect(result.error).toBeUndefined();
      expect(result.value.name).toBe('Test');
    });

    it('devrait retourner les erreurs de validation', () => {
      const schema = Joi.object({ name: Joi.string().required() });
      const result = validators.validate({}, schema);

      expect(result.error).toBeDefined();
    });

    it('devrait supprimer les champs inconnus par défaut', () => {
      const schema = Joi.object({ name: Joi.string() });
      const result = validators.validate({ name: 'Test', extra: 'field' }, schema);

      expect(result.value.extra).toBeUndefined();
      expect(result.value.name).toBe('Test');
    });
  });
});

describe('schemas', () => {
  describe('user.create', () => {
    it('devrait valider une création d\'utilisateur correcte', () => {
      const data = {
        email: 'jean.dupont@hopital.mssante.fr',
        firstName: 'Jean',
        lastName: 'Dupont',
        rpps: '12345678901'
      };
      const { error, value } = schemas.user.create.validate(data);

      expect(error).toBeUndefined();
      expect(value.email).toBe('jean.dupont@hopital.mssante.fr');
    });

    it('devrait rejeter un email non-MSSanté', () => {
      const data = {
        email: 'user@gmail.com',
        firstName: 'Jean',
        lastName: 'Dupont'
      };
      const { error } = schemas.user.create.validate(data);

      expect(error).toBeDefined();
    });

    it('devrait exiger les champs obligatoires', () => {
      const { error } = schemas.user.create.validate({});

      expect(error).toBeDefined();
      expect(error.details.length).toBeGreaterThan(0);
    });
  });

  describe('user.update', () => {
    it('devrait valider une mise à jour partielle', () => {
      const data = { firstName: 'Pierre' };
      const { error, value } = schemas.user.update.validate(data);

      expect(error).toBeUndefined();
      expect(value.firstName).toBe('Pierre');
    });

    it('devrait rejeter une mise à jour vide', () => {
      const { error } = schemas.user.update.validate({});

      expect(error).toBeDefined();
    });
  });

  describe('mailbox.create', () => {
    it('devrait valider une création de BAL personnelle', () => {
      const data = {
        email: 'medecin@hopital.mssante.fr',
        type: 'PERS',
        displayName: 'Dr. Martin',
        userId: '550e8400-e29b-41d4-a716-446655440000'
      };
      const { error } = schemas.mailbox.create.validate(data);

      expect(error).toBeUndefined();
    });

    it('devrait valider une création de BAL organisationnelle', () => {
      const data = {
        email: 'secretariat@hopital.mssante.fr',
        type: 'ORG',
        displayName: 'Secrétariat',
        organizationId: '550e8400-e29b-41d4-a716-446655440000'
      };
      const { error } = schemas.mailbox.create.validate(data);

      expect(error).toBeUndefined();
    });

    it('devrait appliquer les valeurs par défaut', () => {
      const data = {
        email: 'test@hopital.mssante.fr',
        type: 'PERS',
        displayName: 'Test',
        userId: '550e8400-e29b-41d4-a716-446655440000'
      };
      const { value } = schemas.mailbox.create.validate(data);

      expect(value.quotaMb).toBe(1024);
      expect(value.isPrivate).toBe(false);
    });
  });

  describe('auth.login', () => {
    it('devrait valider des identifiants corrects', () => {
      const data = {
        email: 'admin@hopital.mssante.fr',
        password: 'MonMotDePasse123!'
      };
      const { error } = schemas.auth.login.validate(data);

      expect(error).toBeUndefined();
    });

    it('devrait exiger email et password', () => {
      const { error } = schemas.auth.login.validate({});

      expect(error).toBeDefined();
    });
  });

  describe('auth.changePassword', () => {
    it('devrait valider un changement de mot de passe correct', () => {
      const data = {
        currentPassword: 'AncienMDP123!',
        newPassword: 'NouveauMDP456@',
        confirmPassword: 'NouveauMDP456@'
      };
      const { error } = schemas.auth.changePassword.validate(data);

      expect(error).toBeUndefined();
    });

    it('devrait rejeter si les mots de passe ne correspondent pas', () => {
      const data = {
        currentPassword: 'AncienMDP123!',
        newPassword: 'NouveauMDP456@',
        confirmPassword: 'DifferentMDP789#'
      };
      const { error } = schemas.auth.changePassword.validate(data);

      expect(error).toBeDefined();
      expect(error.message).toContain('correspondent pas');
    });

    it('devrait rejeter un mot de passe faible', () => {
      const data = {
        currentPassword: 'AncienMDP123!',
        newPassword: 'faible',
        confirmPassword: 'faible'
      };
      const { error } = schemas.auth.changePassword.validate(data);

      expect(error).toBeDefined();
    });
  });

  describe('email.send', () => {
    it('devrait valider un email correct', () => {
      const data = {
        to: ['destinataire@example.com'],
        subject: 'Test',
        html: '<p>Contenu</p>'
      };
      const { error } = schemas.email.send.validate(data);

      expect(error).toBeUndefined();
    });

    it('devrait accepter un destinataire unique comme string', () => {
      const data = {
        to: 'destinataire@example.com',
        subject: 'Test',
        text: 'Contenu texte'
      };
      const { error } = schemas.email.send.validate(data);

      expect(error).toBeUndefined();
    });

    it('devrait exiger au moins html ou text', () => {
      const data = {
        to: ['destinataire@example.com'],
        subject: 'Test'
      };
      const { error } = schemas.email.send.validate(data);

      expect(error).toBeDefined();
    });

    it('devrait valider les pièces jointes', () => {
      const data = {
        to: ['dest@example.com'],
        subject: 'Test',
        html: '<p>Contenu</p>',
        attachments: [
          { filename: 'doc.pdf', content: 'base64content', contentType: 'application/pdf' }
        ]
      };
      const { error } = schemas.email.send.validate(data);

      expect(error).toBeUndefined();
    });
  });

  describe('pagination', () => {
    it('devrait appliquer les valeurs par défaut', () => {
      const { value } = schemas.pagination.validate({});

      expect(value.page).toBe(1);
      expect(value.limit).toBe(20);
      expect(value.sortOrder).toBe('desc');
    });

    it('devrait valider des paramètres personnalisés', () => {
      const data = { page: 5, limit: 50, sortBy: 'created_at', sortOrder: 'asc' };
      const { error, value } = schemas.pagination.validate(data);

      expect(error).toBeUndefined();
      expect(value.page).toBe(5);
      expect(value.limit).toBe(50);
    });

    it('devrait rejeter une limite trop élevée', () => {
      const { error } = schemas.pagination.validate({ limit: 200 });

      expect(error).toBeDefined();
    });
  });
});