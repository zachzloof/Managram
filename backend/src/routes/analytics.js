const express = require('express');
const {
  getPostsWithLatestMetrics,
  getTagPerformance,
  getEngagementByHour,
  getAccountSnapshots,
  getPostHistoryForContentIds,
  getLatestMetrics,
  getMetricsHistoryForPost,
  getTagsForContentIds,
} = require('../database');
const { asyncRoute } = require('../utils/appError');

const router = express.Router();

// TODO(Part 5): replace with req.accountId from auth middleware once accounts land.
const ACCOUNT_ID = 'local';

const HOUR_LABELS = Array.from({ length: 24 }, (_, h) => {
  const period = h === 0 ? '12am' : h < 12 ? `${h}am` : h === 12 ? '12pm' : `${h - 12}pm`;
  return period;
});

// GET /analytics/overview
router.get('/overview', asyncRoute((req, res) => {
  const posts = getPostsWithLatestMetrics(ACCOUNT_ID, 200);
  const withMetrics = posts.filter((p) => p.like_count != null);

  const totalPosts = posts.length;
  const avgLikes = withMetrics.length
    ? withMetrics.reduce((s, p) => s + (p.like_count || 0), 0) / withMetrics.length
    : 0;
  const avgComments = withMetrics.length
    ? withMetrics.reduce((s, p) => s + (p.comments_count || 0), 0) / withMetrics.length
    : 0;

  let best = null;
  let worst = null;
  for (const p of withMetrics) {
    const score = (p.like_count || 0) + (p.comments_count || 0);
    if (!best || score > best.score) best = { ...p, score };
    if (!worst || score < worst.score) worst = { ...p, score };
  }

  const snapshots = getAccountSnapshots(ACCOUNT_ID, 60).reverse();
  const followerGrowth = snapshots.map((s) => ({
    fetchedAt: s.fetched_at,
    followers: s.followers_count,
    mediaCount: s.media_count,
  }));

  const byHour = getEngagementByHour(ACCOUNT_ID);
  const bestTimes = byHour.slice(0, 3).map((h) => ({
    hour: h.hour,
    label: HOUR_LABELS[h.hour],
    avgEngagement: h.avg_engagement,
    sampleSize: h.n,
  }));

  res.json({
    totalPosts,
    avgLikes,
    avgComments,
    best,
    worst,
    followerGrowth,
    bestTimes,
  });
}));

// GET /analytics/posts
router.get('/posts', asyncRoute((req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  const posts = getPostsWithLatestMetrics(ACCOUNT_ID, limit);
  const contentIds = [...new Set(posts.map((p) => p.content_id).filter(Boolean))];
  const tagsByContentId = getTagsForContentIds(ACCOUNT_ID, contentIds);

  res.json({
    posts: posts.map((p) => ({
      id: p.id,
      contentId: p.content_id,
      instagramPostId: p.instagram_post_id,
      mediaType: p.media_type,
      caption: p.caption,
      subpath: p.subpath_at_post_time,
      postedAt: p.posted_at,
      likeCount: p.like_count,
      commentsCount: p.comments_count,
      tags: p.content_id ? tagsByContentId[p.content_id] || [] : [],
    })),
  });
}));

// GET /analytics/content/:id — full repost history for one piece of content
router.get('/content/:id', asyncRoute((req, res) => {
  const contentId = req.params.id;
  const history = getPostHistoryForContentIds(ACCOUNT_ID, [contentId]);
  const metrics = getLatestMetrics(history.map((h) => h.id));

  const enriched = history.map((h) => ({
    id: h.id,
    instagramPostId: h.instagram_post_id,
    mediaType: h.media_type,
    caption: h.caption,
    subpath: h.subpath_at_post_time,
    postedAt: h.posted_at,
    metrics: metrics[h.id] || null,
    metricsHistory: getMetricsHistoryForPost(h.id),
  }));

  res.json({ contentId, postCount: enriched.length, history: enriched });
}));

// GET /analytics/tags — engagement aggregated by tag
router.get('/tags', asyncRoute((req, res) => {
  const tags = getTagPerformance(ACCOUNT_ID);
  res.json({
    tags: tags.map((t) => ({
      tagId: t.tag_id,
      name: t.name,
      color: t.color,
      postCount: t.post_count,
      avgLikes: t.avg_likes || 0,
      avgComments: t.avg_comments || 0,
    })),
  });
}));

module.exports = router;
