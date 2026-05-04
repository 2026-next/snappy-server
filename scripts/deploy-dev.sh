#!/usr/bin/env bash
set -Eeuo pipefail

if [[ -z "${APP_DIR:-}" ]]; then
  echo "APP_DIR must be set to the repository path on snappy-vm." >&2
  exit 1
fi

if [[ -z "${RESTART_COMMAND:-}" ]]; then
  echo "RESTART_COMMAND must be set to the command that restarts the app on snappy-vm." >&2
  exit 1
fi

cd "$APP_DIR"

git fetch origin dev
if git rev-parse --verify dev >/dev/null 2>&1; then
  git checkout dev
else
  git checkout -b dev origin/dev
fi
git pull --ff-only origin dev

npm ci
npm run prisma:generate
npm run prisma:migrate:deploy
npm run build

bash -lc "$RESTART_COMMAND"
