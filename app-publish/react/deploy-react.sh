#!/usr/bin/env bash
set -euo pipefail

#############################################
# echo "deploy ALL=(ALL) NOPASSWD:ALL" | sudo tee /etc/sudoers.d/90-deploy-nopasswd
# 1) Load .env (overrides defaults)
#############################################
if [[ -f ./.env ]]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi

#############################################
# 2) Defaults (keep these minimal)
#############################################
APP_NAME_UI="${APP_NAME_UI:-hive-planner-ui}"

# SSH
SSH_USER="${SSH_USER:-deploy}"
SSH_HOST="${SSH_HOST:-}"               # required
SSH_PORT="${SSH_PORT:-22}"
KEYFILE="${KEYFILE:-}"                 # OpenSSH private key path (NOT .ppk)

# Directories (project and server)
PROJECT_DIR_UI="${PROJECT_DIR_UI:-$(pwd)}"

BASE_DIR="${BASE_DIR:-/srv/apps/hive-planner}"
BASE_DIR_UI="${BASE_DIR_UI:-$BASE_DIR/hive-planner-ui}"
RELEASES_DIR_UI="${RELEASES_DIR_UI:-$BASE_DIR_UI/releases}"
CURRENT_LINK_UI="${CURRENT_LINK_UI:-$BASE_DIR_UI/current}"
KEEP_RELEASES_UI="${KEEP_RELEASES_UI:-5}"

OWNER_USER="${OWNER_USER:-www-data}"
OWNER_GROUP="${OWNER_GROUP:-www-data}"

# Build / package
TIMESTAMP="${TIMESTAMP:-$(date +%Y%m%d_%H%M%S)}"
ARCHIVE="${APP_NAME_UI}_${TIMESTAMP}.tar.gz"

#############################################
# 3) SSH options (reuse connection + trust on first use)
#############################################
mkdir -p "$HOME/.ssh/cm"
SSH_CTRL_PATH="${SSH_CTRL_PATH:-$HOME/.ssh/cm/%r@%h:%p}"
SSH_OPTS=(-p "$SSH_PORT" -o StrictHostKeyChecking=accept-new \
          -o ControlMaster=auto -o ControlPersist=300 -o ControlPath="$SSH_CTRL_PATH")
SCP_OPTS=(-P "$SSH_PORT" -o StrictHostKeyChecking=accept-new \
          -o ControlMaster=auto -o ControlPersist=300 -o ControlPath="$SSH_CTRL_PATH")
if [[ -n "${KEYFILE}" ]]; then
  SSH_OPTS+=(-i "$KEYFILE")
  SCP_OPTS+=(-i "$KEYFILE")
fi

# Prefer ssh-agent so passphrase is cached (no repeated prompts)
if [[ -n "${KEYFILE}" && -z "${SSH_AUTH_SOCK:-}" ]]; then
  eval "$(ssh-agent -s)" >/dev/null
fi
if [[ -n "${KEYFILE}" ]]; then
  ssh-add -l >/dev/null 2>&1 || ssh-add "$KEYFILE" || true
fi

# Open a master connection up-front (if not present) to avoid a 2nd prompt
ssh -MNf "${SSH_OPTS[@]}" "$SSH_USER@$SSH_HOST" 2>/dev/null || true

#############################################
# 4) Build (Vite / CRA auto-detect)
#############################################
if [[ ! -f "${PROJECT_DIR_UI}/package.json" ]]; then
  echo "[ERROR] package.json not found in ${PROJECT_DIR_UI}"; exit 1
fi

echo "[INFO] Building UI from: ${PROJECT_DIR_UI}"
cd "$PROJECT_DIR_UI"

PKG_MANAGER="npm"
if command -v pnpm >/dev/null 2>&1 && [[ -f "pnpm-lock.yaml" ]]; then
  PKG_MANAGER="pnpm"
elif command -v yarn >/dev/null 2>&1 && [[ -f "yarn.lock" ]]; then
  PKG_MANAGER="yarn"
fi
echo "[INFO] Using package manager: ${PKG_MANAGER}"

case "$PKG_MANAGER" in
  npm)
    if [[ -f package-lock.json ]]; then npm ci; else npm install; fi
    # Vite: base is set in vite.config.js (prod => '/hive-planner/')
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

