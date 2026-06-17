const { getPool } = require('../db/postgres');

async function createAccount({ email, passwordHash, plan, trialEndsAt, isAdmin = false }) {
  const { rows } = await getPool().query(
    `INSERT INTO accounts (email, password_hash, plan, trial_ends_at, is_admin)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [email, passwordHash, plan || 'monthly', trialEndsAt, isAdmin]
  );
  return rows[0];
}

async function getAccountByEmail(email) {
  const { rows } = await getPool().query('SELECT * FROM accounts WHERE email = $1', [email]);
  return rows[0] || null;
}

async function getAccountById(id) {
  const { rows } = await getPool().query('SELECT * FROM accounts WHERE id = $1', [id]);
  return rows[0] || null;
}

async function getAccountByStripeCustomerId(customerId) {
  const { rows } = await getPool().query('SELECT * FROM accounts WHERE stripe_customer_id = $1', [customerId]);
  return rows[0] || null;
}

async function updateAccount(id, fields) {
  const keys = Object.keys(fields);
  if (keys.length === 0) return getAccountById(id);
  const setClause = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');
  const { rows } = await getPool().query(
    `UPDATE accounts SET ${setClause}, updated_at = now() WHERE id = $1 RETURNING *`,
    [id, ...keys.map((k) => fields[k])]
  );
  return rows[0];
}

async function listAccounts() {
  const { rows } = await getPool().query('SELECT * FROM accounts ORDER BY created_at DESC');
  return rows;
}

async function setAccessOverride(id, override) {
  return updateAccount(id, { access_override: override });
}

// Idempotency guard for Stripe webhooks — returns false if this event was
// already processed (caller should skip side effects in that case).
async function recordBillingEventOnce(eventId, type, accountId, rawPayload) {
  const { rowCount } = await getPool().query(
    `INSERT INTO billing_events (stripe_event_id, type, account_id, raw_payload)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (stripe_event_id) DO NOTHING`,
    [eventId, type, accountId, rawPayload]
  );
  return rowCount > 0;
}

module.exports = {
  createAccount,
  getAccountByEmail,
  getAccountById,
  getAccountByStripeCustomerId,
  updateAccount,
  listAccounts,
  setAccessOverride,
  recordBillingEventOnce,
};
