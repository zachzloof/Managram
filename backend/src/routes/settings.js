const express = require('express');
const { getAllSettings, setSetting } = require('../database');

const router = express.Router();

function maskKey(value) {
  if (!value || value.length < 8) return value;
  return value.substring(0, 4) + '••••••••' + value.substring(value.length - 4);
}

// GET /settings — get all settings (mask API keys)
router.get('/', (req, res) => {
  try {
    const settings = getAllSettings();

    const masked = {
      instagram_username: settings.instagram_username || '',
      instagram_user_id: settings.instagram_user_id || '',
      instagram_profile_picture: settings.instagram_profile_picture || '',
      content_folder_path: settings.content_folder_path || '',
      public_url: settings.public_url || '',
      app_id: settings.app_id || '',
      // Mask sensitive values
      instagram_access_token: settings.instagram_access_token
        ? maskKey(settings.instagram_access_token)
        : '',
      openai_api_key: settings.openai_api_key ? maskKey(settings.openai_api_key) : '',
      app_secret: settings.app_secret ? maskKey(settings.app_secret) : '',
      ngrok_authtoken: settings.ngrok_authtoken ? maskKey(settings.ngrok_authtoken) : '',
    };

    res.json({ settings: masked });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /settings — bulk update settings
router.post('/', (req, res) => {
  const allowedKeys = [
    'content_folder_path',
    'openai_api_key',
    'public_url',
    'app_id',
    'app_secret',
    'ngrok_authtoken',
  ];

  try {
    const updates = {};

    for (const key of allowedKeys) {
      if (req.body[key] !== undefined) {
        // Skip masked values (they weren't changed)
        const value = req.body[key];
        if (typeof value === 'string' && value.includes('••••••••')) {
          continue;
        }
        setSetting(key, value);
        updates[key] = value;
      }
    }

    res.json({ success: true, updated: Object.keys(updates) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
