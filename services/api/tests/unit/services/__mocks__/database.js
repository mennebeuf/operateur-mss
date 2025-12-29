// ============================================================
// services/api/tests/unit/services/__mocks__/database.js
// ============================================================

const mockPool = {
  query: jest.fn(),
  connect: jest.fn().mockResolvedValue({
    query: jest.fn(),
    release: jest.fn()
  }),
  end: jest.fn()
};

module.exports = {
  pool: mockPool,
  connectDB: jest.fn().mockResolvedValue(true)
};