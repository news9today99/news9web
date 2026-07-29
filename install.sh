#!/usr/bin/env bash
# ============================================================================
# News 9 Today — One-shot server installer
# ============================================================================
# Fresh Ubuntu 22.04 / 24.04 setup for https://news9today.com
#
# What this script does (idempotent — safe to re-run):
#   1. Installs system packages: python3, pip, node, yarn, mongodb, nginx,
#      git, certbot, pm2
#   2. Clones (or updates) https://github.com/news9today99/news9web.git
#   3. Sets up backend .env, frontend .env
#   4. Installs Python + Node dependencies
#   5. Runs the DB seed
#   6. Builds the frontend
#   7. Writes nginx site config (www → root redirect, /api reverse proxy)
#   8. Requests / renews Let's Encrypt cert for both www + apex domains
#   9. Starts backend under pm2 (survives reboot)
#
# Prerequisites (please do these BEFORE running):
#   * DNS: both news9today.com AND www.news9today.com must A-record to this
#     server's public IP (needed for SSL issuance).
#   * You are running as root (or via sudo).
#
# Usage:
#   sudo bash install.sh
#   sudo bash install.sh --skip-ssl        # skip Let's Encrypt (dev / staging)
#   sudo bash install.sh --skip-clone      # already cloned, just build
#   sudo bash install.sh --reset-admin     # force reset admin password
# ============================================================================

set -euo pipefail

# ---------- Config (edit these if needed) ----------
DOMAIN="news9today.com"
WWW_DOMAIN="www.news9today.com"
LETSENCRYPT_EMAIL="news9today99@gmail.com"

REPO_URL="https://github.com/news9today99/news9web.git"
APP_DIR="/opt/news9web"
BACKEND_PORT="8000"

ADMIN_EMAIL="admin@news.com"
ADMIN_PASSWORD="admin123"

NODE_MAJOR="20"                       # Node.js 20 LTS
MONGO_MAJOR="7.0"                     # MongoDB 7

# ---------- Colors ----------
if [ -t 1 ]; then
  B="\033[1;34m"; G="\033[1;32m"; Y="\033[1;33m"; R="\033[1;31m"; D="\033[2m"; N="\033[0m"
else B=""; G=""; Y=""; R=""; D=""; N=""; fi

step() { echo -e "\n${B}▸${N} ${1}"; }
ok()   { echo -e "  ${G}✓${N} ${1}"; }
warn() { echo -e "  ${Y}!${N} ${1}"; }
die()  { echo -e "  ${R}✗${N} ${1}"; exit 1; }

# ---------- Args ----------
SKIP_SSL=0
SKIP_CLONE=0
SEED_FLAGS=""
for arg in "$@"; do
  case "$arg" in
    --skip-ssl)    SKIP_SSL=1 ;;
    --skip-clone)  SKIP_CLONE=1 ;;
    --reset-admin) SEED_FLAGS="--reset-admin" ;;
    --full-reset)  SEED_FLAGS="--full-reset" ;;
    *) die "Unknown flag: $arg" ;;
  esac
done

# ---------- Root check ----------
[ "$EUID" -eq 0 ] || die "Run as root: sudo bash install.sh"

echo -e "${B}=========================================${N}"
echo -e "${B}  News 9 Today — new server installer${N}"
echo -e "${B}=========================================${N}"
echo -e "${D}Domain      : ${DOMAIN} (+ ${WWW_DOMAIN})${N}"
echo -e "${D}App path    : ${APP_DIR}${N}"
echo -e "${D}Repo        : ${REPO_URL}${N}"
echo -e "${D}Backend port: ${BACKEND_PORT}${N}"

# ============================================================================
# 1. System packages
# ============================================================================
step "Installing system packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y

# Base tools
apt-get install -y curl wget git build-essential gnupg lsb-release \
  ca-certificates software-properties-common ufw nginx

# Python 3 + pip
apt-get install -y python3 python3-pip python3-venv
# Remove conflicting apt python3-openssl (breaks pymongo)
apt-get remove -y python3-openssl 2>/dev/null || true

