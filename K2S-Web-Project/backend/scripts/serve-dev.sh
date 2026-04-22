#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PUBLIC_DIR="${SCRIPT_DIR}/../public"
HOST="${APP_HOST:-0.0.0.0}"
PORT="${APP_PORT:-8000}"

cd "${PUBLIC_DIR}"

exec php \
  -d upload_max_filesize=64M \
  -d post_max_size=64M \
  -d memory_limit=256M \
  -S "${HOST}:${PORT}" \
  ../vendor/laravel/framework/src/Illuminate/Foundation/resources/server.php
