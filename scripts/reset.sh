#!/usr/bin/env bash
# scripts/reset.sh
#
# One-command reset & rebuild for News 9 Today
# ============================================
# Usage:
#   bash scripts/reset.sh                # seed admin + settings (safe, no data loss)
#   bash scripts/reset.sh --reset-admin  # force reset admin password
#   bash scripts/reset.sh --wipe-news    # wipe news, re-seed 12 samples
#   bash scripts/reset.sh --full-reset   # WIPE EVERYTHING and reseed
#
# What it does:
#   1. Ensures backend/.env exists (from .env.example if missing)
#   2. Ensures frontend/.env  exists (from .env.production.example if missing)
#   3. Installs Python deps if needed
#   4. Runs the DB seeder (backend/seed.py) with any flags you pass through
#   5. Installs frontend deps (yarn) if node_modules missing
#   6. Builds the frontend production bundle
#   7. Restarts supervisor services if available

set -euo pipefail

# ---------- locate project root ----------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
BACKEND_DIR="${ROOT_DIR}/backend"
FRONTEND_DIR="${ROOT_DIR}/frontend"

# ---------- colors ----------
if [ -t 1 ]; then
  BLUE="\033[1;34m"; GREEN="\033[1;32m"; YELLOW="\033[1;33m"; RED="\033[1;31m"; DIM="\033[2m"; RESET="\033[0m"
else
  BLUE=""; GREEN=""; YELLOW=""; RED=""; DIM=""; RESET=""
fi

step()  { echo -e "\n${BLUE}▸${RESET} ${1}"; }
ok()    { echo -e "  ${GREEN}✓${RESET} ${1}"; }
warn()  { echo -e "  ${YELLOW}!${RESET} ${1}"; }
fail()  { echo -e "  ${RED}✗${RESET} ${1}"; exit 1; }

echo -e "${BLUE}=========================================${RESET}"
echo -e "${BLUE}  News 9 Today — reset & rebuild${RESET}"
echo -e "${BLUE}=========================================${RESET}"
echo -e "${DIM}Project: ${ROOT_DIR}${RESET}"

SEED_FLAGS="$*"
if [ -n "${SEED_FLAGS}" ]; then
  echo -e "${DIM}Seed flags: ${SEED_FLAGS}${RESET}"
fi

# ---------- 1. env files ----------
step "Checking env files"
if [ ! -f "${BACKEND_DIR}/.env" ]; then
  if [ -f "${BACKEND_DIR}/.env.example" ]; then
    cp "${BACKEND_DIR}/.env.example" "${BACKEND_DIR}/.env"
    warn "backend/.env was missing — created from .env.example. EDIT IT before going live."
  else
    fail "backend/.env and backend/.env.example both missing"
  fi
else
  ok "backend/.env exists"
fi

if [ ! -f "${FRONTEND_DIR}/.env" ]; then
  if [ -f "${FRONTEND_DIR}/.env.production.example" ]; then
    cp "${FRONTEND_DIR}/.env.production.example" "${FRONTEND_DIR}/.env"
    warn "frontend/.env was missing — created from .env.production.example."
  else
    warn "frontend/.env missing and no template found — api.js will fall back to relative /api"
  fi
else
  ok "frontend/.env exists"
fi

# ---------- 2. python deps ----------
step "Checking Python dependencies"
if ! python -c "import motor, bcrypt, dotenv" >/dev/null 2>&1; then
  warn "installing backend requirements"
  pip install -q -r "${BACKEND_DIR}/requirements.txt" || fail "pip install failed"
fi
ok "Python deps ready"

# ---------- 3. seed database ----------
step "Seeding database"
cd "${BACKEND_DIR}"
# shellcheck disable=SC2086
python seed.py ${SEED_FLAGS} || fail "seed.py failed"

# ---------- 4. frontend build ----------
step "Building frontend"
cd "${FRONTEND_DIR}"
if [ ! -d node_modules ]; then
  warn "node_modules missing — running yarn install (this may take a while)"
  yarn install --frozen-lockfile || yarn install || fail "yarn install failed"
fi

if grep -q "\"build\"" package.json; then
  yarn build || fail "yarn build failed"
  ok "frontend build complete → ${FRONTEND_DIR}/build"
else
  warn "no build script in package.json — skipping build"
fi

# ---------- 5. restart services ----------
step "Restarting services"
if command -v supervisorctl >/dev/null 2>&1; then
  sudo supervisorctl restart backend frontend 2>/dev/null \
    || supervisorctl restart backend frontend 2>/dev/null \
    || warn "supervisorctl restart failed — restart your process manager manually"
  ok "supervisor restart requested"
else
  warn "supervisorctl not found — restart your web server manually"
fi

# ---------- done ----------
echo ""
echo -e "${GREEN}=========================================${RESET}"
echo -e "${GREEN}  ✅ Reset complete${RESET}"
echo -e "${GREEN}=========================================${RESET}"

ADMIN_EMAIL_VAL="$(grep -E '^ADMIN_EMAIL=' "${BACKEND_DIR}/.env" | cut -d '=' -f2- | tr -d '"' || true)"
ADMIN_PWD_VAL="$(grep -E '^ADMIN_PASSWORD=' "${BACKEND_DIR}/.env" | cut -d '=' -f2- | tr -d '"' || true)"
DOMAIN_VAL="$(grep -E '^SITE_DOMAIN=' "${BACKEND_DIR}/.env" | cut -d '=' -f2- | tr -d '"' || true)"

echo -e "Admin login : ${YELLOW}${ADMIN_EMAIL_VAL:-admin@news.com}${RESET} / ${YELLOW}${ADMIN_PWD_VAL:-admin123}${RESET}"
echo -e "Site        : ${YELLOW}${DOMAIN_VAL:-https://news9today.com}${RESET}/admin"
echo ""
echo -e "${DIM}Tip: if login still fails, run:  bash scripts/reset.sh --reset-admin${RESET}"
