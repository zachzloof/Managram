const express = require('express');
const { getSetting } = require('../database');
const { generateCaptions } = require('../services/openai');

const router = express.Router();

// POST /captions/generate — generate 3 caption options using OpenAI
router.post('/generate', async (req, res) => {
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
    console.error('[Captions] Generation error:', err.message);
    res.status(500).json({
      error: err.message || 'Failed to generate captions',
    });
  }
});

module.exports = router;
