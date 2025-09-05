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
APP_NAME_API="${APP_NAME_API:-hiveapi}"
SERVICE_NAME="${SERVICE_NAME:-hiveapi}"

SSH_USER="${SSH_USER:-deploy}"
SSH_HOST="${SSH_HOST:-x.x.x.x}"
SSH_PORT="${SSH_PORT:-22}"
KEYFILE="${KEYFILE:-}"                 # optional .pem/.ppk (OpenSSH format works best in Git Bash)

# Per-app layout (not under /var/www)
BASE_DIR_API="${BASE_DIR_API:-/srv/apps/${APP_NAME_API}}"
RELEASES_DIR_API="${RELEASES_DIR_API:-${BASE_DIR_API}/releases}"
CURRENT_LINK_API="${CURRENT_LINK_API:-${BASE_DIR_API}/current}"
KEEP_RELEASES_API="${KEEP_RELEASES_API:-5}"

# Local project and publish output
PROJECT_DIR_API="${PROJECT_DIR_API:-$(pwd)}"
PUBLISH_DIR="${PUBLISH_DIR:-${PROJECT_DIR_API}/publish}"

TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
ARCHIVE="${APP_NAME_API}_${TIMESTAMP}.tar.gz"

# Compose ssh/scp options (only add -i if KEYFILE set)
SSH_ID_OPT=()
if [[ -n "${KEYFILE}" ]]; then
  SSH_ID_OPT=(-i "$KEYFILE")
fi

#############################################
# 3) Build & Package
#############################################
echo "[INFO] Publishing .NET app from: ${PROJECT_DIR_API}"
cd "$PROJECT_DIR_API"
dotnet publish -c Release -o "$PUBLISH_DIR"

echo "[INFO] Packaging publish/ to ${ARCHIVE}"
tar -C "$PUBLISH_DIR" -czf "$ARCHIVE" .

#############################################
# 4) Upload to VPS (/tmp)
#############################################
echo "[INFO] Uploading archive to ${SSH_USER}@${SSH_HOST}:/tmp/"
scp -P "$SSH_PORT" "${SSH_ID_OPT[@]}" "$ARCHIVE" "$SSH_USER@$SSH_HOST:/tmp/"

#############################################
# 5) Remote deploy (releases + current symlink)
#############################################
echo "[INFO] Deploying on remote server..."

ssh -p "$SSH_PORT" "${SSH_ID_OPT[@]}" "$SSH_USER@$SSH_HOST" \
  APP_NAME_API="$APP_NAME_API" \
  SERVICE_NAME="$SERVICE_NAME" \
  RELEASES_DIR_API="$RELEASES_DIR_API" \
  CURRENT_LINK_API="$CURRENT_LINK_API" \
  KEEP_RELEASES_API="$KEEP_RELEASES_API" \
  ARCHIVE="$ARCHIVE" \
  TIMESTAMP="$TIMESTAMP" \
  bash -se <<'REMOTE_EOF'
set -euo pipefail

ARCHIVE="/tmp/$ARCHIVE"
TARGET="${RELEASES_DIR_API}/${TIMESTAMP}"

# Prepare folders and permissions
sudo mkdir -p "${RELEASES_DIR_API}"
sudo mkdir -p "$(dirname "${CURRENT_LINK_API}")"

# Keep a reference to previous release (for rollback)
PREV=""
if [[ -L "${CURRENT_LINK_API}" ]]; then
  PREV="$(readlink -f "${CURRENT_LINK_API}")" || true
fi

echo "[REMOTE] Extracting to ${TARGET}"
sudo mkdir -p "${TARGET}"
sudo tar -C "${TARGET}" -xzf "${ARCHIVE}"
sudo rm -f "${ARCHIVE}"

# Permissions
sudo chown -R www-data:www-data "${TARGET}"
sudo find "${TARGET}" -type f -exec chmod 0644 {} \;
sudo find "${TARGET}" -type d -exec chmod 0755 {} \;

echo "[REMOTE] Switching current -> ${TARGET}"
sudo ln -sfn "${TARGET}" "${CURRENT_LINK_API}"

echo "[REMOTE] Restarting service: ${SERVICE_NAME}"
if ! sudo systemctl restart "${SERVICE_NAME}"; then
  echo "[REMOTE][WARN] Restart failed. Rolling back..."
  if [[ -n "${PREV}" && -d "${PREV}" ]]; then
    sudo ln -sfn "${PREV}" "${CURRENT_LINK_API}"
    sudo systemctl restart "${SERVICE_NAME}" || true
  fi
  exit 1
fi

echo "[REMOTE] Clean old releases, keep ${KEEP_RELEASES_API}"
COUNT=$(ls -1dt "${RELEASES_DIR_API}"/* 2>/dev/null | wc -l || true)
if [[ "$COUNT" -gt "$KEEP_RELEASES_API" ]]; then
  ls -1dt "${RELEASES_DIR_API}"/* | tail -n +$((KEEP_RELEASES_API + 1)) | xargs -r sudo rm -rf
fi

echo "[REMOTE] Deploy complete."
REMOTE_EOF
