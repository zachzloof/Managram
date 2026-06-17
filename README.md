# Managram — Instagram Content Manager

A desktop (Electron) and hosted (Railway) Instagram content manager: schedule
posts, generate captions with AI, track how content performs over time, and
tag/organize your media library. Built to be sold as a SaaS — either as a
locally-installed app or a hosted multi-tenant deployment — with centralized
account/license control either way.

## Features

- **Media Library** — browse a local content folder or Cloudflare R2 bucket, with
  star ratings, tags, folder presets, and bulk move/delete
- **Compose** — crop/trim videos in-app, AI-generated captions (GPT-4o), per-post
  settings (hide likes, disable comments, alt text, location, user tags)
- **Queue & Schedules** — a post queue with manual reordering, plus recurring
  posting schedules (e.g. "5:30 PM every weekday") with automatic caption
  generation when the queue is empty
- **Analytics** — recent post performance, best/worst performer, follower growth
  over time, best-time-to-post, and engagement broken down by tag
- **Content identity & repost history** — every photo/video gets a hidden,
  persistent ID the first time you tag/rate/post it, so renaming a file (in the
  app or in File Explorer) never loses its history, rating, or tags — see
  [Content identity](#content-identity--repost-history) below
- **Tags** — free-form tags (e.g. "funny", "dnb", a stage name), filterable in
  the Library, broken down by performance in Analytics
- **Accounts, licensing & billing** — Stripe-backed subscriptions, a central
  admin override switch, and a license gate that applies even to local
  Electron installs (see [Accounts & licensing](#accounts--licensing))

## Architecture

```
frontend/   Vue 3 + Vite + Pinia + Tailwind — the UI, identical in both deployment modes
backend/    Express API + scheduler — runs either embedded in Electron or standalone on Railway
electron/   Desktop shell — spawns the backend in-process, manages the ngrok tunnel, license gate
```

The backend auto-detects two independent axes of configuration:

| Axis | Local/default | Alternate |
|---|---|---|
| Media storage | Local filesystem (content folder + ngrok tunnel) | Cloudflare R2 (set `R2_*` env vars) |
| App mode | Single-tenant (`APP_MODE` unset) | Hosted multi-tenant (`APP_MODE=hosted`, Postgres + Stripe) |

These are independent: a local Electron install always uses local-filesystem
storage and never needs Postgres/Stripe; a hosted Railway deployment always
uses R2 storage and the multi-tenant account/billing layer.

## Prerequisites

- Node.js 18+ (see [Running tests](#running-tests) for a Windows-specific native
  module caveat)
- Instagram Business or Creator account linked to a Facebook Page
- Facebook Developer App
- OpenAI API key (for AI captions)
- ngrok account (free) — local mode only, for media delivery
- For hosted mode: a Stripe account and a Postgres database (e.g. Railway's
  Postgres add-on)

## Quick start (local/Electron)

### 1 — Install dependencies
```bash
cd Managram
npm run install:all
```

### 2 — Facebook Developer App
1. Go to developers.facebook.com → My Apps → Create App → Business
2. Add the Instagram Graph API product
3. Under Settings → Basic: copy App ID and App Secret
4. Under Facebook Login → Settings: add `http://localhost:3001/auth/callback` as a valid OAuth Redirect URI

### 3 — Instagram Business Account
Your Instagram must be a Business or Creator account linked to a Facebook Page:
- Instagram app: Settings → Account → Switch to Professional Account
- Facebook: Settings → Linked Accounts → Instagram

### 4 — ngrok account (free)
1. Sign up at ngrok.com (free)
2. Copy your Authtoken from dashboard.ngrok.com/get-started/your-authtoken
3. Paste it into Managram's Settings page — the app manages the tunnel automatically

### 5 — OpenAI API key
1. platform.openai.com/api-keys → Create new secret key
2. Paste into Managram Settings

### 6 — Run the app
```bash
npm run dev
```
Electron opens automatically once the frontend dev server is ready.

By default, even a local install will ask you to sign in against the hosted
license server before showing the rest of the app (see
[Accounts & licensing](#accounts--licensing)). For day-to-day local
development without a live license server running, set:
```bash
MANAGRAM_SKIP_LICENSE=true npm run dev
```

### First-time setup in the app
1. Enter Facebook App ID and App Secret on the connect screen
2. Click Connect with Instagram and authorize
3. In Settings: set your Content Folder, add your ngrok Authtoken (Save & Connect), add your OpenAI key
4. Go to Library to see your media

## Hosted deployment (Railway)

Hosted mode adds: a Postgres-backed `accounts` table, Stripe subscriptions, a
`/admin` page, and JWT-based login — on top of the same backend/frontend code.

1. Generate a license signing keypair (one time, on your own machine):
   ```bash
   node backend/scripts/generate-license-keys.js
   ```
   This writes `electron/license-public-key.pem` (safe to commit — it can only
   *verify* tokens, not create them) and prints a private key. **Never commit
   the private key.**
2. On Railway, set these environment variables:
   ```bash
   APP_MODE=hosted
   APP_URL=https://your-domain.example
   DATABASE_URL=<Railway Postgres connection string>
   JWT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
   STRIPE_SECRET_KEY=sk_live_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   STRIPE_PRICE_ID_MONTHLY=price_...
   STRIPE_PRICE_ID_ANNUAL=price_...
   R2_ACCOUNT_ID=...
   R2_ACCESS_KEY_ID=...
   R2_SECRET_ACCESS_KEY=...
   R2_BUCKET_NAME=...
   ```
3. In the Stripe dashboard, point a webhook at `https://your-domain.example/billing/webhook`
   for `checkout.session.completed`, `customer.subscription.updated`,
   `customer.subscription.deleted`, and `invoice.payment_failed`.
4. Promote your own account to admin once it exists, by hand, directly in
   Postgres: `UPDATE accounts SET is_admin = true WHERE email = '...';` — there's
   no UI for the very first admin, deliberately, since the table starts empty.
5. Deploy. `railway.toml` builds and starts both `frontend` and `backend`
   from the repo root.

**Known gap, by design:** the accounts/billing/admin layer (new tables,
genuinely Postgres-backed) is fully isolated per tenant. The pre-existing
feature routes — `queue`, `schedule`, `folder_presets`, and the local-filesystem
media browser — still read/write a single shared SQLite-shaped store and are
**not yet** scoped per hosted tenant. Rewriting those five route files'
raw SQL into a dual SQLite/Postgres repository layer is a deliberately
separate, larger piece of work (see the code comment at the top of
`backend/src/db/postgres.js`) — don't run hosted mode with multiple real
paying tenants relying on data isolation in those specific features until
that lands.

## Content identity & repost history

When you tag, rate, or post a photo/video for the first time, Managram embeds
a hidden UUID directly in the file: an EXIF `UserComment` field for JPEGs, a
custom PNG `tEXt` chunk for PNGs, and a container-level metadata tag (read via
ffprobe, written via a lossless ffmpeg stream-copy) for MP4/MOV. Untouched
files are never written to — the stamp only happens lazily, on first
interaction.

This means:
- **Renaming a file** (in the app, or in File Explorer) never breaks its
  rating, tags, or post history — the ID travels with the bytes, not the name.
- **Trimming or cropping** in-app carries the *same* ID forward (piggybacked
  onto the ffmpeg pass the edit already runs — no extra work, no separate
  "lineage" table needed).
- **Editing outside Managram** (e.g. in CapCut or Premiere) is an inherent
  blind spot — most external tools regenerate the file and strip custom tags
  on export. There's no way to track through that, by design.
- GIFs aren't stamped — there's no reliable lossless custom-metadata field for
  that format, and it's rarely the thing actually being posted/analyzed here.

The library listing itself stays fast regardless of folder size: it only
*reads* a cached subpath→ID mapping from the database, never the files
themselves. A file renamed outside the app will show up unlinked from its
history in the grid until you next open it (tag/rate/preview it), at which
point the cache self-heals by reading the embedded ID directly.

## Accounts & licensing

Every install — including a fully local, offline-capable Electron install —
checks in with a central license server so the app owner can grant or revoke
access centrally. This is a **good-faith access gate, not DRM**: it's meant to
stop "forgot to cancel" and casual credential sharing, not a determined
technical bypass. Specifics:

- Tokens are signed with RS256. The private key lives only in the hosted
  server's `JWT_PRIVATE_KEY` env var; the public key is bundled inside the
  Electron app (`electron/license-public-key.pem`) and can only *verify*
  tokens, never forge them.
- A logged-in Electron install caches its token locally and keeps working
  offline for up to 3 days (the token's expiry), refreshing opportunistically
  whenever it's online. An explicit revoke from the server (e.g. an admin
  override) locks the app immediately on the next successful check-in,
  regardless of remaining offline grace time.
- A basic clock-rollback guard refuses a cached token if the system clock now
  reads earlier than the last time the app saw the network — it won't stop a
  determined user, but it stops the trivial case.
- The backend's own API routes (not just the renderer UI) are gated locally
  too, via `backend/src/services/localLicenseGate.js`, so patching the
  renderer alone doesn't bypass anything.
- Running the backend directly with plain `node backend/src/index.js`
  (outside the Electron wrapper) defaults this gate to *open* — intentional,
  so local development isn't blocked by a license server that may not be
  running. The shipped Electron installer always starts closed until a real
  check succeeds.

## Tech stack

- **Frontend**: Vue 3, Vite, Pinia, Tailwind CSS, Chart.js
- **Backend**: Express, better-sqlite3 (local) / Postgres (hosted accounts),
  node-cron, Stripe, jsonwebtoken
- **Desktop**: Electron 28
- **Media**: Instagram Graph API, OpenAI GPT-4o, ffmpeg-static/ffprobe-static,
  piexifjs, png-chunks-*
- **Storage**: local filesystem + ngrok, or Cloudflare R2

## Repo structure

```
backend/src/
  database.js               SQLite schema + queries (local/single-tenant tables)
  db/postgres.js             Postgres schema + pool (hosted accounts/billing only)
  repositories/accountsRepo.js
  services/
    appMode.js                isHostedMode() — local vs hosted, parallel to isR2Mode()
    auth.js                    JWT issuance/verification, password hashing
    localLicenseGate.js        in-process flag the Electron main process flips
    mediaIdentity.js           content-ID resolve/cache/relink orchestration
    instagram.js, openai.js, r2.js
  utils/contentId.js          EXIF/PNG-chunk/ffmpeg metadata read+write
  middleware/requireAccount.js
  routes/                     one file per API area (media, posts, queue, schedule,
                               tags, analytics, account, billing, admin, ...)
electron/
  main.js, preload.js, license-manager.js, ngrok-manager.js
frontend/src/
  views/, components/, stores/, router/
```

## Running tests

```bash
cd backend && npm test     # Jest
cd frontend && npm test    # Vitest
```

Backend tests are split by how much they touch real I/O:
- `utils/contentId.test.js` generates real JPEG/PNG/MP4 fixtures with the
  bundled ffmpeg binary and round-trips the actual metadata-stamping logic —
  no mocking, this exercises the real format quirks (which is exactly how a
  missing `ffprobe-static` dependency and a missing MP4 `movflags` setting
  were caught while building this).
- `services/auth.test.js`, `services/appMode.test.js` are pure-logic tests.
- `services/mediaIdentity.test.js` mocks `database.js`/`r2.js`/`contentId.js`
  to test the cache/resolve/relink orchestration in isolation.

**Windows caveat**: `better-sqlite3` is a native module. The Electron app
rebuilds it for Electron's bundled Node version via `npm run rebuild-native`;
if your system `node` (used by plain `npm test` or `node backend/src/index.js`)
is a different version, requiring `database.js` directly will fail with a
`NODE_MODULE_VERSION` mismatch until you rebuild for that Node version too
(`npm rebuild better-sqlite3` from `backend/`, which needs Visual Studio Build
Tools on Windows). None of the current test files require `database.js`
directly for this reason — they're written to need only what's mockable —
but it's worth knowing about before adding tests that do.

## Video limits

| Type | Max Size | Max Duration |
|------|----------|--------------|
| Feed Video | 100 MB | 60 seconds |
| Reels | 1 GB | 90 seconds |
| Image | 8 MB | — |

MP4 (H.264) recommended. Managram checks file size and duration before posting.
