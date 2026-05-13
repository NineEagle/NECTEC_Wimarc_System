#!/bin/bash
set -e

# Kill existing tunnel on 5433/8001
for port in 5433 8001; do
    pid=$(lsof -ti :$port 2>/dev/null || true)
    if [ -n "$pid" ]; then
        kill $pid 2>/dev/null || true
    fi
done

# Start tunnel bound to 0.0.0.0 so Docker can reach it via host.docker.internal
echo "Starting SSH tunnel to opas@203.185.101.161..."
ssh -f -o ExitOnForwardFailure=yes \
    -L 0.0.0.0:5433:localhost:5432 \
    -L 0.0.0.0:8001:localhost:80 \
    opas@203.185.101.161 -N

echo "Tunnel up. Starting services..."
docker compose up "$@"
