# News 9 Today Portal - PRD

## Problem Statement
Telugu news portal (News 9 Today) where admin uploads news; public site shows Sports, Cinema, Photos, Videos and other sections. Full Telugu UI, admin customization, YouTube auto-import, ads system, weather/stock widgets, region-based news.

## Architecture
- Backend: FastAPI + Motor (MongoDB), PyJWT, bcrypt, Emergent object storage, YouTube RSS, Open-Meteo, Yahoo Finance
- Frontend: React 19 + React Router 7 + Tailwind + Shadcn + hls.js + DOMPurify + react-fast-marquee
- DB: users, news, files, categories, settings, pages, ads
- Fonts: Playfair Display + IBM Plex Sans + Noto Sans Telugu + 18 Google Fonts Telugu fonts

## Test Credentials
Admin: `admin@news.com` / `admin123`
Site: https://content-manager-163.preview.emergentagent.com
Contact: 9393950505 / news9today99@gmail.com

## Implemented (feature-complete through Feb 2026)

### Core (Iterations 1-2)
- JWT admin auth, news CRUD, categories, image upload via Emergent object storage
- Editorial homepage, article detail, admin dashboard, 12 seeded articles
- Full Telugu UI (i18n.js T.* dictionary), category management, live TV admin, flash news toggle
- Search bar + pagination, rich-text editor, multi-image galleries, social share buttons

### Rebrand + Advanced (Iteration 3)
- Site rebranded to News 9 Today with real logo (/logo.png)
- Colors: red #E11D2E + blue #1E4B9C (from logo)
- YouTube channel auto-import via RSS feed (no API key)
- Ads system: strip / sidebar / image / video placements + admin CRUD
- Weather widget (Open-Meteo free API), Stock ticker (Yahoo Finance)
- Privacy Policy + Terms editable pages, /live dedicated Live TV page
- Contact settings, 19 Telugu font selector for article body

### Admin Customization + Location (Iteration 4)
- Theme admin: primary/secondary/accent color pickers, logo URL, site name & tagline editors
- Social links: Twitter/Instagram/Facebook/WhatsApp/YouTube in Contact tab → shown in header strip + footer
- Breaking news category picker: multi-select which categories drive the top marquee
- Region-based news via geolocation: 5 regions (National + Telangana + AP + Karnataka + Tamil Nadu) with bbox detection + manual picker + localStorage
- YouTube Shorts rail on homepage (9:16 vertical cards from YT-source items)
- Article region field, region-filtered news feed

## Test Results
- Iteration 1: 15/15 passed
- Iteration 2: 21/21 passed
- Iteration 3: deferred (completed in iter 5)
- Iteration 4: 22/22 fixed + 43/43 retest passed
- Iteration 5: 104/105 passed → 1 fix applied
- Iteration 6: 43/43 backend retest passed (100%)
- Iteration 7-8: backend 20/20, feed sources + Hindi labels verified

## Recent Fixes (Feb 2026)
- Fix: Local domain admin login was building `/admin/undefined/api/auth/login`
  when `REACT_APP_BACKEND_URL` was missing at build time on self-hosted builds.
  `frontend/src/lib/api.js` now safely falls back to a relative `/api` (same-origin
  reverse-proxy deployments), while preview builds with the env var continue to
  use the absolute URL. `resolveImageUrl` handles the same-origin case too.
  Verified `POST /api/auth/login` returns 200 on preview after change.
- Added `/app/backend/seed.py` — one-shot / idempotent seed for admin, categories,
  settings (with `SITE_DOMAIN=https://news9today.com`), pages, and 12 sample
  articles. Supports `--reset-admin`, `--wipe-news`, `--full-reset`.
- Added `.env.example` templates for backend and frontend for reproducible
  self-hosted setup.

## Backlog

### P1
- Image insertion inside rich-text editor
- OpenGraph meta tags per article (share previews)
- Multi-channel Live TV picker (list of channels admin can flip between)
- View count UI badge on articles

### P2
- Comments (anonymous or via Emergent Google Auth)
- Push notifications for breaking news
- RSS feed generation
- Working newsletter backend
- LLM English↔Telugu translation (paste English → auto-Telugu via Emergent LLM key)
- Auto-schedule YouTube sync (currently manual)
- SEO sitemap.xml

### Nice-to-have
- Editor's Pick carousel between hero and Latest News
- Reading time estimate per article
- Dark mode toggle