# Node.js
if ! command -v node >/dev/null 2>&1 || [ "$(node -v | cut -d. -f1 | tr -d v)" -lt "$NODE_MAJOR" ]; then
  warn "installing Node.js ${NODE_MAJOR}.x"
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
  apt-get install -y nodejs
fi
ok "Node $(node -v)"

# Yarn (classic)
if ! command -v yarn >/dev/null 2>&1; then
  npm install -g yarn
fi
ok "Yarn $(yarn -v)"

# PM2
if ! command -v pm2 >/dev/null 2>&1; then
  npm install -g pm2
fi
ok "PM2 $(pm2 -v)"

# MongoDB
if ! command -v mongod >/dev/null 2>&1; then
  warn "installing MongoDB ${MONGO_MAJOR}"
  curl -fsSL "https://pgp.mongodb.com/server-${MONGO_MAJOR}.asc" | \
    gpg -o /usr/share/keyrings/mongodb-server.gpg --dearmor
  UBUNTU_CODENAME="$(lsb_release -cs)"
  # 24.04 uses noble; MongoDB 7 official supports jammy — fall back if needed
  MONGO_CODENAME="$UBUNTU_CODENAME"
  case "$UBUNTU_CODENAME" in noble) MONGO_CODENAME="jammy" ;; esac
  echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server.gpg ] https://repo.mongodb.org/apt/ubuntu ${MONGO_CODENAME}/mongodb-org/${MONGO_MAJOR} multiverse" \
    > /etc/apt/sources.list.d/mongodb-org-${MONGO_MAJOR}.list
  apt-get update -y
  apt-get install -y mongodb-org
fi
systemctl enable mongod >/dev/null 2>&1 || true
systemctl start mongod
sleep 2
ok "MongoDB running ($(mongod --version | head -1))"

# Certbot
if [ "$SKIP_SSL" -eq 0 ] && ! command -v certbot >/dev/null 2>&1; then
  apt-get install -y certbot python3-certbot-nginx
fi

# ============================================================================
# 2. Clone / update repo
# ============================================================================
step "Fetching application code"
if [ "$SKIP_CLONE" -eq 0 ]; then
  if [ -d "${APP_DIR}/.git" ]; then
    warn "repo exists — pulling latest"
    cd "${APP_DIR}" && git pull --ff-only || warn "git pull had conflicts — inspect manually"
  else
    mkdir -p "$(dirname "${APP_DIR}")"
    git clone "${REPO_URL}" "${APP_DIR}"
  fi
fi
[ -d "${APP_DIR}/backend" ] || die "Missing ${APP_DIR}/backend"
[ -d "${APP_DIR}/frontend" ] || die "Missing ${APP_DIR}/frontend"
ok "code at ${APP_DIR}"

# ============================================================================
# 3. Backend .env
# ============================================================================
step "Configuring backend/.env"
BE_ENV="${APP_DIR}/backend/.env"
if [ ! -f "${BE_ENV}" ]; then
  JWT_SECRET_VAL="$(head -c 48 /dev/urandom | base64 | tr -d '=+/' | head -c 48)"
  cat > "${BE_ENV}" <<EOF
MONGO_URL="mongodb://localhost:27017"
DB_NAME="news9today"
CORS_ORIGINS="https://${DOMAIN},https://${WWW_DOMAIN}"
JWT_SECRET="${JWT_SECRET_VAL}"
ADMIN_EMAIL="${ADMIN_EMAIL}"
ADMIN_PASSWORD="${ADMIN_PASSWORD}"
SITE_DOMAIN="https://${DOMAIN}"
EMERGENT_LLM_KEY=""
APP_NAME="news9today"
EOF
  ok "backend/.env written with random JWT secret"
else
  ok "backend/.env already exists — kept as-is"
fi

# ============================================================================
# 4. Frontend .env
# ============================================================================
step "Configuring frontend/.env"
FE_ENV="${APP_DIR}/frontend/.env"
if [ ! -f "${FE_ENV}" ]; then
  cat > "${FE_ENV}" <<EOF
