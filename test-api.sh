#!/bin/bash

echo "🧪 Testing Product Info API..."
echo ""

# Test with SE2225HM
echo "Test 1: SE2225HM"
curl -X POST http://localhost:3000/api/smart-extract-product-info \
  -H "Content-Type: application/json" \
  -d '{"productName": "DELL Monitor - SE2225HM"}' \
  2>/dev/null | python3 -m json.tool

echo ""
echo "==================================="
echo ""

# Test with P2424HT
echo "Test 2: P2424HT"
curl -X POST http://localhost:3000/api/smart-extract-product-info \
  -H "Content-Type: application/json" \
  -d '{"productName": "P2424HT"}' \
  2>/dev/null | python3 -m json.tool
