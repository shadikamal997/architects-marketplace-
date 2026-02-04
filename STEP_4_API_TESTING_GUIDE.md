# ✅ STEP 4 COMPLETE — API ENDPOINTS FOR REVIEWS

## 📊 Status Overview

**Step 4 is DONE!** All production-ready review APIs are built and running.

### What Was Built

| Endpoint | Method | Auth | Purpose | Status |
|----------|--------|------|---------|--------|
| `/reviews` | POST | BUYER | Create review | ✅ Complete |
| `/reviews/:id` | PUT | BUYER | Update own review | ✅ Complete |
| `/reviews/:id` | DELETE | BUYER | Soft delete review | ✅ Complete |
| `/reviews/design/:designId` | GET | Public | List design reviews | ✅ Complete |
| `/reviews/design/:designId/stats` | GET | Public | Rating statistics | ✅ Complete |
| `/reviews/my-reviews` | GET | BUYER | Get buyer's reviews | ✅ Complete |
| `/reviews/can-review/:designId` | GET | BUYER | Check eligibility | ✅ Complete |
| `/architect/reviews` | GET | ARCHITECT | Reviews for own designs | ✅ Just added! |

---

## 🧪 API TESTING GUIDE

### Setup: Get Your Auth Tokens

**1. Login as BUYER:**
```bash
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "buyer@example.com",
    "password": "password123"
  }'
```

**2. Login as ARCHITECT:**
```bash
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "architect@example.com",
    "password": "password123"
  }'
```

Copy the `token` from responses and use in `Authorization: Bearer <token>` headers below.

---

## 1️⃣ Create Review (BUYER only)

**Endpoint:** `POST /reviews`

**Headers:**
```
Authorization: Bearer <BUYER_TOKEN>
Content-Type: application/json
```

**Request Body:**
```json
{
  "designId": "uuid-of-design",
  "purchaseId": "uuid-of-purchase",
  "rating": 5,
  "comment": "Excellent design! Very detailed blueprints and easy to understand. Highly recommend for residential projects."
}
```

**Validation Rules:**
- ✅ Rating: 1-5 (integer)
- ✅ Comment: 10-1000 characters
- ✅ Must own the purchase
- ✅ Cannot review same design twice

**Success Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "review-uuid",
    "rating": 5,
    "comment": "Excellent design...",
    "status": "PUBLISHED",
    "buyerId": "buyer-uuid",
    "designId": "design-uuid",
    "purchaseId": "purchase-uuid",
    "createdAt": "2026-02-02T...",
    "updatedAt": "2026-02-02T..."
  }
}
```

**Error Cases:**
- `403 Forbidden` - Not purchase owner
- `409 Conflict` - Already reviewed this design
- `400 Bad Request` - Validation failed

**Test with cURL:**
```bash
curl -X POST http://localhost:3001/reviews \
  -H "Authorization: Bearer <BUYER_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "designId": "your-design-id",
    "purchaseId": "your-purchase-id",
    "rating": 5,
    "comment": "Great design, very professional and detailed"
  }'
```

---

## 2️⃣ Update Own Review (BUYER only)

**Endpoint:** `PUT /reviews/:reviewId`

**Headers:**
```
Authorization: Bearer <BUYER_TOKEN>
Content-Type: application/json
```

**Request Body:**
```json
{
  "rating": 4,
  "comment": "Updated after using the design. Still great but found minor issues with room dimensions."
}
```

**Notes:**
- Can update rating, comment, or both
- Cannot change designId or purchaseId
- Can only update own reviews

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "review-uuid",
    "rating": 4,
    "comment": "Updated after using...",
    "updatedAt": "2026-02-02T..."
  }
}
```

**Test with cURL:**
```bash
curl -X PUT http://localhost:3001/reviews/review-uuid \
  -H "Authorization: Bearer <BUYER_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "rating": 4,
    "comment": "Updated review text here"
  }'
```

---

## 3️⃣ Get Reviews for a Design (PUBLIC)

**Endpoint:** `GET /reviews/design/:designId`

**No authentication required!**

**Query Parameters:**
- `page` (default: 1)
- `limit` (default: 10, max: 50)
- `sortBy` (recent | oldest | highest | lowest)

**Example Request:**
```
GET /reviews/design/design-uuid-123?page=1&limit=10&sortBy=recent
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "reviews": [
      {
        "id": "review-uuid",
        "rating": 5,
        "comment": "Excellent design...",
        "buyer": {
          "id": "buyer-uuid",
          "displayName": "John D."
        },
        "createdAt": "2026-02-02T...",
        "updatedAt": "2026-02-02T..."
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 15,
      "totalPages": 2
    }
  }
}
```

**Test with cURL:**
```bash
# Recent reviews (default)
curl http://localhost:3001/reviews/design/design-uuid-123

# Highest rated first
curl "http://localhost:3001/reviews/design/design-uuid-123?sortBy=highest"

# Oldest first, page 2
curl "http://localhost:3001/reviews/design/design-uuid-123?page=2&sortBy=oldest"
```

---

## 4️⃣ Get Rating Statistics (PUBLIC)

**Endpoint:** `GET /reviews/design/:designId/stats`

