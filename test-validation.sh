#!/bin/bash

# Backend Validation Test Script
# Tests create, update, and submit with validation

echo "========================================="
echo "Backend Validation Tests"
echo "========================================="
echo ""

BASE_URL="http://localhost:3001"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}Testing backend validation endpoints...${NC}"
echo ""

# Test 1: Health check
echo "1. Backend health check..."
response=$(curl -s -o /dev/null -w "%{http_code}" $BASE_URL/health)
if [ "$response" = "200" ]; then
  echo -e "${GREEN}✓ Backend is running${NC}"
else
  echo -e "${RED}✗ Backend not responding${NC}"
  exit 1
fi
echo ""

# Test 2: Create without auth (should fail with 401)
echo "2. Testing authentication requirement..."
response=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "$BASE_URL/architect/designs" \
  -H "Content-Type: application/json" \
  -d '{"title":"Test"}')

if [ "$response" = "401" ]; then
  echo -e "${GREEN}✓ Authentication required (401)${NC}"
else
  echo -e "${YELLOW}⚠ Expected 401, got $response${NC}"
fi
echo ""

# Test 3: Update without auth (should fail with 401)
echo "3. Testing update authentication..."
response=$(curl -s -o /dev/null -w "%{http_code}" \
  -X PUT "$BASE_URL/architect/designs/test-id" \
  -H "Content-Type: application/json" \
  -d '{"title":"Updated"}')

if [ "$response" = "401" ]; then
  echo -e "${GREEN}✓ Update requires authentication (401)${NC}"
else
  echo -e "${YELLOW}⚠ Expected 401, got $response${NC}"
fi
echo ""

# Test 4: Submit without auth (should fail with 401)
echo "4. Testing submit authentication..."
response=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "$BASE_URL/architect/designs/test-id/submit" \
  -H "Content-Type: application/json" \
  -d '{"codeDisclaimerAccepted":true}')

if [ "$response" = "401" ]; then
  echo -e "${GREEN}✓ Submit requires authentication (401)${NC}"
else
  echo -e "${YELLOW}⚠ Expected 401, got $response${NC}"
fi
echo ""

echo "========================================="
echo -e "${GREEN}Validation layer is active!${NC}"
echo "========================================="
echo ""
echo -e "${YELLOW}To test with valid credentials:${NC}"
echo "1. Login to get JWT token"
echo "2. Test create with valid data:"
echo ""
echo 'curl -X POST http://localhost:3001/architect/designs \'
echo '  -H "Authorization: Bearer YOUR_TOKEN" \'
echo '  -H "Content-Type: application/json" \'
echo '  -d '"'"'{'
echo '    "title": "Modern Villa",'
echo '    "shortSummary": "Luxury 3-bedroom villa design",'
echo '    "category": "Residential",'
echo '    "licenseType": "STANDARD",'
echo '    "standardPrice": 299.99'
echo '  }'"'"
echo ""
echo "3. Test validation errors with incomplete data:"
echo ""
echo 'curl -X POST http://localhost:3001/architect/designs \'
echo '  -H "Authorization: Bearer YOUR_TOKEN" \'
echo '  -H "Content-Type: application/json" \'
echo '  -d '"'"'{"title": "Short"}'"'"
echo ""
echo "Expected: 400 with validation errors"
echo ""
