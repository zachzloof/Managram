const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');
const piexif = require('piexifjs');
const extractChunks = require('png-chunks-extract');
const encodeChunks = require('png-chunks-encode');
const textChunk = require('png-chunk-text');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const ffprobePath = require('ffprobe-static').path;

ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

const VIDEO_EXTS = ['.mp4', '.mov'];
const STAMPABLE_EXTS = ['.jpg', '.jpeg', '.png', '.mp4', '.mov'];
const TAG_KEY = 'managram_id';
const ID_PATTERN = /managram_id:([a-f0-9-]{36})/i;

function isVideoExt(ext) {
  return VIDEO_EXTS.includes(ext.toLowerCase());
}

function isStampable(ext) {
  return STAMPABLE_EXTS.includes(ext.toLowerCase());
}

function atomicReplace(filePath, buffer) {
  const tmpPath = path.join(path.dirname(filePath), `.managram_tmp_${Date.now()}${path.extname(filePath)}`);
  fs.writeFileSync(tmpPath, buffer);
  fs.moveSync(tmpPath, filePath, { overwrite: true });
}

// ---- JPEG (EXIF UserComment) ----

function readJpegId(filePath) {
  const data = fs.readFileSync(filePath, 'binary');
  let exifObj;
  try {
    exifObj = piexif.load(data);
  } catch {
    return null;
  }
  const comment = exifObj?.Exif?.[piexif.ExifIFD.UserComment];
  if (!comment) return null;
  const match = ID_PATTERN.exec(comment);
  return match ? match[1] : null;
}

function writeJpegId(filePath, id) {
  const data = fs.readFileSync(filePath, 'binary');
  let exifObj;
  try {
    exifObj = piexif.load(data);
  } catch {
    exifObj = { '0th': {}, Exif: {}, GPS: {} };
  }
  exifObj.Exif = exifObj.Exif || {};
  exifObj.Exif[piexif.ExifIFD.UserComment] = `managram_id:${id}`;
  const exifBytes = piexif.dump(exifObj);
  const newData = piexif.insert(exifBytes, data);
  atomicReplace(filePath, Buffer.from(newData, 'binary'));
}

// ---- PNG (custom tEXt chunk) ----

function readPngId(filePath) {
  const buffer = fs.readFileSync(filePath);
  let chunks;
  try {
    chunks = extractChunks(buffer);
  } catch {
    return null;
  }
  for (const chunk of chunks) {
    if (chunk.name !== 'tEXt') continue;
    const { keyword, text } = textChunk.decode(chunk.data);
    if (keyword === TAG_KEY) return text;
  }
  return null;
}

function writePngId(filePath, id) {
  const buffer = fs.readFileSync(filePath);
  const chunks = extractChunks(buffer);
  const filtered = chunks.filter((c) => {
    if (c.name !== 'tEXt') return true;
    const { keyword } = textChunk.decode(c.data);
    return keyword !== TAG_KEY;
  });
  const newChunk = textChunk.encode(TAG_KEY, id); // already a { name: 'tEXt', data } chunk object
  const iendIndex = filtered.findIndex((c) => c.name === 'IEND');
  filtered.splice(iendIndex === -1 ? filtered.length : iendIndex, 0, newChunk);
  atomicReplace(filePath, Buffer.from(encodeChunks(filtered)));
}

// ---- Video (container metadata) ----

function readVideoId(filePath) {
  return new Promise((resolve) => {
    ffmpeg.ffprobe(filePath, (err, data) => {
      if (err) return resolve(null);
      const tags = data?.format?.tags || {};
      const key = Object.keys(tags).find((k) => k.toLowerCase() === TAG_KEY);
      resolve(key ? tags[key] : null);
    });
  });
}

function probeDuration(filePath) {
  return new Promise((resolve) => {
    ffmpeg.ffprobe(filePath, (err, data) => {
      if (err) return resolve(null);
      const duration = parseFloat(data?.format?.duration);
      resolve(isFinite(duration) ? duration : null);
    });
  });
}

