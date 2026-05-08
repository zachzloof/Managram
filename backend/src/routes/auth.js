const express = require('express');
const axios = require('axios');
const { getSetting, setSetting } = require('../database');

const router = express.Router();

const INSTAGRAM_AUTH_BASE = 'https://api.instagram.com';
const GRAPH_BASE = 'https://graph.instagram.com/v21.0';

// In production set APP_URL=https://managram.uk in Railway env vars.
// In local dev the frontend runs on 5173 proxying to 3001.
function getBaseUrl() {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, '');
  return 'http://localhost:5173';
}

function getRedirectUri() {
  // Production (Railway): APP_URL env var takes priority
  if (process.env.APP_URL) return `${process.env.APP_URL.replace(/\/$/, '')}/auth/callback`;
  // Local mode: ngrok URL saved in DB settings
  const publicUrl = getSetting('public_url');
  if (publicUrl) return `${publicUrl.replace(/\/$/, '')}/auth/callback`;
  return 'http://localhost:3001/auth/callback';
}

// GET /auth/instagram — initiate OAuth flow
router.get('/instagram', (req, res) => {
  const appId = getSetting('app_id');

  if (!appId) {
    return res.redirect(
      `${getBaseUrl()}?error=${encodeURIComponent('App ID not configured. Please add it in Settings.')}`
    );
  }

  const scope = [
    'instagram_business_basic',
    'instagram_business_content_publish',
    'instagram_business_manage_comments',
  ].join(',');

  const authUrl =
    `${INSTAGRAM_AUTH_BASE}/oauth/authorize?` +
    `client_id=${appId}` +
    `&redirect_uri=${encodeURIComponent(getRedirectUri())}` +
    `&scope=${encodeURIComponent(scope)}` +
    `&response_type=code`;

  res.redirect(authUrl);
});

// GET /auth/callback — exchange code for token
router.get('/callback', async (req, res) => {
  const { code, error, error_description } = req.query;

  if (error) {
    const message = error_description || error;
    return res.redirect(`${getBaseUrl()}?error=${encodeURIComponent(message)}`);
  }

  if (!code) {
    return res.redirect(
      `${getBaseUrl()}?error=${encodeURIComponent('No authorization code received')}`
    );
  }

  try {
    const appId = getSetting('app_id');
    const appSecret = getSetting('app_secret');

    if (!appId || !appSecret) {
      return res.redirect(
        `${getBaseUrl()}?error=${encodeURIComponent('App ID or App Secret not configured')}`
      );
    }

    // Exchange code for short-lived token
    const tokenResponse = await axios.post(
      `${INSTAGRAM_AUTH_BASE}/oauth/access_token`,
      new URLSearchParams({
        client_id: appId,
        client_secret: appSecret,
        grant_type: 'authorization_code',
        redirect_uri: getRedirectUri(),
        code,
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const { access_token: shortToken, user_id: userId } = tokenResponse.data;

    // Exchange short-lived token for long-lived token (60 days)
    const longTokenResponse = await axios.get(`${GRAPH_BASE}/access_token`, {
      params: {
        grant_type: 'ig_exchange_token',
        client_secret: appSecret,
        access_token: shortToken,
      },
    });

    const longToken = longTokenResponse.data.access_token;

    // Get account info using the user_id returned from token exchange
    const userResponse = await axios.get(`${GRAPH_BASE}/${userId}`, {
      params: {
        fields: 'id,username,name,profile_picture_url,followers_count,media_count',
        access_token: longToken,
      },
    });

    const igAccount = userResponse.data;

    setSetting('instagram_access_token', longToken);
    setSetting('instagram_user_id', String(userId));
    setSetting('instagram_username', igAccount.username || igAccount.name || '');
    setSetting('instagram_profile_picture', igAccount.profile_picture_url || '');

    console.log(`[Auth] Authenticated as @${igAccount.username}`);

    res.redirect(`${getBaseUrl()}?auth=success`);
  } catch (err) {
    console.error('[Auth] OAuth error:', err.response?.data || err.message);
    const errorMsg =
      err.response?.data?.error_message ||
      err.response?.data?.error?.message ||
      err.message ||
      'Authentication failed';
    res.redirect(`${getBaseUrl()}?error=${encodeURIComponent(errorMsg)}`);
  }
});

// POST /auth/token — manually paste a token generated from the Meta portal
router.post('/token', async (req, res) => {
  const { access_token } = req.body;
  if (!access_token) return res.status(400).json({ error: 'access_token required' });

  try {
    const appSecret = getSetting('app_secret');

    // Try to exchange for a long-lived token if app secret is available
    let finalToken = access_token;
    if (appSecret) {
      try {
        const longTokenResponse = await axios.get(`${GRAPH_BASE}/access_token`, {
          params: {
            grant_type: 'ig_exchange_token',
            client_secret: appSecret,
            access_token,
          },
        });
        finalToken = longTokenResponse.data.access_token;
      } catch {
        // If exchange fails, use the token as-is
        finalToken = access_token;
      }
    }

    // Get user info from the token
    const userResponse = await axios.get(`${GRAPH_BASE}/me`, {
      params: {
        fields: 'id,username,name,profile_picture_url,followers_count,media_count',
        access_token: finalToken,
      },
    });

    const igAccount = userResponse.data;

    setSetting('instagram_access_token', finalToken);
    setSetting('instagram_user_id', String(igAccount.id));
    setSetting('instagram_username', igAccount.username || igAccount.name || '');
    setSetting('instagram_profile_picture', igAccount.profile_picture_url || '');

    console.log(`[Auth] Manually authenticated as @${igAccount.username}`);

    res.json({
      success: true,
      user: {
        id: igAccount.id,
        username: igAccount.username,
        profilePicture: igAccount.profile_picture_url || '',
      },
    });
  } catch (err) {
    console.error('[Auth] Token error:', err.response?.data || err.message);
    const errorMsg =
      err.response?.data?.error?.message ||
      err.response?.data?.error_message ||
      err.message ||
      'Invalid token';
    res.status(400).json({ error: errorMsg });
  }
});

// GET /auth/status
router.get('/status', (req, res) => {
  const accessToken = getSetting('instagram_access_token');
  const userId = getSetting('instagram_user_id');
  const username = getSetting('instagram_username');
  const profilePicture = getSetting('instagram_profile_picture');

  if (accessToken && userId) {
    res.json({
      authenticated: true,
      user: { id: userId, username, profilePicture },
    });
  } else {
    res.json({ authenticated: false, user: null });
  }
});

// POST /auth/logout
router.post('/logout', (req, res) => {
  setSetting('instagram_access_token', '');
  setSetting('instagram_user_id', '');
  setSetting('instagram_username', '');
  setSetting('instagram_profile_picture', '');
  res.json({ success: true });
});

module.exports = router;
