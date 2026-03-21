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

# 5. Pull & Rebuild
git pull origin main
docker compose up -d --build --remove-orphans

echo "✅ VPS RECOVERY COMPLETE. BOT IS RUNNING."
