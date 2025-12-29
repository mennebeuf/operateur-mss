// ============================================================
// services/api/tests/unit/services/__mocks__/redis.js
// ============================================================

const mockRedis = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  expire: jest.fn(),
  keys: jest.fn(),
  hget: jest.fn(),
  hset: jest.fn(),
  hgetall: jest.fn(),
  incr: jest.fn(),
  quit: jest.fn()
};

module.exports = {
  redisClient: mockRedis,
  connectRedis: jest.fn().mockResolvedValue(true)
};