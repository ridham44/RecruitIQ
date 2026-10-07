#!/usr/bin/env bash
# RecruitIQ — self-hosted deploy on port 2020 behind recruitiq.hanaplatform.com.
#
# Run on the server from the project root:
#   chmod +x deploy.sh && ./deploy.sh
#
# Optional env vars:
#   CERTBOT_EMAIL=you@example.com   issue an HTTPS cert with certbot (first run)
#   SKIP_NGINX=1                    don't touch nginx
#   SKIP_MIGRATE=1                  don't run prisma migrate deploy
set -euo pipefail

APP_NAME="recruitiq"
PORT=2020
DOMAIN="recruitiq.hanaplatform.com"
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$APP_DIR"

log()  { echo -e "\033[1;36m==>\033[0m $*"; }
warn() { echo -e "\033[1;33m[warn]\033[0m $*"; }
die()  { echo -e "\033[1;31m[error]\033[0m $*" >&2; exit 1; }

SUDO=""
if [ "$(id -u)" -ne 0 ] && command -v sudo >/dev/null 2>&1; then SUDO="sudo"; fi

# ── 1. Prerequisites ────────────────────────────────────────────────
command -v node >/dev/null 2>&1 || die "Node.js is not installed (need >= 18)."
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
[ "$NODE_MAJOR" -ge 18 ] || die "Node.js >= 18 required, found $(node -v)."
command -v npm >/dev/null 2>&1 || die "npm is not installed."

if [ ! -f .env ]; then
  if [ -f .env.production ]; then
    log "No .env found — copying .env.production to .env"
    cp .env.production .env
  else
    die "No .env or .env.production in $APP_DIR. Upload it first."
  fi
fi
grep -q "^PORT=$PORT" .env || warn ".env PORT is not $PORT — the server reads PORT from .env."

# ── 2. Free port 2020 ───────────────────────────────────────────────
port_pids() {
  if command -v lsof >/dev/null 2>&1; then
    $SUDO lsof -t -iTCP:"$PORT" -sTCP:LISTEN 2>/dev/null || true
  elif command -v ss >/dev/null 2>&1; then
    $SUDO ss -ltnpH "sport = :$PORT" 2>/dev/null | grep -oP 'pid=\K[0-9]+' | sort -u || true
  elif command -v fuser >/dev/null 2>&1; then
    $SUDO fuser "$PORT"/tcp 2>/dev/null | tr -s ' ' '\n' | grep -E '^[0-9]+$' || true
  fi
}

# Stop our own pm2 process first so pm2 doesn't respawn it after a kill.
if command -v pm2 >/dev/null 2>&1 && pm2 describe "$APP_NAME" >/dev/null 2>&1; then
  log "Stopping existing pm2 process '$APP_NAME'"
  pm2 stop "$APP_NAME" >/dev/null || true
fi

PIDS="$(port_pids)"
if [ -n "$PIDS" ]; then
  log "Port $PORT is in use by PID(s): $(echo $PIDS) — stopping"
  for pid in $PIDS; do ps -o pid=,cmd= -p "$pid" 2>/dev/null || true; done
  $SUDO kill $PIDS 2>/dev/null || true
  for _ in $(seq 1 10); do
    [ -z "$(port_pids)" ] && break
    sleep 1
  done
  PIDS="$(port_pids)"
  if [ -n "$PIDS" ]; then
    warn "Still running after 10s — force killing $(echo $PIDS)"
    $SUDO kill -9 $PIDS 2>/dev/null || true
    sleep 1
  fi
  [ -z "$(port_pids)" ] || die "Could not free port $PORT."
  log "Port $PORT is free"
else
  log "Port $PORT is free"
fi

# ── 3. Code, dependencies, build ────────────────────────────────────
if [ -d .git ]; then
  log "Pulling latest code"
  git pull --ff-only || warn "git pull failed — deploying the code already on disk."
fi

log "Installing dependencies"
# --include=dev: vite and prisma CLI are devDependencies but needed to build.
npm ci --include=dev

