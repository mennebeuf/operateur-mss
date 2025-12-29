// services/api/tests/unit/utils/helpers.test.js

/**
 * Tests unitaires pour les fonctions utilitaires helpers
 */

const {
  formatDate,
  dateDiff,
  formatBytes,
  mbToBytes,
  bytesToMb,
  slugify,
  truncate,
  capitalize,
  formatName,
  sleep,
  retry,
  parseBoolean,
  cleanObject,
  paginate,
  apiResponse,
  apiError,
  getClientIp,
  shortId,
  isEmpty,
  groupBy,
  getFirstDayOfMonth,
  getLastDayOfMonth
} = require('../../../src/utils/helpers');

describe('Fonctions de date', () => {
  describe('formatDate', () => {
    const testDate = new Date('2024-06-15T14:30:00Z');

    it('devrait formater en ISO par défaut', () => {
      const result = formatDate(testDate, 'iso');
      expect(result).toBe('2024-06-15T14:30:00.000Z');
    });

    it('devrait formater en français', () => {
      const result = formatDate(testDate, 'fr');
      expect(result).toMatch(/15\/06\/2024/);
    });

    it('devrait formater en datetime français', () => {
      const result = formatDate(testDate, 'datetime');
      expect(result).toMatch(/15\/06\/2024/);
    });

    it('devrait accepter une chaîne de date', () => {
      const result = formatDate('2024-06-15', 'iso');
      expect(result).toContain('2024-06-15');
    });

    it('devrait retourner null pour une date invalide', () => {
      expect(formatDate('invalid-date')).toBeNull();
      expect(formatDate('not a date')).toBeNull();
    });
  });

  describe('dateDiff', () => {
    const date1 = new Date('2024-01-01');
    const date2 = new Date('2024-01-11');

    it('devrait calculer la différence en jours', () => {
      expect(dateDiff(date1, date2, 'days')).toBe(10);
    });

    it('devrait calculer la différence en heures', () => {
      expect(dateDiff(date1, date2, 'hours')).toBe(240);
    });

    it('devrait calculer la différence en minutes', () => {
      expect(dateDiff(date1, date2, 'minutes')).toBe(14400);
    });

    it('devrait retourner une valeur absolue', () => {
      expect(dateDiff(date2, date1, 'days')).toBe(10);
    });

    it('devrait utiliser days par défaut', () => {
      expect(dateDiff(date1, date2)).toBe(10);
    });
  });

  describe('getFirstDayOfMonth', () => {
    it('devrait retourner le premier jour du mois', () => {
      const date = new Date('2024-06-15');
      const first = getFirstDayOfMonth(date);

      expect(first.getDate()).toBe(1);
      expect(first.getMonth()).toBe(5); // Juin = 5
    });

    it('devrait utiliser la date actuelle par défaut', () => {
      const first = getFirstDayOfMonth();
      expect(first.getDate()).toBe(1);
    });
  });

  describe('getLastDayOfMonth', () => {
    it('devrait retourner le dernier jour du mois', () => {
      const date = new Date('2024-06-15');
      const last = getLastDayOfMonth(date);

      expect(last.getDate()).toBe(30); // Juin a 30 jours
    });

    it('devrait gérer février année bissextile', () => {
      const date = new Date('2024-02-15');
      const last = getLastDayOfMonth(date);

      expect(last.getDate()).toBe(29);
    });
  });
});

