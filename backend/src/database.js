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

    CREATE TABLE IF NOT EXISTS media_identity (
      content_id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL DEFAULT 'local',
      first_subpath TEXT,
      first_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_subpath TEXT,
      last_seen_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS post_history (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL DEFAULT 'local',
      content_id TEXT,
      instagram_post_id TEXT,
      media_type TEXT NOT NULL,
      caption TEXT,
      subpath_at_post_time TEXT,
      posted_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS post_metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id TEXT NOT NULL DEFAULT 'local',
      post_history_id TEXT NOT NULL,
      fetched_at TEXT NOT NULL DEFAULT (datetime('now')),
      like_count INTEGER,
      comments_count INTEGER,
      reach INTEGER,
      impressions INTEGER,
      plays INTEGER
    );

    CREATE TABLE IF NOT EXISTS account_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id TEXT NOT NULL DEFAULT 'local',
      fetched_at TEXT NOT NULL DEFAULT (datetime('now')),
      followers_count INTEGER,
      media_count INTEGER
    );

    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id TEXT NOT NULL DEFAULT 'local',
      name TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#f5610c',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(account_id, name)
    );

    CREATE TABLE IF NOT EXISTS media_tags (
      content_id TEXT NOT NULL,
      tag_id INTEGER NOT NULL,
      account_id TEXT NOT NULL DEFAULT 'local',
      PRIMARY KEY (content_id, tag_id)
    );

    CREATE INDEX IF NOT EXISTS idx_media_identity_subpath ON media_identity (account_id, last_subpath);
    CREATE INDEX IF NOT EXISTS idx_post_history_content_id ON post_history (account_id, content_id);
    CREATE INDEX IF NOT EXISTS idx_post_metrics_history_id ON post_metrics (post_history_id);
  `);

  // Migrations: add columns that may not exist in older DBs
  const queueCols = db.pragma('table_info(queue)').map(c => c.name);
  if (!queueCols.includes('error_message')) {
    db.exec('ALTER TABLE queue ADD COLUMN error_message TEXT');
  }

  const ratingCols = db.pragma('table_info(media_ratings)').map(c => c.name);
  if (!ratingCols.includes('content_id')) {
    db.exec('ALTER TABLE media_ratings ADD COLUMN content_id TEXT');
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

function getRatingsForContentIds(contentIds) {
  if (!contentIds.length) return {};
  const db = getDb();
  const placeholders = contentIds.map(() => '?').join(',');
  const rows = db.prepare(`SELECT content_id, rating FROM media_ratings WHERE content_id IN (${placeholders})`).all(contentIds);
  const result = {};
  for (const row of rows) result[row.content_id] = row.rating;
  return result;
}

function setRating(subpath, rating, contentId) {
  const db = getDb();
  if (rating === 0) {
    db.prepare('DELETE FROM media_ratings WHERE subpath = ?').run(subpath);
  } else {
    db.prepare('INSERT OR REPLACE INTO media_ratings (subpath, rating, content_id) VALUES (?, ?, ?)').run(subpath, rating, contentId || null);
  }
}

// ── Content identity ─────────────────────────────────────────────────────

function getIdentityBySubpath(accountId, subpath) {
  const db = getDb();
  return db.prepare('SELECT * FROM media_identity WHERE account_id = ? AND last_subpath = ?').get(accountId, subpath);
}

function getIdentitiesBySubpaths(accountId, subpaths) {
  if (!subpaths.length) return {};
  const db = getDb();
  const placeholders = subpaths.map(() => '?').join(',');
  const rows = db
    .prepare(`SELECT * FROM media_identity WHERE account_id = ? AND last_subpath IN (${placeholders})`)
    .all(accountId, ...subpaths);
  const result = {};
  for (const row of rows) result[row.last_subpath] = row;
  return result;
}

function getIdentity(contentId) {
  const db = getDb();
  return db.prepare('SELECT * FROM media_identity WHERE content_id = ?').get(contentId);
}

function upsertIdentity(accountId, contentId, subpath) {
  const db = getDb();
  const existing = getIdentity(contentId);
  if (existing) {
    db.prepare('UPDATE media_identity SET last_subpath = ?, last_seen_at = datetime(\'now\') WHERE content_id = ?').run(subpath, contentId);
  } else {
    db.prepare(
      `INSERT INTO media_identity (content_id, account_id, first_subpath, last_subpath) VALUES (?, ?, ?, ?)`
    ).run(contentId, accountId, subpath, subpath);
  }
}

// ── Post history & metrics ───────────────────────────────────────────────

function insertPostHistory(row) {
  const db = getDb();
  db.prepare(
    `INSERT INTO post_history (id, account_id, content_id, instagram_post_id, media_type, caption, subpath_at_post_time, posted_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`
  ).run(row.id, row.accountId, row.contentId, row.instagramPostId, row.mediaType, row.caption || '', row.subpath);
}

function getPostHistoryForContentIds(accountId, contentIds) {
  if (!contentIds.length) return [];
  const db = getDb();
  const placeholders = contentIds.map(() => '?').join(',');
  return db
    .prepare(`SELECT * FROM post_history WHERE account_id = ? AND content_id IN (${placeholders}) ORDER BY posted_at DESC`)
    .all(accountId, ...contentIds);
}

function getAllPostHistory(accountId, limit = 200) {
  const db = getDb();
  return db.prepare('SELECT * FROM post_history WHERE account_id = ? ORDER BY posted_at DESC LIMIT ?').all(accountId, limit);
}

function getPostHistoryById(id) {
  const db = getDb();
  return db.prepare('SELECT * FROM post_history WHERE id = ?').get(id);
}

function insertPostMetrics(row) {
  const db = getDb();
  db.prepare(
    `INSERT INTO post_metrics (account_id, post_history_id, like_count, comments_count, reach, impressions, plays)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(row.accountId, row.postHistoryId, row.likeCount ?? null, row.commentsCount ?? null, row.reach ?? null, row.impressions ?? null, row.plays ?? null);
}

