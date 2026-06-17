// Explicit deployment-mode flag — mirrors the existing isR2Mode() pattern in
// services/r2.js. Hosted (Railway, multi-tenant, Postgres-backed accounts)
// vs local (Electron, single-tenant, SQLite) is decided by this flag alone,
// rather than inferred from "did a JWT verify" or other implicit signals.
function isHostedMode() {
  return process.env.APP_MODE === 'hosted';
}

module.exports = { isHostedMode };
