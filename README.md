# Managram — Instagram Content Manager

Electron desktop app for automated Instagram content management.

## Features
- Media Library — browse local content folder
- AI Captions — GPT-4o generates captions with style selection
- Queue — scheduled post queue with auto-posting
- Schedules — recurring post times (e.g. 5:30 PM every weekday)
- Dashboard — account stats and recent posts
- Video Preflight — size/format checks before posting

## Prerequisites
- Node.js 18+
- Instagram Business or Creator account linked to a Facebook Page
- Facebook Developer App
- OpenAI API key (for AI captions)
- ngrok account (free) — for media delivery

## Quick Start

### Step 1 — Install dependencies
```bash
cd Managram
npm run install:all
```

### Step 2 — Facebook Developer App
1. Go to developers.facebook.com → My Apps → Create App → Business
2. Add the Instagram Graph API product
3. Under Settings → Basic: copy App ID and App Secret
4. Under Facebook Login → Settings: add `http://localhost:3001/auth/callback` as a valid OAuth Redirect URI

### Step 3 — Instagram Business Account
Your Instagram must be a Business or Creator account linked to a Facebook Page:
- Instagram app: Settings → Account → Switch to Professional Account
- Facebook: Settings → Linked Accounts → Instagram

### Step 4 — ngrok account (free)
1. Sign up at ngrok.com (free)
2. Copy your Authtoken from dashboard.ngrok.com/get-started/your-authtoken
3. You'll paste it into Managram's Settings page — the app manages the tunnel automatically

### Step 5 — OpenAI API key
1. platform.openai.com/api-keys → Create new secret key
2. Paste into Managram Settings

### Step 6 — Run the app
```bash
npm run dev
```
Electron will open automatically once the frontend dev server is ready.

## First-time setup in the app
1. Enter Facebook App ID and App Secret on the login screen
2. Click Connect with Instagram and authorize
3. In Settings:
   - Set your Content Folder path (native folder picker available)
   - Add ngrok Authtoken — click Save & Connect
   - Add OpenAI API key
4. Go to Library to see your media

## Tech Stack
- Electron 28, Vue 3, Vite, Pinia, Tailwind CSS
- Express.js, better-sqlite3, node-cron
- Instagram Graph API v18.0, OpenAI GPT-4o, @ngrok/ngrok

## Video Limits
| Type | Max Size | Max Duration |
|------|----------|--------------|
| Feed Video | 100 MB | 60 seconds |
| Reels | 1 GB | 90 seconds |
| Image | 8 MB | — |

MP4 (H.264) recommended. Managram checks file size before posting.
