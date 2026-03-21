#!/bin/bash
echo "🛡️ VPS INFRASTRUCTURE RESCUE: STARTING..."

# 1. Stop Docker (Break the lock)
systemctl stop docker

# 2. Kill any lingering shims (The 'Permission Denied' culprits)
ps aux | grep containerd-shim | awk '{print $2}' | xargs kill -9 2>/dev/null

# 3. Clean up the Docker state
systemctl start docker

# 4. Nuclear Purge (Orphans & Dead containers)
docker container prune -f
docker network prune -f

# 5. Pull & Rebuild Both Services
git fetch --all && git reset --hard origin/main
docker compose down
docker compose build --no-cache
docker compose up -d

echo "✅ HYBRID SYSTEM (BOT + VALIDATOR) IS ONLINE."
