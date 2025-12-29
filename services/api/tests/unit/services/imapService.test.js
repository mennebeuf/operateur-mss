// ============================================================
// services/api/tests/unit/services/imapService.test.js
// ============================================================

const ImapService = require('../../../src/services/email/imapService');

// Mock des dépendances
jest.mock('imap');
jest.mock('mailparser');
jest.mock('../../../src/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  mail: jest.fn()
}));

const Imap = require('imap');
const { simpleParser } = require('mailparser');

describe('ImapService', () => {
  let mockImap;

  beforeEach(() => {
  jest.clearAllMocks();
  ImapService.connections.clear();
  
  mockImap = {
    state: 'authenticated',
    connect: jest.fn(),
    end: jest.fn(),
    openBox: jest.fn(),
    getBoxes: jest.fn(),
    search: jest.fn(),
    fetch: jest.fn(),
    addFlags: jest.fn(),
    delFlags: jest.fn(),
    move: jest.fn(),
    once: jest.fn((event, cb) => {
      if (event === 'ready') {setTimeout(() => cb(), 0);}
    }),
    on: jest.fn(),
    // Ajouter seq avec sa propre méthode fetch
    seq: {
      fetch: jest.fn()
    }
  };
  
  Imap.mockImplementation(() => mockImap);
});

  describe('getConnection', () => {
    it('devrait créer une nouvelle connexion IMAP', async () => {
      const connection = await ImapService.getConnection('user@test.fr', 'token123');
      
      expect(Imap).toHaveBeenCalledWith(expect.objectContaining({
        user: 'user@test.fr',
        password: 'token123'
      }));
      expect(mockImap.connect).toHaveBeenCalled();
      expect(connection).toBeDefined();
    });

    it('devrait réutiliser une connexion existante', async () => {
      await ImapService.getConnection('user@test.fr', 'token123');
      await ImapService.getConnection('user@test.fr', 'token123');
      
      expect(Imap).toHaveBeenCalledTimes(1);
    });

    it('devrait gérer les erreurs de connexion', async () => {
      mockImap.once = jest.fn((event, cb) => {
        if (event === 'error') {setTimeout(() => cb(new Error('Connection failed')), 0);}
      });
      
      await expect(ImapService.getConnection('user@test.fr', 'token'))
        .rejects.toThrow('Connection failed');
    });
  });

  describe('listFolders', () => {
    it('devrait retourner la liste des dossiers formatée', async () => {
      const mockBoxes = {
        INBOX: { attribs: ['\\HasNoChildren'], delimiter: '/' },
        Sent: { attribs: ['\\Sent', '\\HasNoChildren'], delimiter: '/' },
        Drafts: { attribs: ['\\Drafts'], delimiter: '/' },
        Trash: { attribs: ['\\Trash'], delimiter: '/' }
      };
      
      mockImap.getBoxes = jest.fn(cb => cb(null, mockBoxes));
      
      const folders = await ImapService.listFolders('user@test.fr', 'token');
      
      expect(folders).toEqual(expect.arrayContaining([
        expect.objectContaining({ name: 'INBOX' }),
        expect.objectContaining({ name: 'Sent', specialUse: 'sent' }),
        expect.objectContaining({ name: 'Drafts', specialUse: 'drafts' }),
        expect.objectContaining({ name: 'Trash', specialUse: 'trash' })
      ]));
    });

    it('devrait gérer les erreurs de récupération', async () => {
      mockImap.getBoxes = jest.fn(cb => cb(new Error('Folder error')));
      
      await expect(ImapService.listFolders('user@test.fr', 'token'))
        .rejects.toThrow('Folder error');
    });
  });

  describe('listMessages', () => {
    it('devrait retourner les messages avec pagination', async () => {
      mockImap.openBox = jest.fn((folder, readOnly, cb) => {
        cb(null, { messages: { total: 100 } });
      });

      // Stocker les callbacks pour les déclencher manuellement
      const fetchCallbacks = {};
      
      const mockFetch = {
        on: jest.fn((event, cb) => {
          fetchCallbacks[event] = cb;
        }),
        once: jest.fn((event, cb) => {
          fetchCallbacks[event] = cb;
        })
      };

      mockImap.seq.fetch = jest.fn(() => {
        // Déclencher les événements de manière asynchrone
        setImmediate(() => {
          // Simuler un message
          if (fetchCallbacks['message']) {
            const mockStream = {
              on: jest.fn((ev, handler) => {
                if (ev === 'data') {
                  handler(Buffer.from('From: sender@test.fr\r\nSubject: Test\r\n'));
                }
              }),
              once: jest.fn((ev, handler) => {
                if (ev === 'end') handler();
              })
            };

            const mockMsg = {
              on: jest.fn((e, c) => {
                if (e === 'body') {
                  c(mockStream, { which: 'HEADER.FIELDS' });
                }
              }),
              once: jest.fn((e, c) => {
                if (e === 'attributes') {
                  c({ uid: 1, flags: ['\\Seen'], size: 1024 });
                }
                if (e === 'end') c();
              })
            };

            fetchCallbacks['message'](mockMsg, 1);
          }

          // Terminer le fetch
          if (fetchCallbacks['end']) {
            fetchCallbacks['end']();
          }
        });

        return mockFetch;
      });

      // Mock de Imap.parseHeader
      Imap.parseHeader = jest.fn(() => ({
        from: ['sender@test.fr'],
        to: ['recipient@test.fr'],
        subject: ['Test Subject'],
        date: ['Mon, 01 Jan 2025 00:00:00 +0000'],
        'message-id': ['<test@example.com>']
      }));

      const result = await ImapService.listMessages('user@test.fr', 'token', 'INBOX', { page: 1, limit: 20 });

      expect(result).toHaveProperty('messages');
      expect(result).toHaveProperty('total', 100);
      expect(result).toHaveProperty('page', 1);
      expect(result.messages).toHaveLength(1);
    });
  });

  describe('setFlags', () => {
    it('devrait ajouter des flags à un message', async () => {
      mockImap.openBox = jest.fn((folder, readOnly, cb) => cb(null));
      mockImap.addFlags = jest.fn((uid, flags, cb) => cb(null));
      
      const result = await ImapService.setFlags('user@test.fr', 'token', 'INBOX', 123, { add: ['\\Seen'] });
      
      expect(mockImap.addFlags).toHaveBeenCalledWith(123, ['\\Seen'], expect.any(Function));
      expect(result.success).toBe(true);
    });

    it('devrait supprimer des flags', async () => {
      mockImap.openBox = jest.fn((folder, readOnly, cb) => cb(null));
      mockImap.delFlags = jest.fn((uid, flags, cb) => cb(null));
      
      const result = await ImapService.setFlags('user@test.fr', 'token', 'INBOX', 123, { remove: ['\\Flagged'] });
      
      expect(mockImap.delFlags).toHaveBeenCalledWith(123, ['\\Flagged'], expect.any(Function));
    });
  });

  describe('moveMessages', () => {
    it('devrait déplacer des messages vers un autre dossier', async () => {
      mockImap.openBox = jest.fn((folder, readOnly, cb) => cb(null));
      mockImap.move = jest.fn((uids, target, cb) => cb(null));
      
      const result = await ImapService.moveMessages('user@test.fr', 'token', 'INBOX', 'Trash', [1, 2, 3]);
      
      expect(mockImap.move).toHaveBeenCalledWith([1, 2, 3], 'Trash', expect.any(Function));
      expect(result.success).toBe(true);
      expect(result.moved).toBe(3);
    });
  });
});