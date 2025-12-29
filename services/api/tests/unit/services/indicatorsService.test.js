// ============================================================
// services/api/tests/unit/services/indicatorsService.test.js
// ============================================================

const IndicatorsService = require('../../../src/services/indicatorsService');

jest.mock('../../../src/config/database', () => ({
  pool: {
    query: jest.fn()
  }
}));
jest.mock('../../../src/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn()
}));

const { pool } = require('../../../src/config/database');

describe('IndicatorsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateMonthlyIndicators', () => {
    it('devrait générer les indicateurs pour un mois donné', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [{ count: '150' }] }) // BAL actives
        .mockResolvedValueOnce({ rows: [{ count: '45' }] })  // BAL personnelles
        .mockResolvedValueOnce({ rows: [{ count: '100' }] }) // BAL organisationnelles
        .mockResolvedValueOnce({ rows: [{ count: '5' }] })   // BAL applicatives
        .mockResolvedValueOnce({ rows: [{ total: '5000' }] }) // Emails envoyés
        .mockResolvedValueOnce({ rows: [{ total: '8000' }] }) // Emails reçus
        .mockResolvedValueOnce({ rows: [{ id: 'ind-123' }] }); // Insert
      
      const result = await IndicatorsService.generateMonthlyIndicators(2025, 1);
      
      expect(result).toMatchObject({
        year: 2025,
        month: 1,
        totalMailboxes: 150,
        personalMailboxes: 45,
        organizationalMailboxes: 100,
        applicativeMailboxes: 5,
        emailsSent: 5000,
        emailsReceived: 8000
      });
    });

    it('devrait gérer le cas sans données', async () => {
      pool.query.mockResolvedValue({ rows: [{ count: '0', total: '0' }] });
      
      const result = await IndicatorsService.generateMonthlyIndicators(2025, 1);
      
      expect(result.totalMailboxes).toBe(0);
    });
  });

  describe('getIndicators', () => {
    it('devrait récupérer les indicateurs par période', async () => {
      pool.query.mockResolvedValue({
        rows: [
          { year: 2025, month: 1, total_mailboxes: 100 },
          { year: 2024, month: 12, total_mailboxes: 95 }
        ]
      });
      
      const result = await IndicatorsService.getIndicators({
        startDate: '2024-12-01',
        endDate: '2025-01-31'
      });
      
      expect(result).toHaveLength(2);
    });
  });

  describe('exportCSV', () => {
    it('devrait exporter les indicateurs en CSV', async () => {
      pool.query.mockResolvedValue({
        rows: [{
          year: 2025,
          month: 1,
          total_mailboxes: 150,
          personal_mailboxes: 45,
          organizational_mailboxes: 100,
          applicative_mailboxes: 5,
          emails_sent: 5000,
          emails_received: 8000
        }]
      });
      
      const csv = await IndicatorsService.exportCSV(2025, 1);
      
      expect(csv).toContain('year');
      expect(csv).toContain('month');
      expect(csv).toContain('2025');
      expect(csv).toContain('150');
    });
  });

  describe('calculateGrowth', () => {
    it('devrait calculer la croissance entre deux périodes', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [{ total_mailboxes: 150 }] })
        .mockResolvedValueOnce({ rows: [{ total_mailboxes: 100 }] });
      
      const growth = await IndicatorsService.calculateGrowth(
        { year: 2025, month: 1 },
        { year: 2024, month: 12 }
      );
      
      expect(growth.mailboxGrowth).toBe(50);
      expect(growth.mailboxGrowthPercent).toBe(50);
    });

    it('devrait gérer le cas de période précédente à zéro', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [{ total_mailboxes: 100 }] })
        .mockResolvedValueOnce({ rows: [{ total_mailboxes: 0 }] });
      
      const growth = await IndicatorsService.calculateGrowth(
        { year: 2025, month: 1 },
        { year: 2024, month: 12 }
      );
      
      expect(growth.mailboxGrowthPercent).toBe(null);
    });
  });
});