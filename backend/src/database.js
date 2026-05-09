const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs-extra');

let db;

function getDb() {
  if (!db) {
    const dbPath = process.env.DB_PATH || path.join(__dirname, '../../managram.db');
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initializeSchema(db);
  }
  return db;
}

function initializeSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS queue (
      id TEXT PRIMARY KEY,
      media_path TEXT NOT NULL,
      media_type TEXT NOT NULL DEFAULT 'IMAGE',
      caption TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      scheduled_at TEXT,
      posted_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS schedules (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      time TEXT NOT NULL,
      days TEXT NOT NULL DEFAULT '[]',
      caption_template TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS folder_presets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      path TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS media_ratings (
      subpath TEXT PRIMARY KEY,
      rating  INTEGER NOT NULL
    );
  `);

  // Migrations: add columns that may not exist in older DBs
  const queueCols = db.pragma('table_info(queue)').map(c => c.name);
  if (!queueCols.includes('error_message')) {
    db.exec('ALTER TABLE queue ADD COLUMN error_message TEXT');
  }

  // Insert default settings keys if they don't exist
  const defaultSettings = [
    'instagram_access_token',
    'instagram_user_id',
    'instagram_username',
    'instagram_profile_picture',
    'content_folder_path',
    'openai_api_key',
    'public_url',
    'app_id',
    'app_secret',
    'ngrok_authtoken',
  ];

  const insertSetting = db.prepare(
    `INSERT OR IGNORE INTO settings (key, value) VALUES (?, '')`
  );
  for (const key of defaultSettings) {
    insertSetting.run(key);
  }
}

function getSetting(key) {
  const db = getDb();
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : null;
}

function setSetting(key, value) {
  const db = getDb();
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);
}

function getAllSettings() {
  const db = getDb();
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const result = {};
  for (const row of rows) {
    result[row.key] = row.value;
  }
  return result;
}

function getRatingsForSubpaths(subpaths) {
  if (!subpaths.length) return {};
  const db = getDb();
  const placeholders = subpaths.map(() => '?').join(',');
  const rows = db.prepare(`SELECT subpath, rating FROM media_ratings WHERE subpath IN (${placeholders})`).all(subpaths);
  const result = {};
  for (const row of rows) result[row.subpath] = row.rating;
  return result;
}

function setRating(subpath, rating) {
  const db = getDb();
  if (rating === 0) {
    db.prepare('DELETE FROM media_ratings WHERE subpath = ?').run(subpath);
  } else {
    db.prepare('INSERT OR REPLACE INTO media_ratings (subpath, rating) VALUES (?, ?)').run(subpath, rating);
  }
}

module.exports = { getDb, getSetting, setSetting, getAllSettings, getRatingsForSubpaths, setRating };