describe('Fonctions de formatage', () => {
  describe('formatBytes', () => {
    it('devrait formater 0 bytes', () => {
      expect(formatBytes(0)).toBe('0 Bytes');
    });

    it('devrait formater en KB', () => {
      expect(formatBytes(1024)).toBe('1 KB');
    });

    it('devrait formater en MB', () => {
      expect(formatBytes(1048576)).toBe('1 MB');
    });

    it('devrait formater en GB', () => {
      expect(formatBytes(1073741824)).toBe('1 GB');
    });

    it('devrait respecter le nombre de décimales', () => {
      expect(formatBytes(1500, 0)).toBe('1 KB');
      expect(formatBytes(1500, 2)).toBe('1.46 KB');
    });
  });

  describe('mbToBytes / bytesToMb', () => {
    it('devrait convertir MB en bytes', () => {
      expect(mbToBytes(1)).toBe(1048576);
      expect(mbToBytes(10)).toBe(10485760);
    });

    it('devrait convertir bytes en MB', () => {
      expect(bytesToMb(1048576)).toBe(1);
      expect(bytesToMb(10485760)).toBe(10);
    });
  });

  describe('slugify', () => {
    it('devrait créer un slug simple', () => {
      expect(slugify('Hello World')).toBe('hello-world');
    });

    it('devrait gérer les accents', () => {
      expect(slugify('Café éléphant')).toBe('cafe-elephant');
    });

    it('devrait supprimer les caractères spéciaux', () => {
      expect(slugify('Test@#$%123')).toBe('test123');
    });

    it('devrait gérer les espaces multiples', () => {
      expect(slugify('Hello    World')).toBe('hello-world');
    });

    it('devrait supprimer les tirets en début/fin', () => {
      expect(slugify('  Hello World  ')).toBe('hello-world');
    });
  });

  describe('truncate', () => {
    it('devrait tronquer une longue chaîne', () => {
      const long = 'A'.repeat(150);
      const result = truncate(long, 100);

      expect(result).toHaveLength(100);
      expect(result).toMatch(/\.\.\.$/);
    });

    it('devrait garder une chaîne courte intacte', () => {
      expect(truncate('Short', 100)).toBe('Short');
    });

    it('devrait gérer null/undefined', () => {
      expect(truncate(null)).toBeNull();
      expect(truncate(undefined)).toBeUndefined();
    });
  });

  describe('capitalize', () => {
    it('devrait capitaliser la première lettre', () => {
      expect(capitalize('hello')).toBe('Hello');
      expect(capitalize('HELLO')).toBe('Hello');
    });

    it('devrait gérer une chaîne vide', () => {
      expect(capitalize('')).toBe('');
      expect(capitalize(null)).toBe('');
    });
  });

  describe('formatName', () => {
    it('devrait formater prénom et nom', () => {
      expect(formatName('jean', 'dupont')).toBe('Jean DUPONT');
    });

    it('devrait gérer les espaces', () => {
      expect(formatName('  jean  ', '  dupont  ')).toBe('Jean DUPONT');
    });

    it('devrait gérer les valeurs manquantes', () => {
      expect(formatName('jean', null)).toBe('Jean');
      expect(formatName(null, 'dupont')).toBe('DUPONT');
      expect(formatName(null, null)).toBe('');
    });
  });
});