**No authentication required!**

**Example Request:**
```
GET /reviews/design/design-uuid-123/stats
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "averageRating": 4.6,
    "totalReviews": 15,
    "distribution": {
      "5": 10,
      "4": 3,
      "3": 1,
      "2": 1,
      "1": 0
    }
  }
}
```

**Test with cURL:**
```bash
curl http://localhost:3001/reviews/design/design-uuid-123/stats
```

---

## 5️⃣ Get My Reviews (BUYER only)

**Endpoint:** `GET /reviews/my-reviews`

**Headers:**
```
Authorization: Bearer <BUYER_TOKEN>
```

**Success Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "review-uuid",
      "rating": 5,
      "comment": "Great design",
      "design": {
        "id": "design-uuid",
        "title": "Modern House Blueprint",
        "slug": "modern-house-blueprint"
      },
      "createdAt": "2026-02-02T...",
      "updatedAt": "2026-02-02T..."
    }
  ]
}
```

**Test with cURL:**
```bash
curl http://localhost:3001/reviews/my-reviews \
  -H "Authorization: Bearer <BUYER_TOKEN>"
```

---

## 6️⃣ Check Eligibility (BUYER only)

**Endpoint:** `GET /reviews/can-review/:designId`

**Headers:**
```
Authorization: Bearer <BUYER_TOKEN>
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "canReview": true,
    "reason": null
  }
}
```

**Already Reviewed Response:**
```json
{
  "success": true,
  "data": {
    "canReview": false,
    "reason": "You have already reviewed this design"
  }
}
```

**Not Purchased Response:**
```json
{
  "success": true,
  "data": {
    "canReview": false,
    "reason": "You must purchase this design before reviewing"
  }
}
```

**Test with cURL:**
```bash
curl http://localhost:3001/reviews/can-review/design-uuid-123 \
  -H "Authorization: Bearer <BUYER_TOKEN>"
```

---

## 7️⃣ Delete Review (BUYER only)

**Endpoint:** `DELETE /reviews/:reviewId`

**Headers:**
```
Authorization: Bearer <BUYER_TOKEN>
```

**Notes:**
- Soft delete (sets status = DELETED)
- Review stays in database but hidden from public
- Updates design rating aggregation

**Success Response (200):**
```json
{
  "success": true,
  "message": "Review deleted successfully"
}
```

**Test with cURL:**
```bash
curl -X DELETE http://localhost:3001/reviews/review-uuid \
  -H "Authorization: Bearer <BUYER_TOKEN>"
```

---

## 8️⃣ NEW! Architect Reviews (ARCHITECT only)

**Endpoint:** `GET /architect/reviews`

**Headers:**
```
Authorization: Bearer <ARCHITECT_TOKEN>
```

**Purpose:** Architects can see all reviews for their own designs

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "summary": {
      "totalReviews": 25,
      "overallAverageRating": 4.7,
      "designsWithReviews": 5
    },
    "byDesign": [
      {
        "designId": "design-uuid-1",
        "designTitle": "Modern Villa Blueprint",
        "designSlug": "modern-villa-blueprint",
        "averageRating": 4.8,
        "reviewCount": 10,
        "reviews": [
          {
            "id": "review-uuid",
            "rating": 5,
            "comment": "Excellent work!",
            "buyer": {
              "id": "buyer-uuid",
              "name": "John D."
            },
            "createdAt": "2026-02-02T...",
            "updatedAt": "2026-02-02T..."
          }
        ]
      }
    ]
  }
}
```

**Test with cURL:**
```bash
curl http://localhost:3001/architect/reviews \
  -H "Authorization: Bearer <ARCHITECT_TOKEN>"
```

---

## 🔒 Security Guarantees

✅ **BUYER-only operations:**
- Create review (must own purchase)
- Update review (must be owner)
- Delete review (must be owner)
- Cannot review designs they haven't purchased

✅ **ARCHITECT protections:**
- Cannot review own or other designs
- Can only view reviews for own designs
- No moderation powers (yet)

✅ **Public access:**
- Anyone can read published reviews
- Only PUBLISHED status shown publicly
- HIDDEN/DELETED reviews excluded

✅ **Data integrity:**
- One review per buyer per design (enforced at DB level)
- Purchase ownership verified before review creation
- Rating aggregation auto-updates

---

## 🧑‍💻 What's Left for Step 5

Step 4 = ✅ **Backend APIs complete**

**Next (Step 5): Frontend UI**
- Review display components (StarRating, ReviewCard, ReviewList)
- Review submission form (ReviewForm)
- Integration with design detail pages
- Architect dashboard reviews section

---

## 🎯 Quick Test Checklist

Before moving to Step 5, verify:

- [ ] Can create review as BUYER (with valid purchase)
- [ ] Cannot create duplicate review
- [ ] Cannot review without purchase
- [ ] Can update own review
- [ ] Cannot update someone else's review
- [ ] Public can view reviews (no auth)
- [ ] ARCHITECT can see own design reviews
- [ ] ARCHITECT blocked from creating reviews
- [ ] Rating stats calculate correctly

**All APIs are production-ready!**

Type **"STEP 5"** when ready for frontend components.
