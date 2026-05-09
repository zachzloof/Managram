const express = require('express');
const path = require('path');
const fs = require('fs-extra');
const { getDb } = require('../database');

const router = express.Router();

// GET /presets
router.get('/', (req, res) => {
  const db = getDb();
  const presets = db.prepare('SELECT * FROM folder_presets ORDER BY name ASC').all();
  res.json(presets);
});

// POST /presets
router.post('/', async (req, res) => {
  const { name, path: folderPath } = req.body;
  if (!name || !folderPath) {
    return res.status(400).json({ error: 'name and path are required' });
  }
  const exists = await fs.pathExists(folderPath);
  if (!exists) {
    return res.status(400).json({ error: `Folder does not exist: ${folderPath}` });
  }
  const stats = await fs.stat(folderPath);
  if (!stats.isDirectory()) {
    return res.status(400).json({ error: 'Path is not a directory' });
  }
  const db = getDb();
  const result = db.prepare('INSERT INTO folder_presets (name, path) VALUES (?, ?)').run(name.trim(), folderPath);
  const preset = db.prepare('SELECT * FROM folder_presets WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(preset);
});

// PUT /presets/:id
router.put('/:id', async (req, res) => {
  const { name, path: folderPath } = req.body;
  const db = getDb();
  const existing = db.prepare('SELECT * FROM folder_presets WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Preset not found' });

  const newName = name?.trim() || existing.name;
  const newPath = folderPath || existing.path;

  if (folderPath) {
    const exists = await fs.pathExists(folderPath);
    if (!exists) return res.status(400).json({ error: `Folder does not exist: ${folderPath}` });
  }

  db.prepare('UPDATE folder_presets SET name = ?, path = ? WHERE id = ?').run(newName, newPath, req.params.id);
  const updated = db.prepare('SELECT * FROM folder_presets WHERE id = ?').get(req.params.id);
  res.json(updated);
});

// DELETE /presets/:id
router.delete('/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM folder_presets WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Preset not found' });
  db.prepare('DELETE FROM folder_presets WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// POST /presets/send — copy files to a preset destination
router.post('/send', async (req, res) => {
  const { filePaths, presetId } = req.body;
  if (!Array.isArray(filePaths) || filePaths.length === 0 || !presetId) {
    return res.status(400).json({ error: 'filePaths and presetId are required' });
  }

  const db = getDb();
  const preset = db.prepare('SELECT * FROM folder_presets WHERE id = ?').get(presetId);
  if (!preset) return res.status(404).json({ error: 'Preset not found' });

  const destExists = await fs.pathExists(preset.path);
  if (!destExists) return res.status(400).json({ error: `Destination folder no longer exists: ${preset.path}` });

  const results = [];

  for (const filePath of filePaths) {
    const resolved = path.resolve(filePath);

    if (!fs.pathExistsSync(resolved)) {
      results.push({ filePath, error: 'Source file not found' });
      continue;
    }

    const fileName = path.basename(resolved);
    const ext = path.extname(fileName);
    const base = path.basename(fileName, ext);

    let destPath = path.join(preset.path, fileName);
    let counter = 1;
    while (fs.pathExistsSync(destPath)) {
      destPath = path.join(preset.path, `${base}_${counter}${ext}`);
      counter++;
    }

    try {
      await fs.move(resolved, destPath);
      results.push({ filePath, destPath, fileName: path.basename(destPath), success: true });
    } catch (err) {
      results.push({ filePath, error: err.message });
    }
  }

  const failed = results.filter(r => r.error);
  if (failed.length === filePaths.length) {
    return res.status(500).json({ error: 'All moves failed', results });
  }

  res.json({ copied: results.filter(r => r.success).length, results });
});

module.exports = router;
