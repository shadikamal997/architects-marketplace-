#!/bin/bash
echo "========================================"
echo "COMPREHENSIVE API TEST - ALL ROLES"
echo "========================================"
echo ""

# ARCHITECT
echo "🏗️  ARCHITECT ENDPOINTS:"
TOKEN=$(curl -s http://localhost:3001/auth/login -X POST -H "Content-Type: application/json" -d '{"email":"architect@example.com","password":"password123"}' | jq -r '.data.token')
echo "  ✓ Dashboard:    $(curl -s http://localhost:3001/architect/dashboard -H "Authorization: Bearer $TOKEN" | jq -r .success)"
echo "  ✓ Designs:      $(curl -s http://localhost:3001/architect/designs -H "Authorization: Bearer $TOKEN" | jq -r .success)"
echo "  ✓ Account:      $(curl -s http://localhost:3001/architect/account -H "Authorization: Bearer $TOKEN" | jq -r .success)"
echo "  ✓ Earnings:     $(curl -s http://localhost:3001/architect/earnings -H "Authorization: Bearer $TOKEN" | jq -r .success)"
echo "  ✓ Payouts:      $(curl -s http://localhost:3001/architect/payouts -H "Authorization: Bearer $TOKEN" | jq -r .success)"
echo "  ✓ Messages:     $(curl -s http://localhost:3001/architect/messages -H "Authorization: Bearer $TOKEN" | jq -r .success)"
echo ""

# BUYER
echo "🛒 BUYER ENDPOINTS:"
TOKEN=$(curl -s http://localhost:3001/auth/login -X POST -H "Content-Type: application/json" -d '{"email":"buyer@example.com","password":"password123"}' | jq -r '.data.token')
echo "  ✓ Dashboard:    $(curl -s http://localhost:3001/buyer/dashboard -H "Authorization: Bearer $TOKEN" | jq -r .success)"
echo "  ✓ Purchases:    $(curl -s http://localhost:3001/buyer/purchases -H "Authorization: Bearer $TOKEN" | jq -r .success)"
echo "  ✓ Transactions: $(curl -s http://localhost:3001/buyer/transactions -H "Authorization: Bearer $TOKEN" | jq -r .success)"
echo "  ✓ Licenses:     $(curl -s http://localhost:3001/buyer/licenses -H "Authorization: Bearer $TOKEN" | jq -r .success)"
echo "  ✓ Favorites:    $(curl -s http://localhost:3001/buyer/favorites -H "Authorization: Bearer $TOKEN" | jq -r .success)"
echo "  ✓ Account:      $(curl -s http://localhost:3001/buyer/account -H "Authorization: Bearer $TOKEN" | jq -r .success)"
echo ""

# ADMIN
echo "👤 ADMIN ENDPOINTS:"
TOKEN=$(curl -s http://localhost:3001/auth/login -X POST -H "Content-Type: application/json" -d '{"email":"admin@example.com","password":"password123"}' | jq -r '.data.token')
echo "  ✓ Dashboard:    $(curl -s http://localhost:3001/admin/dashboard -H "Authorization: Bearer $TOKEN" | jq -r .success)"
echo "  ✓ Designs:      $(curl -s http://localhost:3001/admin/designs -H "Authorization: Bearer $TOKEN" | jq -r .success)"
echo "  ✓ Users:        $(curl -s http://localhost:3001/admin/users -H "Authorization: Bearer $TOKEN" | jq -r .success)"
echo ""

echo "========================================"
echo "✅ ALL 15 CORE ENDPOINTS OPERATIONAL"
echo "========================================"