BUILD_DIR=""
[[ -d dist  ]] && BUILD_DIR="dist"
[[ -z "$BUILD_DIR" && -d build ]] && BUILD_DIR="build"
if [[ -z "$BUILD_DIR" || -z "$(ls -A "$BUILD_DIR" 2>/dev/null || true)" ]]; then
  echo "[ERROR] Build output missing/empty (expected ./dist or ./build)."; exit 1
fi

#############################################
# 5) Package & upload (single archive)
#############################################
trap 'rm -f "$ARCHIVE"' EXIT
echo "[INFO] Packaging ${BUILD_DIR}/ -> ${ARCHIVE}"
tar -C "$BUILD_DIR" -czf "$ARCHIVE" .

echo "[INFO] Uploading archive to ${SSH_USER}@${SSH_HOST}:/tmp/"
scp "${SCP_OPTS[@]}" "$ARCHIVE" "$SSH_USER@$SSH_HOST:/tmp/"

#############################################
# 6) Remote deploy (releases + current symlink)
#############################################
echo "[INFO] Deploying on remote server..."
ssh "${SSH_OPTS[@]}" "$SSH_USER@$SSH_HOST" \
  APP_NAME_UI="$APP_NAME_UI" \
  RELEASES_DIR_UI="$RELEASES_DIR_UI" \
  CURRENT_LINK_UI="$CURRENT_LINK_UI" \
  KEEP_RELEASES_UI="$KEEP_RELEASES_UI" \
  OWNER_USER="$OWNER_USER" \
  OWNER_GROUP="$OWNER_GROUP" \
  ARCHIVE="$ARCHIVE" \
  TIMESTAMP="$TIMESTAMP" \
  'bash -se' <<'REMOTE_EOF'
set -euo pipefail

ARCHIVE="/tmp/$ARCHIVE"
TARGET="${RELEASES_DIR_UI}/${TIMESTAMP}"

# Prepare folders
sudo -n mkdir -p "${RELEASES_DIR_UI}" "$(dirname "${CURRENT_LINK_UI}")" || {
  echo "[ERROR] sudo requires NOPASSWD for this user."; exit 1; }

# Keep a reference to previous release (for rollback)
PREV=""
if [[ -L "${CURRENT_LINK_UI}" ]]; then
  PREV="$(readlink -f "${CURRENT_LINK_UI}")" || true
fi

echo "[REMOTE] Extracting to ${TARGET}"
sudo -n mkdir -p "${TARGET}"
sudo -n tar -C "${TARGET}" -xzf "${ARCHIVE}"
sudo -n rm -f "${ARCHIVE}"

# Permissions
sudo -n chown -R "${OWNER_USER}:${OWNER_GROUP}" "${TARGET}"
sudo -n find "${TARGET}" -type f -exec chmod 0644 {} \;
sudo -n find "${TARGET}" -type d -exec chmod 0755 {} \;

echo "[REMOTE] Switching current -> ${TARGET}"
sudo -n ln -sfn "${TARGET}" "${CURRENT_LINK_UI}"

# Reload nginx if present
if command -v nginx >/dev/null 2>&1 && sudo -n nginx -t >/dev/null 2>&1; then
  sudo -n systemctl reload nginx || true
fi

echo "[REMOTE] Clean old releases, keep ${KEEP_RELEASES_UI}"
COUNT=$(ls -1dt "${RELEASES_DIR_UI}"/* 2>/dev/null | wc -l || true)
if [[ "$COUNT" -gt "$KEEP_RELEASES_UI" ]]; then
  ls -1dt "${RELEASES_DIR_UI}"/* | tail -n +$((KEEP_RELEASES_UI + 1)) | xargs -r sudo -n rm -rf
fi

echo "[REMOTE] UI deploy complete."
REMOTE_EOF

# Close master connection (ok if already gone)
ssh -O exit "${SSH_OPTS[@]}" "$SSH_USER@$SSH_HOST" 2>/dev/null || true

echo "[DONE] ${APP_NAME_UI} deployed. Current -> ${CURRENT_LINK_UI}"