describe('Fonctions asynchrones', () => {
  describe('sleep', () => {
    it('devrait attendre le délai spécifié', async () => {
      const start = Date.now();
      await sleep(100);
      const elapsed = Date.now() - start;

      expect(elapsed).toBeGreaterThanOrEqual(95);
      expect(elapsed).toBeLessThan(150);
    });
  });

  describe('retry', () => {
    it('devrait réussir au premier essai', async () => {
      const fn = jest.fn().mockResolvedValue('success');
      const result = await retry(fn, 3, 10);

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('devrait réessayer après un échec', async () => {
      const fn = jest.fn()
        .mockRejectedValueOnce(new Error('Fail 1'))
        .mockResolvedValue('success');

      const result = await retry(fn, 3, 10);

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('devrait échouer après le nombre maximum de tentatives', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('Always fail'));

      await expect(retry(fn, 3, 10)).rejects.toThrow('Always fail');
      expect(fn).toHaveBeenCalledTimes(3);
    });
  });
});

describe('Fonctions de parsing', () => {
  describe('parseBoolean', () => {
    it('devrait parser true', () => {
      expect(parseBoolean(true)).toBe(true);
      expect(parseBoolean('true')).toBe(true);
      expect(parseBoolean('1')).toBe(true);
      expect(parseBoolean('yes')).toBe(true);
      expect(parseBoolean('oui')).toBe(true);
    });

    it('devrait parser false', () => {
      expect(parseBoolean(false)).toBe(false);
      expect(parseBoolean('false')).toBe(false);
      expect(parseBoolean('0')).toBe(false);
      expect(parseBoolean('no')).toBe(false);
    });

    it('devrait être case-insensitive', () => {
      expect(parseBoolean('TRUE')).toBe(true);
      expect(parseBoolean('OUI')).toBe(true);
    });
  });

  describe('cleanObject', () => {
    it('devrait supprimer les valeurs null et undefined', () => {
      const obj = { a: 1, b: null, c: undefined, d: 'test' };
      const result = cleanObject(obj);

      expect(result).toEqual({ a: 1, d: 'test' });
    });

    it('devrait garder les valeurs falsy valides', () => {
      const obj = { a: 0, b: '', c: false };
      const result = cleanObject(obj);

      expect(result).toEqual({ a: 0, b: '', c: false });
    });

    it('devrait retourner null/undefined pour une entrée invalide', () => {
      expect(cleanObject(null)).toBeNull();
      expect(cleanObject(undefined)).toBeUndefined();
    });
  });
});

describe('Fonctions de pagination', () => {
  describe('paginate', () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

    it('devrait paginer correctement', () => {
      const result = paginate(items, 1, 3);

      expect(result.data).toEqual([1, 2, 3]);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(3);
      expect(result.pagination.total).toBe(10);
      expect(result.pagination.totalPages).toBe(4);
    });

    it('devrait gérer la dernière page', () => {
      const result = paginate(items, 4, 3);

      expect(result.data).toEqual([10]);
      expect(result.pagination.hasNext).toBe(false);
      expect(result.pagination.hasPrev).toBe(true);
    });

    it('devrait gérer une page au-delà des données', () => {
      const result = paginate(items, 100, 3);

      expect(result.data).toEqual([]);
    });

    it('devrait utiliser les valeurs par défaut', () => {
      const result = paginate(items);

      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(20);
    });
  });
});

describe('Fonctions de réponse API', () => {
  describe('apiResponse', () => {
    it('devrait créer une réponse de succès', () => {
      const result = apiResponse({ id: 1 }, 'Opération réussie');

      expect(result.success).toBe(true);
      expect(result.message).toBe('Opération réussie');
      expect(result.data).toEqual({ id: 1 });
      expect(result.timestamp).toBeDefined();
    });

    it('devrait inclure les métadonnées', () => {
      const result = apiResponse({}, null, { page: 1, total: 100 });

      expect(result.page).toBe(1);
      expect(result.total).toBe(100);
    });
  });

  describe('apiError', () => {
    it('devrait créer une réponse d\'erreur', () => {
      const result = apiError('Erreur de validation', 'VALIDATION_ERROR');

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('VALIDATION_ERROR');
      expect(result.error.message).toBe('Erreur de validation');
      expect(result.timestamp).toBeDefined();
    });

    it('devrait inclure les détails', () => {
      const details = [{ field: 'email', message: 'Email invalide' }];
      const result = apiError('Erreur', 'ERROR', details);

      expect(result.error.details).toEqual(details);
    });
  });
});

describe('Fonctions utilitaires', () => {
  describe('getClientIp', () => {
    it('devrait extraire l\'IP de x-forwarded-for', () => {
      const req = { headers: { 'x-forwarded-for': '192.168.1.1, 10.0.0.1' } };
      expect(getClientIp(req)).toBe('192.168.1.1');
    });

    it('devrait extraire l\'IP de x-real-ip', () => {
      const req = { headers: { 'x-real-ip': '192.168.1.2' } };
      expect(getClientIp(req)).toBe('192.168.1.2');
    });

    it('devrait utiliser req.ip en fallback', () => {
      const req = { headers: {}, ip: '127.0.0.1' };
      expect(getClientIp(req)).toBe('127.0.0.1');
    });

    it('devrait retourner "unknown" si pas d\'IP', () => {
      const req = { headers: {} };
      expect(getClientIp(req)).toBe('unknown');
    });
  });

  describe('shortId', () => {
    it('devrait générer un ID de 8 caractères par défaut', () => {
      const id = shortId();
      expect(id).toHaveLength(8);
      expect(id).toMatch(/^[A-Za-z0-9]+$/);
    });

    it('devrait générer un ID de longueur personnalisée', () => {
      expect(shortId(12)).toHaveLength(12);
      expect(shortId(4)).toHaveLength(4);
    });

    it('devrait générer des IDs uniques', () => {
      const ids = new Set();
      for (let i = 0; i < 100; i++) {
        ids.add(shortId());
      }
      expect(ids.size).toBe(100);
    });
  });

  describe('isEmpty', () => {
    it('devrait détecter les valeurs vides', () => {
      expect(isEmpty(null)).toBe(true);
      expect(isEmpty(undefined)).toBe(true);
      expect(isEmpty('')).toBe(true);
      expect(isEmpty('   ')).toBe(true);
      expect(isEmpty([])).toBe(true);
      expect(isEmpty({})).toBe(true);
    });

    it('devrait détecter les valeurs non vides', () => {
      expect(isEmpty('text')).toBe(false);
      expect(isEmpty([1])).toBe(false);
      expect(isEmpty({ a: 1 })).toBe(false);
      expect(isEmpty(0)).toBe(false);
      expect(isEmpty(false)).toBe(false);
    });
  });

  describe('groupBy', () => {
    const items = [
      { type: 'A', value: 1 },
      { type: 'B', value: 2 },
      { type: 'A', value: 3 }
    ];

    it('devrait grouper par clé string', () => {
      const result = groupBy(items, 'type');

      expect(result.A).toHaveLength(2);
      expect(result.B).toHaveLength(1);
    });

    it('devrait grouper par fonction', () => {
      const result = groupBy(items, item => item.value > 1 ? 'high' : 'low');

      expect(result.high).toHaveLength(2);
      expect(result.low).toHaveLength(1);
    });
  });
});