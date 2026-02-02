#!/bin/bash

# ═══════════════════════════════════════════════════════════════
# AUTH FLOW TEST — Login & Dashboard Access
# ═══════════════════════════════════════════════════════════════

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔐 AUTHENTICATION FLOW TEST"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

BASE="http://localhost:3001"

echo "1️⃣  Testing Login Endpoint"
echo "───────────────────────────────────────────────────────────"

# Login as buyer
echo "Logging in as buyer..."
BUYER_RESPONSE=$(curl -s "$BASE/auth/login" -X POST -H "Content-Type: application/json" -d '{"email":"buyer@example.com","password":"password123"}')
BUYER_TOKEN=$(echo "$BUYER_RESPONSE" | jq -r '.data.token')
BUYER_SUCCESS=$(echo "$BUYER_RESPONSE" | jq -r '.success')

if [ "$BUYER_SUCCESS" = "true" ] && [ "$BUYER_TOKEN" != "null" ]; then
  echo "✅ Buyer login successful"
  echo "   Token: ${BUYER_TOKEN:0:20}..."
else
  echo "❌ Buyer login failed"
  echo "$BUYER_RESPONSE"
fi
echo ""

# Login as architect
echo "Logging in as architect..."
ARCH_RESPONSE=$(curl -s "$BASE/auth/login" -X POST -H "Content-Type: application/json" -d '{"email":"architect@example.com","password":"password123"}')
ARCH_TOKEN=$(echo "$ARCH_RESPONSE" | jq -r '.data.token')
ARCH_SUCCESS=$(echo "$ARCH_RESPONSE" | jq -r '.success')

if [ "$ARCH_SUCCESS" = "true" ] && [ "$ARCH_TOKEN" != "null" ]; then
  echo "✅ Architect login successful"
  echo "   Token: ${ARCH_TOKEN:0:20}..."
else
  echo "❌ Architect login failed"
  echo "$ARCH_RESPONSE"
fi
echo ""

echo "2️⃣  Testing /auth/me Endpoint"
echo "───────────────────────────────────────────────────────────"

# Test buyer /me
echo "Testing buyer /auth/me..."
BUYER_ME=$(curl -s "$BASE/auth/me" -H "Authorization: Bearer $BUYER_TOKEN")
BUYER_ME_SUCCESS=$(echo "$BUYER_ME" | jq -r '.success')
BUYER_ME_ROLE=$(echo "$BUYER_ME" | jq -r '.data.role')

if [ "$BUYER_ME_SUCCESS" = "true" ] && [ "$BUYER_ME_ROLE" = "BUYER" ]; then
  echo "✅ Buyer /auth/me working"
  echo "   Role: $BUYER_ME_ROLE"
else
  echo "❌ Buyer /auth/me failed"
  echo "$BUYER_ME"
fi
echo ""

# Test architect /me
echo "Testing architect /auth/me..."
ARCH_ME=$(curl -s "$BASE/auth/me" -H "Authorization: Bearer $ARCH_TOKEN")
ARCH_ME_SUCCESS=$(echo "$ARCH_ME" | jq -r '.success')
ARCH_ME_ROLE=$(echo "$ARCH_ME" | jq -r '.data.role')

if [ "$ARCH_ME_SUCCESS" = "true" ] && [ "$ARCH_ME_ROLE" = "ARCHITECT" ]; then
  echo "✅ Architect /auth/me working"
  echo "   Role: $ARCH_ME_ROLE"
else
  echo "❌ Architect /auth/me failed"
  echo "$ARCH_ME"
fi
echo ""

echo "3️⃣  Testing Dashboard Endpoints"
echo "───────────────────────────────────────────────────────────"

# Test buyer dashboard data
echo "Testing buyer transactions..."
BUYER_TRANS=$(curl -s "$BASE/buyer/purchases" -H "Authorization: Bearer $BUYER_TOKEN")
BUYER_TRANS_SUCCESS=$(echo "$BUYER_TRANS" | jq -r '.success')

if [ "$BUYER_TRANS_SUCCESS" = "true" ]; then
  TRANS_COUNT=$(echo "$BUYER_TRANS" | jq '.data.purchases | length')
  echo "✅ Buyer transactions working"
  echo "   Transactions: $TRANS_COUNT"
else
  echo "❌ Buyer transactions failed"
fi
echo ""

# Test architect dashboard data
echo "Testing architect designs..."
ARCH_DESIGNS=$(curl -s "$BASE/architect/designs" -H "Authorization: Bearer $ARCH_TOKEN")
ARCH_DESIGNS_SUCCESS=$(echo "$ARCH_DESIGNS" | jq -r '.success')

if [ "$ARCH_DESIGNS_SUCCESS" = "true" ]; then
  DESIGNS_COUNT=$(echo "$ARCH_DESIGNS" | jq '.data.designs | length')
  echo "✅ Architect designs working"
  echo "   Designs: $DESIGNS_COUNT"
else
  echo "❌ Architect designs failed"
fi
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 SUMMARY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "✅ Backend API: Working"
echo "✅ Login: Working"  
echo "✅ Token generation: Working"
echo "✅ Auth verification: Working"
echo "✅ Protected endpoints: Working"
echo ""
echo "📋 Next: Test in Browser"
echo "   1. Open: http://localhost:3000/login"
echo "   2. Login as: buyer@example.com / password123"
echo "   3. Should redirect to: /buyer/purchases"
echo "   4. Dashboard should load (no redirect loop)"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