REACT_APP_BACKEND_URL=https://${DOMAIN}
WDS_SOCKET_PORT=443
ENABLE_HEALTH_CHECK=false
EOF
  ok "frontend/.env written"
else
  ok "frontend/.env already exists — kept as-is"
fi

# ============================================================================
# 5. Python dependencies
# ============================================================================
step "Installing Python dependencies"
cd "${APP_DIR}/backend"
python3 -m pip install --upgrade pip wheel setuptools -q
python3 -m pip install -q -r requirements.txt
# Repair pyOpenSSL / cryptography if pymongo import broken
if ! python3 -c "import pymongo" >/dev/null 2>&1; then
  warn "pymongo broken — upgrading pyOpenSSL + cryptography"
  python3 -m pip install -q --upgrade "pyOpenSSL>=24.0.0" "cryptography>=42.0.8"
fi
python3 -c "import pymongo, motor, bcrypt, fastapi" || die "backend deps failed"
ok "Python deps installed"

# ============================================================================
# 6. Seed database
# ============================================================================
step "Seeding database"
cd "${APP_DIR}/backend"
# shellcheck disable=SC2086
python3 seed.py ${SEED_FLAGS} || die "seed.py failed"

# ============================================================================
# 7. Frontend build
# ============================================================================
step "Installing & building frontend"
cd "${APP_DIR}/frontend"
yarn install --frozen-lockfile 2>/dev/null || yarn install
yarn build || die "yarn build failed"
ok "frontend build → ${APP_DIR}/frontend/build"

# ============================================================================
# 8. Nginx site config
# ============================================================================
step "Configuring nginx"
NGX_SITE="/etc/nginx/sites-available/news9today"
cat > "${NGX_SITE}" <<EOF
# HTTP → HTTPS (also handles ACME challenge)
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN} ${WWW_DOMAIN};
    location /.well-known/acme-challenge/ { root /var/www/html; }
    location / { return 301 https://${DOMAIN}\$request_uri; }
}

# www → apex redirect on HTTPS
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name ${WWW_DOMAIN};

    # SSL certs (managed by certbot; will be created after first run)
    ssl_certificate     /etc/letsencrypt/live/${DOMAIN}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${DOMAIN}/privkey.pem;
    return 301 https://${DOMAIN}\$request_uri;
}

# Main site
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name ${DOMAIN};

    ssl_certificate     /etc/letsencrypt/live/${DOMAIN}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${DOMAIN}/privkey.pem;

    client_max_body_size 20M;

    root ${APP_DIR}/frontend/build;
    index index.html;

    # API → FastAPI on ${BACKEND_PORT}
    location /api/ {
        proxy_pass http://127.0.0.1:${BACKEND_PORT};
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 120s;
    }

    # Static assets — long cache
    location /static/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # SPA fallback
    location / {
        try_files \$uri \$uri/ /index.html;
    }
}
EOF

# Enable site
ln -sf "${NGX_SITE}" /etc/nginx/sites-enabled/news9today
rm -f /etc/nginx/sites-enabled/default

# For first-time SSL issuance we need HTTP-only server to be valid — write a
# temporary minimal config if certs don't exist yet.
if [ ! -f "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" ]; then
  warn "no SSL cert yet — writing temporary HTTP-only nginx config for cert issuance"
  cat > "${NGX_SITE}" <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN} ${WWW_DOMAIN};
    root ${APP_DIR}/frontend/build;
    index index.html;
    location /.well-known/acme-challenge/ { root /var/www/html; }
    location /api/ {
        proxy_pass http://127.0.0.1:${BACKEND_PORT};
        proxy_set_header Host \$host;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
    location / { try_files \$uri \$uri/ /index.html; }
}
EOF
fi

mkdir -p /var/www/html
nginx -t || die "nginx config test failed"
systemctl enable nginx >/dev/null 2>&1 || true
systemctl reload nginx || systemctl restart nginx
ok "nginx configured"

