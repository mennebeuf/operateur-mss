// ============================================================
// services/api/tests/unit/services/__mocks__/logger.js
// ============================================================

module.exports = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  mail: jest.fn(),
  http: jest.fn(),
  child: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }))
};