#!/usr/bin/env bash

set -euo pipefail

REMOTE_HOST="root@185.169.252.206"
REMOTE_APP_DIR="/var/lib/docker/volumes/nextcloud_nextcloud_custom_apps/_data/nextcloud-talk"
REMOTE_BRANCH="main"
NEXTCLOUD_CONTAINER="nextcloud"
APP_ID="spreed"

echo "Starting deploy to ${REMOTE_HOST}"

ssh "${REMOTE_HOST}" /bin/bash <<EOF
set -euo pipefail

cd "${REMOTE_APP_DIR}"

echo "Fetching latest changes from ${REMOTE_BRANCH}"
git fetch origin "${REMOTE_BRANCH}"

echo "Resetting working tree to origin/${REMOTE_BRANCH}"
git reset --hard "origin/${REMOTE_BRANCH}"

echo "Cleaning untracked files"
git clean -fd -e node_modules/

echo "Building frontend assets"
npm run build

echo "Disabling ${APP_ID}"
docker exec -u www-data "${NEXTCLOUD_CONTAINER}" php occ app:disable "${APP_ID}"

echo "Enabling ${APP_ID}"
docker exec -u www-data "${NEXTCLOUD_CONTAINER}" php occ app:enable "${APP_ID}"
EOF

echo "Deploy completed"