// Sanity check that ffmpeg actually produced something plausible before it's
// ever allowed to replace a real file — "ffmpeg exited without an error" is
// not the same guarantee as "the output is intact." Compares duration
// against an expected value (the original's own duration for a lossless
// remux, or a target duration for a trim) within a generous tolerance.
// Returns true (skip the check) if the expected duration couldn't be
// determined at all, rather than blocking the whole operation on that edge
// case — the much more common failure mode this guards against is a remux
// that silently truncated or corrupted the stream, not an unreadable input.
async function verifyVideoDuration(candidatePath, expectedDurationSeconds, toleranceSeconds = 1) {
  if (expectedDurationSeconds == null) return true;
  const actual = await probeDuration(candidatePath);
  if (actual == null) return false;
  return Math.abs(actual - expectedDurationSeconds) <= toleranceSeconds;
}

// Lossless stream-copy remux that stamps the id as container metadata.
// The temp file lives *next to* the original (not the OS temp folder) so
// the final swap is a same-volume atomic rename, not a cross-device
// copy-then-delete that could leave a half-written file in the original's
// place if interrupted partway through.
function writeVideoId(filePath, id) {
  return new Promise((resolve, reject) => {
    const ext = path.extname(filePath);
    const tmpPath = path.join(path.dirname(filePath), `.managram_stamp_${Date.now()}${ext}`);
    probeDuration(filePath).then((originalDuration) => {
      ffmpeg(filePath)
        .outputOptions(['-c', 'copy', '-map_metadata', '0', ...metadataOutputOptions(id)])
        .output(tmpPath)
        .on('end', async () => {
          try {
            const ok = await verifyVideoDuration(tmpPath, originalDuration);
            if (!ok) {
              await fs.unlink(tmpPath).catch(() => {});
              throw new Error('Stamped file failed verification (duration mismatch) — original left untouched');
            }
            await fs.move(tmpPath, filePath, { overwrite: true });
            resolve();
          } catch (err) {
            reject(err);
          }
        })
        .on('error', reject)
        .run();
    });
  });
}

// Stamps id directly into an ffmpeg output-options array, for callers (trim/crop)
// that are already running their own ffmpeg pass — avoids a second remux entirely.
// The mp4/mov muxer silently drops any metadata key it doesn't recognize as a
// standard tag unless `movflags +use_metadata_tags` is set — found by testing
// the round trip directly, not by reading ffmpeg's docs closely enough the
// first time. Passed as its own `-movflags` occurrence (with a `+` prefix) so
// it adds to, rather than clobbers, any movflags the caller already set.
function metadataOutputOptions(id) {
  return ['-movflags', '+use_metadata_tags', '-metadata', `${TAG_KEY}=${id}`];
}

async function readContentId(filePath, ext) {
  const e = (ext || path.extname(filePath)).toLowerCase();
  try {
    if (e === '.jpg' || e === '.jpeg') return readJpegId(filePath);
    if (e === '.png') return readPngId(filePath);
    if (isVideoExt(e)) return await readVideoId(filePath);
  } catch (err) {
    console.warn('[contentId] read failed:', err.message);
  }
  return null;
}

async function writeContentId(filePath, ext, id) {
  const e = (ext || path.extname(filePath)).toLowerCase();
  if (e === '.jpg' || e === '.jpeg') return writeJpegId(filePath, id);
  if (e === '.png') return writePngId(filePath, id);
  if (isVideoExt(e)) return writeVideoId(filePath, id);
  throw new Error(`Unsupported extension for content id: ${e}`);
}

// Read-or-create. Returns null (never throws) if the format isn't stampable
// or the write fails — callers must fall back to subpath-based identity.
async function ensureContentId(filePath, ext) {
  const e = (ext || path.extname(filePath)).toLowerCase();
  if (!isStampable(e)) return null;
  try {
    const existing = await readContentId(filePath, e);
    if (existing) return existing;
    const id = crypto.randomUUID();
    await writeContentId(filePath, e, id);
    return id;
  } catch (err) {
    console.warn('[contentId] ensureContentId failed:', err.message);
    return null;
  }
}

module.exports = {
  readContentId,
  writeContentId,
  ensureContentId,
  isStampable,
  isVideoExt,
  metadataOutputOptions,
  probeDuration,
  verifyVideoDuration,
  TAG_KEY,
};
