# Done: tests, README, 8 commits

**Tests** (57 total, all passing): backend Jest tests for content-identity metadata stamping (using *real* ffmpeg-generated JPEG/PNG/MP4 fixtures, not mocks), auth/license tokens, and the identity-cache orchestration logic; frontend Vitest tests for the time util and the tags/account Pinia stores. Writing them caught and fixed **4 real bugs** that would have shipped: a PNG metadata double-wrap, a missing `ffprobe-static` dependency (video reads silently always failed), a missing ffmpeg flag (video tags silently never persisted), and a function that existed but was never exported (would've crashed the rename route). Also caught a missing dev-proxy config that would 404 every new route in `npm run dev`.

**README**: rewritten to cover the new architecture, content-identity mechanics and its known blind spot, hosted deployment steps, the deliberately-deferred multi-tenant data-isolation work, and how to run tests.

**Commits**: 8 clean commits on `main`, nothing pushed — `git log --oneline -8` to see them. Working tree is clean.

## What you need to do to run this yourself

**Locally (Electron), quickest path:**
```bash
npm run install:all
MANAGRAM_SKIP_LICENSE=true npm run dev
```
That env var skips the license-server check entirely so you don't need any Stripe/Postgres setup just to look at it. Without it, the app will show a login screen on launch expecting a hosted license server that doesn't exist yet.

Then in the app: paste your Facebook App ID/Secret on the connect screen → Connect with Instagram → in Settings set your content folder, ngrok authtoken, and OpenAI key (same as before — nothing here changed).

**To see the new stuff specifically:**
- Library → tag a few files, click "History" on a card, rename a file and confirm the tag/rating survives.
- Analytics in the sidebar — will look empty until you actually publish something (it tracks real posts going forward, doesn't backfill history).

**If you want to try the hosted/SaaS side** (optional, more setup):
1. `node backend/scripts/generate-license-keys.js` — keep the printed private key somewhere safe, never commit it.
2. Create a Stripe account (test mode is fine), a product/price, and a webhook pointed at `/billing/webhook`.
3. Spin up a Postgres instance (Railway's add-on is the easy route).
4. Set `APP_MODE=hosted`, `DATABASE_URL`, `JWT_PRIVATE_KEY`, the `STRIPE_*` vars from the README's hosted section.
5. Sign up through the app, then manually run `UPDATE accounts SET is_admin = true WHERE email = '...'` in Postgres to get into `/admin`.

**Run the tests anytime**: `cd backend && npm test`, `cd frontend && npm test`.

**One thing to know going in**: I never got to actually see the redesigned UI render — no headless browser available in my sandbox, and `better-sqlite3`'s native module doesn't match this shell's Node version. Both builds compile clean and the logic is tested, but a real visual pass on your end (especially Analytics' charts and the Library tag UI) is the one thing I genuinely couldn't verify myself.
