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

// GET /media/files?subpath= — list folders + media files at a given subpath
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

    const entries = await fs.readdir(targetDir, { withFileTypes: true });
    const folders = [];
    const files = [];

    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue; // skip hidden

      if (entry.isDirectory()) {
        folders.push({
          name: entry.name,
          subpath: subpath ? `${subpath}/${entry.name}` : entry.name,
        });
      } else if (entry.isFile() && isMediaFile(entry.name)) {
        const filePath = path.join(targetDir, entry.name);
        const stats = await fs.stat(filePath);
        const relPath = subpath ? `${subpath}/${entry.name}` : entry.name;
        const type = getMediaType(entry.name);

        files.push({
          name: entry.name,
          subpath: relPath,
          path: filePath,
          type,
          size: stats.size,
          sizeFormatted: formatFileSize(stats.size),
          url: `/media/file/${relPath.split('/').map(encodeURIComponent).join('/')}`,
          thumbnail: type === 'image'
            ? `/media/file/${relPath.split('/').map(encodeURIComponent).join('/')}`
            : null,
          modifiedAt: stats.mtime.toISOString(),
        });
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
