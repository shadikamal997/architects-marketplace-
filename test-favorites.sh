#!/bin/bash
echo "========================================"
echo "BUYER FAVORITES COMPREHENSIVE TEST"
echo "========================================"
echo ""

# Login and get token
TOKEN=$(curl -s http://localhost:3001/auth/login -X POST -H "Content-Type: application/json" -d '{"email":"buyer@example.com","password":"password123"}' | jq -r '.data.token')
DESIGN_ID=$(curl -s http://localhost:3001/marketplace/designs -H "Authorization: Bearer $TOKEN" | jq -r '.data.designs[0].id')

echo "Test Design ID: $DESIGN_ID"
echo ""

# Clear any existing favorites first
curl -s -X DELETE http://localhost:3001/buyer/favorites/$DESIGN_ID -H "Authorization: Bearer $TOKEN" > /dev/null 2>&1

echo "1️⃣  GET /buyer/favorites (empty state)"
curl -s http://localhost:3001/buyer/favorites -H "Authorization: Bearer $TOKEN" | jq '{success:.success, count:(.data.favorites|length)}'
echo ""

echo "2️⃣  POST /buyer/favorites/:designId (add favorite)"
curl -s -X POST http://localhost:3001/buyer/favorites/$DESIGN_ID -H "Authorization: Bearer $TOKEN" | jq '{success:.success}'
echo ""

echo "3️⃣  GET /buyer/favorites (after adding)"
curl -s http://localhost:3001/buyer/favorites -H "Authorization: Bearer $TOKEN" | jq '{success:.success, count:(.data.favorites|length)}'
echo ""

echo "4️⃣  POST /buyer/favorites/:designId (duplicate attempt)"
curl -s -X POST http://localhost:3001/buyer/favorites/$DESIGN_ID -H "Authorization: Bearer $TOKEN" | jq '{success:.success, error:.error}'
echo ""

echo "5️⃣  DELETE /buyer/favorites/:designId (remove favorite)"
curl -s -X DELETE http://localhost:3001/buyer/favorites/$DESIGN_ID -H "Authorization: Bearer $TOKEN" | jq '{success:.success, message:.data.message}'
echo ""

echo "6️⃣  GET /buyer/favorites (after removing)"
curl -s http://localhost:3001/buyer/favorites -H "Authorization: Bearer $TOKEN" | jq '{success:.success, count:(.data.favorites|length)}'
echo ""

echo "========================================"
echo "🔒 SECURITY TESTS"
echo "========================================"
echo ""

echo "7️⃣  POST without auth token"
curl -s -X POST http://localhost:3001/buyer/favorites/test-id | jq '{error:.error}'
echo ""

echo "8️⃣  POST with architect token (wrong role)"
ARCH_TOKEN=$(curl -s http://localhost:3001/auth/login -X POST -H "Content-Type: application/json" -d '{"email":"architect@example.com","password":"password123"}' | jq -r '.data.token')
curl -s -X POST http://localhost:3001/buyer/favorites/test-id -H "Authorization: Bearer $ARCH_TOKEN" | jq '{error:.error}'
echo ""

echo "========================================"
echo "✅ ALL FAVORITES TESTS COMPLETE"
echo "========================================"
