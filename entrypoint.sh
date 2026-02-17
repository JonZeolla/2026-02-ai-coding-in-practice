#!/bin/sh
set -e

# Map DB_* env vars to POSTGRES_* for the worker process
# The API uses DB_HOST/DB_PORT/etc while the worker uses POSTGRES_HOST/POSTGRES_PORT/etc
export POSTGRES_HOST="${DB_HOST:-localhost}"
export POSTGRES_PORT="${DB_PORT:-5432}"
export POSTGRES_USER="${DB_USER:-postgres}"
export POSTGRES_PASSWORD="${DB_PASSWORD:-postgres}"
export POSTGRES_DB="${DB_NAME:-jobqueue}"

# Run database migrations
echo "Running database migrations..."
export PGPASSWORD="${DB_PASSWORD:-postgres}"
PGSSLMODE=require psql -h "${DB_HOST:-localhost}" -p "${DB_PORT:-5432}" -U "${DB_USER:-postgres}" -d "${DB_NAME:-jobqueue}" \
  -f /app/db/init.sql 2>&1 || echo "Warning: migration failed (tables may already exist)"
unset PGPASSWORD

# Start the worker in the background
echo "Starting worker..."
cd /app/worker && node dist/index.js &
WORKER_PID=$!

# Start the API on port 3001 (nginx proxies from port 3000)
echo "Starting API on port 3001..."
cd /app/api && PORT=3001 node dist/index.js &
API_PID=$!

# Forward signals to child processes for graceful shutdown
cleanup() {
    echo "Shutting down..."
    kill "$WORKER_PID" "$API_PID" 2>/dev/null || true
    wait "$WORKER_PID" "$API_PID" 2>/dev/null || true
    nginx -s quit 2>/dev/null || true
    exit 0
}
trap cleanup TERM INT

# Start nginx in the foreground
echo "Starting nginx on port 3000..."
nginx -g 'daemon off;' &
NGINX_PID=$!

# Wait for any process to exit; poll since POSIX sh lacks wait -n
while kill -0 "$WORKER_PID" 2>/dev/null \
   && kill -0 "$API_PID" 2>/dev/null \
   && kill -0 "$NGINX_PID" 2>/dev/null; do
    sleep 1
done

# If any process exits, shut everything down
echo "A process exited unexpectedly, shutting down..."
cleanup
