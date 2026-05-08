require('dotenv').config();
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const path = require('path');

const { getDb, getSetting } = require('./database');
const { startScheduler } = require('./scheduler');

const authRoutes = require('./routes/auth');
const mediaRoutes = require('./routes/media');
const postsRoutes = require('./routes/posts');
const queueRoutes = require('./routes/queue');
const scheduleRoutes = require('./routes/schedule');
const captionsRoutes = require('./routes/captions');
const settingsRoutes = require('./routes/settings');

const app = express();
const PORT = process.env.PORT || 3001;

// CORS — allow requests from the Vue dev server
app.use(
  cors({
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Session middleware
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'managram-dev-secret-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false, // set to true in production with HTTPS
      httpOnly: true,
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    },
  })
);

// Body parsing
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// API Routes
app.use('/auth', authRoutes);
app.use('/media', mediaRoutes);
app.use('/posts', postsRoutes);
app.use('/queue', queueRoutes);
app.use('/schedule', scheduleRoutes);
app.use('/captions', captionsRoutes);
app.use('/settings', settingsRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('[Error]', err.stack);
  res.status(500).json({
    error: err.message || 'Internal server error',
  });
});

let serverStarted = false;

async function startServer() {
  if (serverStarted) return;
  serverStarted = true;

  // Initialize DB and start scheduler
  const db = getDb();
  console.log('[DB] Database initialized');
  startScheduler(db);

  return new Promise((resolve) => {
    app.listen(PORT, () => {
      console.log(`[Server] Managram backend running on http://localhost:${PORT}`);
      console.log(`[Server] Content folder: ${getSetting('content_folder_path') || '(not configured)'}`);
      console.log(`[Server] Instagram connected: ${getSetting('instagram_user_id') ? 'Yes' : 'No'}`);
      resolve();
    });
  });
}

if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };
