#!/usr/bin/env bash
set -euo pipefail

#############################################
# 1) Load .env (all sensitive values live here)
#############################################
if [[ -f ./.env ]]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi

#############################################
# 2) Defaults (can be overridden by .env)
#############################################
APP_NAME_UI="${APP_NAME_UI:-hiveui}"

SSH_USER="${SSH_USER:-deploy}"
SSH_HOST="${SSH_HOST:-x.x.x.x}"
SSH_PORT="${SSH_PORT:-22}"
KEYFILE="${KEYFILE:-}"                 # optional .pem (OpenSSH). Do NOT use .ppk.

# Local project root (must contain package.json)
PROJECT_DIR_UI="${PROJECT_DIR_UI:-$(pwd)}"

# Ownership on the server (nginx/www)
OWNER_USER="${OWNER_USER:-www-data}"
OWNER_GROUP="${OWNER_GROUP:-www-data}"

# Per-app layout (not under /var/www)
BASE_DIR_UI="${BASE_DIR_UI:-/srv/apps/${APP_NAME_UI}}"
RELEASES_DIR_UI="${RELEASES_DIR_UI:-${BASE_DIR_UI}/releases}"
CURRENT_LINK_UI="${CURRENT_LINK_UI:-${BASE_DIR_UI}/current}"
KEEP_RELEASES_UI="${KEEP_RELEASES_UI:-5}"

TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
ARCHIVE="${APP_NAME_UI}_${TIMESTAMP}.tar.gz"

# Compose ssh/scp options (only add -i if KEYFILE set)
SSH_ID_OPT=()
if [[ -n "${KEYFILE}" ]]; then
  SSH_ID_OPT=(-i "$KEYFILE")
fi

#############################################
# 3) Locate project (auto-fix common mistake)
#############################################
# If package.json is not here, try common sibling paths relative to current dir
if [[ ! -f "${PROJECT_DIR_UI}/package.json" ]]; then
  for guess in "./frontend" "./frontend/plancraft-ui" "../frontend" "../frontend/plancraft-ui"; do
    if [[ -f "${guess}/package.json" ]]; then
      echo "[INFO] Auto-detected React project at: ${guess}"
      PROJECT_DIR_UI="$(cd "$guess" && pwd)"
      break
    fi
  done
fi

# Final check
if [[ ! -f "${PROJECT_DIR_UI}/package.json" ]]; then
  echo "[ERROR] package.json not found in ${PROJECT_DIR_UI}"
  echo "        Set PROJECT_DIR_UI in your .env to the React project's root (where package.json lives),"
  echo "        or run this script from that directory."
  exit 1
fi

#############################################
# 4) Build
#############################################
echo "[INFO] Building React app from: ${PROJECT_DIR_UI}"
cd "$PROJECT_DIR_UI"

# Select package manager
PKG_MANAGER="npm"
if command -v pnpm >/dev/null 2>&1 && [[ -f "pnpm-lock.yaml" ]]; then
  PKG_MANAGER="pnpm"
elif command -v yarn >/dev/null 2>&1 && [[ -f "yarn.lock" ]]; then
  PKG_MANAGER="yarn"
fi
echo "[INFO] Using package manager: ${PKG_MANAGER}"

case "$PKG_MANAGER" in
  npm)
    if [[ -f package-lock.json ]]; then
      npm ci
    else
      npm install
    fi
      npm run build
    ;;
  yarn)
    yarn install --frozen-lockfile || yarn install
    yarn build
    ;;
  pnpm)
    pnpm install --frozen-lockfile || pnpm install
    pnpm build
    ;;
esac

#############################################
# 5) Pick build output folder (Vite 'dist' vs CRA 'build')
#############################################
BUILD_DIR=""
if [[ -d "${PROJECT_DIR_UI}/dist" ]]; then
  BUILD_DIR="${PROJECT_DIR_UI}/dist"
elif [[ -d "${PROJECT_DIR_UI}/build" ]]; then
  BUILD_DIR="${PROJECT_DIR_UI}/build"
