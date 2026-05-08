const cron = require('node-cron');
const path = require('path');
const fs = require('fs-extra');
const { v4: uuidv4 } = require('uuid');
const { getSetting, setSetting } = require('./database');
const instagramService = require('./services/instagram');
const openaiService = require('./services/openai');

const SUPPORTED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.mp4', '.mov'];

function getMediaType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (['.mp4', '.mov'].includes(ext)) return 'VIDEO';
  return 'IMAGE';
}

function isMediaFile(filename) {
  const ext = path.extname(filename).toLowerCase();
  return SUPPORTED_EXTENSIONS.includes(ext);
}

async function getRandomMediaFromFolder(folderPath) {
  try {
    const files = await fs.readdir(folderPath);
    const mediaFiles = files.filter(isMediaFile);
    if (mediaFiles.length === 0) return null;
    const randomFile = mediaFiles[Math.floor(Math.random() * mediaFiles.length)];
    return path.join(folderPath, randomFile);
  } catch (err) {
    return null;
  }
}

async function postMedia(db, mediaPath, caption) {
  const accessToken = getSetting('instagram_access_token');
  const userId = getSetting('instagram_user_id');
  const publicUrl = getSetting('public_url');

  if (!accessToken || !userId) {
    throw new Error('Instagram not connected');
  }

  if (!publicUrl) {
    throw new Error('Public URL (ngrok) not configured');
  }

  const filename = path.basename(mediaPath);
  const mediaType = getMediaType(mediaPath);
  const fileUrl = `${publicUrl.replace(/\/$/, '')}/media/file/${encodeURIComponent(filename)}`;

  const containerId = await instagramService.createMediaContainer(
    userId,
    accessToken,
    fileUrl,
    mediaType,
    caption
  );

  // Wait for video containers to finish processing
  if (mediaType === 'VIDEO') {
    await instagramService.waitForContainerReady(containerId, accessToken);
  }

  const postId = await instagramService.publishMedia(userId, accessToken, containerId);
  return postId;
}

function getCurrentDayAbbr() {
  const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  return days[new Date().getDay()];
}

function getCurrentTime() {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

async function checkAndFireSchedules(db) {
  const currentTime = getCurrentTime();
  const currentDay = getCurrentDayAbbr();

  // Get all active schedules
  const schedules = db.prepare('SELECT * FROM schedules WHERE active = 1').all();

  for (const schedule of schedules) {
    if (schedule.time !== currentTime) continue;

    let scheduleDays;
    try {
      scheduleDays = JSON.parse(schedule.days);
    } catch {
      scheduleDays = [];
    }

    if (!scheduleDays.includes(currentDay)) continue;

    console.log(`[Scheduler] Firing schedule: ${schedule.name} at ${currentTime}`);

    try {
      // First, try to get the oldest pending queue item
      const queueItem = db
        .prepare(
          `SELECT * FROM queue WHERE status = 'pending' ORDER BY
          CASE WHEN scheduled_at IS NOT NULL AND scheduled_at != '' THEN scheduled_at ELSE created_at END ASC
          LIMIT 1`
        )
        .get();

      let mediaPath, caption;

      if (queueItem) {
        mediaPath = queueItem.media_path;
        caption = queueItem.caption || '';

        // Mark as posting
        db.prepare("UPDATE queue SET status = 'posting' WHERE id = ?").run(queueItem.id);
      } else {
        // No queue items — pick random from content folder
        const contentFolder = getSetting('content_folder_path');
        if (!contentFolder) {
          console.log('[Scheduler] No content folder configured, skipping');
          continue;
        }

        mediaPath = await getRandomMediaFromFolder(contentFolder);
        if (!mediaPath) {
          console.log('[Scheduler] No media files found in content folder, skipping');
          continue;
        }

        // Generate caption if template says {auto} or if template is empty
        const template = schedule.caption_template || '';
        if (template === '{auto}' || template === '') {
          const openaiKey = getSetting('openai_api_key');
          if (openaiKey) {
            try {
              caption = await openaiService.generateSingleCaption(openaiKey, '', 'casual');
            } catch (err) {
              console.warn('[Scheduler] Could not generate caption:', err.message);
              caption = '';
            }
          } else {
            caption = '';
          }
        } else {
          caption = template;
        }
      }

      // Post the media
      const postId = await postMedia(db, mediaPath, caption);

      if (queueItem) {
        // Update queue item to posted
        db.prepare(
          "UPDATE queue SET status = 'posted', posted_at = datetime('now') WHERE id = ?"
        ).run(queueItem.id);
        console.log(`[Scheduler] Posted queue item ${queueItem.id}, Instagram post ID: ${postId}`);
      } else {
        // Add a record to queue as posted
        db.prepare(
          `INSERT INTO queue (id, media_path, media_type, caption, status, posted_at, created_at)
           VALUES (?, ?, ?, ?, 'posted', datetime('now'), datetime('now'))`
        ).run(
          uuidv4(),
          mediaPath,
          getMediaType(mediaPath),
          caption
        );
        console.log(`[Scheduler] Posted random media, Instagram post ID: ${postId}`);
      }
    } catch (err) {
      console.error(`[Scheduler] Error posting for schedule ${schedule.name}:`, err.message);

      // If there was a queue item being posted, revert it to failed
      const failedItem = db
        .prepare("SELECT id FROM queue WHERE status = 'posting' LIMIT 1")
        .get();
      if (failedItem) {
        db.prepare("UPDATE queue SET status = 'failed' WHERE id = ?").run(failedItem.id);
      }
    }
  }
}

function startScheduler(db) {
  console.log('[Scheduler] Starting cron scheduler (checks every minute)');

  // Run every minute
  cron.schedule('* * * * *', async () => {
    try {
      await checkAndFireSchedules(db);
    } catch (err) {
      console.error('[Scheduler] Unexpected error:', err.message);
    }
  });
}

module.exports = { startScheduler };
