# 🧪 STEP 7 API TESTING GUIDE

## New Marketplace Endpoints

All marketplace endpoints are **PUBLIC** (no authentication required).

---

## 1️⃣ Browse Designs with Sorting

**Endpoint:** `GET /marketplace/designs`

### Recent Designs (Default)
```bash
curl http://localhost:3001/marketplace/designs
```

### Highest Rated First
```bash
curl "http://localhost:3001/marketplace/designs?sortBy=highest-rated"
```

### Most Reviewed First
```bash
curl "http://localhost:3001/marketplace/designs?sortBy=most-reviewed"
```

### Price: Low to High
```bash
curl "http://localhost:3001/marketplace/designs?sortBy=price-low"
```

### Price: High to Low
```bash
curl "http://localhost:3001/marketplace/designs?sortBy=price-high"
```

---

## 2️⃣ Filter by Minimum Rating

### Only 4+ Star Designs
```bash
curl "http://localhost:3001/marketplace/designs?minRating=4"
```

### Top Rated + Sorted
```bash
curl "http://localhost:3001/marketplace/designs?minRating=4&sortBy=highest-rated"
```

---

## 3️⃣ Search Designs
```bash
curl "http://localhost:3001/marketplace/designs?search=modern"
```

### Search + Filter + Sort
```bash
curl "http://localhost:3001/marketplace/designs?search=house&minRating=4&sortBy=highest-rated"
```

---

## 4️⃣ Top-Rated Shortcut

**Gets designs with:**
- Average rating ≥ 4.0
- At least 3 reviews

```bash
# Top 10 rated designs
curl "http://localhost:3001/marketplace/designs/top-rated?limit=10"
```

---

## 5️⃣ Get Categories
```bash
curl http://localhost:3001/marketplace/categories
```

**Response:**
```json
{
  "success": true,
  "data": {
    "categories": [
      { "name": "Residential", "count": 45 },
      { "name": "Commercial", "count": 23 },
      { "name": "Industrial", "count": 12 }
    ]
  }
}
```

---

## 6️⃣ Pagination

```bash
# Page 1 (20 items)
curl "http://localhost:3001/marketplace/designs?page=1&limit=20"

# Page 2
curl "http://localhost:3001/marketplace/designs?page=2&limit=20"

# Custom page size (max 100)
curl "http://localhost:3001/marketplace/designs?limit=50"
```

---

## 🛠️ Admin Script: Recalculate Ratings

**When to use:**
- After initial deployment
- If you suspect rating drift
- After manual database changes

```bash
node scripts/recalculate-ratings.js
```

**Expected output:**
```
╔════════════════════════════════════════════════╗
║   RECALCULATE ALL DESIGN RATINGS               ║
╚════════════════════════════════════════════════╝

📊 Fetching all designs...
Found 150 designs to process

[1/150] ✓ OK: "Modern Villa" | Rating: 4.8 | Reviews: 25
[2/150] ✓ UPDATED: "Beach House" | Rating: 0 → 4.5 | Count: 0 → 12

SUMMARY
Total Designs:     150
Updated:           5
Already Correct:   145

✅ Successfully recalculated ratings for 5 designs
```

---

## 🧪 Complete Test Flow

### 1. Create a review (as BUYER)
```bash
TOKEN="<your_buyer_token>"

curl -X POST http://localhost:3001/reviews \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "designId": "design-uuid",
    "purchaseId": "purchase-uuid",
    "rating": 5,
    "comment": "Excellent design, very detailed!"
  }'
```

### 2. Verify aggregation updated
```bash
# Get design details - should show updated averageRating and reviewCount
curl http://localhost:3001/marketplace/designs/design-uuid
```

**Response should include:**
```json
{
  "averageRating": 5.0,
  "reviewCount": 1
}
```

### 3. Test sorting
```bash
# Design should appear in highest-rated results
curl "http://localhost:3001/marketplace/designs?sortBy=highest-rated"
```

### 4. Update review
```bash
curl -X PUT http://localhost:3001/reviews/review-uuid \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "rating": 4,
    "comment": "Updated review"
  }'
```

### 5. Verify aggregation recalculated
```bash
# Rating should now be 4.0
curl http://localhost:3001/marketplace/designs/design-uuid
```

---

## ✅ Verification Checklist

- [ ] Can browse designs without auth
- [ ] Sorting by rating works correctly
- [ ] Filtering by minRating works
- [ ] Creating review updates design aggregation
- [ ] Updating review recalculates aggregation
- [ ] Deleting review recalculates aggregation
- [ ] Top-rated endpoint returns high-quality designs only
- [ ] Categories endpoint lists all categories
- [ ] Pagination works correctly
- [ ] Search filtering works
- [ ] Recalculation script runs successfully

---

**All systems operational!** ✅

Full documentation: [STEP_7_AGGREGATION_COMPLETE.md](../STEP_7_AGGREGATION_COMPLETE.md)