fi

if [[ -z "$BUILD_DIR" ]]; then
  echo "[ERROR] Could not find build output. Expected ./dist (Vite) or ./build (CRA)."
  exit 1
fi

# Guard: ensure build dir has files
if [[ -z "$(ls -A "$BUILD_DIR" 2>/dev/null || true)" ]]; then
  echo "[ERROR] Build directory is empty: $BUILD_DIR"
  exit 1
fi

#############################################
# 6) Package & Upload
#############################################
echo "[INFO] Packaging $(basename "$BUILD_DIR")/ to ${ARCHIVE}"
tar -C "$BUILD_DIR" -czf "$ARCHIVE" .

echo "[INFO] Uploading archive to ${SSH_USER}@${SSH_HOST}:/tmp/"
scp -P "$SSH_PORT" "${SSH_ID_OPT[@]}" "$ARCHIVE" "$SSH_USER@$SSH_HOST:/tmp/"

#############################################
# 7) Remote deploy (releases + current symlink)
#############################################
echo "[INFO] Deploying on remote server..."
ssh -p "$SSH_PORT" "${SSH_ID_OPT[@]}" \
  "$SSH_USER@$SSH_HOST" \
  APP_NAME_UI="$APP_NAME_UI" \
  RELEASES_DIR_UI="$RELEASES_DIR_UI" \
  CURRENT_LINK_UI="$CURRENT_LINK_UI" \
  KEEP_RELEASES_UI="$KEEP_RELEASES_UI" \
  OWNER_USER="$OWNER_USER" \
  OWNER_GROUP="$OWNER_GROUP" \
  ARCHIVE="$ARCHIVE" \
  TIMESTAMP="$TIMESTAMP" \
  bash -se <<'REMOTE_EOF'
set -euo pipefail

ARCHIVE="/tmp/$ARCHIVE"
TARGET="${RELEASES_DIR_UI}/${TIMESTAMP}"

# Prepare folders and permissions
sudo mkdir -p "${RELEASES_DIR_UI}"
sudo mkdir -p "$(dirname "${CURRENT_LINK_UI}")"

# Keep a reference to previous release (for rollback)
PREV=""
if [[ -L "${CURRENT_LINK_UI}" ]]; then
  PREV="$(readlink -f "${CURRENT_LINK_UI}")" || true
fi

echo "[REMOTE] Extracting to ${TARGET}"
sudo mkdir -p "${TARGET}"
sudo tar -C "${TARGET}" -xzf "${ARCHIVE}"
sudo rm -f "${ARCHIVE}"

# Permissions (adjust user/group if your webserver runs under a different account)
sudo chown -R "${OWNER_USER}:${OWNER_GROUP}" "${TARGET}"
sudo find "${TARGET}" -type f -exec chmod 0644 {} \;
sudo find "${TARGET}" -type d -exec chmod 0755 {} \;

echo "[REMOTE] Switching current -> ${TARGET}"
sudo ln -sfn "${TARGET}" "${CURRENT_LINK_UI}"

# Try to reload nginx if present (non-fatal if not installed)
if command -v nginx >/dev/null 2>&1; then
  if sudo nginx -t >/dev/null 2>&1; then
    sudo systemctl reload nginx || true
  fi
fi

echo "[REMOTE] Clean old releases, keep ${KEEP_RELEASES_UI}"
COUNT=$(ls -1dt "${RELEASES_DIR_UI}"/* 2>/dev/null | wc -l || true)
if [[ "$COUNT" -gt "$KEEP_RELEASES_UI" ]]; then
  ls -1dt "${RELEASES_DIR_UI}"/* | tail -n +$((KEEP_RELEASES_UI + 1)) | xargs -r sudo rm -rf
fi

echo "[REMOTE] Deploy complete."
REMOTE_EOF

echo "[DONE] ${APP_NAME_UI} deployed. Current -> ${CURRENT_LINK_UI}"
