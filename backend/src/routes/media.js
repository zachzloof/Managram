const express = require('express');
const path = require('path');
const fs = require('fs-extra');
const mime = require('mime-types');
const multer = require('multer');
const os = require('os');
const { getSetting, setSetting, getRatingsForSubpaths, getRatingsForContentIds, setRating, getTagsForContentIds } = require('../database');
const r2 = require('../services/r2');
const mediaIdentity = require('../services/mediaIdentity');
const contentIdUtil = require('../utils/contentId');

const router = express.Router();

// TODO(Part 5): replace with req.accountId from auth middleware once accounts land.
const ACCOUNT_ID = 'local';

const SUPPORTED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.mp4', '.mov'];
const VIDEO_EXTENSIONS = ['.mp4', '.mov'];

function isMediaFile(filename) {
  return SUPPORTED_EXTENSIONS.includes(path.extname(filename).toLowerCase());
}

function getMediaType(filename) {
  return VIDEO_EXTENSIONS.includes(path.extname(filename).toLowerCase()) ? 'video' : 'image';
}

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── Local filesystem helpers ────────────────────────────────────────────────

async function buildFileEntry(rootFolder, filePath, relPath) {
  const stats = await fs.stat(filePath);
  const type = getMediaType(filePath);
  const encoded = relPath.split('/').map(encodeURIComponent).join('/');
  return {
    name: path.basename(filePath),
    subpath: relPath,
    path: filePath,
    type,
    size: stats.size,
    sizeFormatted: formatFileSize(stats.size),
    url: `/media/file/${encoded}`,
    thumbnail: type === 'image' ? `/media/file/${encoded}` : null,
    modifiedAt: stats.mtime.toISOString(),
  };
}

