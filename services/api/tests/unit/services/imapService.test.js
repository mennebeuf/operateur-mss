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
        if (event === 'ready') setTimeout(() => cb(), 0);
      }),
      on: jest.fn()
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
        if (event === 'error') setTimeout(() => cb(new Error('Connection failed')), 0);
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
      
      mockImap.search = jest.fn((criteria, cb) => {
        cb(null, [1, 2, 3, 4, 5]);
      });
      
      const mockFetch = {
        on: jest.fn((event, cb) => {
          if (event === 'message') {
            const msg = {
              on: jest.fn((e, c) => {
                if (e === 'body') {
                  c({ on: jest.fn((ev, handler) => {
                    if (ev === 'data') handler(Buffer.from('test'));
                    if (ev === 'end') handler();
                  })});
                }
                if (e === 'attributes') c({ uid: 1, flags: [] });
              }),
              once: jest.fn((e, c) => { if (e === 'end') c(); })
            };
            cb(msg, 1);
          }
          if (event === 'end') cb();
        }),
        once: jest.fn()
      };
      
      mockImap.fetch = jest.fn(() => mockFetch);
      
      simpleParser.mockResolvedValue({
        from: { value: [{ address: 'sender@test.fr', name: 'Sender' }] },
        subject: 'Test Subject',
        date: new Date('2025-01-01')
      });
      
      const result = await ImapService.listMessages('user@test.fr', 'token', 'INBOX', { page: 1, limit: 20 });
      
      expect(result).toHaveProperty('messages');
      expect(result).toHaveProperty('total');
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