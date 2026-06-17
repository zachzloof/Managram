const express = require('express');
const path = require('path');
const { getSetting, listTags, createTag, deleteTag, addMediaTag, removeMediaTag } = require('../database');
const r2 = require('../services/r2');
const mediaIdentity = require('../services/mediaIdentity');
const { sendError, asyncRoute } = require('../utils/appError');

const router = express.Router();

// TODO(Part 5): replace with req.accountId from auth middleware once accounts land.
const ACCOUNT_ID = 'local';

// GET /tags — list all tag definitions
router.get('/', asyncRoute((req, res) => {
  res.json(listTags(ACCOUNT_ID));
}));

// POST /tags — create a tag { name, color }
router.post('/', asyncRoute((req, res) => {
  const { name, color } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'name is required' });
  try {
    const tag = createTag(ACCOUNT_ID, name.trim(), color);
    res.json(tag);
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'A tag with that name already exists' });
    sendError(res, err, 'POST /tags');
  }
}));

// DELETE /tags/:id — delete a tag (and all its assignments)
router.delete('/:id', asyncRoute((req, res) => {
  deleteTag(ACCOUNT_ID, parseInt(req.params.id));
  res.json({ success: true });
}));

// POST /media/:subpath-encoded/tags — assign a tag to a file, resolving/stamping its id if needed
// Implemented as a body-based route rather than path param so subpaths with slashes work cleanly.
router.post('/assign', asyncRoute(async (req, res) => {
  const { subpath, tagId } = req.body;
  if (!subpath || !tagId) return res.status(400).json({ error: 'subpath and tagId are required' });

  const rootFolder = getSetting('content_folder_path');
  const mediaPathOrKey = r2.isR2Mode() ? subpath : path.resolve(rootFolder || '', subpath);

  try {
    const contentId = await mediaIdentity.resolveContentId(mediaPathOrKey, ACCOUNT_ID);
    if (!contentId) return res.status(422).json({ error: 'This file type does not support tagging' });
    addMediaTag(ACCOUNT_ID, contentId, tagId);
    res.json({ success: true, contentId });
  } catch (err) {
    sendError(res, err, 'POST /tags/assign');
  }
}));

// POST /tags/unassign — remove a tag from a file
router.post('/unassign', asyncRoute(async (req, res) => {
  const { subpath, tagId } = req.body;
  if (!subpath || !tagId) return res.status(400).json({ error: 'subpath and tagId are required' });

  const rootFolder = getSetting('content_folder_path');
  const mediaPathOrKey = r2.isR2Mode() ? subpath : path.resolve(rootFolder || '', subpath);

  try {
    const contentId = await mediaIdentity.resolveContentId(mediaPathOrKey, ACCOUNT_ID);
    if (!contentId) return res.json({ success: true });
    removeMediaTag(ACCOUNT_ID, contentId, tagId);
    res.json({ success: true });
  } catch (err) {
    sendError(res, err, 'POST /tags/unassign');
  }
}));

module.exports = router;