function getLatestMetrics(postHistoryIds) {
  if (!postHistoryIds.length) return {};
  const db = getDb();
  const placeholders = postHistoryIds.map(() => '?').join(',');
  const rows = db
    .prepare(
      `SELECT pm.* FROM post_metrics pm
       WHERE pm.post_history_id IN (${placeholders})
       AND pm.fetched_at = (SELECT MAX(fetched_at) FROM post_metrics WHERE post_history_id = pm.post_history_id)`
    )
    .all(...postHistoryIds);
  const result = {};
  for (const row of rows) result[row.post_history_id] = row;
  return result;
}

function getMetricsHistoryForPost(postHistoryId) {
  const db = getDb();
  return db.prepare('SELECT * FROM post_metrics WHERE post_history_id = ? ORDER BY fetched_at ASC').all(postHistoryId);
}

function insertAccountSnapshot(accountId, followersCount, mediaCount) {
  const db = getDb();
  db.prepare('INSERT INTO account_snapshots (account_id, followers_count, media_count) VALUES (?, ?, ?)').run(
    accountId, followersCount ?? null, mediaCount ?? null
  );
}

function getAccountSnapshots(accountId, limit = 90) {
  const db = getDb();
  return db
    .prepare('SELECT * FROM account_snapshots WHERE account_id = ? ORDER BY fetched_at DESC LIMIT ?')
    .all(accountId, limit);
}

// ── Tags ──────────────────────────────────────────────────────────────────

function listTags(accountId) {
  const db = getDb();
  return db.prepare('SELECT * FROM tags WHERE account_id = ? ORDER BY name COLLATE NOCASE').all(accountId);
}

function createTag(accountId, name, color) {
  const db = getDb();
  const info = db
    .prepare('INSERT INTO tags (account_id, name, color) VALUES (?, ?, ?)')
    .run(accountId, name, color || '#f5610c');
  return db.prepare('SELECT * FROM tags WHERE id = ?').get(info.lastInsertRowid);
}

function deleteTag(accountId, tagId) {
  const db = getDb();
  db.prepare('DELETE FROM media_tags WHERE tag_id = ? AND account_id = ?').run(tagId, accountId);
  db.prepare('DELETE FROM tags WHERE id = ? AND account_id = ?').run(tagId, accountId);
}

function addMediaTag(accountId, contentId, tagId) {
  const db = getDb();
  db.prepare('INSERT OR IGNORE INTO media_tags (content_id, tag_id, account_id) VALUES (?, ?, ?)').run(contentId, tagId, accountId);
}

