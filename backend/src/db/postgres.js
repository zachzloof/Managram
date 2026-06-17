// Postgres backing for the hosted (multi-tenant) deployment only. Electron/
// local mode never touches this file — it keeps using better-sqlite3 via
// backend/src/database.js exactly as before.
//
// Scope note: this module owns the accounts/billing tables, which are new
// and self-contained. Fully migrating every existing tenant-data table
// (queue, schedules, folder_presets, media_ratings, tags, post_history, etc.)
// off raw better-sqlite3 calls and onto a dual SQLite/Postgres repository
// layer is a second, mechanically large pass (it touches the SQL in every
// existing route file) — tracked separately so it can be done carefully
// against a real Postgres instance rather than blind in this pass.

const { Pool } = require('pg');

let pool;

function getPool() {
  if (!pool) {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL is not set — required in hosted mode (APP_MODE=hosted)');
    }
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false },
    });
  }
  return pool;
}

const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS accounts (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email               text UNIQUE NOT NULL,
    password_hash       text NOT NULL,
    plan                text NOT NULL DEFAULT 'monthly',
    subscription_status text NOT NULL DEFAULT 'trialing',
    stripe_customer_id      text,
    stripe_subscription_id  text,
    trial_ends_at       timestamptz,
    is_admin            boolean NOT NULL DEFAULT false,
    access_override     text, -- NULL | 'force_allow' | 'force_deny'
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS billing_events (
    stripe_event_id  text PRIMARY KEY,
    type             text NOT NULL,
    account_id       uuid REFERENCES accounts(id),
    processed_at     timestamptz NOT NULL DEFAULT now(),
    raw_payload      jsonb
  );
`;

async function initializeHostedSchema() {
  const client = getPool();
  // gen_random_uuid() needs pgcrypto on older Postgres; Railway's managed
  // Postgres ships it enabled by default on 13+, but guard for older images.
  await client.query('CREATE EXTENSION IF NOT EXISTS pgcrypto;').catch(() => {});
  await client.query(SCHEMA_SQL);
}

module.exports = { getPool, initializeHostedSchema };
