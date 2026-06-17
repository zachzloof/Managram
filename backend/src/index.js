require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');

const { getDb, getSetting } = require('./database');
const { startScheduler } = require('./scheduler');
const { isR2Mode } = require('./services/r2');
const { isHostedMode } = require('./services/appMode');
const localLicenseGate = require('./services/localLicenseGate');

const authRoutes = require('./routes/auth');
const mediaRoutes = require('./routes/media');
const postsRoutes = require('./routes/posts');
const queueRoutes = require('./routes/queue');
const scheduleRoutes = require('./routes/schedule');
const captionsRoutes = require('./routes/captions');
const settingsRoutes = require('./routes/settings');
const presetsRoutes = require('./routes/presets');
const tagsRoutes = require('./routes/tags');
const analyticsRoutes = require('./routes/analytics');
const accountRoutes = require('./routes/account');
const { router: billingRoutes, webhookHandler } = require('./routes/billing');
const adminRoutes = require('./routes/admin');

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

app.use(cookieParser());

// Stripe webhook needs the RAW request body to verify its signature — it's
// wired directly on `app` (not the billing router) with express.raw() ahead
// of the global JSON body parser below, or signature verification would
// always fail.
app.post('/billing/webhook', express.raw({ type: 'application/json' }), webhookHandler);

// Body parsing
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Local/Electron license gate — irrelevant in hosted mode, where
// requireAccount on each route already handles access control.
app.use((req, res, next) => {
  if (isHostedMode() || req.path === '/health' || localLicenseGate.isValid()) return next();
  res.status(402).json({ error: 'Subscription required — please sign in again.' });
});

// API Routes
app.use('/auth', authRoutes);
app.use('/media', mediaRoutes);
app.use('/posts', postsRoutes);
app.use('/queue', queueRoutes);
app.use('/schedule', scheduleRoutes);
app.use('/captions', captionsRoutes);
app.use('/settings', settingsRoutes);
app.use('/presets', presetsRoutes);
app.use('/tags', tagsRoutes);
app.use('/analytics', analyticsRoutes);
app.use('/account', accountRoutes);
app.use('/billing', billingRoutes);
app.use('/admin', adminRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

// Serve built frontend (Railway / production)
const frontendDist = path.join(__dirname, '../../frontend/dist');
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
} else {
  // Dev mode — API-only 404
  app.use((req, res) => {
    res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` });
  });
}

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

  if (isHostedMode()) {
    const { initializeHostedSchema } = require('./db/postgres');
    await initializeHostedSchema();
    console.log('[DB] Hosted Postgres schema initialized (accounts, billing_events)');
  }

  return new Promise((resolve) => {
    app.listen(PORT, () => {
      console.log(`[Server] Managram backend running on http://localhost:${PORT}`);
      console.log(`[Server] App mode: ${isHostedMode() ? 'hosted (multi-tenant)' : 'local'}`);
      console.log(`[Server] Storage mode: ${isR2Mode() ? 'R2 (Cloudflare)' : 'Local filesystem'}`);
      if (!isR2Mode()) {
        console.log(`[Server] Content folder: ${getSetting('content_folder_path') || '(not configured)'}`);
      }
      console.log(`[Server] Instagram connected: ${getSetting('instagram_user_id') ? 'Yes' : 'No'}`);
      resolve();
    });
  });
}

if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };
