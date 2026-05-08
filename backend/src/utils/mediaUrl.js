const path = require('path');
const { isR2Mode, getPublicUrl } = require('../services/r2');
const { getSetting } = require('../database');

// Returns a publicly accessible URL for a media file suitable for the Instagram API.
// In R2 mode: mediaPath is an R2 key (e.g. "folder/video.mp4")
// In local mode: mediaPath is an absolute filesystem path
function buildMediaUrl(mediaPath) {
  if (isR2Mode()) {
    return getPublicUrl(mediaPath);
  }

  const publicUrl = getSetting('public_url');
  if (!publicUrl) {
    throw new Error('Public URL (ngrok) not configured. Please add it in Settings.');
  }

  const contentFolder = getSetting('content_folder_path');
  if (!contentFolder) {
    throw new Error('Content folder not configured');
  }

  const relPath = path.relative(contentFolder, mediaPath).replace(/\\/g, '/');
  const encodedPath = relPath.split('/').map(encodeURIComponent).join('/');
  return `${publicUrl.replace(/\/$/, '')}/media/file/${encodedPath}`;
}

module.exports = { buildMediaUrl };
