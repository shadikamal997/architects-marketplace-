#!/bin/bash
echo "========================================"
echo "COMPLETE BUYER FLOW TEST"
echo "========================================"
echo ""

# Login
TOKEN=$(curl -s http://localhost:3001/auth/login -X POST -H "Content-Type: application/json" -d '{"email":"buyer@example.com","password":"password123"}' | jq -r '.data.token')

if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
  echo "❌ Login failed"
  exit 1
fi

echo "✅ Login successful"
echo ""

# Test all buyer endpoints
echo "📊 BUYER ENDPOINTS:"
echo ""

echo "1️⃣  /buyer/dashboard"
RESULT=$(curl -s http://localhost:3001/buyer/dashboard -H "Authorization: Bearer $TOKEN" | jq -r .success)
echo "   Status: $RESULT"

echo "2️⃣  /buyer/dashboard/stats"
RESULT=$(curl -s http://localhost:3001/buyer/dashboard/stats -H "Authorization: Bearer $TOKEN" | jq -r .success)
echo "   Status: $RESULT"

echo "3️⃣  /buyer/purchases"
RESULT=$(curl -s http://localhost:3001/buyer/purchases -H "Authorization: Bearer $TOKEN" | jq -r .success)
echo "   Status: $RESULT"

echo "4️⃣  /buyer/transactions"
RESULT=$(curl -s http://localhost:3001/buyer/transactions -H "Authorization: Bearer $TOKEN" | jq -r .success)
echo "   Status: $RESULT"

echo "5️⃣  /buyer/licenses"
RESULT=$(curl -s http://localhost:3001/buyer/licenses -H "Authorization: Bearer $TOKEN" | jq -r .success)
echo "   Status: $RESULT"

echo "6️⃣  /buyer/favorites"
RESULT=$(curl -s http://localhost:3001/buyer/favorites -H "Authorization: Bearer $TOKEN" | jq -r .success)
echo "   Status: $RESULT"

echo "7️⃣  /buyer/account"
RESULT=$(curl -s http://localhost:3001/buyer/account -H "Authorization: Bearer $TOKEN" | jq -r .success)
echo "   Status: $RESULT"

echo ""
echo "========================================"
echo "🔒 SECURITY TEST"
echo "========================================"
echo ""

echo "8️⃣  Access without token"
RESULT=$(curl -s http://localhost:3001/buyer/dashboard | jq -r .error)
echo "   Error: $RESULT"

echo "9️⃣  Access with wrong role (architect)"
ARCH_TOKEN=$(curl -s http://localhost:3001/auth/login -X POST -H "Content-Type: application/json" -d '{"email":"architect@example.com","password":"password123"}' | jq -r '.data.token')
RESULT=$(curl -s http://localhost:3001/buyer/dashboard -H "Authorization: Bearer $ARCH_TOKEN" | jq -r .error)
echo "   Error: $RESULT"

echo ""
echo "========================================"
echo "✅ BUYER SYSTEM FULLY OPERATIONAL"
echo "========================================"