# ============================================================================
# 9. Let's Encrypt SSL
# ============================================================================
if [ "$SKIP_SSL" -eq 0 ]; then
  step "Issuing SSL certificate (Let's Encrypt)"
  if [ ! -f "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" ]; then
    certbot --nginx -n --agree-tos -m "${LETSENCRYPT_EMAIL}" \
      -d "${DOMAIN}" -d "${WWW_DOMAIN}" || warn "certbot failed — check DNS + firewall (port 80 must be open)"
  else
    ok "cert already present — renewing if needed"
    certbot renew --quiet || warn "renewal skipped"
  fi

  # Re-write the FULL nginx config now that certs exist
  cat > "${NGX_SITE}" <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN} ${WWW_DOMAIN};
    location /.well-known/acme-challenge/ { root /var/www/html; }
    location / { return 301 https://${DOMAIN}\$request_uri; }
}
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name ${WWW_DOMAIN};
    ssl_certificate     /etc/letsencrypt/live/${DOMAIN}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${DOMAIN}/privkey.pem;
    return 301 https://${DOMAIN}\$request_uri;
}
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name ${DOMAIN};
    ssl_certificate     /etc/letsencrypt/live/${DOMAIN}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${DOMAIN}/privkey.pem;
    client_max_body_size 20M;
    root ${APP_DIR}/frontend/build;
    index index.html;
    location /api/ {
        proxy_pass http://127.0.0.1:${BACKEND_PORT};
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 120s;
    }
    location /static/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    location / { try_files \$uri \$uri/ /index.html; }
}
EOF
  nginx -t && systemctl reload nginx
  ok "HTTPS enabled for ${DOMAIN} + ${WWW_DOMAIN}"
else
  warn "SSL skipped (--skip-ssl) — site served on HTTP only"
fi

# ============================================================================
# 10. PM2 backend service
# ============================================================================
step "Starting backend under PM2"
pm2 delete news9-backend >/dev/null 2>&1 || true
# Remove any stale ecosystem file that might override env vars
rm -f "${APP_DIR}/backend/ecosystem.config.js"
# Clear pycache
find "${APP_DIR}/backend" -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true

UVICORN_BIN="$(command -v uvicorn || echo /usr/local/bin/uvicorn)"
cd "${APP_DIR}/backend"
pm2 start "${UVICORN_BIN} server:app --host 0.0.0.0 --port ${BACKEND_PORT}" \
  --name news9-backend \
  --cwd "${APP_DIR}/backend" \
  --interpreter none
pm2 save
pm2 startup systemd -u root --hp /root >/dev/null 2>&1 || true

sleep 4
if curl -fsS "http://localhost:${BACKEND_PORT}/api/categories" | grep -q '"slug"'; then
  ok "backend responding on :${BACKEND_PORT}"
else
  warn "backend responded but /api/categories not returning categories — check: pm2 logs news9-backend"
fi

# ============================================================================
# 11. Firewall
# ============================================================================
step "Configuring UFW firewall"
ufw allow OpenSSH >/dev/null 2>&1 || true
ufw allow 'Nginx Full' >/dev/null 2>&1 || true
echo "y" | ufw enable >/dev/null 2>&1 || true
ok "firewall: SSH + HTTP + HTTPS open"

# ============================================================================
# Done
# ============================================================================
PROTO="https"; [ "$SKIP_SSL" -eq 1 ] && PROTO="http"
echo ""
echo -e "${G}=========================================${N}"
echo -e "${G}  ✅ Installation complete${N}"
echo -e "${G}=========================================${N}"
echo -e "Site        : ${Y}${PROTO}://${DOMAIN}${N}"
echo -e "Admin login : ${Y}${PROTO}://${DOMAIN}/admin${N}"
echo -e "  Email     : ${Y}${ADMIN_EMAIL}${N}"
echo -e "  Password  : ${Y}${ADMIN_PASSWORD}${N}"
echo ""
echo -e "${D}Backend logs : pm2 logs news9-backend${N}"
echo -e "${D}Nginx logs   : tail -f /var/log/nginx/error.log${N}"
echo -e "${D}Reset admin  : bash scripts/reset.sh --reset-admin${N}"
echo -e "${D}Renew SSL    : certbot renew${N}"
