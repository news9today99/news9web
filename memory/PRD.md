# ABN Andhra News Portal - PRD

## Problem Statement
Build a news portal (ABN Andhra Jyothi-inspired) where admin uploads news from backend and public site displays them with video attachments, sports, cinema, photos categories. Telugu support required.

## Architecture
- **Backend**: FastAPI + Motor (async MongoDB), PyJWT, bcrypt, Emergent object storage, hls.js (frontend)
- **Frontend**: React 19 + React Router 7 + Tailwind + Shadcn UI + react-fast-marquee + Sonner + DOMPurify
- **DB Collections**: `users`, `news`, `files`, `categories`, `settings`
- **Fonts**: Playfair Display + IBM Plex Sans + Noto Sans Telugu
- **Design**: Editorial newspaper — red (#DC2626) + blue (#1E3A8A) + off-white paper

## Implemented

### Iteration 1 (2026-02-15)
- JWT admin auth + bcrypt
- News CRUD, categories, image upload (Emergent object storage)
- Editorial homepage, article page, admin dashboard with 12 seeded articles
- Test result: 15/15 passed

### Iteration 2 (2026-02-15)
- **Full Telugu UI**: All nav labels, buttons, form labels, dashboard, footer in Telugu (via lib/i18n.js)
- **Admin category management**: Add/edit/delete categories with English + Telugu names + display order; blocked if articles exist
- **Live TV admin control**: URL + stream type (YouTube / HLS / MP4) + channel titles; hls.js integrated for .m3u8 streams
- **Flash news toggle**: Per-article `is_flash` flag controls what appears in the top marquee (admin picks)
- **Search bar**: Header search icon + /search?q= page with full-text query across title/summary/body
- **Category pagination**: 12/page with Previous/Next controls
- **Rich-text editor**: Bold/Italic/Heading/Quote/List/Link/Undo/Redo (contenteditable + DOMPurify sanitization on render)
- **Multi-image galleries**: Multiple images per article + lightbox viewer
- **Social share buttons**: Twitter, Facebook, WhatsApp + native share + copy-link
- Test result: 21/21 backend + all frontend flows passed

## Test Credentials
Admin: `admin@news.com` / `admin123`

## Backlog

### P1
- Rich-text editor: add image insertion inline
- Article view counts + author bio
- Improved SEO (meta tags, OpenGraph) — currently minimal
- Live TV: reset-to-default button + multi-channel picker

### P2
- Comments system (anonymous or Emergent Google Auth)
- Push notifications for breaking news
- RSS feed
- Newsletter backend (currently UI-only)
- Multi-admin user management + roles
- Automatic translation (English ↔ Telugu) via LLM

## Recent Notes
- Existing 12 seed articles have plain-text bodies (pre-rich-editor). New articles use HTML.
- Flash news marquee reads `is_flash=true` items; migrated 5 featured items to also be flash.
- RTMP streams don't work directly in browsers — admin must convert to HLS (help text shown).
