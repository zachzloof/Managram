const express = require('express');
const path = require('path');
const fs = require('fs-extra');
const mime = require('mime-types');
const { getSetting, setSetting } = require('../database');

const router = express.Router();

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
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const entryPath = path.join(dir, entry.name);
    const relPath = relBase ? `${relBase}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      const sub = await collectRecursive(rootFolder, entryPath, relPath);
      files.push(...sub);
    } else if (entry.isFile() && isMediaFile(entry.name)) {
      files.push(await buildFileEntry(rootFolder, entryPath, relPath));
    }
  }
  return files;
}

// GET /media/files?subpath=&recursive=true — list folders + media files at a given subpath
router.get('/files', async (req, res) => {
  try {
    const rootFolder = getSetting('content_folder_path');
    if (!rootFolder) return res.json({ folders: [], files: [], error: 'Content folder not configured' });

    // Resolve the requested subpath safely
    const subpath = req.query.subpath || '';
    const targetDir = subpath
      ? path.resolve(rootFolder, subpath)
      : path.resolve(rootFolder);

    // Prevent directory traversal
    if (!targetDir.startsWith(path.resolve(rootFolder))) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const exists = await fs.pathExists(targetDir);
    if (!exists) return res.json({ folders: [], files: [], error: `Folder not found` });

    // Recursive mode: flatten all files in all subdirectories
    if (req.query.recursive === 'true') {
      const files = await collectRecursive(rootFolder, targetDir, subpath);
      files.sort((a, b) => new Date(b.modifiedAt) - new Date(a.modifiedAt));
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
        files.push(await buildFileEntry(rootFolder, path.join(targetDir, entry.name), relPath));
      }
    }

    folders.sort((a, b) => a.name.localeCompare(b.name));
    files.sort((a, b) => new Date(b.modifiedAt) - new Date(a.modifiedAt));

    res.json({ folders, files });
  } catch (err) {
    console.error('[Media] Error listing files:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /media/file/* — serve a file at any depth within the content folder
router.get('/file/*', (req, res) => {
  const rootFolder = getSetting('content_folder_path');
  if (!rootFolder) return res.status(404).json({ error: 'Content folder not configured' });

  // Decode each path segment individually
  const relPath = req.params[0]
    .split('/')
    .map(decodeURIComponent)
    .join(path.sep);

  const filePath = path.resolve(rootFolder, relPath);

  // Prevent directory traversal
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

// POST /media/trim — trim a video to a start/end time range
router.post('/trim', async (req, res) => {
  const { filePath, startTime, endTime } = req.body;

  if (!filePath || startTime == null || endTime == null) {
    return res.status(400).json({ error: 'filePath, startTime, and endTime are required' });
  }
  if (endTime <= startTime) {
    return res.status(400).json({ error: 'endTime must be greater than startTime' });
  }

  const rootFolder = getSetting('content_folder_path');
  if (!rootFolder) return res.status(400).json({ error: 'Content folder not configured' });

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

  let outputPath = path.join(dir, `${base}_trimmed${ext}`);
  let counter = 1;
  while (fs.pathExistsSync(outputPath)) {
    outputPath = path.join(dir, `${base}_trimmed_${counter}${ext}`);
    counter++;
  }

  try {
    const ffmpeg = require('fluent-ffmpeg');
    const ffmpegPath = require('ffmpeg-static');
    ffmpeg.setFfmpegPath(ffmpegPath);

    await new Promise((resolve, reject) => {
      ffmpeg(resolved)
        .setStartTime(startTime)
        .setDuration(endTime - startTime)
        .videoCodec('libx264')
        .audioCodec('aac')
        .outputOptions(['-preset veryfast', '-crf 23', '-movflags +faststart'])
        .output(outputPath)
        .on('end', resolve)
        .on('error', reject)
        .run();
    });

    res.json({ success: true, filePath: outputPath, fileName: path.basename(outputPath) });
  } catch (err) {
    console.error('[Media] Trim error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /media/crop — crop a video with ffmpeg
router.post('/crop', async (req, res) => {
  const { filePath, x, y, width, height } = req.body

  if (!filePath || width == null || height == null) {
    return res.status(400).json({ error: 'filePath, width and height are required' })
  }

  const rootFolder = getSetting('content_folder_path')
  const resolved = path.resolve(filePath)
  if (!resolved.startsWith(path.resolve(rootFolder))) {
    return res.status(403).json({ error: 'Access denied' })
  }

  if (!fs.pathExistsSync(resolved)) {
    return res.status(404).json({ error: 'File not found' })
  }

  const dir = path.dirname(resolved)
  const ext = path.extname(resolved)
  const base = path.basename(resolved, ext)

  let outputPath = path.join(dir, `${base}_cropped${ext}`)
  let counter = 1
  while (fs.pathExistsSync(outputPath)) {
    outputPath = path.join(dir, `${base}_cropped_${counter}${ext}`)
    counter++
  }

  try {
    const ffmpeg = require('fluent-ffmpeg')
    const ffmpegPath = require('ffmpeg-static')
    ffmpeg.setFfmpegPath(ffmpegPath)

    await new Promise((resolve, reject) => {
      ffmpeg(resolved)
        .videoFilters(`crop=${Math.round(width)}:${Math.round(height)}:${Math.round(x)}:${Math.round(y)}`)
        .outputOptions('-c:a copy')
        .output(outputPath)
        .on('end', resolve)
        .on('error', reject)
        .run()
    })

    res.json({ success: true, filePath: outputPath, fileName: path.basename(outputPath) })
  } catch (err) {
    console.error('[Media] Crop error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// DELETE /media/files — delete one or more files
router.delete('/files', async (req, res) => {
  const { filePaths } = req.body;
  if (!Array.isArray(filePaths) || filePaths.length === 0) {
    return res.status(400).json({ error: 'filePaths array is required' });
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

  const failed = results.filter(r => r.error);
  if (failed.length === filePaths.length) {
    return res.status(500).json({ error: 'All deletions failed', results });
  }
  res.json({ deleted: results.filter(r => r.success).length, results });
});

// PATCH /media/rename — rename a file on disk
router.patch('/rename', async (req, res) => {
  const { filePath, newName } = req.body;
  if (!filePath || !newName) {
    return res.status(400).json({ error: 'filePath and newName are required' });
  }

  const rootFolder = getSetting('content_folder_path');
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(path.resolve(rootFolder))) {
    return res.status(403).json({ error: 'Access denied' });
  }

  if (!fs.pathExistsSync(resolved)) {
    return res.status(404).json({ error: 'File not found' });
  }

  // Reject path separators in newName to prevent traversal
  if (newName.includes('/') || newName.includes('\\') || newName.includes('..')) {
    return res.status(400).json({ error: 'Invalid file name' });
  }

  const dir = path.dirname(resolved);
  const newPath = path.join(dir, newName);

  if (fs.pathExistsSync(newPath)) {
    return res.status(409).json({ error: 'A file with that name already exists' });
  }

  try {
    await fs.rename(resolved, newPath);
    res.json({ success: true, newPath, fileName: newName });
  } catch (err) {
    console.error('[Media] Rename error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /media/mkdir — create a subfolder inside the content folder
router.post('/mkdir', async (req, res) => {
  const { name, subpath } = req.body
  if (!name) return res.status(400).json({ error: 'name is required' })

  if (name.includes('/') || name.includes('\\') || name.includes('..')) {
    return res.status(400).json({ error: 'Invalid folder name' })
  }

  const rootFolder = getSetting('content_folder_path')
  if (!rootFolder) return res.status(400).json({ error: 'Content folder not configured' })

  const base = subpath ? path.resolve(rootFolder, subpath) : path.resolve(rootFolder)

  if (!base.startsWith(path.resolve(rootFolder))) {
    return res.status(403).json({ error: 'Access denied' })
  }

  const newDir = path.join(base, name)

  if (!newDir.startsWith(path.resolve(rootFolder))) {
    return res.status(403).json({ error: 'Access denied' })
  }

  if (fs.pathExistsSync(newDir)) {
    return res.status(409).json({ error: 'A folder with that name already exists' })
  }

  try {
    await fs.mkdir(newDir)
    res.json({ success: true, name, subpath: subpath ? `${subpath}/${name}` : name })
  } catch (err) {
    console.error('[Media] mkdir error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// POST /media/folder — update content folder path
router.post('/folder', async (req, res) => {
  const { folderPath } = req.body;
  if (!folderPath) return res.status(400).json({ error: 'folderPath is required' });

  try {
    const exists = await fs.pathExists(folderPath);
    if (!exists) return res.status(400).json({ error: `Folder does not exist: ${folderPath}` });

    const stats = await fs.stat(folderPath);
    if (!stats.isDirectory()) return res.status(400).json({ error: `Path is not a directory` });

    setSetting('content_folder_path', folderPath);
    res.json({ success: true, folderPath });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
