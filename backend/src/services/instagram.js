const axios = require('axios');

const GRAPH_BASE = 'https://graph.instagram.com/v21.0';

async function createMediaContainer(userId, accessToken, mediaUrl, mediaType, caption, meta = {}) {
  const params = {
    access_token: accessToken,
    caption: caption || '',
  };

  if (meta.likeCountHidden)    params.like_and_view_counts_hidden = true;
  if (meta.commentsDisabled)   params.comment_enabled = false;
  if (meta.altText)            params.alt_text = meta.altText;
  if (meta.locationId)         params.location_id = meta.locationId;

  if (mediaType === 'VIDEO' || mediaType === 'REELS') {
    params.media_type = 'REELS';
    params.video_url = mediaUrl;
    params.share_to_feed = meta.shareToFeed !== false;
  } else {
    params.image_url = mediaUrl;
    if (meta.userTags && meta.userTags.length > 0) {
      params.user_tags = JSON.stringify(meta.userTags);
    }
  }

  const response = await axios.post(`${GRAPH_BASE}/${userId}/media`, null, { params });
  return response.data.id;
}

async function waitForContainerReady(containerId, accessToken, maxWaitMs = 300000) {
  const interval = 5000;
  let elapsed = 0;

  while (elapsed < maxWaitMs) {
    const response = await axios.get(`${GRAPH_BASE}/${containerId}`, {
      params: { fields: 'status_code,status', access_token: accessToken },
    });

    const { status_code, status } = response.data;

    if (status_code === 'FINISHED') return true;

    if (status_code === 'ERROR' || status_code === 'EXPIRED') {
      const detail = status && status !== status_code ? ` — ${status}` : '';
      throw new Error(`Media container failed with status: ${status_code}${detail}`);
    }

    await new Promise((resolve) => setTimeout(resolve, interval));
    elapsed += interval;
  }

  throw new Error('Timed out waiting for media container to be ready');
}

async function publishMedia(userId, accessToken, containerId) {
  const response = await axios.post(`${GRAPH_BASE}/${userId}/media_publish`, null, {
    params: { creation_id: containerId, access_token: accessToken },
  });
  return response.data.id;
}

async function getAccountInfo(accessToken) {
  const response = await axios.get(`${GRAPH_BASE}/me`, {
    params: {
      fields: 'id,username,name,profile_picture_url,followers_count,media_count',
      access_token: accessToken,
    },
  });
  return response.data;
}

async function getRecentMedia(userId, accessToken, limit = 12) {
  const response = await axios.get(`${GRAPH_BASE}/${userId}/media`, {
    params: {
      fields: 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count',
      limit,
      access_token: accessToken,
    },
  });
  return response.data.data || [];
}

async function getMediaFields(mediaId, accessToken) {
  const response = await axios.get(`${GRAPH_BASE}/${mediaId}`, {
    params: {
      fields: 'like_count,comments_count',
      access_token: accessToken,
    },
  });
  return response.data;
}

async function getInsights(userId, accessToken) {
  try {
    const response = await axios.get(`${GRAPH_BASE}/${userId}/insights`, {
      params: {
        metric: 'impressions,reach,profile_views',
        period: 'day',
        access_token: accessToken,
      },
    });
    return response.data.data || [];
  } catch {
    return [];
  }
}

module.exports = {
  createMediaContainer,
  publishMedia,
  waitForContainerReady,
  getAccountInfo,
  getRecentMedia,
  getMediaFields,
  getInsights,
};
