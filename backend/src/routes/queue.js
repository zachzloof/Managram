const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../database');
const { sendError, asyncRoute } = require('../utils/appError');

const router = express.Router();

// GET /queue — list all queue items
router.get('/', asyncRoute((req, res) => {
  try {
    const db = getDb();
    const items = db
      .prepare(
        `SELECT * FROM queue ORDER BY
          CASE status
            WHEN 'pending' THEN 1
            WHEN 'posting' THEN 2
            WHEN 'posted' THEN 3
            WHEN 'failed' THEN 4
          END,
          CASE WHEN scheduled_at IS NOT NULL AND scheduled_at != '' THEN scheduled_at ELSE created_at END ASC`
      )
      .all();

    res.json({ items });
  } catch (err) {
    sendError(res, err, 'GET /queue');
  }
}));

// POST /queue — add item to queue
router.post('/', asyncRoute((req, res) => {
  const { mediaPath, caption, scheduledAt, mediaType } = req.body;

  if (!mediaPath) {
    return res.status(400).json({ error: 'mediaPath is required' });
  }

  try {
    const db = getDb();
    const id = uuidv4();
    const path = require('path');
    const ext = path.extname(mediaPath).toLowerCase();
    const type = ['.mp4', '.mov'].includes(ext) ? 'VIDEO' : 'IMAGE';

    db.prepare(
      `INSERT INTO queue (id, media_path, media_type, caption, status, scheduled_at, created_at)
       VALUES (?, ?, ?, ?, 'pending', ?, datetime('now'))`
    ).run(id, mediaPath, mediaType || type, caption || '', scheduledAt || null);

    const item = db.prepare('SELECT * FROM queue WHERE id = ?').get(id);
    res.status(201).json({ item });
  } catch (err) {
    sendError(res, err, 'POST /queue');
  }
}));

// DELETE /queue/:id — remove from queue
router.delete('/:id', asyncRoute((req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;

    const item = db.prepare('SELECT * FROM queue WHERE id = ?').get(id);
    if (!item) {
      return res.status(404).json({ error: 'Queue item not found' });
    }

    db.prepare('DELETE FROM queue WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (err) {
    sendError(res, err, 'DELETE /queue/:id');
  }
}));

// PATCH /queue/:id — update queue item
router.patch('/:id', asyncRoute((req, res) => {
  const { caption, scheduledAt, status } = req.body;
  const { id } = req.params;

  try {
    const db = getDb();
    const item = db.prepare('SELECT * FROM queue WHERE id = ?').get(id);

    if (!item) {
      return res.status(404).json({ error: 'Queue item not found' });
    }

    const updates = [];
    const values = [];

    if (caption !== undefined) {
      updates.push('caption = ?');
      values.push(caption);
    }

    if (scheduledAt !== undefined) {
      updates.push('scheduled_at = ?');
      values.push(scheduledAt || null);
    }

    if (status !== undefined) {
      updates.push('status = ?');
      values.push(status);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(id);
    db.prepare(`UPDATE queue SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    const updated = db.prepare('SELECT * FROM queue WHERE id = ?').get(id);
    res.json({ item: updated });
  } catch (err) {
    sendError(res, err, 'PATCH /queue/:id');
  }
}));

// POST /queue/reorder — reorder queue items
router.post('/reorder', asyncRoute((req, res) => {
  const { orderedIds } = req.body;

  if (!Array.isArray(orderedIds)) {
    return res.status(400).json({ error: 'orderedIds must be an array' });
  }

  try {
    const db = getDb();
    const updateStmt = db.prepare(
      `UPDATE queue SET scheduled_at = ? WHERE id = ?`
    );

    const reorderMany = db.transaction((ids) => {
      const now = new Date();
      for (let i = 0; i < ids.length; i++) {
        // Use position-based timestamps to maintain order
        const fakeTime = new Date(now.getTime() + i * 1000).toISOString();
        updateStmt.run(fakeTime, ids[i]);
      }
    });

    reorderMany(orderedIds);
    res.json({ success: true });
  } catch (err) {
    sendError(res, err, 'POST /queue/reorder');
  }
}));

module.exports = router;