log "Building frontend + Prisma client"
npm run build
[ -f dist/index.html ] || die "Build did not produce dist/index.html."

if [ "${SKIP_MIGRATE:-0}" != "1" ]; then
  log "Applying database migrations"
  npx prisma migrate deploy
fi

mkdir -p uploads logs

# ── 4. Start the app ────────────────────────────────────────────────
if ! command -v pm2 >/dev/null 2>&1; then
  log "Installing pm2"
  $SUDO npm install -g pm2 || npm install -g pm2
fi

log "Starting $APP_NAME on port $PORT with pm2"
if pm2 describe "$APP_NAME" >/dev/null 2>&1; then
  pm2 delete "$APP_NAME" >/dev/null
fi
pm2 start src/server/prod-server.js \
  --name "$APP_NAME" \
  --cwd "$APP_DIR" \
  --time \
  --output "$APP_DIR/logs/out.log" \
  --error "$APP_DIR/logs/error.log"
pm2 save >/dev/null
# Survive reboots (prints a command to run once if it can't set it up itself).
$SUDO env PATH="$PATH" pm2 startup systemd -u "$(whoami)" --hp "$HOME" >/dev/null 2>&1 \
  || warn "Run 'pm2 startup' once manually so the app restarts after reboot."

log "Waiting for health check"
for i in $(seq 1 20); do
  if curl -fsS "http://127.0.0.1:$PORT/api/health" >/dev/null 2>&1; then
    log "App is up: http://127.0.0.1:$PORT"
    break
  fi
  [ "$i" -eq 20 ] && { pm2 logs "$APP_NAME" --lines 50 --nostream; die "App did not respond on port $PORT."; }
  sleep 1
done

# ── 5. nginx reverse proxy for the domain ───────────────────────────
if [ "${SKIP_NGINX:-0}" != "1" ] && command -v nginx >/dev/null 2>&1; then
  if [ -d /etc/nginx/sites-available ]; then
    NGINX_CONF="/etc/nginx/sites-available/$DOMAIN"
    NGINX_LINK="/etc/nginx/sites-enabled/$DOMAIN"
  else
    NGINX_CONF="/etc/nginx/conf.d/$DOMAIN.conf"
    NGINX_LINK=""
  fi

  # Only write the config once — certbot edits it to add the HTTPS block,
  # and overwriting it on every deploy would drop that.
  if [ ! -f "$NGINX_CONF" ]; then
    log "Writing nginx config $NGINX_CONF"
    $SUDO tee "$NGINX_CONF" >/dev/null <<NGINX
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN;

    client_max_body_size 10m;

    location / {
        proxy_pass http://127.0.0.1:$PORT;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 120s;
    }
}
NGINX
    [ -n "$NGINX_LINK" ] && $SUDO ln -sf "$NGINX_CONF" "$NGINX_LINK"
  else
    log "nginx config $NGINX_CONF already exists — leaving it as is"
  fi

  $SUDO nginx -t && $SUDO systemctl reload nginx
  log "nginx is proxying $DOMAIN -> 127.0.0.1:$PORT"

  if [ -n "${CERTBOT_EMAIL:-}" ] && command -v certbot >/dev/null 2>&1; then
    if [ ! -d "/etc/letsencrypt/live/$DOMAIN" ]; then
      log "Requesting HTTPS certificate for $DOMAIN"
      $SUDO certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "$CERTBOT_EMAIL" --redirect \
        || warn "certbot failed — check that $DOMAIN's DNS A record points to this server."
    fi
  elif [ ! -d "/etc/letsencrypt/live/$DOMAIN" ]; then
    warn "No HTTPS cert yet. Re-run with CERTBOT_EMAIL=you@example.com ./deploy.sh (needs certbot)."
  fi
elif [ "${SKIP_NGINX:-0}" != "1" ]; then
  warn "nginx not installed — app is only reachable on port $PORT. Point $DOMAIN at it via your proxy."
fi

log "Done. https://$DOMAIN"
pm2 status "$APP_NAME"
