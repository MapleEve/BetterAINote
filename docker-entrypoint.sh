#!/bin/sh
set -e

echo "🚀 Starting BetterAINote..."

if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  echo "⏳ Running database migrations..."
  bun migrate-idempotent.js
else
  echo "⏭️ Skipping database migrations..."
fi

echo "🚀 Starting application..."
exec "$@"
