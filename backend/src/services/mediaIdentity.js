const path = require('path');
const crypto = require('crypto');
const fs = require('fs-extra');
const mime = require('mime-types');

const {
  getSetting,
  getIdentityBySubpath,
  getIdentitiesBySubpaths,
  upsertIdentity,
  insertPostHistory,
} = require('../database');
const contentIdUtil = require('../utils/contentId');
const r2 = require('./r2');

function toSubpath(mediaPathOrKey) {
  if (r2.isR2Mode()) return mediaPathOrKey;
  const contentFolder = getSetting('content_folder_path') || '';
  if (!contentFolder) return mediaPathOrKey;
  return path.relative(contentFolder, mediaPathOrKey).replace(/\\/g, '/');
}

// Read-or-create. Lazily stamps the file the first time it's touched
// (tag/rating/post) — never on a plain library listing. Falls back to
// null (caller should fall back to subpath-based behavior) on any failure
// or unsupported format.
async function resolveContentId(mediaPathOrKey, accountId = 'local') {
  const ext = path.extname(mediaPathOrKey);
  if (!contentIdUtil.isStampable(ext)) return null;
  const subpath = toSubpath(mediaPathOrKey);

  const cached = getIdentityBySubpath(accountId, subpath);
  if (cached) return cached.content_id;

  if (r2.isR2Mode()) {
    let tmpPath;
    try {
      tmpPath = await r2.downloadToTemp(mediaPathOrKey);
      const existing = await contentIdUtil.readContentId(tmpPath, ext);
      if (existing) {
        upsertIdentity(accountId, existing, subpath);
        return existing;
      }
      const id = crypto.randomUUID();
      await contentIdUtil.writeContentId(tmpPath, ext, id);
      const contentType = mime.lookup(tmpPath) || 'application/octet-stream';
      await r2.uploadStream(mediaPathOrKey, fs.createReadStream(tmpPath), contentType);
      upsertIdentity(accountId, id, subpath);
      return id;
    } catch (err) {
      console.warn('[mediaIdentity] R2 resolveContentId failed:', err.message);
      return null;
    } finally {
      if (tmpPath) fs.unlink(tmpPath, () => {});
    }
  }

  try {
    const existing = await contentIdUtil.readContentId(mediaPathOrKey, ext);
    if (existing) {
      upsertIdentity(accountId, existing, subpath);
      return existing;
    }
    const id = crypto.randomUUID();
    await contentIdUtil.writeContentId(mediaPathOrKey, ext, id);
    upsertIdentity(accountId, id, subpath);
    return id;
  } catch (err) {
    console.warn('[mediaIdentity] resolveContentId failed:', err.message);
    return null;
  }
}

// Read-only check — does this file already carry an id? Used by trim/crop
// so they only propagate an id forward when one already exists, and never
// trigger a write of their own (the caller's own ffmpeg pass handles that).
async function peekContentId(mediaPathOrKey) {
  const ext = path.extname(mediaPathOrKey);
  if (!contentIdUtil.isStampable(ext)) return null;
  try {
    return await contentIdUtil.readContentId(mediaPathOrKey, ext);
  } catch (err) {
    console.warn('[mediaIdentity] peekContentId failed:', err.message);
    return null;
  }
}

// Updates the subpath cache to point an existing id at a new location —
// called after trim (overwrite) / crop (new file) once the output already
// carries the id (stamped via contentId.metadataOutputOptions in the same
// ffmpeg pass that did the edit).
function relinkIdentity(accountId, existingContentId, newMediaPathOrKey) {
  if (!existingContentId) return;
  upsertIdentity(accountId, existingContentId, toSubpath(newMediaPathOrKey));
}

function batchResolveCachedIdentities(accountId, subpaths) {
  return getIdentitiesBySubpaths(accountId, subpaths);
}

// Pure cache update for rename — no file I/O. If the file was never
// touched (tagged/rated/posted) there's nothing cached and this is a no-op;
// its embedded tag (if any) is still intact under the new name regardless,
// and will resolve correctly the next time it's touched.
function relinkBySubpathIfCached(accountId, oldMediaPathOrKey, newMediaPathOrKey) {
  const oldSubpath = toSubpath(oldMediaPathOrKey);
  const cached = getIdentityBySubpath(accountId, oldSubpath);
  if (!cached) return;
  upsertIdentity(accountId, cached.content_id, toSubpath(newMediaPathOrKey));
}

async function recordPublishedPost({ mediaPathOrKey, instagramPostId, mediaType, caption, accountId = 'local' }) {
  const contentId = await resolveContentId(mediaPathOrKey, accountId);
  const id = crypto.randomUUID();
  insertPostHistory({
    id,
    accountId,
    contentId,
    instagramPostId,
    mediaType,
    caption,
    subpath: toSubpath(mediaPathOrKey),
  });
  return { id, contentId };
}

module.exports = {
  toSubpath,
  resolveContentId,
  peekContentId,
  relinkIdentity,
  relinkBySubpathIfCached,
  batchResolveCachedIdentities,
  recordPublishedPost,
};
