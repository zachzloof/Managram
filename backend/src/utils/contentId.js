const fs = require('fs-extra');
const path = require('path');
const os = require('os');
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

// Lossless stream-copy remux that stamps the id as container metadata.
function writeVideoId(filePath, id) {
  return new Promise((resolve, reject) => {
    const ext = path.extname(filePath);
    const tmpPath = path.join(os.tmpdir(), `managram_stamp_${Date.now()}${ext}`);
    ffmpeg(filePath)
      .outputOptions(['-c', 'copy', '-map_metadata', '0', ...metadataOutputOptions(id)])
      .output(tmpPath)
      .on('end', async () => {
        try {
          await fs.move(tmpPath, filePath, { overwrite: true });
          resolve();
        } catch (err) {
          reject(err);
        }
      })
      .on('error', reject)
      .run();
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
  TAG_KEY,
};
