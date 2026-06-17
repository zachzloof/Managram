const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

// Single signing key, RS256 throughout (per architecture review: one auth
// mechanism for both the hosted web cookie session and the Electron license
// token, rather than maintaining two separate schemes). Only the PRIVATE key
// (server-side env var) can sign; the PUBLIC key (embedded in the Electron
// app, see backend/scripts/generate-license-keys.js) can only verify.
function getPrivateKey() {
  const key = process.env.JWT_PRIVATE_KEY;
  if (!key) throw new Error('JWT_PRIVATE_KEY is not set');
  return key;
}

function getPublicKey() {
  if (process.env.JWT_PUBLIC_KEY) return process.env.JWT_PUBLIC_KEY;
  const bundled = path.join(__dirname, '../../../electron/license-public-key.pem');
  if (fs.existsSync(bundled)) return fs.readFileSync(bundled, 'utf8');
  throw new Error('No JWT public key available (set JWT_PUBLIC_KEY or run generate-license-keys.js)');
}

function hashPassword(password) {
  return bcrypt.hash(password, 12);
}

function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

// `kind` distinguishes a short-lived web session cookie from a longer-lived,
// offline-verifiable Electron license token — same signing mechanism, just
// a different expiry policy.
function issueToken(account, kind = 'session') {
  const payload = {
    accountId: account.id,
    plan: account.plan,
    status: account.subscription_status,
    override: account.access_override || null,
    isAdmin: !!account.is_admin,
    kind,
  };
  const expiresIn = kind === 'license' ? '3d' : '30d';
  return jwt.sign(payload, getPrivateKey(), { algorithm: 'RS256', expiresIn });
}

function verifyToken(token) {
  return jwt.verify(token, getPublicKey(), { algorithms: ['RS256'] });
}

// Whether the decoded token's claims indicate the account currently has
// access — combines Stripe-derived subscription_status with the admin
// kill-switch (access_override), without needing a fresh DB hit on every
// request. Callers that need fully fresh state (e.g. the admin panel) should
// re-fetch the account row directly instead of trusting a cached token.
function hasAccess(claims) {
  if (claims.override === 'force_deny') return false;
  if (claims.override === 'force_allow') return true;
  return claims.status === 'trialing' || claims.status === 'active';
}

module.exports = {
  hashPassword,
  verifyPassword,
  issueToken,
  verifyToken,
  hasAccess,
};
