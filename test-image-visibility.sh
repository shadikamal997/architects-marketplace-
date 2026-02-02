#!/bin/bash

# ═══════════════════════════════════════════════════════════════
# STEP 10 — IMAGE VISIBILITY TEST
# Verify images load correctly across all pages
# ═══════════════════════════════════════════════════════════════

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🖼️  IMAGE VISIBILITY VERIFICATION"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

BASE="http://localhost:3001"
PASS=0
FAIL=0

# ═══════════════════════════════════════════════════════════════
# TEST 1: Backend returns previewImageUrl
# ═══════════════════════════════════════════════════════════════
echo "1️⃣  Backend API - Image Field Consistency"
echo "───────────────────────────────────────────────────────────"

echo "Testing marketplace designs endpoint..."
response=$(curl -s "$BASE/marketplace/designs?limit=3")
has_field=$(echo "$response" | jq '.data.designs[0] | has("previewImageUrl")')

if [ "$has_field" = "true" ]; then
  echo "✅ previewImageUrl field exists"
  PASS=$((PASS + 1))
else
  echo "❌ previewImageUrl field missing"
  FAIL=$((FAIL + 1))
fi

# Count how many have actual URLs vs null
total=$(echo "$response" | jq '.data.designs | length')
with_url=$(echo "$response" | jq '[.data.designs[] | select(.previewImageUrl != null)] | length')
echo "   └─ $with_url/$total designs have image URLs"
echo ""

# ═══════════════════════════════════════════════════════════════
# TEST 2: Architect endpoints return previewImageUrl
# ═══════════════════════════════════════════════════════════════
echo "2️⃣  Architect API - Image Field"
echo "───────────────────────────────────────────────────────────"

echo "Getting architect token..."
ARCH_TOKEN=$(curl -s "$BASE/auth/login" -X POST -H "Content-Type: application/json" -d '{"email":"architect@example.com","password":"password123"}' | jq -r '.data.token')

if [ "$ARCH_TOKEN" = "null" ] || [ -z "$ARCH_TOKEN" ]; then
  echo "❌ Failed to get architect token"
  FAIL=$((FAIL + 1))
else
  echo "Testing architect designs endpoint..."
  arch_response=$(curl -s "$BASE/architect/designs?limit=3" -H "Authorization: Bearer $ARCH_TOKEN")
  arch_has_field=$(echo "$arch_response" | jq '.data.designs[0] | has("previewImageUrl")')
  
  if [ "$arch_has_field" = "true" ]; then
    echo "✅ Architect designs have previewImageUrl"
    PASS=$((PASS + 1))
  else
    echo "❌ Architect designs missing previewImageUrl"
    FAIL=$((FAIL + 1))
  fi
  
  # Get a design ID and test single design endpoint
  DESIGN_ID=$(echo "$arch_response" | jq -r '.data.designs[0].id')
  if [ "$DESIGN_ID" != "null" ] && [ -n "$DESIGN_ID" ]; then
    single_response=$(curl -s "$BASE/architect/designs/$DESIGN_ID" -H "Authorization: Bearer $ARCH_TOKEN")
    single_has_field=$(echo "$single_response" | jq '.data.design | has("previewImageUrl")')
    
    if [ "$single_has_field" = "true" ]; then
      echo "✅ Single design has previewImageUrl"
      PASS=$((PASS + 1))
    else
      echo "❌ Single design missing previewImageUrl"
      FAIL=$((FAIL + 1))
    fi
  fi
fi
echo ""

# ═══════════════════════════════════════════════════════════════
# TEST 3: Placeholder image exists
# ═══════════════════════════════════════════════════════════════
echo "3️⃣  Placeholder Image"
echo "───────────────────────────────────────────────────────────"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "$SCRIPT_DIR/frontend-app/public/placeholder-design.jpg" ]; then
  echo "✅ Placeholder image exists"
  PASS=$((PASS + 1))
else
  echo "❌ Placeholder image missing"
  FAIL=$((FAIL + 1))
fi
echo ""

# ═══════════════════════════════════════════════════════════════
# TEST 4: Frontend code uses previewImageUrl
# ═══════════════════════════════════════════════════════════════
echo "4️⃣  Frontend Code - Image Field Usage"
echo "───────────────────────────────────────────────────────────"

# Check explore page
if grep -q "design.previewImageUrl || '/placeholder-design.jpg'" "$SCRIPT_DIR/frontend-app/pages/explore.tsx"; then
  echo "✅ Explore page uses previewImageUrl with fallback"
  PASS=$((PASS + 1))
else
  echo "❌ Explore page not updated"
  FAIL=$((FAIL + 1))
fi

# Check design detail page
if grep -q "design.previewImageUrl || '/placeholder-design.jpg'" "$SCRIPT_DIR/frontend-app/pages/design/[id].tsx"; then
  echo "✅ Design detail page uses previewImageUrl with fallback"
  PASS=$((PASS + 1))
else
  echo "❌ Design detail page not updated"
  FAIL=$((FAIL + 1))
fi

# Check for old references to design.image
if grep -q "design\.image\>" "$SCRIPT_DIR/frontend-app/pages/explore.tsx" || grep -q "design\.image\>" "$SCRIPT_DIR/frontend-app/pages/design/[id].tsx"; then
  echo "⚠️  Old design.image references still exist"
  FAIL=$((FAIL + 1))
else
  echo "✅ No old design.image references"
  PASS=$((PASS + 1))
fi
echo ""

# ═══════════════════════════════════════════════════════════════
# SUMMARY
# ═══════════════════════════════════════════════════════════════
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 TEST RESULTS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "✅ Passed: $PASS"
echo "❌ Failed: $FAIL"
echo ""

if [ $FAIL -eq 0 ]; then
  echo "🎉 ALL TESTS PASSED!"
  echo ""
  echo "✅ Single source of truth: previewImageUrl"
  echo "✅ Backend returns consistent field"
  echo "✅ Frontend uses correct field"
  echo "✅ Fallback to placeholder"
  echo "✅ Production-ready"
  echo ""
  echo "📋 Next: Browser Testing"
  echo "   1. Open: http://localhost:3000/explore"
  echo "   2. Verify: All cards show images or placeholder"
  echo "   3. Click any design"
  echo "   4. Verify: Hero image loads or shows placeholder"
  echo "   5. Check: No broken image icons"
else
  echo "⚠️  SOME TESTS FAILED"
  echo "Review the errors above"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
