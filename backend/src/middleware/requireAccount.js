const { verifyToken, hasAccess } = require('../services/auth');
const { isHostedMode } = require('../services/appMode');

// Single auth gate for the hosted deployment. Electron/local mode never
// mounts this — there's exactly one tenant per install and no other users
// to distinguish, so the local Express server stays open as it is today;
// the license gate lives in the Electron main process instead (see
// electron/license-manager.js), not here.
function requireAccount(req, res, next) {
  if (!isHostedMode()) return next();

  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : req.cookies?.managram_session;
  if (!token) return res.status(401).json({ error: 'Not logged in' });

  try {
    const claims = verifyToken(token);
    if (!hasAccess(claims)) {
      return res.status(402).json({ error: 'Subscription required', status: claims.status });
    }
    req.account = claims;
    req.accountId = claims.accountId;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }
}

function requireAdmin(req, res, next) {
  if (!req.account?.isAdmin) return res.status(403).json({ error: 'Admin access required' });
  next();
}

module.exports = { requireAccount, requireAdmin };
