const express = require('express');
const { getSetting } = require('../database');
const { generateCaptions } = require('../services/openai');
const { sendError, asyncRoute } = require('../utils/appError');

const router = express.Router();

// POST /captions/generate — generate 3 caption options using OpenAI
router.post('/generate', asyncRoute(async (req, res) => {
  const { mediaType, context, style, hashtagCount, language } = req.body;

  const openaiKey = getSetting('openai_api_key');

  if (!openaiKey) {
    return res.status(400).json({
      error: 'OpenAI API key not configured. Please add it in Settings.',
    });
  }

  try {
    const captions = await generateCaptions(
      openaiKey,
      context || '',
      style || 'casual',
      mediaType || 'IMAGE',
      hashtagCount ?? 10,
      language || 'English'
    );

    res.json({ captions });
  } catch (err) {
    sendError(res, err, 'POST /captions/generate');
  }
}));

module.exports = router;
