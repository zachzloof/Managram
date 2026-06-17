const express = require('express');
const { isHostedMode } = require('../services/appMode');
const { hashPassword, verifyPassword, issueToken } = require('../services/auth');
const accountsRepo = require('../repositories/accountsRepo');
const { requireAccount } = require('../middleware/requireAccount');

const router = express.Router();

function hostedOnly(req, res, next) {
  if (!isHostedMode()) return res.status(404).json({ error: 'Not available in local mode' });
  next();
}

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 30 * 24 * 60 * 60 * 1000,
};

// POST /account/signup — { email, password }
router.post('/signup', hostedOnly, async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password || password.length < 8) {
    return res.status(400).json({ error: 'A valid email and an 8+ character password are required' });
  }

  const existing = await accountsRepo.getAccountByEmail(email.toLowerCase());
  if (existing) return res.status(409).json({ error: 'An account with that email already exists' });

  const passwordHash = await hashPassword(password);
  const trialEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const account = await accountsRepo.createAccount({ email: email.toLowerCase(), passwordHash, trialEndsAt });

  const token = issueToken(account, 'session');
  res.cookie('managram_session', token, COOKIE_OPTS);
  res.json({ account: { id: account.id, email: account.email, status: account.subscription_status } });
});

// POST /account/login — { email, password } — used by both the hosted web app
// and the Electron client (Electron calls this over HTTPS against the
// hosted server, then caches the returned token locally — see
// electron/license-manager.js).
router.post('/login', hostedOnly, async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email and password are required' });

  const account = await accountsRepo.getAccountByEmail(email.toLowerCase());
  if (!account || !(await verifyPassword(password, account.password_hash))) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const wantsLicense = req.body.client === 'electron';
  const token = issueToken(account, wantsLicense ? 'license' : 'session');

  if (!wantsLicense) res.cookie('managram_session', token, COOKIE_OPTS);
  res.json({
    token,
    account: { id: account.id, email: account.email, status: account.subscription_status, isAdmin: account.is_admin },
  });
});

// GET /account/me
router.get('/me', hostedOnly, requireAccount, async (req, res) => {
  const account = await accountsRepo.getAccountById(req.accountId);
  if (!account) return res.status(404).json({ error: 'Account not found' });
  res.json({ account: { id: account.id, email: account.email, status: account.subscription_status, isAdmin: account.is_admin } });
});

// POST /account/refresh — re-issue a token with fresh status/override claims;
// Electron calls this opportunistically every few hours while online.
router.post('/refresh', hostedOnly, requireAccount, async (req, res) => {
  const account = await accountsRepo.getAccountById(req.accountId);
  if (!account) return res.status(404).json({ error: 'Account not found' });
  const wantsLicense = req.body.client === 'electron';
  const token = issueToken(account, wantsLicense ? 'license' : 'session');
  if (!wantsLicense) res.cookie('managram_session', token, COOKIE_OPTS);
  res.json({ token, status: account.subscription_status });
});

// POST /account/logout
router.post('/logout', hostedOnly, (req, res) => {
  res.clearCookie('managram_session');
  res.json({ success: true });
});

module.exports = router;
