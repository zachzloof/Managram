const crypto = require('crypto');

// auth.js reads its signing keys from env vars lazily (inside each function
// call, not at require-time), so a throwaway keypair generated here is
// enough to exercise the real RS256 sign/verify path without touching the
// actual electron/license-public-key.pem used in production.
const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});
process.env.JWT_PRIVATE_KEY = privateKey;
process.env.JWT_PUBLIC_KEY = publicKey;

const auth = require('./auth');

function account(overrides = {}) {
  return {
    id: 'acct-1',
    plan: 'monthly',
    subscription_status: 'trialing',
    access_override: null,
    is_admin: false,
    ...overrides,
  };
}

describe('issueToken / verifyToken', () => {
  it('round-trips the account claims', () => {
    const token = auth.issueToken(account());
    const claims = auth.verifyToken(token);
    expect(claims.accountId).toBe('acct-1');
    expect(claims.plan).toBe('monthly');
    expect(claims.status).toBe('trialing');
    expect(claims.isAdmin).toBe(false);
  });

  it('marks a license-kind token distinctly from a session-kind token', () => {
    const license = auth.verifyToken(auth.issueToken(account(), 'license'));
    const session = auth.verifyToken(auth.issueToken(account(), 'session'));
    expect(license.kind).toBe('license');
    expect(session.kind).toBe('session');
  });

  it('rejects a token signed with a different key (forged/tampered)', () => {
    const other = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    const jwt = require('jsonwebtoken');
    const forged = jwt.sign({ accountId: 'acct-1', status: 'active' }, other.privateKey, { algorithm: 'RS256' });
    expect(() => auth.verifyToken(forged)).toThrow();
  });

  it('rejects an expired token', () => {
    const jwt = require('jsonwebtoken');
    const expired = jwt.sign({ accountId: 'acct-1' }, process.env.JWT_PRIVATE_KEY, {
      algorithm: 'RS256',
      expiresIn: -10, // already expired
    });
    expect(() => auth.verifyToken(expired)).toThrow();
  });
});

describe('hasAccess', () => {
  it('allows trialing and active subscriptions', () => {
    expect(auth.hasAccess({ status: 'trialing', override: null })).toBe(true);
    expect(auth.hasAccess({ status: 'active', override: null })).toBe(true);
  });

  it('denies canceled, past_due, and incomplete subscriptions by default', () => {
    expect(auth.hasAccess({ status: 'canceled', override: null })).toBe(false);
    expect(auth.hasAccess({ status: 'past_due', override: null })).toBe(false);
    expect(auth.hasAccess({ status: 'incomplete', override: null })).toBe(false);
  });

  it('force_deny always wins, even for an active subscription', () => {
    expect(auth.hasAccess({ status: 'active', override: 'force_deny' })).toBe(false);
  });

  it('force_allow always wins, even for a canceled subscription', () => {
    expect(auth.hasAccess({ status: 'canceled', override: 'force_allow' })).toBe(true);
  });
});

describe('password hashing', () => {
  it('verifies the correct password and rejects an incorrect one', async () => {
    const hash = await auth.hashPassword('correct-horse-battery-staple');
    await expect(auth.verifyPassword('correct-horse-battery-staple', hash)).resolves.toBe(true);
    await expect(auth.verifyPassword('wrong-password', hash)).resolves.toBe(false);
  });

  it('never stores the password in plaintext', async () => {
    const hash = await auth.hashPassword('correct-horse-battery-staple');
    expect(hash).not.toContain('correct-horse-battery-staple');
  });
});
