#!/bin/bash

echo "🧹 Clearing all Next.js caches..."

# Kill any running Next.js processes
pkill -f "next dev" || true
sleep 2

# Remove all cache directories
rm -rf .next
rm -rf node_modules/.cache
rm -rf .turbo

echo "✅ Caches cleared!"
echo ""
echo "🚀 Restarting dev server..."
npm run dev
