#!/bin/bash

echo "🔧 FIXING BUILD ERROR - Complete Clean Restart"
echo "============================================"
echo ""

# Step 1: Kill all processes
echo "Step 1: Killing all Node/Next.js processes..."
pkill -9 -f "next dev" 2>/dev/null || true
pkill -9 node 2>/dev/null || true
sleep 3
echo "✅ Processes killed"
echo ""

# Step 2: Remove ALL caches
echo "Step 2: Removing all caches..."
rm -rf .next
rm -rf node_modules/.cache
rm -rf .turbo
echo "✅ Caches removed"
echo ""

# Step 3: Verify file is correct
echo "Step 3: Verifying file content..."
LINE_837=$(sed -n '837p' /Users/jasonsoh/Documents/Jerry/src/app/api/smart-extract-product-info-puppeteer/route.ts)
echo "Line 837: $LINE_837"
echo ""

if [[ "$LINE_837" == *"const cachedInfo"* ]]; then
    echo "✅ File is CORRECT!"
else
    echo "❌ File still has wrong content!"
    echo "Expected: const cachedInfo = await getFromCachedFiles(modelCode);"
    echo "Got: $LINE_837"
    exit 1
fi

echo ""
echo "Step 4: Starting fresh dev server..."
echo "============================================"
npm run dev
