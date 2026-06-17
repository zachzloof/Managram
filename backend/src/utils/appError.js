const crypto = require('crypto');

// Short, greppable code attached to every unexpected-error response, so a
// user can report "ERR-A3F9C1" and that string can be searched for directly
// in server logs instead of guessing which request it was.
function generateErrorCode() {
  return 'ERR-' + crypto.randomBytes(3).toString('hex').toUpperCase();
}

// Standard error response for anything unexpected (as opposed to ordinary
// validation responses like "name is required", which don't need a code —
// the user already knows exactly what to fix). Logs full detail server-side
// and returns just the message + code to the client.
function sendError(res, err, context, status = 500) {
  const code = generateErrorCode();
  console.error(`[${code}]${context ? ' ' + context : ''}:`, err?.stack || err?.message || err);
  res.status(status).json({ error: err?.message || 'Something went wrong', code });
}

// Wraps an async (or sync) Express handler so a thrown error or rejected
// promise reaches Express's error-handling middleware via next(err), instead
// of leaving the request hanging forever — Express 4 does not catch async
// errors on its own, and several routes had no try/catch at all.
function asyncRoute(handler) {
  return (req, res, next) => {
    try {
      Promise.resolve(handler(req, res, next)).catch(next);
    } catch (err) {
      next(err);
    }
  };
}

module.exports = { generateErrorCode, sendError, asyncRoute };
