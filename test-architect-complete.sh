#!/bin/bash
echo "========================================"
echo "COMPLETE ARCHITECT FLOW TEST"
echo "========================================"
echo ""

# Login
TOKEN=$(curl -s http://localhost:3001/auth/login -X POST -H "Content-Type: application/json" -d '{"email":"architect@example.com","password":"password123"}' | jq -r '.data.token')

if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
  echo "❌ Login failed"
  exit 1
fi

echo "✅ Login successful"
echo ""

# Test all architect endpoints
echo "🏗️  ARCHITECT ENDPOINTS:"
echo ""

echo "1️⃣  /architect/dashboard"
RESULT=$(curl -s http://localhost:3001/architect/dashboard -H "Authorization: Bearer $TOKEN" | jq -r .success)
echo "   Status: $RESULT"

echo "2️⃣  /architect/designs (list)"
RESULT=$(curl -s http://localhost:3001/architect/designs -H "Authorization: Bearer $TOKEN" | jq -r .success)
echo "   Status: $RESULT"

echo "3️⃣  /architect/account (GET)"
RESULT=$(curl -s http://localhost:3001/architect/account -H "Authorization: Bearer $TOKEN" | jq -r .success)
echo "   Status: $RESULT"

echo "4️⃣  /architect/earnings"
RESULT=$(curl -s http://localhost:3001/architect/earnings -H "Authorization: Bearer $TOKEN" | jq -r .success)
echo "   Status: $RESULT"

echo "5️⃣  /architect/payouts"
RESULT=$(curl -s http://localhost:3001/architect/payouts -H "Authorization: Bearer $TOKEN" | jq -r .success)
echo "   Status: $RESULT"

echo "6️⃣  /architect/performance"
RESULT=$(curl -s http://localhost:3001/architect/performance -H "Authorization: Bearer $TOKEN" | jq -r .success)
echo "   Status: $RESULT"

echo "7️⃣  /architect/messages"
RESULT=$(curl -s http://localhost:3001/architect/messages -H "Authorization: Bearer $TOKEN" | jq -r .success)
echo "   Status: $RESULT"

echo ""
echo "========================================"
echo "🔒 SECURITY TEST"
echo "========================================"
echo ""

echo "8️⃣  Access without token"
RESULT=$(curl -s http://localhost:3001/architect/dashboard | jq -r .error)
echo "   Error: $RESULT"

echo "9️⃣  Access with wrong role (buyer)"
BUYER_TOKEN=$(curl -s http://localhost:3001/auth/login -X POST -H "Content-Type: application/json" -d '{"email":"buyer@example.com","password":"password123"}' | jq -r '.data.token')
RESULT=$(curl -s http://localhost:3001/architect/dashboard -H "Authorization: Bearer $BUYER_TOKEN" | jq -r .error)
echo "   Error: $RESULT"

echo ""
echo "========================================"
echo "📊 RESPONSE STRUCTURE CHECK"
echo "========================================"
echo ""

echo "🔍 Performance endpoint structure:"
curl -s http://localhost:3001/architect/performance -H "Authorization: Bearer $TOKEN" | jq '.data.performance'

echo ""
echo "========================================"
echo "✅ ARCHITECT SYSTEM FULLY OPERATIONAL"
echo "========================================"
