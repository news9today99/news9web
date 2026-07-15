# ABN Andhra News Portal - PRD

## Problem Statement
"create a website that when i upload news from backend in front end website all news should be visible video attachement sports section cinema section and photos all attachements attached one sample website image" (sample: ABN Andhra Jyothi Telugu news portal)

## User Choices
- Simple admin login (JWT + bcrypt)
- Sample seed data + admin can add own news
- Telugu content support (UTF-8, Noto Sans Telugu font)
- Images (Emergent object storage) + YouTube embed URLs for video
- English UI labels, Telugu-friendly typography

## Architecture
- **Backend**: FastAPI + Motor (async MongoDB), PyJWT, bcrypt, Emergent object storage integration
- **Frontend**: React 19 + React Router 7 + Tailwind + Shadcn UI + react-fast-marquee + Sonner
- **DB Collections**: `users`, `news`, `files`
- **Fonts**: Playfair Display (headlines) + IBM Plex Sans (body) + Noto Sans Telugu
- **Design**: Editorial newspaper aesthetic — bold red (#DC2626) accents, deep blue (#1E3A8A) nav, off-white paper background, sharp corners

## User Personas
1. **Reader** — visits home, browses categories, reads articles, watches embedded videos
2. **Admin (Editor)** — logs in, creates/edits/deletes news, uploads cover images, sets featured/published flags

## Core Requirements
- Multi-category news portal (Politics, Sports, Cinema, Business, Technology, Health, Photos, Videos)
- Rich article page with hero image + optional YouTube video + Telugu-friendly body
- Admin CRUD with image upload (Emergent object storage) and YouTube URL support
- Flash news marquee, Live TV widget, trending sidebar

## Implemented (2026-02-15)
- Backend
  - JWT login/logout/me (`/api/auth/*`)
  - News CRUD (`/api/news`, `/api/admin/news`) with category/featured filters
  - Image upload + serve (`/api/admin/upload`, `/api/files/{path}`) via Emergent object storage
  - 12 sample seed articles across all categories
  - Admin seeded (admin@news.com / admin123)
- Frontend
  - Home page: flash marquee, hero + side stories, latest grid, Live TV iframe, trending sidebar, per-category sections
  - Category listing page
  - Article detail with related sidebar
  - Admin login + dashboard with modal-based create/edit form
  - Image upload button with preview
  - Featured/Published toggles

## Test Results (Iteration 1)
- Backend: 100%
- Frontend: 100%
- 15/15 tests passed. Full E2E admin CRUD -> public visibility validated with Telugu text.

## Backlog (P1)
- Search functionality
- Pagination on category pages
- Article view counts + comments
- Newsletter subscription backend
- Rich text editor for admin (currently plain textarea)
- Multiple image gallery for photos category

## Backlog (P2)
- Multi-admin user management
- Push notifications for breaking news
- SEO meta tags per article
- Social sharing buttons
- Related article ML tagging
