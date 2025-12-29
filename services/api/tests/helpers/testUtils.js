// ============================================================
// services/api/tests/helpers/testUtils.js
// ============================================================

/**
 * Utilitaires pour les tests
 */

/**
 * Génère un utilisateur de test
 */
function createMockUser(overrides = {}) {
  return {
    id: 'user-test-123',
    email: 'test@hopital.mssante.fr',
    firstName: 'Test',
    lastName: 'User',
    role: 'user',
    domainId: 'domain-123',
    isSuperAdmin: false,
    accessToken: 'mock-access-token',
    ...overrides
  };
}

/**
 * Génère une BAL de test
 */
function createMockMailbox(overrides = {}) {
  return {
    id: 'mailbox-test-123',
    email: 'test@hopital.mssante.fr',
    type: 'personal',
    status: 'active',
    domainId: 'domain-123',
    ownerId: 'user-test-123',
    quotaMb: 500,
    usedMb: 50,
    createdAt: new Date().toISOString(),
    ...overrides
  };
}

/**
 * Génère un domaine de test
 */
function createMockDomain(overrides = {}) {
  return {
    id: 'domain-123',
    domainName: 'hopital.mssante.fr',
    organizationName: 'Hôpital Test',
    type: 'healthcare',
    status: 'active',
    finessJuridique: '123456789',
    finessGeographique: '987654321',
    quotaMb: 10000,
    usedMb: 500,
    createdAt: new Date().toISOString(),
    ...overrides
  };
}

/**
 * Génère un certificat de test
 */
function createMockCertificate(overrides = {}) {
  const validTo = new Date();
  validTo.setFullYear(validTo.getFullYear() + 1);
  
  return {
    id: 'cert-123',
    domain: 'hopital.mssante.fr',
    type: 'domain',
    subject: 'CN=hopital.mssante.fr',
    issuer: 'CN=IGC SANTE SERVEURS',
    serialNumber: '1234567890ABCDEF',
    validFrom: new Date().toISOString(),
    validTo: validTo.toISOString(),
    status: 'valid',
    ...overrides
  };
}

/**
 * Génère un email de test
 */
function createMockEmail(overrides = {}) {
  return {
    uid: 1234,
    messageId: '<test-msg-id@hopital.mssante.fr>',
    from: { address: 'sender@test.mssante.fr', name: 'Sender Test' },
    to: [{ address: 'recipient@hopital.mssante.fr', name: 'Recipient' }],
    cc: [],
    bcc: [],
    subject: 'Test Email Subject',
    date: new Date().toISOString(),
    html: '<p>Test email content</p>',
    text: 'Test email content',
    attachments: [],
    flags: [],
    ...overrides
  };
}

/**
 * Attend un certain temps (utile pour les tests async)
 */
function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Mock une réponse Express
 */
function createMockResponse() {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    cookie: jest.fn().mockReturnThis(),
    clearCookie: jest.fn().mockReturnThis()
  };
  return res;
}

/**
 * Mock une requête Express
 */
function createMockRequest(overrides = {}) {
  return {
    body: {},
    params: {},
    query: {},
    headers: {},
    user: createMockUser(),
    cookies: {},
    ip: '127.0.0.1',
    ...overrides
  };
}

module.exports = {
  createMockUser,
  createMockMailbox,
  createMockDomain,
  createMockCertificate,
  createMockEmail,
  wait,
  createMockResponse,
  createMockRequest
};