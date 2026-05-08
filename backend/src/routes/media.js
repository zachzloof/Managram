const express = require('express');
const path = require('path');
const fs = require('fs-extra');
const mime = require('mime-types');
const { getSetting, setSetting } = require('../database');

const router = express.Router();

const SUPPORTED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.mp4', '.mov'];
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif'];
const VIDEO_EXTENSIONS = ['.mp4', '.mov'];

function isMediaFile(filename) {
  const ext = path.extname(filename).toLowerCase();
  return SUPPORTED_EXTENSIONS.includes(ext);
}

function getMediaType(filename) {
  const ext = path.extname(filename).toLowerCase();
  if (VIDEO_EXTENSIONS.includes(ext)) return 'video';
  return 'image';
}

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// GET /media/files — list all media files in content folder
router.get('/files', async (req, res) => {
  try {
    const folderPath = getSetting('content_folder_path');

    if (!folderPath) {
      return res.json({ files: [], error: 'Content folder not configured' });
    }

    const exists = await fs.pathExists(folderPath);
    if (!exists) {
      return res.json({ files: [], error: `Folder not found: ${folderPath}` });
    }

    const entries = await fs.readdir(folderPath, { withFileTypes: true });
    const files = [];

    for (const entry of entries) {
      if (!entry.isFile()) continue;
      if (!isMediaFile(entry.name)) continue;

      const filePath = path.join(folderPath, entry.name);
      const stats = await fs.stat(filePath);
      const type = getMediaType(entry.name);

      files.push({
        name: entry.name,
        path: filePath,
        type,
        size: stats.size,
        sizeFormatted: formatFileSize(stats.size),
        url: `/media/file/${encodeURIComponent(entry.name)}`,
        thumbnail: type === 'image' ? `/media/file/${encodeURIComponent(entry.name)}` : null,
        modifiedAt: stats.mtime.toISOString(),
      });
    }

    // Sort by modification time, newest first
    files.sort((a, b) => new Date(b.modifiedAt) - new Date(a.modifiedAt));

    res.json({ files });
  } catch (err) {
    console.error('[Media] Error listing files:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /media/file/:filename — serve the actual file
router.get('/file/:filename', (req, res) => {
  const folderPath = getSetting('content_folder_path');

  if (!folderPath) {
    return res.status(404).json({ error: 'Content folder not configured' });
  }

  const filename = decodeURIComponent(req.params.filename);

  // Security: prevent directory traversal
  const safeName = path.basename(filename);
  const filePath = path.join(folderPath, safeName);

  // Check the resolved path is within the content folder
  const resolvedPath = path.resolve(filePath);
  const resolvedFolder = path.resolve(folderPath);

  if (!resolvedPath.startsWith(resolvedFolder)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  if (!fs.pathExistsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }

  const mimeType = mime.lookup(filename) || 'application/octet-stream';

  // Set appropriate headers for streaming video
  const stats = fs.statSync(filePath);
  const fileSize = stats.size;

  if (mimeType.startsWith('video/') && req.headers.range) {
    const range = req.headers.range;
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunkSize = end - start + 1;

    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunkSize,
      'Content-Type': mimeType,
    });

    const stream = fs.createReadStream(filePath, { start, end });
    stream.pipe(res);
  } else {
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Length', fileSize);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    fs.createReadStream(filePath).pipe(res);
  }
});

// POST /media/folder — update content folder path
router.post('/folder', async (req, res) => {
  const { folderPath } = req.body;

  if (!folderPath) {
    return res.status(400).json({ error: 'folderPath is required' });
  }

  try {
    const exists = await fs.pathExists(folderPath);
    if (!exists) {
      return res.status(400).json({ error: `Folder does not exist: ${folderPath}` });
    }

    const stats = await fs.stat(folderPath);
    if (!stats.isDirectory()) {
      return res.status(400).json({ error: `Path is not a directory: ${folderPath}` });
    }

    setSetting('content_folder_path', folderPath);
    res.json({ success: true, folderPath });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
