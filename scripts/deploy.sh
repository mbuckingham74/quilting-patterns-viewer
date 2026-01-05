#!/bin/bash
set -e

# Deploy quilting-patterns to production
# Run from project root: ./scripts/deploy.sh

cd "$(dirname "$0")/.."

# Supabase public keys (safe to include - these are public)
NEXT_PUBLIC_SUPABASE_URL="https://base.tachyonfuture.com"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzY2NDY0NDcwLCJleHAiOjE5MjQxNDQ0NzB9.66TfVQwO4TvSe549H__MAdfubeN11ZmoShPUJ_JoP0A"

echo "Building Docker image..."
docker build \
  --build-arg NEXT_PUBLIC_SUPABASE_URL="$NEXT_PUBLIC_SUPABASE_URL" \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY="$NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  -t quilting-patterns:latest -f Dockerfile .

echo "Packaging image..."
docker save quilting-patterns:latest | gzip > /tmp/quilting-patterns.tar.gz

echo "Transferring to server..."
rsync -avz --progress /tmp/quilting-patterns.tar.gz michael@tachyonfuture.com:/tmp/

echo "Deploying..."
ssh michael@tachyonfuture.com "cd ~/quilting-patterns-viewer && gunzip -c /tmp/quilting-patterns.tar.gz | docker load && docker compose down && docker compose up -d"

echo "Verifying..."
sleep 3
STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://patterns.tachyonfuture.com/)
if [ "$STATUS" = "200" ]; then
    echo "✓ Deployment successful - site responding with HTTP 200"
else
    echo "✗ Warning: Site returned HTTP $STATUS"
    exit 1
fi
