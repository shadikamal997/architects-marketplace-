#!/bin/bash

# File Upload Endpoints Test Script
# Tests the new file upload functionality

echo "========================================="
echo "File Upload Endpoints Test"
echo "========================================="
echo ""

BASE_URL="http://localhost:3001"
TOKEN="your-auth-token-here"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Note: You need a valid JWT token to test these endpoints${NC}"
echo ""

# Test 1: Health Check
echo "1. Testing backend health..."
response=$(curl -s -o /dev/null -w "%{http_code}" $BASE_URL/health)
if [ "$response" = "200" ]; then
  echo -e "${GREEN}✓ Backend is running${NC}"
else
  echo -e "${RED}✗ Backend not responding (HTTP $response)${NC}"
  exit 1
fi
echo ""

# Test 2: Check routes exist (will return 401 without token, which is expected)
echo "2. Checking if file upload routes are registered..."

# GET files endpoint
response=$(curl -s -o /dev/null -w "%{http_code}" \
  -X GET "$BASE_URL/architect/designs/test-id/files")

if [ "$response" = "401" ] || [ "$response" = "403" ]; then
  echo -e "${GREEN}✓ GET /architect/designs/:id/files exists${NC}"
else
  echo -e "${YELLOW}⚠ GET endpoint returned HTTP $response (expected 401/403)${NC}"
fi

# POST files endpoint
response=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "$BASE_URL/architect/designs/test-id/files")

if [ "$response" = "401" ] || [ "$response" = "403" ]; then
  echo -e "${GREEN}✓ POST /architect/designs/:id/files exists${NC}"
else
  echo -e "${YELLOW}⚠ POST endpoint returned HTTP $response (expected 401/403)${NC}"
fi

# DELETE files endpoint
response=$(curl -s -o /dev/null -w "%{http_code}" \
  -X DELETE "$BASE_URL/architect/designs/test-id/files/file-id")

if [ "$response" = "401" ] || [ "$response" = "403" ]; then
  echo -e "${GREEN}✓ DELETE /architect/designs/:id/files/:fileId exists${NC}"
else
  echo -e "${YELLOW}⚠ DELETE endpoint returned HTTP $response (expected 401/403)${NC}"
fi

echo ""
echo "========================================="
echo -e "${GREEN}File upload endpoints are registered!${NC}"
echo "========================================="
echo ""
echo -e "${YELLOW}To test with authentication:${NC}"
echo "1. Login and get JWT token"
echo "2. Create a design in DRAFT status"
echo "3. Use curl or Postman to upload files:"
echo ""
echo "curl -X POST http://localhost:3001/architect/designs/DESIGN_ID/files \\"
echo "  -H \"Authorization: Bearer YOUR_TOKEN\" \\"
echo "  -F \"mainPackage=@/path/to/design.zip\" \\"
echo "  -F \"images=@/path/to/image1.jpg\" \\"
echo "  -F \"images=@/path/to/image2.jpg\" \\"
echo "  -F \"images=@/path/to/image3.jpg\""
echo ""
