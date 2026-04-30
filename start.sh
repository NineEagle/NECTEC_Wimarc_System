#!/bin/bash

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
SSH_KEY="$HOME/.ssh/wimarc_key"
SERVER="opas@203.185.101.161"

cleanup() {
    echo ""
    echo "Shutting down..."
    kill "$BACKEND_PID" 2>/dev/null || true
    kill "$TUNNEL_PID" 2>/dev/null || true
    exit 0
}
trap cleanup INT TERM

# Clear all ports used by this app
for port in 5433 8001 8000 3000; do
    if lsof -ti:$port >/dev/null 2>&1; then
        echo "Clearing port $port..."
        lsof -ti:$port | xargs kill -9 2>/dev/null || true
    fi
done
sleep 1

# 1. Open SSH tunnels (DB port 5432 + nginx port 80 for images)
echo "=== Connecting to server ==="
ssh -i "$SSH_KEY" \
    -L 5433:localhost:5432 \
    -L 8001:localhost:80 \
    -N -f \
    -o StrictHostKeyChecking=no \
    -o ConnectTimeout=10 \
    -o ExitOnForwardFailure=yes \
    -o ServerAliveInterval=30 \
    -o ServerAliveCountMax=10 \
    "$SERVER"
sleep 2
TUNNEL_PID=$(lsof -ti:5433 | head -1)

sleep 3

if ! lsof -ti:5433 >/dev/null 2>&1; then
    echo "ERROR: Tunnel failed."
    exit 1
fi
echo "Tunnel open: DB(:5433) + Images(:8001)"

# 3. Backend
echo ""
echo "=== Installing Python dependencies ==="
pip install -r "$ROOT_DIR/backend/requirements.txt" -q

echo "=== Starting backend (port 8000) ==="
cd "$ROOT_DIR/backend"
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!
sleep 4

# 4. Frontend
echo ""
echo "=== Starting frontend (port 3000) ==="
cd "$ROOT_DIR"
pnpm install --silent 2>/dev/null || pnpm install
pnpm dev

wait