async function collectRecursive(rootFolder, dir, relBase) {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const files = [];
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const entryPath = path.join(dir, entry.name);
    const relPath = relBase ? `${relBase}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      files.push(...(await collectRecursive(rootFolder, entryPath, relPath)));
    } else if (entry.isFile() && isMediaFile(entry.name)) {
      try {
        files.push(await buildFileEntry(rootFolder, entryPath, relPath));
      } catch {
        // skip files we can't stat (e.g. iCloud placeholders, permission-denied)
      }
    }
  }
  return files;
}

// ── R2 helpers ──────────────────────────────────────────────────────────────

function buildR2FileEntry(obj) {
  const name = path.basename(obj.key);
  const type = getMediaType(obj.key);
  const publicUrl = r2.getPublicUrl(obj.key);
  return {
    name,
    subpath: obj.key,
    path: obj.key,
    type,
    size: obj.size,
    sizeFormatted: formatFileSize(obj.size),
    url: publicUrl,
    thumbnail: type === 'image' ? publicUrl : null,
    modifiedAt: obj.lastModified ? new Date(obj.lastModified).toISOString() : new Date().toISOString(),
  };
}

// Attaches rating + tags + content_id to each file entry. Only reads the
// subpath -> content_id cache (a DB lookup) — never reads or stamps file
// metadata here, so plain library listing stays fast even for large folders.
function attachRatings(files) {
  const legacyRatings = getRatingsForSubpaths(files.map((f) => f.subpath));
  const identities = mediaIdentity.batchResolveCachedIdentities(ACCOUNT_ID, files.map((f) => f.subpath));
  const contentIds = files
    .map((f) => identities[f.subpath]?.content_id)
    .filter(Boolean);
  const ratingsById = getRatingsForContentIds(contentIds);
  const tagsById = getTagsForContentIds(ACCOUNT_ID, contentIds);

  return files.map((f) => {
    const contentId = identities[f.subpath]?.content_id || null;
    const rating = contentId && ratingsById[contentId] != null ? ratingsById[contentId] : (legacyRatings[f.subpath] || 0);
    return {
      ...f,
      contentId,
      rating,
      tags: contentId ? (tagsById[contentId] || []) : [],
    };
  });
}

// ── Multer (disk storage → R2 or local) ────────────────────────────────────

const upload = multer({
  storage: multer.diskStorage({
    destination: os.tmpdir(),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `managram_upload_${Date.now()}${ext}`);
    },
  }),
  limits: { fileSize: 1024 * 1024 * 1024 }, // 1 GB
});

// ── Routes ──────────────────────────────────────────────────────────────────

// GET /media/files — list folders + media files
router.get('/files', async (req, res) => {
  try {
    const subpath = req.query.subpath || '';

    if (r2.isR2Mode()) {
      const prefix = subpath ? `${subpath}/` : '';
      const recursive = req.query.recursive === 'true';
      const objects = recursive
        ? await r2.listAllObjects(prefix)
        : await r2.listObjects(prefix);

      const folders = recursive
        ? []
        : objects
            .filter((o) => o.type === 'folder')
            .map((o) => {
              const stripped = o.prefix.slice(prefix.length);
              const name = stripped.endsWith('/') ? stripped.slice(0, -1) : stripped;
              const fullSubpath = o.prefix.endsWith('/') ? o.prefix.slice(0, -1) : o.prefix;
              return { name, subpath: fullSubpath };
            });

      const files = attachRatings(
        objects
          .filter((o) => o.type === 'file' && isMediaFile(o.key))
          .map(buildR2FileEntry)
          .sort((a, b) => new Date(b.modifiedAt) - new Date(a.modifiedAt))
      );

      return res.json({ folders, files });
    }

    // Local mode
    const rootFolder = getSetting('content_folder_path');
    if (!rootFolder) return res.json({ folders: [], files: [], error: 'Content folder not configured' });

    const targetDir = subpath
      ? path.resolve(rootFolder, subpath)
      : path.resolve(rootFolder);

    if (!targetDir.startsWith(path.resolve(rootFolder))) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const exists = await fs.pathExists(targetDir);
    if (!exists) return res.json({ folders: [], files: [], error: 'Folder not found' });

    if (req.query.recursive === 'true') {
      const files = attachRatings(
        (await collectRecursive(rootFolder, targetDir, subpath)).sort(
          (a, b) => new Date(b.modifiedAt) - new Date(a.modifiedAt)
        )
      );
      return res.json({ folders: [], files });
    }

    const entries = await fs.readdir(targetDir, { withFileTypes: true });
    const folders = [];
    const files = [];

    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      if (entry.isDirectory()) {
        folders.push({
          name: entry.name,
          subpath: subpath ? `${subpath}/${entry.name}` : entry.name,
        });
      } else if (entry.isFile() && isMediaFile(entry.name)) {
        const relPath = subpath ? `${subpath}/${entry.name}` : entry.name;
        try {
          files.push(await buildFileEntry(rootFolder, path.join(targetDir, entry.name), relPath));
        } catch {
          // skip files we can't stat (e.g. iCloud placeholders, permission-denied)
        }
      }
    }

    folders.sort((a, b) => a.name.localeCompare(b.name));
    files.sort((a, b) => new Date(b.modifiedAt) - new Date(a.modifiedAt));

    res.json({ folders, files: attachRatings(files) });
  } catch (err) {
    console.error('[Media] Error listing files:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /media/file/* — serve or redirect a file
router.get('/file/*', (req, res) => {
  const keyOrRel = req.params[0]
    .split('/')
    .map(decodeURIComponent)
    .join('/');

  if (r2.isR2Mode()) {
    return res.redirect(302, r2.getPublicUrl(keyOrRel));
  }

  const rootFolder = getSetting('content_folder_path');
  if (!rootFolder) return res.status(404).json({ error: 'Content folder not configured' });

  const filePath = path.resolve(rootFolder, keyOrRel.split('/').join(path.sep));
  if (!filePath.startsWith(path.resolve(rootFolder))) {
    return res.status(403).json({ error: 'Access denied' });
  }
  if (!fs.pathExistsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }

  const mimeType = mime.lookup(filePath) || 'application/octet-stream';
  const stats = fs.statSync(filePath);
  const fileSize = stats.size;

  if (mimeType.startsWith('video/') && req.headers.range) {
    const parts = req.headers.range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': end - start + 1,
      'Content-Type': mimeType,
    });
    fs.createReadStream(filePath, { start, end }).pipe(res);
  } else {
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Length', fileSize);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    fs.createReadStream(filePath).pipe(res);
  }
});

// POST /media/upload — upload a file to R2 or local content folder
router.post('/upload', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file provided' });

  const subpath = req.body.subpath || '';
  const originalName = req.file.originalname;
  const tmpPath = req.file.path;

  try {
    if (r2.isR2Mode()) {
      const key = subpath ? `${subpath}/${originalName}` : originalName;
      const contentType = mime.lookup(originalName) || 'application/octet-stream';
      await r2.uploadStream(key, fs.createReadStream(tmpPath), contentType);
      fs.unlink(tmpPath, () => {});
      return res.json({ success: true, key, url: r2.getPublicUrl(key) });
    }

    // Local mode: move to content folder
    const rootFolder = getSetting('content_folder_path');
    if (!rootFolder) {
      fs.unlink(tmpPath, () => {});
      return res.status(400).json({ error: 'Content folder not configured' });
    }

    const targetDir = subpath ? path.join(rootFolder, subpath) : rootFolder;
    await fs.ensureDir(targetDir);

    const targetPath = path.join(targetDir, originalName);
    await fs.move(tmpPath, targetPath, { overwrite: false });

    const relPath = path.relative(rootFolder, targetPath).replace(/\\/g, '/');
    const encoded = relPath.split('/').map(encodeURIComponent).join('/');
    return res.json({ success: true, key: relPath, url: `/media/file/${encoded}` });
  } catch (err) {
    fs.unlink(tmpPath, () => {});
    console.error('[Media] Upload error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /media/trim — trim a video
router.post('/trim', async (req, res) => {
  const { filePath, startTime, endTime } = req.body;

  if (!filePath || startTime == null || endTime == null) {
    return res.status(400).json({ error: 'filePath, startTime, and endTime are required' });
  }
  if (endTime <= startTime) {
    return res.status(400).json({ error: 'endTime must be greater than startTime' });
  }

  const ffmpeg = require('fluent-ffmpeg');
  const ffmpegPath = require('ffmpeg-static');
  ffmpeg.setFfmpegPath(ffmpegPath);

  if (r2.isR2Mode()) {
    const ext = path.extname(filePath);
    let tmpInput, tmpOutput;
    try {
      tmpInput = await r2.downloadToTemp(filePath);
      tmpOutput = path.join(os.tmpdir(), `managram_trim_${Date.now()}${ext}`);
      const existingId = await mediaIdentity.peekContentId(tmpInput);
      const outputOptions = ['-preset veryfast', '-crf 23', '-movflags +faststart'];
      if (existingId) outputOptions.push(...contentIdUtil.metadataOutputOptions(existingId));

      await new Promise((resolve, reject) => {
        ffmpeg(tmpInput)
          .setStartTime(startTime)
          .setDuration(endTime - startTime)
          .videoCodec('libx264')
          .audioCodec('aac')
          .outputOptions(outputOptions)
          .output(tmpOutput)
          .on('end', resolve)
          .on('error', reject)
          .run();
      });

      const verified = await contentIdUtil.verifyVideoDuration(tmpOutput, endTime - startTime, 1.5);
      if (!verified) {
        return res.status(500).json({ error: 'Trim verification failed — output duration did not match the requested trim. Original left untouched.' });
      }

      // Overwrite the same key
      const contentType = mime.lookup(tmpOutput) || 'video/mp4';
      await r2.uploadStream(filePath, fs.createReadStream(tmpOutput), contentType);
      if (existingId) mediaIdentity.relinkIdentity(ACCOUNT_ID, existingId, filePath);
      res.json({ success: true, filePath, fileName: path.basename(filePath) });
    } catch (err) {
      console.error('[Media] R2 trim error:', err.message);
      res.status(500).json({ error: err.message });
    } finally {
      if (tmpInput) fs.unlink(tmpInput, () => {});
      if (tmpOutput) fs.unlink(tmpOutput, () => {});
    }
    return;
  }

  // Local mode
  const rootFolder = getSetting('content_folder_path');
  if (!rootFolder) return res.status(400).json({ error: 'Content folder not configured' });

  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(path.resolve(rootFolder))) {
    return res.status(403).json({ error: 'Access denied' });
  }
  if (!fs.pathExistsSync(resolved)) {
    return res.status(404).json({ error: 'File not found' });
  }

  const ext = path.extname(resolved);
  // Sibling of the original (not the OS temp folder) so the final swap below
  // is a same-volume atomic rename rather than a cross-device copy that
  // could leave a half-written file in the original's place if interrupted.
  const tmpOutput = path.join(path.dirname(resolved), `.managram_trim_${Date.now()}${ext}`);

  try {
    const existingId = await mediaIdentity.peekContentId(resolved);
    const outputOptions = ['-preset veryfast', '-crf 23', '-movflags +faststart'];
    if (existingId) outputOptions.push(...contentIdUtil.metadataOutputOptions(existingId));

    await new Promise((resolve, reject) => {
      ffmpeg(resolved)
        .setStartTime(startTime)
        .setDuration(endTime - startTime)
        .videoCodec('libx264')
        .audioCodec('aac')
        .outputOptions(outputOptions)
        .output(tmpOutput)
        .on('end', resolve)
        .on('error', reject)
        .run();
    });

    // Don't trust "ffmpeg exited cleanly" alone — confirm the trimmed output
    // is actually close to the requested length before it's ever allowed to
    // replace the original.
    const expectedDuration = endTime - startTime;
    const verified = await contentIdUtil.verifyVideoDuration(tmpOutput, expectedDuration, 1.5);
    if (!verified) {
      fs.unlink(tmpOutput, () => {});
      return res.status(500).json({ error: 'Trim verification failed — output duration did not match the requested trim. Original left untouched.' });
    }

    // Replace original with trimmed output
    await fs.move(tmpOutput, resolved, { overwrite: true });
    if (existingId) mediaIdentity.relinkIdentity(ACCOUNT_ID, existingId, resolved);
    res.json({ success: true, filePath: resolved, fileName: path.basename(resolved) });
  } catch (err) {
    fs.unlink(tmpOutput, () => {});
    console.error('[Media] Trim error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /media/crop — crop a video
router.post('/crop', async (req, res) => {
  const { filePath, x, y, width, height } = req.body;

  if (!filePath || width == null || height == null) {
    return res.status(400).json({ error: 'filePath, width and height are required' });
  }

  const ffmpeg = require('fluent-ffmpeg');
  const ffmpegPath = require('ffmpeg-static');
  ffmpeg.setFfmpegPath(ffmpegPath);
  const cropFilter = `crop=${Math.round(width)}:${Math.round(height)}:${Math.round(x || 0)}:${Math.round(y || 0)}`;

  if (r2.isR2Mode()) {
    const ext = path.extname(filePath);
    const baseName = path.basename(filePath, ext);
    const dir = filePath.includes('/') ? filePath.substring(0, filePath.lastIndexOf('/') + 1) : '';
    const outputKey = `${dir}${baseName}_cropped${ext}`;

    let tmpInput, tmpOutput;
    try {
      tmpInput = await r2.downloadToTemp(filePath);
      tmpOutput = path.join(os.tmpdir(), `managram_crop_${Date.now()}${ext}`);
      const existingId = await mediaIdentity.peekContentId(tmpInput);
      const outputOptions = ['-c:a copy'];
      if (existingId) outputOptions.push(...contentIdUtil.metadataOutputOptions(existingId));

      await new Promise((resolve, reject) => {
        ffmpeg(tmpInput)
          .videoFilters(cropFilter)
          .outputOptions(outputOptions)
          .output(tmpOutput)
          .on('end', resolve)
          .on('error', reject)
          .run();
      });

      const contentType = mime.lookup(tmpOutput) || 'video/mp4';
      await r2.uploadStream(outputKey, fs.createReadStream(tmpOutput), contentType);
      if (existingId) mediaIdentity.relinkIdentity(ACCOUNT_ID, existingId, outputKey);
      res.json({ success: true, filePath: outputKey, fileName: path.basename(outputKey) });
    } catch (err) {
      console.error('[Media] R2 crop error:', err.message);
      res.status(500).json({ error: err.message });
    } finally {
      if (tmpInput) fs.unlink(tmpInput, () => {});
      if (tmpOutput) fs.unlink(tmpOutput, () => {});
    }
    return;
  }

  // Local mode
  const rootFolder = getSetting('content_folder_path');
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(path.resolve(rootFolder))) {
    return res.status(403).json({ error: 'Access denied' });
  }
  if (!fs.pathExistsSync(resolved)) {
    return res.status(404).json({ error: 'File not found' });
  }

  const dir = path.dirname(resolved);
  const ext = path.extname(resolved);
  const base = path.basename(resolved, ext);
  let outputPath = path.join(dir, `${base}_cropped${ext}`);
  let counter = 1;
  while (fs.pathExistsSync(outputPath)) {
    outputPath = path.join(dir, `${base}_cropped_${counter++}${ext}`);
  }

  try {
    const existingId = await mediaIdentity.peekContentId(resolved);
    const outputOptions = ['-c:a copy'];
    if (existingId) outputOptions.push(...contentIdUtil.metadataOutputOptions(existingId));

    await new Promise((resolve, reject) => {
      ffmpeg(resolved)
        .videoFilters(cropFilter)
        .outputOptions(outputOptions)
        .output(outputPath)
        .on('end', resolve)
        .on('error', reject)
        .run();
    });
    if (existingId) mediaIdentity.relinkIdentity(ACCOUNT_ID, existingId, outputPath);
    res.json({ success: true, filePath: outputPath, fileName: path.basename(outputPath) });
  } catch (err) {
    console.error('[Media] Crop error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /media/files — delete one or more files
router.delete('/files', async (req, res) => {
  const { filePaths } = req.body;
  if (!Array.isArray(filePaths) || filePaths.length === 0) {
    return res.status(400).json({ error: 'filePaths array is required' });
  }

  if (r2.isR2Mode()) {
    try {
      await r2.deleteObjects(filePaths);
      return res.json({
        deleted: filePaths.length,
        results: filePaths.map((k) => ({ filePath: k, success: true })),
      });
    } catch (err) {
      console.error('[Media] R2 delete error:', err.message);
      return res.status(500).json({ error: err.message });
    }
  }

  const rootFolder = getSetting('content_folder_path');
  const results = [];

  for (const filePath of filePaths) {
    const resolved = path.resolve(filePath);
    if (!resolved.startsWith(path.resolve(rootFolder))) {
      results.push({ filePath, error: 'Access denied' });
      continue;
    }
    if (!fs.pathExistsSync(resolved)) {
      results.push({ filePath, error: 'File not found' });
      continue;
    }
    try {
      await fs.remove(resolved);
      results.push({ filePath, success: true });
    } catch (err) {
      results.push({ filePath, error: err.message });
    }
  }

  const failed = results.filter((r) => r.error);
  if (failed.length === filePaths.length) {
    return res.status(500).json({ error: 'All deletions failed', results });
  }
  res.json({ deleted: results.filter((r) => r.success).length, results });
});

// PATCH /media/rename — rename a file
router.patch('/rename', async (req, res) => {
  const { filePath, newName } = req.body;
  if (!filePath || !newName) {
    return res.status(400).json({ error: 'filePath and newName are required' });
  }
  if (newName.includes('/') || newName.includes('\\') || newName.includes('..')) {
    return res.status(400).json({ error: 'Invalid file name' });
  }

  if (r2.isR2Mode()) {
    const dir = filePath.includes('/') ? filePath.substring(0, filePath.lastIndexOf('/') + 1) : '';
    const newKey = `${dir}${newName}`;
    try {
      await r2.renameObject(filePath, newKey);
      mediaIdentity.relinkBySubpathIfCached(ACCOUNT_ID, filePath, newKey);
      return res.json({ success: true, newPath: newKey, fileName: newName });
    } catch (err) {
      console.error('[Media] R2 rename error:', err.message);
      return res.status(500).json({ error: err.message });
    }
  }

  const rootFolder = getSetting('content_folder_path');
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(path.resolve(rootFolder))) {
    return res.status(403).json({ error: 'Access denied' });
  }
  if (!fs.pathExistsSync(resolved)) {
    return res.status(404).json({ error: 'File not found' });
  }

  const dir = path.dirname(resolved);
  const newPath = path.join(dir, newName);
  if (fs.pathExistsSync(newPath)) {
    return res.status(409).json({ error: 'A file with that name already exists' });
  }

  try {
    await fs.rename(resolved, newPath);
    mediaIdentity.relinkBySubpathIfCached(ACCOUNT_ID, resolved, newPath);
    res.json({ success: true, newPath, fileName: newName });
  } catch (err) {
    console.error('[Media] Rename error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /media/mkdir — create a subfolder
router.post('/mkdir', async (req, res) => {
  const { name, subpath } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  if (name.includes('/') || name.includes('\\') || name.includes('..')) {
    return res.status(400).json({ error: 'Invalid folder name' });
  }

  if (r2.isR2Mode()) {
    const key = subpath ? `${subpath}/${name}/.keep` : `${name}/.keep`;
    try {
      await r2.uploadBuffer(key, Buffer.alloc(0), 'application/octet-stream');
      const newSubpath = subpath ? `${subpath}/${name}` : name;
      return res.json({ success: true, name, subpath: newSubpath });
    } catch (err) {
      console.error('[Media] R2 mkdir error:', err.message);
      return res.status(500).json({ error: err.message });
    }
  }

  const rootFolder = getSetting('content_folder_path');
  if (!rootFolder) return res.status(400).json({ error: 'Content folder not configured' });

  const base = subpath ? path.resolve(rootFolder, subpath) : path.resolve(rootFolder);
  if (!base.startsWith(path.resolve(rootFolder))) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const newDir = path.join(base, name);
  if (!newDir.startsWith(path.resolve(rootFolder))) {
    return res.status(403).json({ error: 'Access denied' });
  }
  if (fs.pathExistsSync(newDir)) {
    return res.status(409).json({ error: 'A folder with that name already exists' });
  }

  try {
    await fs.mkdir(newDir);
    res.json({ success: true, name, subpath: subpath ? `${subpath}/${name}` : name });
  } catch (err) {
    console.error('[Media] mkdir error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /media/folder — set local content folder path (local mode only)
router.post('/folder', async (req, res) => {
  if (r2.isR2Mode()) {
    return res.json({ success: true, message: 'R2 mode — content folder not used' });
  }

  const { folderPath } = req.body;
  if (!folderPath) return res.status(400).json({ error: 'folderPath is required' });

  try {
    const exists = await fs.pathExists(folderPath);
    if (!exists) return res.status(400).json({ error: `Folder does not exist: ${folderPath}` });

    const stats = await fs.stat(folderPath);
    if (!stats.isDirectory()) return res.status(400).json({ error: 'Path is not a directory' });

    setSetting('content_folder_path', folderPath);
    res.json({ success: true, folderPath });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /media/rating — set star rating (0 = clear)
router.post('/rating', async (req, res) => {
  const { subpath, rating } = req.body;
  if (!subpath) return res.status(400).json({ error: 'subpath required' });
  const r = parseInt(rating);
  if (isNaN(r) || r < 0 || r > 5) return res.status(400).json({ error: 'rating must be 0–5' });

  const rootFolder = getSetting('content_folder_path');
  const mediaPathOrKey = r2.isR2Mode() ? subpath : path.resolve(rootFolder || '', subpath);
  const contentId = await mediaIdentity.resolveContentId(mediaPathOrKey, ACCOUNT_ID);

  setRating(subpath, r, contentId);
  res.json({ success: true, subpath, rating: r, contentId });
});

// GET /media/identity — full detail for one file: content id, tags, post history
router.get('/identity', async (req, res) => {
  const subpath = req.query.subpath;
  if (!subpath) return res.status(400).json({ error: 'subpath required' });

  const rootFolder = getSetting('content_folder_path');
  const mediaPathOrKey = r2.isR2Mode() ? subpath : path.resolve(rootFolder || '', subpath);

  try {
    const contentId = await mediaIdentity.resolveContentId(mediaPathOrKey, ACCOUNT_ID);
    if (!contentId) return res.json({ contentId: null, tags: [], history: [] });

    const { getTagsForContentIds, getPostHistoryForContentIds, getLatestMetrics } = require('../database');
    const tags = getTagsForContentIds(ACCOUNT_ID, [contentId])[contentId] || [];
    const history = getPostHistoryForContentIds(ACCOUNT_ID, [contentId]);
    const metrics = getLatestMetrics(history.map((h) => h.id));
    const historyWithMetrics = history.map((h) => ({ ...h, metrics: metrics[h.id] || null }));

    res.json({ contentId, tags, history: historyWithMetrics });
  } catch (err) {
    console.error('[Media] identity lookup error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
