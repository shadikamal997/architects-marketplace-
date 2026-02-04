# 🧪 QUICK TEST GUIDE — DESIGN PUBLISHING STEP 1

**Run these tests to verify public visibility and data safety.**

---

## Prerequisites

1. Backend running: `node server.js`
2. At least one design in each status:
   - DRAFT
   - SUBMITTED
   - APPROVED (created by admin approval)
   - REJECTED

---

## Test Commands (cURL)

### Test 1: List Public Designs (Only APPROVED visible)

```bash
curl -X GET http://localhost:3001/marketplace/designs \
  -H "Content-Type: application/json" | jq
```

**Expected:**
- Only designs with status=APPROVED appear
- Each design has `slug`, `publishedAt`, `standardPrice`
- `files` array only contains `fileType: "PREVIEW_IMAGE"`
- NO `rejectionReason`, NO `adminNotes`, NO status field

---

### Test 2: Get Single Design by Slug (Approved)

```bash
# Replace 'modern-villa' with an actual approved design slug
curl -X GET http://localhost:3001/marketplace/designs/modern-villa \
  -H "Content-Type: application/json" | jq
```

**Expected:**
- 200 OK response
- Full design details
- Only PREVIEW_IMAGE files included
- NO MAIN_PACKAGE or THREE_D_ASSET files
- NO adminNotes or rejectionReason

---

### Test 3: Get Single Design by Slug (Draft) → 404

```bash
# Try to access a draft design by slug
curl -X GET http://localhost:3001/marketplace/designs/draft-design-slug \
  -H "Content-Type: application/json" | jq
```

**Expected:**
- 404 Not Found
- Error message: "Design not found or not available"

---

### Test 4: Get Categories (Only APPROVED designs counted)

```bash
curl -X GET http://localhost:3001/marketplace/categories \
  -H "Content-Type: application/json" | jq
```

**Expected:**
```json
{
  "success": true,
  "data": {
    "categories": [
      { "name": "Residential", "count": 5 },
      { "name": "Commercial", "count": 2 }
    ]
  }
}
```

Counts include ONLY APPROVED designs.

---

### Test 5: Filter by Category

```bash
curl -X GET "http://localhost:3001/marketplace/designs?category=Residential" \
  -H "Content-Type: application/json" | jq
```

**Expected:**
- Only designs with `category: "Residential"` returned
- All must be APPROVED status

---

### Test 6: Filter by Price Range

```bash
curl -X GET "http://localhost:3001/marketplace/designs?minPrice=100&maxPrice=500" \
  -H "Content-Type: application/json" | jq
```

**Expected:**
- Only designs with `standardPrice` between $100-$500
- All must be APPROVED status

---

### Test 7: Search

```bash
curl -X GET "http://localhost:3001/marketplace/designs?search=villa" \
  -H "Content-Type: application/json" | jq
```

**Expected:**
- Designs with "villa" in title, shortSummary, or description
- Case-insensitive search
- Only APPROVED designs

---

### Test 8: Top-Rated Designs

```bash
curl -X GET http://localhost:3001/marketplace/designs/top-rated?limit=5 \
  -H "Content-Type: application/json" | jq
```

**Expected:**
- Max 5 designs returned
- All have `averageRating >= 4.0`
- All have `reviewCount >= 3`
- Sorted by rating descending

---

## Database Verification

### Verify Slug Auto-Generation on Approval

```sql
-- Check approved designs have slugs and publishedAt
SELECT id, title, slug, status, publishedAt, approvedAt 
FROM "Design" 
WHERE status = 'APPROVED';
```

**Expected:**
- All APPROVED designs have non-null `slug`
- All APPROVED designs have non-null `publishedAt`
- `publishedAt` and `approvedAt` should be same or very close timestamps

---

### Verify Hidden Designs

```sql
-- Count designs by status
SELECT status, COUNT(*) 
FROM "Design" 
GROUP BY status;
```

**Expected:**
- DRAFT: Should NOT appear in `/marketplace/designs`
- SUBMITTED: Should NOT appear in `/marketplace/designs`
- REJECTED: Should NOT appear in `/marketplace/designs`
- APPROVED: ONLY these appear in `/marketplace/designs`

---

## Security Checks

### ❌ Verify NO Private Data Leaks

For any public marketplace API response:

**Should NEVER see:**
- `adminNotes`
- `rejectionReason`
- `submittedAt`
- `approvedAt` (internal timestamp)
- `status` (internal state)
- Files with `fileType: "MAIN_PACKAGE"`
- Files with `fileType: "THREE_D_ASSET"`

**Should ALWAYS see:**
- `publishedAt` (public timestamp)
- `slug` (public URL)
- Files with `fileType: "PREVIEW_IMAGE"` only

---

## ✅ Success Criteria

**Step 1 is successful when:**

1. ✅ Only APPROVED designs visible in `/marketplace/designs`
2. ✅ DRAFT, SUBMITTED, REJECTED designs return 404 on direct access
3. ✅ Slug auto-generated on approval (unique, collision-safe)
4. ✅ publishedAt set automatically on approval
5. ✅ NO private data (ZIP, notes, internal timestamps) in public API
6. ✅ Filters work (category, style, price, rating, search)
7. ✅ Slug-based detail page works for approved designs
8. ✅ Top-rated endpoint works (min 4.0 rating, 3 reviews)

---

## Quick Browser Test

Visit in browser (after starting frontend):
- http://localhost:3000/marketplace (should show only approved designs)
- http://localhost:3000/marketplace/designs/[slug] (should show design detail)

---

**If all tests pass → Step 1 complete. Move to Step 2: Buyer Purchase Flow.**
