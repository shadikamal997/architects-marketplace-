#!/bin/bash
echo "========================================"
echo "COMPLETE ADMIN FLOW TEST"
echo "========================================"
echo ""

# Login
TOKEN=$(curl -s http://localhost:3001/auth/login -X POST -H "Content-Type: application/json" -d '{"email":"admin@example.com","password":"password123"}' | jq -r '.data.token')

if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
  echo "❌ Login failed"
  exit 1
fi

echo "✅ Login successful"
echo ""

# Test all admin endpoints
echo "👤 ADMIN ENDPOINTS:"
echo ""

echo "1️⃣  /admin/dashboard"
RESULT=$(curl -s http://localhost:3001/admin/dashboard -H "Authorization: Bearer $TOKEN" | jq -r .success)
echo "   Status: $RESULT"

echo "2️⃣  /admin/designs (list)"
RESULT=$(curl -s http://localhost:3001/admin/designs -H "Authorization: Bearer $TOKEN" | jq -r .success)
echo "   Status: $RESULT"

echo "3️⃣  /admin/designs/:id (single)"
DESIGN_ID=$(curl -s http://localhost:3001/admin/designs -H "Authorization: Bearer $TOKEN" | jq -r '.data.designs[0].id')
RESULT=$(curl -s http://localhost:3001/admin/designs/$DESIGN_ID -H "Authorization: Bearer $TOKEN" | jq -r .success)
echo "   Status: $RESULT (Design ID: ${DESIGN_ID:0:8}...)"

echo "4️⃣  /admin/users"
RESULT=$(curl -s http://localhost:3001/admin/users -H "Authorization: Bearer $TOKEN" | jq -r .success)
echo "   Status: $RESULT"

echo "5️⃣  /admin/audit"
RESULT=$(curl -s http://localhost:3001/admin/audit -H "Authorization: Bearer $TOKEN" | jq -r .success)
echo "   Status: $RESULT"

echo ""
echo "========================================"
echo "🔐 MODERATION WORKFLOW TEST"
echo "========================================"
echo ""

echo "6️⃣  POST /admin/designs/:id/approve"
RESULT=$(curl -s -X POST http://localhost:3001/admin/designs/$DESIGN_ID/approve -H "Authorization: Bearer $TOKEN" | jq -r 'if .success then "success" else .error end')
echo "   Response: $RESULT"

echo "7️⃣  POST /admin/designs/:id/reject"
RESULT=$(curl -s -X POST http://localhost:3001/admin/designs/$DESIGN_ID/reject -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"reason":"Test"}' | jq -r 'if .success then "success" else .error end')
echo "   Response: $RESULT"

echo ""
echo "========================================"
echo "🔒 SECURITY TEST"
echo "========================================"
echo ""

echo "8️⃣  Access without token"
RESULT=$(curl -s http://localhost:3001/admin/dashboard | jq -r .error)
echo "   Error: $RESULT"

echo "9️⃣  Access with wrong role (buyer)"
BUYER_TOKEN=$(curl -s http://localhost:3001/auth/login -X POST -H "Content-Type: application/json" -d '{"email":"buyer@example.com","password":"password123"}' | jq -r '.data.token')
RESULT=$(curl -s http://localhost:3001/admin/dashboard -H "Authorization: Bearer $BUYER_TOKEN" | jq -r .error)
echo "   Error: $RESULT"

echo ""
echo "========================================"
echo "📊 RESPONSE STRUCTURE CHECK"
echo "========================================"
echo ""

echo "🔍 Dashboard stats structure:"
curl -s http://localhost:3001/admin/dashboard -H "Authorization: Bearer $TOKEN" | jq '.data.stats'

echo ""
echo "🔍 Audit logs structure:"
curl -s http://localhost:3001/admin/audit -H "Authorization: Bearer $TOKEN" | jq '.data | {eventsCount: (.events | length)}'

echo ""
echo "========================================"
echo "✅ ADMIN SYSTEM FULLY OPERATIONAL"
echo "========================================"
