const axios = require('axios');

const GRAPH_BASE = 'https://graph.instagram.com/v21.0';

async function createMediaContainer(userId, accessToken, mediaUrl, mediaType, caption) {
  const params = {
    access_token: accessToken,
    caption: caption || '',
  };

  if (mediaType === 'VIDEO' || mediaType === 'REELS') {
    params.media_type = 'REELS';
    params.video_url = mediaUrl;
    params.share_to_feed = true;
  } else {
    params.image_url = mediaUrl;
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

    const { status_code } = response.data;

    if (status_code === 'FINISHED') return true;

    if (status_code === 'ERROR' || status_code === 'EXPIRED') {
      throw new Error(`Media container failed with status: ${status_code}`);
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
  getInsights,
};
