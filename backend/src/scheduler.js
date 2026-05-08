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

  const contentFolder = getSetting('content_folder_path');
  if (!contentFolder) throw new Error('Content folder not configured');

  const mediaType = getMediaType(mediaPath);
  const relPath = path.relative(contentFolder, mediaPath).replace(/\\/g, '/');
  const encodedPath = relPath.split('/').map(encodeURIComponent).join('/');
  const fileUrl = `${publicUrl.replace(/\/$/, '')}/media/file/${encodedPath}`;

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
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    weekday: 'short',
  }).format(new Date()).toLowerCase().slice(0, 3);
}

function getCurrentTime() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date());
  const hour = parts.find(p => p.type === 'hour')?.value ?? '00';
  const minute = parts.find(p => p.type === 'minute')?.value ?? '00';
  return `${hour}:${minute}`;
}

function getCurrentUKDatetime() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date());
  const get = (t) => parts.find(p => p.type === t)?.value ?? '00';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}

async function checkScheduledQueueItems(db) {
  const ukNow = getCurrentUKDatetime();

  // Only match items explicitly scheduled by the user (YYYY-MM-DDTHH:MM, no Z suffix)
  const due = db.prepare(
    `SELECT * FROM queue WHERE status = 'pending'
     AND scheduled_at IS NOT NULL AND scheduled_at != ''
     AND scheduled_at NOT LIKE '%Z'
     AND scheduled_at <= ?`
  ).all(ukNow);

  for (const item of due) {
    console.log(`[Scheduler] Auto-posting scheduled item ${item.id} (due ${item.scheduled_at})`);
    db.prepare("UPDATE queue SET status = 'posting', error_message = NULL WHERE id = ?").run(item.id);
    try {
      const postId = await postMedia(db, item.media_path, item.caption || '');
      db.prepare("UPDATE queue SET status = 'posted', posted_at = datetime('now') WHERE id = ?").run(item.id);
      console.log(`[Scheduler] Posted scheduled item ${item.id}, Instagram post ID: ${postId}`);
    } catch (err) {
      console.error(`[Scheduler] Error posting scheduled item ${item.id}:`, err.message);
      db.prepare("UPDATE queue SET status = 'failed', error_message = ? WHERE id = ?")
        .run(err.message, item.id);
    }
  }
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

      const failedItem = db
        .prepare("SELECT id FROM queue WHERE status = 'posting' LIMIT 1")
        .get();
      if (failedItem) {
        db.prepare("UPDATE queue SET status = 'failed', error_message = ? WHERE id = ?")
          .run(err.message, failedItem.id);
      }
    }
  }
}

function startScheduler(db) {
  console.log('[Scheduler] Starting cron scheduler (checks every minute)');

  // Reset any items stuck in 'posting' from a previous crashed run
  const stuck = db.prepare("UPDATE queue SET status = 'failed', error_message = 'Server restarted during post' WHERE status = 'posting'").run();
  if (stuck.changes > 0) {
    console.log(`[Scheduler] Reset ${stuck.changes} stuck 'posting' item(s) to 'failed'`);
  }

  cron.schedule('* * * * *', async () => {
    try {
      await checkScheduledQueueItems(db);
      await checkAndFireSchedules(db);
    } catch (err) {
      console.error('[Scheduler] Unexpected error:', err.message);
    }
  });
}

module.exports = { startScheduler };