function removeMediaTag(accountId, contentId, tagId) {
  const db = getDb();
  db.prepare('DELETE FROM media_tags WHERE content_id = ? AND tag_id = ? AND account_id = ?').run(contentId, tagId, accountId);
}

function getTagsForContentIds(accountId, contentIds) {
  if (!contentIds.length) return {};
  const db = getDb();
  const placeholders = contentIds.map(() => '?').join(',');
  const rows = db
    .prepare(
      `SELECT mt.content_id, t.* FROM media_tags mt
       JOIN tags t ON t.id = mt.tag_id
       WHERE mt.account_id = ? AND mt.content_id IN (${placeholders})`
    )
    .all(accountId, ...contentIds);
  const result = {};
  for (const row of rows) {
    if (!result[row.content_id]) result[row.content_id] = [];
    result[row.content_id].push({ id: row.id, name: row.name, color: row.color });
  }
  return result;
}

function getContentIdsForTag(accountId, tagId) {
  const db = getDb();
  return db.prepare('SELECT content_id FROM media_tags WHERE account_id = ? AND tag_id = ?').all(accountId, tagId).map((r) => r.content_id);
}

// ── Analytics ─────────────────────────────────────────────────────────────

function getPostsWithLatestMetrics(accountId, limit = 50) {
  const db = getDb();
  return db
    .prepare(
      `SELECT ph.*, pm.like_count, pm.comments_count, pm.fetched_at AS metrics_fetched_at
       FROM post_history ph
       LEFT JOIN post_metrics pm ON pm.post_history_id = ph.id
         AND pm.fetched_at = (SELECT MAX(fetched_at) FROM post_metrics WHERE post_history_id = ph.id)
       WHERE ph.account_id = ?
       ORDER BY ph.posted_at DESC
       LIMIT ?`
    )
    .all(accountId, limit);
}

function getTagPerformance(accountId) {
  const db = getDb();
  return db
    .prepare(
      `SELECT t.id AS tag_id, t.name, t.color,
              COUNT(DISTINCT ph.id) AS post_count,
              AVG(pm.like_count) AS avg_likes,
              AVG(pm.comments_count) AS avg_comments
       FROM tags t
       JOIN media_tags mt ON mt.tag_id = t.id AND mt.account_id = t.account_id
       JOIN post_history ph ON ph.content_id = mt.content_id AND ph.account_id = t.account_id
       LEFT JOIN post_metrics pm ON pm.post_history_id = ph.id
         AND pm.fetched_at = (SELECT MAX(fetched_at) FROM post_metrics WHERE post_history_id = ph.id)
       WHERE t.account_id = ?
       GROUP BY t.id
       ORDER BY avg_likes DESC`
    )
    .all(accountId);
}

function getEngagementByHour(accountId) {
  const db = getDb();
  return db
    .prepare(
      `SELECT CAST(strftime('%H', ph.posted_at) AS INTEGER) AS hour,
              AVG(COALESCE(pm.like_count, 0) + COALESCE(pm.comments_count, 0)) AS avg_engagement,
              COUNT(*) AS n
       FROM post_history ph
       JOIN post_metrics pm ON pm.post_history_id = ph.id
         AND pm.fetched_at = (SELECT MAX(fetched_at) FROM post_metrics WHERE post_history_id = ph.id)
       WHERE ph.account_id = ?
       GROUP BY hour
       ORDER BY avg_engagement DESC`
    )
    .all(accountId);
}

module.exports = {
  getDb,
  getSetting,
  setSetting,
  getAllSettings,
  getRatingsForSubpaths,
  getRatingsForContentIds,
  setRating,
  getIdentityBySubpath,
  getIdentitiesBySubpaths,
  getIdentity,
  upsertIdentity,
  insertPostHistory,
  getPostHistoryForContentIds,
  getAllPostHistory,
  getPostHistoryById,
  insertPostMetrics,
  getLatestMetrics,
  getMetricsHistoryForPost,
  insertAccountSnapshot,
  getAccountSnapshots,
  listTags,
  createTag,
  deleteTag,
  addMediaTag,
  removeMediaTag,
  getTagsForContentIds,
  getContentIdsForTag,
  getPostsWithLatestMetrics,
  getTagPerformance,
  getEngagementByHour,
};
