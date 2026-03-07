#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

if [ -z "${SESSION_SECRET:-}" ]; then
  SESSION_SECRET="$(python3 -c 'import secrets; print(secrets.token_hex(32))')"
  export SESSION_SECRET
fi

cd "$PROJECT_ROOT"
docker compose up --build -d

echo "App started at http://localhost:8001"
