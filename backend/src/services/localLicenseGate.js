// In-process gate the Electron main process flips after checking in with
// the hosted license server (see electron/license-manager.js). The backend
// and Electron's main process share this same Node process (main.js does
// `require('../backend/src/index')`), so a plain in-memory flag is enough —
// no IPC needed.
//
// Defaults to open (true) so `node backend/src/index.js` keeps working for
// local development/testing without an Electron wrapper around it. The
// shipped Electron installer explicitly sets this to false at launch and
// only flips it true after a successful license check — this is a
// good-faith access gate for the distributed app, not DRM; per the design
// review, the threat model here is "forgot to cancel" / casual sharing, not
// a determined technical bypass, so a simple flag is the right amount of
// effort, not a half-measure.
let valid = true;

function setValid(value) {
  valid = !!value;
}

function isValid() {
  return valid;
}

module.exports = { setValid, isValid };
