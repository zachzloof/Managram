const express = require('express');
const path = require('path');
const fs = require('fs');
const { getSetting } = require('../database');
const instagramService = require('../services/instagram');
const mediaIdentity = require('../services/mediaIdentity');
const { buildMediaUrl } = require('../utils/mediaUrl');
const { generateErrorCode, asyncRoute } = require('../utils/appError');

const router = express.Router();

// TODO(Part 5): replace with req.accountId from auth middleware once accounts land.
const ACCOUNT_ID = 'local';

// Size limits in bytes
const LIMITS = {
  IMAGE: 8 * 1024 * 1024,          // 8 MB
  FEED_VIDEO: 100 * 1024 * 1024,   // 100 MB
  REELS_VIDEO: 1024 * 1024 * 1024, // 1 GB
}

// POST /posts/preflight — check a file before attempting to post
router.post('/preflight', asyncRoute((req, res) => {
  const { mediaPath, postType } = req.body // postType: 'FEED' | 'REELS'

  if (!mediaPath) return res.status(400).json({ error: 'mediaPath required' })

  const contentFolder = getSetting('content_folder_path')
  if (!contentFolder) return res.status(400).json({ error: 'Content folder not configured' })

  const fullPath = path.isAbsolute(mediaPath) ? mediaPath : path.join(contentFolder, mediaPath)

  // Prevent path traversal
  if (!fullPath.startsWith(contentFolder)) {
    return res.status(403).json({ error: 'Path outside content folder' })
  }

  let stat
  try {
    stat = fs.statSync(fullPath)
  } catch {
    return res.status(404).json({ error: 'File not found' })
  }

  const ext = path.extname(fullPath).toLowerCase()
  const isVideo = ['.mp4', '.mov'].includes(ext)
  const mediaType = isVideo ? 'VIDEO' : 'IMAGE'
  const sizeMB = (stat.size / (1024 * 1024)).toFixed(1)

  const errors = []
  const warnings = []

  if (isVideo) {
    const limit = postType === 'REELS' ? LIMITS.REELS_VIDEO : LIMITS.FEED_VIDEO
    const limitMB = limit / (1024 * 1024)
    if (stat.size > limit) {
      errors.push(`Video is ${sizeMB} MB — exceeds the ${limitMB} MB limit for ${postType === 'REELS' ? 'Reels' : 'feed videos'}.`)
    }
    if (postType === 'FEED') {
      warnings.push('Feed videos must be 60 seconds or under. Reels support up to 90 seconds.')
    } else {
      warnings.push('Reels must be 90 seconds or under.')
    }
    if (ext === '.mov') {
      warnings.push('MOV files are supported but MP4 (H.264) is recommended for best compatibility.')
    }
  } else {
    if (stat.size > LIMITS.IMAGE) {
      errors.push(`Image is ${sizeMB} MB — exceeds the 8 MB Instagram limit. Please resize before posting.`)
    }
    if (!['.jpg', '.jpeg', '.png'].includes(ext)) {
      warnings.push(`File type ${ext} may not be supported. JPG and PNG are recommended.`)
    }
  }

  res.json({
    ok: errors.length === 0,
    mediaType,
    postType: isVideo ? (postType || 'FEED') : 'IMAGE',
    sizeMB: parseFloat(sizeMB),
    errors,
    warnings,
  })
}))

function getMediaType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (['.mp4', '.mov'].includes(ext)) return 'VIDEO';
  return 'IMAGE';
}


// POST /posts/publish — immediately publish a post
router.post('/publish', asyncRoute(async (req, res) => {
  const { mediaPath, caption, metadata = {} } = req.body;

  if (!mediaPath) {
    return res.status(400).json({ error: 'mediaPath is required' });
  }

  const accessToken = getSetting('instagram_access_token');
  const userId = getSetting('instagram_user_id');

  if (!accessToken || !userId) {
    return res.status(401).json({ error: 'Instagram account not connected' });
  }

  let fileUrl = '';

  try {
    const mediaType = getMediaType(mediaPath);
    fileUrl = buildMediaUrl(mediaPath);
    console.log(`[Posts] Publishing ${mediaType} to Instagram: ${fileUrl}`);

    const containerId = await instagramService.createMediaContainer(
      userId, accessToken, fileUrl, mediaType, caption || '', metadata
    );

    if (mediaType === 'VIDEO') {
      console.log('[Posts] Waiting for video container to process...');
      await instagramService.waitForContainerReady(containerId, accessToken);
    }

    const postId = await instagramService.publishMedia(userId, accessToken, containerId);
    console.log(`[Posts] Successfully published post ID: ${postId}`);

    try {
      await mediaIdentity.recordPublishedPost({
        mediaPathOrKey: mediaPath,
        instagramPostId: postId,
        mediaType,
        caption: caption || '',
        accountId: ACCOUNT_ID,
      });
    } catch (err) {
      console.warn('[Posts] Failed to record post history:', err.message);
    }

    res.json({ success: true, postId, message: 'Post published successfully' });
  } catch (err) {
    const code = generateErrorCode();
    const igError = err.response?.data?.error;
    console.error(`[${code}] [Posts] Publish error:`, igError || err.message);
    res.status(500).json({ error: igError?.message || err.message || 'Failed to publish post', fileUrl, code });
  }
}));

// GET /posts/recent — fetch recent posts from Instagram
router.get('/recent', asyncRoute(async (req, res) => {
  const accessToken = getSetting('instagram_access_token');
  const userId = getSetting('instagram_user_id');

  if (!accessToken || !userId) {
    return res.status(401).json({ error: 'Instagram account not connected' });
  }

  try {
    const limit = parseInt(req.query.limit) || 12;
    const posts = await instagramService.getRecentMedia(userId, accessToken, limit);

    res.json({ posts });
  } catch (err) {
    const code = generateErrorCode();
    console.error(`[${code}] [Posts] Error fetching recent posts:`, err.response?.data || err.message);
    const errorMsg =
      err.response?.data?.error?.message || err.message || 'Failed to fetch recent posts';
    res.status(500).json({ error: errorMsg, code });
  }
}));

// GET /posts/account — get account info with stats
router.get('/account', asyncRoute(async (req, res) => {
  const accessToken = getSetting('instagram_access_token');
  const userId = getSetting('instagram_user_id');

  if (!accessToken || !userId) {
    return res.status(401).json({ error: 'Instagram account not connected' });
  }

  try {
    const accountInfo = await instagramService.getAccountInfo(accessToken);
    res.json({ account: accountInfo });
  } catch (err) {
    const code = generateErrorCode();
    console.error(`[${code}] [Posts] Error fetching account info:`, err.response?.data || err.message);
    const errorMsg =
      err.response?.data?.error?.message || err.message || 'Failed to fetch account info';
    res.status(500).json({ error: errorMsg, code });
  }
}));

module.exports = router;
