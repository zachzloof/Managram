const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../database');

const router = express.Router();

function getNextFireTime(time, days) {
  if (!time || !days || days.length === 0) return null;

  const dayMap = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
  const now = new Date();
  const [hours, minutes] = time.split(':').map(Number);

  for (let i = 0; i <= 7; i++) {
    const candidate = new Date(now);
    candidate.setDate(now.getDate() + i);
    candidate.setHours(hours, minutes, 0, 0);

    if (candidate <= now) continue;

    const dayAbbr = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][candidate.getDay()];
    if (days.includes(dayAbbr)) {
      return candidate.toISOString();
    }
  }

  return null;
}

// GET /schedule — list all schedules
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const schedules = db
      .prepare('SELECT * FROM schedules ORDER BY created_at DESC')
      .all();

    const schedulesWithNextFire = schedules.map((s) => {
      let days;
      try {
        days = JSON.parse(s.days);
      } catch {
        days = [];
      }

      return {
        ...s,
        days,
        active: s.active === 1,
        nextFireTime: s.active ? getNextFireTime(s.time, days) : null,
      };
    });

    res.json({ schedules: schedulesWithNextFire });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /schedule — create schedule
router.post('/', (req, res) => {
  const { name, time, days, captionTemplate } = req.body;

  if (!name || !time) {
    return res.status(400).json({ error: 'name and time are required' });
  }

  // Validate time format
  if (!/^\d{2}:\d{2}$/.test(time)) {
    return res.status(400).json({ error: 'time must be in HH:MM format' });
  }

  const validDays = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const scheduleDays = Array.isArray(days) ? days.filter((d) => validDays.includes(d)) : [];

  try {
    const db = getDb();
    const id = uuidv4();

    db.prepare(
      `INSERT INTO schedules (id, name, time, days, caption_template, active, created_at)
       VALUES (?, ?, ?, ?, ?, 1, datetime('now'))`
    ).run(id, name, time, JSON.stringify(scheduleDays), captionTemplate || '{auto}');

    const schedule = db.prepare('SELECT * FROM schedules WHERE id = ?').get(id);
    let parsedDays;
    try {
      parsedDays = JSON.parse(schedule.days);
    } catch {
      parsedDays = [];
    }

    res.status(201).json({
      schedule: {
        ...schedule,
        days: parsedDays,
        active: schedule.active === 1,
        nextFireTime: getNextFireTime(schedule.time, parsedDays),
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /schedule/:id — update schedule
router.put('/:id', (req, res) => {
  const { name, time, days, captionTemplate, active } = req.body;
  const { id } = req.params;

  try {
    const db = getDb();
    const existing = db.prepare('SELECT * FROM schedules WHERE id = ?').get(id);

    if (!existing) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    const validDays = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const scheduleDays = Array.isArray(days) ? days.filter((d) => validDays.includes(d)) : JSON.parse(existing.days || '[]');

    db.prepare(
      `UPDATE schedules SET name = ?, time = ?, days = ?, caption_template = ?, active = ?
       WHERE id = ?`
    ).run(
      name || existing.name,
      time || existing.time,
      JSON.stringify(scheduleDays),
      captionTemplate !== undefined ? captionTemplate : existing.caption_template,
      active !== undefined ? (active ? 1 : 0) : existing.active,
      id
    );

    const updated = db.prepare('SELECT * FROM schedules WHERE id = ?').get(id);
    let parsedDays;
    try {
      parsedDays = JSON.parse(updated.days);
    } catch {
      parsedDays = [];
    }

    res.json({
      schedule: {
        ...updated,
        days: parsedDays,
        active: updated.active === 1,
        nextFireTime: updated.active ? getNextFireTime(updated.time, parsedDays) : null,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /schedule/:id — delete schedule
router.delete('/:id', (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;

    const existing = db.prepare('SELECT * FROM schedules WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    db.prepare('DELETE FROM schedules WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /schedule/:id/toggle — toggle active state
router.patch('/:id/toggle', (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;

    const existing = db.prepare('SELECT * FROM schedules WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    const newActive = existing.active === 1 ? 0 : 1;
    db.prepare('UPDATE schedules SET active = ? WHERE id = ?').run(newActive, id);

    const updated = db.prepare('SELECT * FROM schedules WHERE id = ?').get(id);
    let parsedDays;
    try {
      parsedDays = JSON.parse(updated.days);
    } catch {
      parsedDays = [];
    }

    res.json({
      schedule: {
        ...updated,
        days: parsedDays,
        active: updated.active === 1,
        nextFireTime: updated.active ? getNextFireTime(updated.time, parsedDays) : null,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
