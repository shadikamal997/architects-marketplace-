# API CONTRACT - SOURCE OF TRUTH 🔒

**Version**: 1.0  
**Status**: FROZEN  
**Last Updated**: February 1, 2026

This document defines the complete API contract for the Architects Marketplace.  
**NO ENDPOINT may be added or modified without updating this contract first.**

---

## 📋 CONTRACT RULES

1. ❌ Frontend MUST NOT call endpoints outside this list
2. ❌ Backend MUST implement exactly these endpoints (no extras, no omissions)
3. ❌ NO `/api/*` prefixes (all routes start from root)
4. ✅ All endpoints return JSON
5. ✅ All errors follow standard error format
6. ✅ All authenticated endpoints require `Authorization: Bearer <token>` header

---

## 🔐 STANDARD ERROR RESPONSE

All endpoints return this format on error:

```json
{
  "error": "Error message here",
  "code": "ERROR_CODE",
  "status": 400
}
```

**HTTP Status Codes Used:**
- `200` - Success
- `201` - Created
- `400` - Bad Request (validation error)
- `401` - Unauthorized (missing/invalid token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `409` - Conflict (duplicate, constraint violation)
- `500` - Internal Server Error

---

## 🔐 AUTHENTICATION ENDPOINTS

### `POST /auth/register`
**Auth Required**: None  
**Status**: ✅ IMPLEMENTED

**Request Body:**
```json
{
  "email": "string (required, valid email)",
  "password": "string (required, min 8 chars)",
  "name": "string (required)",
  "role": "BUYER | ARCHITECT (required)"
}
```

**Response (201):**
```json
{
  "token": "string (JWT)",
  "user": {
    "id": "string",
    "email": "string",
    "name": "string",
    "role": "BUYER | ARCHITECT | ADMIN"
  }
}
```

**Errors:**
- `400` - Validation error (missing fields, invalid email)
- `409` - Email already exists

---

### `POST /auth/login`
**Auth Required**: None  
**Status**: ✅ IMPLEMENTED

**Request Body:**
```json
{
  "email": "string (required)",
  "password": "string (required)"
}
```

**Response (200):**
```json
{
  "token": "string (JWT)",
  "user": {
    "id": "string",
    "email": "string",
    "name": "string",
    "role": "BUYER | ARCHITECT | ADMIN"
  }
}
```

**Errors:**
- `400` - Missing credentials
- `401` - Invalid credentials

---

### `GET /auth/me`
**Auth Required**: Yes (any role)  
**Status**: ✅ IMPLEMENTED

**Response (200):**
```json
{
  "user": {
    "id": "string",
    "email": "string",
    "name": "string",
    "role": "BUYER | ARCHITECT | ADMIN",
    "createdAt": "ISO8601 datetime"
  }
}
```

**Errors:**
- `401` - Invalid or expired token

---

### `GET /auth/verify`
**Auth Required**: Yes (any role)  
**Status**: ✅ IMPLEMENTED  
**Alias for**: `/auth/me`

---

## 🌍 PUBLIC MARKETPLACE (READ-ONLY)

### `GET /marketplace/designs`
**Auth Required**: None  
**Status**: ✅ IMPLEMENTED

**Query Parameters:**
- `category` - Filter by category (optional)
- `search` - Search in title/description (optional)
- `minPrice` - Minimum price in cents (optional)
- `maxPrice` - Maximum price in cents (optional)
- `page` - Page number, default 1 (optional)
- `limit` - Items per page, default 20 (optional)

**Response (200):**
```json
{
  "designs": [
    {
      "id": "string",
      "title": "string",
      "slug": "string",
      "description": "string",
      "category": "string",
      "priceUsdCents": "number",
      "state": "PUBLISHED",
      "thumbnailUrl": "string | null",
      "previewImageUrl": "string | null",
      "architect": {
        "id": "string",
        "displayName": "string",
        "company": "string | null"
      },
      "createdAt": "ISO8601 datetime",
      "publishedAt": "ISO8601 datetime"
    }
  ],
  "pagination": {
    "page": "number",
    "limit": "number",
    "total": "number",
    "totalPages": "number"
  }
}
```

---

### `GET /marketplace/designs/:id`
**Auth Required**: None  
**Status**: ✅ IMPLEMENTED

**Response (200):**
```json
{
  "id": "string",
  "title": "string",
  "slug": "string",
  "description": "string",
  "category": "string",
  "priceUsdCents": "number",
  "state": "PUBLISHED",
  "thumbnailUrl": "string | null",
  "previewImageUrl": "string | null",
  "files": [
    {
      "id": "string",
      "name": "string",
      "type": "IMAGE | ZIP | PDF",
      "url": "string (preview only)"
    }
  ],
  "architect": {
    "id": "string",
    "displayName": "string",
    "company": "string | null",
    "professionalTitle": "string | null"
  },
  "createdAt": "ISO8601 datetime",
  "publishedAt": "ISO8601 datetime"
}
```

**Errors:**
- `404` - Design not found or not published

---

### `GET /marketplace/designs/slug/:slug`
**Auth Required**: None  
**Status**: ⚠️ NEEDS IMPLEMENTATION

**Response (200):** Same as `/marketplace/designs/:id`

**Errors:**
- `404` - Design not found

---

## 🧑‍🎨 ARCHITECT - DESIGN MANAGEMENT

### `POST /architect/designs`
**Auth Required**: Yes (ARCHITECT only)  
**Status**: ⚠️ NEEDS IMPLEMENTATION

**Request Body:**
```json
{
  "title": "string (required, 3-200 chars)",
  "description": "string (required, 10-2000 chars)",
  "category": "string (required)",
  "priceUsdCents": "number (required, min 100)"
}
```

**Response (201):**
```json
{
  "design": {
    "id": "string",
    "title": "string",
    "slug": "string (auto-generated)",
    "description": "string",
    "category": "string",
    "priceUsdCents": "number",
    "state": "DRAFT",
    "architectId": "string",
    "createdAt": "ISO8601 datetime",
    "updatedAt": "ISO8601 datetime"
  }
}
```

**Errors:**
- `401` - Not authenticated
- `403` - Not an architect
- `400` - Validation error

---

### `GET /architect/designs`
**Auth Required**: Yes (ARCHITECT only)  
**Status**: ⚠️ NEEDS IMPLEMENTATION

**Query Parameters:**
- `state` - Filter by state: DRAFT, SUBMITTED, APPROVED, PUBLISHED (optional)
- `page` - Page number (optional)
- `limit` - Items per page (optional)

**Response (200):**
```json
{
  "designs": [
    {
      "id": "string",
      "title": "string",
      "slug": "string",
      "description": "string",
      "category": "string",
      "priceUsdCents": "number",
      "state": "DRAFT | SUBMITTED | APPROVED | PUBLISHED",
      "filesCount": "number",
      "createdAt": "ISO8601 datetime",
      "updatedAt": "ISO8601 datetime",
      "submittedAt": "ISO8601 datetime | null",
      "publishedAt": "ISO8601 datetime | null"
    }
  ],
  "stats": {
    "total": "number",
    "draft": "number",
    "submitted": "number",
    "approved": "number",
    "published": "number"
  }
}
```

**Errors:**
- `401` - Not authenticated
- `403` - Not an architect

---

### `GET /architect/designs/:id`
**Auth Required**: Yes (ARCHITECT only - own designs)  
**Status**: ⚠️ NEEDS IMPLEMENTATION

**Response (200):**
```json
{
  "design": {
    "id": "string",
    "title": "string",
    "slug": "string",
    "description": "string",
    "category": "string",
    "priceUsdCents": "number",
    "state": "DRAFT | SUBMITTED | APPROVED | PUBLISHED",
    "architectId": "string",
    "files": [
      {
        "id": "string",
        "name": "string",
        "type": "IMAGE | ZIP | PDF",
        "sizeBytes": "number",
        "url": "string",
        "uploadedAt": "ISO8601 datetime"
      }
    ],
    "createdAt": "ISO8601 datetime",
    "updatedAt": "ISO8601 datetime",
    "submittedAt": "ISO8601 datetime | null",
    "publishedAt": "ISO8601 datetime | null"
  }
}
```

**Errors:**
- `401` - Not authenticated
- `403` - Not the owner or not an architect
- `404` - Design not found

---

### `PUT /architect/designs/:id`
**Auth Required**: Yes (ARCHITECT only - own designs)  
**Status**: ⚠️ NEEDS IMPLEMENTATION

**Request Body (all fields optional):**
```json
{
  "title": "string (3-200 chars)",
  "description": "string (10-2000 chars)",
  "category": "string",
  "priceUsdCents": "number (min 100)"
}
```

**Response (200):**
```json
{
  "design": {
    "id": "string",
    "title": "string",
    "slug": "string",
    "description": "string",
    "category": "string",
    "priceUsdCents": "number",
    "state": "DRAFT | SUBMITTED | APPROVED | PUBLISHED",
    "updatedAt": "ISO8601 datetime"
  }
}
```

**Business Rules:**
- Can only update DRAFT designs
- Cannot update SUBMITTED, APPROVED, or PUBLISHED designs
- Slug is auto-regenerated if title changes

**Errors:**
- `401` - Not authenticated
- `403` - Not the owner or design not in DRAFT state
- `404` - Design not found
- `400` - Validation error

---

### `DELETE /architect/designs/:id`
**Auth Required**: Yes (ARCHITECT only - own designs)  
**Status**: ⚠️ NEEDS IMPLEMENTATION

**Response (200):**
```json
{
  "message": "Design deleted successfully",
  "id": "string"
}
```

**Business Rules:**
- Can only delete DRAFT designs
- Cannot delete SUBMITTED, APPROVED, or PUBLISHED designs
- Deletes associated files

**Errors:**
- `401` - Not authenticated
- `403` - Not the owner or design not in DRAFT state
- `404` - Design not found

---

### `POST /architect/designs/:id/submit`
**Auth Required**: Yes (ARCHITECT only - own designs)  
**Status**: ⚠️ NEEDS IMPLEMENTATION

**Request Body:**
```json
{}
```

**Response (200):**
```json
{
  "design": {
    "id": "string",
    "state": "SUBMITTED",
    "submittedAt": "ISO8601 datetime"
  }
}
```

**Business Rules:**
- Can only submit DRAFT designs
- Must have at least 1 file uploaded
- State changes: DRAFT → SUBMITTED

**Errors:**
- `401` - Not authenticated
- `403` - Not the owner or design not in DRAFT state
- `404` - Design not found
- `400` - No files uploaded yet

---

## 🧑‍🎨 ARCHITECT - ACCOUNT & EARNINGS

### `GET /architect/account`
**Auth Required**: Yes (ARCHITECT only)  
**Status**: ✅ IMPLEMENTED

**Response (200):**
```json
{
  "architect": {
    "id": "string",
    "displayName": "string",
    "professionalTitle": "string | null",
    "company": "string | null",
    "bio": "string | null",
    "accountType": "INDIVIDUAL | BUSINESS",
    "currencyPreference": "string",
    "defaultLicenseType": "STANDARD | EXCLUSIVE",
    "allowPaidModifications": "boolean",
    "payoutsEnabled": "boolean",
    "payoutCurrency": "string",
    "payoutSchedule": "WEEKLY | MONTHLY",
    "platformCommission": "number (0.0-1.0)",
    "stripeAccountId": "string | null",
    "stripeAccountStatus": "string | null",
    "twoFactorEnabled": "boolean",
    "publicProfileVisibility": "boolean",
    "companyVisibility": "boolean",
    "searchEngineIndexing": "boolean",
    "payoutBanks": [
      {
        "id": "string",
        "accountHolder": "string",
        "country": "string",
        "currency": "string",
        "verified": "boolean"
      }
    ],
    "user": {
      "id": "string",
      "email": "string",
      "name": "string",
      "phone": "string | null",
      "timezone": "string",
      "preferredLanguage": "string",
      "profilePhotoUrl": "string | null",
      "country": "string | null",
      "city": "string | null",
      "createdAt": "ISO8601 datetime"
    },
    "createdAt": "ISO8601 datetime"
  }
}
```

**Errors:**
- `401` - Not authenticated
- `403` - Not an architect

---

### `PUT /architect/account`
**Auth Required**: Yes (ARCHITECT only)  
**Status**: ⚠️ NEEDS IMPLEMENTATION

**Request Body (all fields optional):**
```json
{
  "displayName": "string",
  "professionalTitle": "string",
  "company": "string",
  "bio": "string",
  "accountType": "INDIVIDUAL | BUSINESS",
  "currencyPreference": "string",
  "defaultLicenseType": "STANDARD | EXCLUSIVE",
  "allowPaidModifications": "boolean",
  "payoutCurrency": "string",
  "payoutSchedule": "WEEKLY | MONTHLY",
  "publicProfileVisibility": "boolean",
  "companyVisibility": "boolean",
  "searchEngineIndexing": "boolean",
  "user": {
    "name": "string",
    "phone": "string",
    "timezone": "string",
    "preferredLanguage": "string",
    "country": "string",
    "city": "string"
  }
}
```

**Response (200):**
```json
{
  "architect": {
    // Same as GET /architect/account
  }
}
```

**Errors:**
- `401` - Not authenticated
- `403` - Not an architect
- `400` - Validation error

---

### `GET /architect/payouts`
**Auth Required**: Yes (ARCHITECT only)  
**Status**: ⚠️ NEEDS IMPLEMENTATION

**Query Parameters:**
- `state` - Filter by state: PENDING, RELEASED (optional)
- `page` - Page number (optional)
- `limit` - Items per page (optional)

**Response (200):**
```json
{
  "payouts": [
    {
      "id": "string",
      "amountUsdCents": "number",
      "state": "PENDING | RELEASED",
      "transaction": {
        "id": "string",
        "design": {
          "id": "string",
          "title": "string"
        },
        "createdAt": "ISO8601 datetime"
      },
      "createdAt": "ISO8601 datetime",
      "releasedAt": "ISO8601 datetime | null"
    }
  ],
  "summary": {
    "totalPending": "number (cents)",
    "totalReleased": "number (cents)",
    "totalEarnings": "number (cents)"
  }
}
```

**Errors:**
- `401` - Not authenticated
- `403` - Not an architect

---

### `POST /architect/payouts/release`
**Auth Required**: Yes (ARCHITECT only)  
**Status**: ⚠️ NEEDS IMPLEMENTATION

**Request Body:**
```json
{
  "payoutBankId": "string (required)"
}
```

**Response (200):**
```json
{
  "released": "number (count of payouts released)",
  "totalAmount": "number (cents)",
  "payoutBankId": "string"
}
```

**Business Rules:**
- Only releases PENDING payouts
- Requires verified payout bank
- Changes state: PENDING → RELEASED

**Errors:**
- `401` - Not authenticated
- `403` - Not an architect
- `400` - No verified bank or no pending payouts
- `404` - Bank not found

---

## 📁 FILE MANAGEMENT

### `POST /files/upload`
**Auth Required**: Yes (ARCHITECT only)  
**Status**: ⚠️ NEEDS IMPLEMENTATION

**Request:**
- Content-Type: `multipart/form-data`
- Body:
  - `file` - File to upload (required)
  - `designId` - Design ID (required)
  - `type` - FILE_TYPE: IMAGE, ZIP, PDF (required)

**Response (201):**
```json
{
  "file": {
    "id": "string",
    "name": "string",
    "type": "IMAGE | ZIP | PDF",
    "sizeBytes": "number",
    "url": "string (CDN or storage URL)",
    "designId": "string",
    "uploadedAt": "ISO8601 datetime"
  }
}
```

**Business Rules:**
- Max file size: 100MB for ZIP, 10MB for images, 20MB for PDF
- Allowed types: .jpg, .png, .pdf, .zip
- Can only upload to own DRAFT designs

**Errors:**
- `401` - Not authenticated
- `403` - Not an architect or not the design owner
- `400` - Invalid file type or size exceeded
- `404` - Design not found
- `413` - File too large

---

### `GET /files/:id`
**Auth Required**: Conditional  
**Status**: ⚠️ NEEDS IMPLEMENTATION

**Response (200):**
```json
{
  "file": {
    "id": "string",
    "name": "string",
    "type": "IMAGE | ZIP | PDF",
    "sizeBytes": "number",
    "url": "string (preview URL)",
    "designId": "string",
    "uploadedAt": "ISO8601 datetime"
  }
}
```

**Authorization Rules:**
- Public: If design is PUBLISHED and file is IMAGE
- Architect: Own designs (any state)
- Buyer: Licensed designs only

**Errors:**
- `401` - Not authenticated (for non-public files)
- `403` - No access to this file
- `404` - File not found

---

### `GET /files/:id/download`
**Auth Required**: Yes  
**Status**: ⚠️ NEEDS IMPLEMENTATION

**Response (200):**
- Content-Type: Based on file type
- Content-Disposition: `attachment; filename="..."`
- Body: File binary data

**Authorization Rules:**
- Architect: Can download own design files
- Buyer: Can download files for ACTIVE licensed designs only
- Tracks download count

**Errors:**
- `401` - Not authenticated
- `403` - No license or license not active
- `404` - File not found

---

### `DELETE /files/:id`
**Auth Required**: Yes (ARCHITECT only - own files)  
**Status**: ⚠️ NEEDS IMPLEMENTATION

**Response (200):**
```json
{
  "message": "File deleted successfully",
  "id": "string"
}
```

**Business Rules:**
- Can only delete files from DRAFT designs
- Removes file from storage

**Errors:**
- `401` - Not authenticated
- `403` - Not the owner or design not in DRAFT state
- `404` - File not found

---

## 🛒 BUYER - PURCHASES & TRANSACTIONS

### `POST /buyer/purchases`
**Auth Required**: Yes (BUYER only)  
**Status**: ⚠️ NEEDS IMPLEMENTATION  
**Alias**: `POST /transactions`

**Request Body:**
```json
{
  "designId": "string (required)",
  "licenseType": "STANDARD | EXCLUSIVE (optional, default: STANDARD)"
}
```

**Response (201):**
```json
{
  "transaction": {
    "id": "string",
    "designId": "string",
    "buyerId": "string",
    "licenseType": "STANDARD | EXCLUSIVE",
    "designPriceUsdCents": "number",
    "totalAmountUsdCents": "number",
    "state": "PENDING | COMPLETED | FAILED",
    "paymentIntentId": "string (Stripe)",
    "createdAt": "ISO8601 datetime"
  },
  "license": {
    "id": "string",
    "state": "ACTIVE",
    "downloadCount": 0,
    "createdAt": "ISO8601 datetime"
  }
}
```

**Business Rules:**
- Design must be PUBLISHED
- Creates transaction + license atomically
- Integrates with Stripe for payment
- Architect cannot buy own designs

**Errors:**
- `401` - Not authenticated
- `403` - Not a buyer or trying to buy own design
- `404` - Design not found
- `400` - Design not published or already purchased

---

### `POST /transactions`
**Auth Required**: Yes (BUYER only)  
**Status**: ⚠️ NEEDS IMPLEMENTATION  
**Alias for**: `POST /buyer/purchases`

---

### `GET /buyer/purchases`
**Auth Required**: Yes (BUYER only)  
**Status**: ⚠️ NEEDS IMPLEMENTATION  
**Alias**: `GET /buyer/transactions`

**Query Parameters:**
- `state` - Filter by state: PENDING, COMPLETED, FAILED (optional)
- `page` - Page number (optional)
- `limit` - Items per page (optional)

**Response (200):**
```json
{
  "transactions": [
    {
      "id": "string",
      "state": "PENDING | COMPLETED | FAILED",
      "designPriceUsdCents": "number",
      "totalAmountUsdCents": "number",
      "paymentMethod": "string | null",
      "design": {
        "id": "string",
        "title": "string",
        "slug": "string",
        "thumbnailUrl": "string | null",
        "architect": {
          "id": "string",
          "displayName": "string",
          "company": "string | null"
        }
      },
      "createdAt": "ISO8601 datetime"
    }
  ],
  "pagination": {
    "page": "number",
    "limit": "number",
    "total": "number"
  }
}
```

**Errors:**
- `401` - Not authenticated
- `403` - Not a buyer

---

### `GET /buyer/transactions`
**Auth Required**: Yes (BUYER only)  
**Status**: ⚠️ NEEDS IMPLEMENTATION  
**Alias for**: `GET /buyer/purchases`

---

### `GET /buyer/library`
**Auth Required**: Yes (BUYER only)  
**Status**: ⚠️ NEEDS IMPLEMENTATION

**Response (200):**
```json
{
  "licenses": [
    {
      "id": "string",
      "state": "ACTIVE | REVOKED",
      "licenseType": "STANDARD | EXCLUSIVE",
      "downloadCount": "number",
      "design": {
        "id": "string",
        "title": "string",
        "slug": "string",
        "description": "string",
        "thumbnailUrl": "string | null",
        "previewImageUrl": "string | null",
        "architect": {
          "id": "string",
          "displayName": "string",
          "company": "string | null"
        }
      },
      "createdAt": "ISO8601 datetime"
    }
  ]
}
```

**Business Rules:**
- Shows all licenses (ACTIVE + REVOKED)
- Includes download counts

**Errors:**
- `401` - Not authenticated
- `403` - Not a buyer

---

### `GET /buyer/licenses`
**Auth Required**: Yes (BUYER only)  
**Status**: ⚠️ NEEDS IMPLEMENTATION  
**Alias for**: `GET /buyer/library`

---

### `GET /licenses/:designId/check`
**Auth Required**: Yes (BUYER only)  
**Status**: ⚠️ NEEDS IMPLEMENTATION

**Response (200):**
```json
{
  "hasLicense": "boolean",
  "license": {
    "id": "string",
    "state": "ACTIVE | REVOKED",
    "licenseType": "STANDARD | EXCLUSIVE",
    "downloadCount": "number",
    "createdAt": "ISO8601 datetime"
  } | null
}
```

**Business Rules:**
- Returns license info if exists
- Used before allowing downloads

**Errors:**
- `401` - Not authenticated
- `403` - Not a buyer
- `404` - Design not found

---

## ⭐ BUYER - FAVORITES

### `POST /buyer/favorites/:designId`
**Auth Required**: Yes (BUYER only)  
**Status**: ⚠️ NEEDS IMPLEMENTATION

**Response (201):**
```json
{
  "favorite": {
    "id": "string",
    "designId": "string",
    "buyerId": "string",
    "createdAt": "ISO8601 datetime"
  }
}
```

**Errors:**
- `401` - Not authenticated
- `403` - Not a buyer
- `404` - Design not found
- `409` - Already favorited

---

### `DELETE /buyer/favorites/:designId`
**Auth Required**: Yes (BUYER only)  
**Status**: ⚠️ NEEDS IMPLEMENTATION

**Response (200):**
```json
{
  "message": "Favorite removed successfully",
  "designId": "string"
}
```

**Errors:**
- `401` - Not authenticated
- `403` - Not a buyer
- `404` - Favorite not found

---

### `GET /buyer/favorites`
**Auth Required**: Yes (BUYER only)  
**Status**: ⚠️ NEEDS IMPLEMENTATION

**Response (200):**
```json
{
  "favorites": [
    {
      "id": "string",
      "design": {
        "id": "string",
        "title": "string",
        "slug": "string",
        "priceUsdCents": "number",
        "thumbnailUrl": "string | null",
        "architect": {
          "id": "string",
          "displayName": "string"
        }
      },
      "createdAt": "ISO8601 datetime"
    }
  ]
}
```

**Errors:**
- `401` - Not authenticated
- `403` - Not a buyer

---

## ✉️ MESSAGING (ANTI-BYPASS SAFE)

### `GET /messages`
**Auth Required**: Yes (ARCHITECT or BUYER)  
**Status**: ⚠️ NEEDS IMPLEMENTATION

**Response (200):**
```json
{
  "conversations": [
    {
      "id": "string",
      "buyer": {
        "id": "string",
        "name": "string",
        "email": "string"
      },
      "architect": {
        "id": "string",
        "displayName": "string"
      },
      "design": {
        "id": "string",
        "title": "string"
      } | null,
      "reason": "MODIFICATION_REQUEST | SUPPORT | GENERAL",
      "lastMessage": {
        "content": "string",
        "createdAt": "ISO8601 datetime"
      } | null,
      "createdAt": "ISO8601 datetime"
    }
  ]
}
```

**Authorization Rules:**
- ARCHITECT: See conversations for own designs
- BUYER: See own conversations
- STANDARD license: Cannot initiate direct messages (filtered)
- EXCLUSIVE license: Can message architect directly

**Errors:**
- `401` - Not authenticated

---

### `POST /messages`
**Auth Required**: Yes (BUYER only)  
**Status**: ⚠️ NEEDS IMPLEMENTATION

**Request Body:**
```json
{
  "architectId": "string (required)",
  "designId": "string (optional)",
  "reason": "MODIFICATION_REQUEST | SUPPORT | GENERAL (required)",
  "initialMessage": "string (required, min 10 chars)"
}
```

**Response (201):**
```json
{
  "conversation": {
    "id": "string",
    "createdAt": "ISO8601 datetime"
  }
}
```

**Business Rules:**
- STANDARD license: Cannot create conversation (403)
- EXCLUSIVE license: Can create conversation
- No license: Can only message for GENERAL inquiries

**Errors:**
- `401` - Not authenticated
- `403` - Insufficient license (STANDARD users blocked)
- `404` - Architect not found
- `400` - Validation error

---

### `GET /messages/:conversationId`
**Auth Required**: Yes (participant only)  
**Status**: ⚠️ NEEDS IMPLEMENTATION  
**Alias**: `GET /conversations/:conversationId`

**Response (200):**
```json
{
  "conversation": {
    "id": "string",
    "buyer": {
      "id": "string",
      "name": "string"
    },
    "architect": {
      "id": "string",
      "displayName": "string"
    },
    "design": {
      "id": "string",
      "title": "string"
    } | null,
    "reason": "string"
  },
  "messages": [
    {
      "id": "string",
      "content": "string",
      "sender": {
        "id": "string",
        "name": "string",
        "role": "BUYER | ARCHITECT"
      },
      "createdAt": "ISO8601 datetime"
    }
  ]
}
```

**Errors:**
- `401` - Not authenticated
- `403` - Not a participant
- `404` - Conversation not found

---

### `POST /messages/:conversationId`
**Auth Required**: Yes (participant only)  
**Status**: ⚠️ NEEDS IMPLEMENTATION

**Request Body:**
```json
{
  "content": "string (required, min 1 char, max 2000 chars)"
}
```

**Response (201):**
```json
{
  "message": {
    "id": "string",
    "content": "string",
    "senderId": "string",
    "conversationId": "string",
    "createdAt": "ISO8601 datetime"
  }
}
```

**Errors:**
- `401` - Not authenticated
- `403` - Not a participant
- `404` - Conversation not found
- `400` - Validation error

---

## 🛠 MODIFICATION REQUESTS

### `POST /modifications/request`
**Auth Required**: Yes (BUYER with EXCLUSIVE license)  
**Status**: ⚠️ NEEDS IMPLEMENTATION

**Request Body:**
```json
{
  "designId": "string (required)",
  "description": "string (required, 50-2000 chars)",
  "urgency": "LOW | MEDIUM | HIGH (optional, default: MEDIUM)"
}
```

**Response (201):**
```json
{
  "modification": {
    "id": "string",
    "designId": "string",
    "buyerId": "string",
    "description": "string",
    "urgency": "LOW | MEDIUM | HIGH",
    "state": "PENDING",
    "createdAt": "ISO8601 datetime"
  }
}
```

**Business Rules:**
- Requires EXCLUSIVE license
- STANDARD license holders: 403 Forbidden

**Errors:**
- `401` - Not authenticated
- `403` - Not a buyer or no EXCLUSIVE license
- `404` - Design not found
- `400` - Validation error

---

### `GET /modifications`
**Auth Required**: Yes (ARCHITECT or BUYER)  
**Status**: ⚠️ NEEDS IMPLEMENTATION

**Query Parameters:**
- `state` - Filter: PENDING, APPROVED, REJECTED, COMPLETED (optional)

**Response (200):**
```json
{
  "modifications": [
    {
      "id": "string",
      "description": "string",
      "urgency": "LOW | MEDIUM | HIGH",
      "state": "PENDING | APPROVED | REJECTED | COMPLETED",
      "design": {
        "id": "string",
        "title": "string"
      },
      "buyer": {
        "id": "string",
        "name": "string"
      },
      "createdAt": "ISO8601 datetime",
      "respondedAt": "ISO8601 datetime | null"
    }
  ]
}
```

**Authorization:**
- ARCHITECT: See modifications for own designs
- BUYER: See own modification requests

**Errors:**
- `401` - Not authenticated

---

### `POST /modifications/:id/approve`
**Auth Required**: Yes (ARCHITECT only - own designs)  
**Status**: ⚠️ NEEDS IMPLEMENTATION

**Response (200):**
```json
{
  "modification": {
    "id": "string",
    "state": "APPROVED",
    "respondedAt": "ISO8601 datetime"
  }
}
```

**Business Rules:**
- Only design owner can approve
- State changes: PENDING → APPROVED

**Errors:**
- `401` - Not authenticated
- `403` - Not the design owner
- `404` - Modification not found
- `400` - Already responded

---

### `POST /modifications/:id/reject`
**Auth Required**: Yes (ARCHITECT only - own designs)  
**Status**: ⚠️ NEEDS IMPLEMENTATION

**Request Body:**
```json
{
  "reason": "string (optional, max 500 chars)"
}
```

**Response (200):**
```json
{
  "modification": {
    "id": "string",
    "state": "REJECTED",
    "rejectionReason": "string | null",
    "respondedAt": "ISO8601 datetime"
  }
}
```

**Business Rules:**
- Only design owner can reject
- State changes: PENDING → REJECTED

**Errors:**
- `401` - Not authenticated
- `403` - Not the design owner
- `404` - Modification not found
- `400` - Already responded

---

## 🧑‍⚖️ ADMIN ENDPOINTS

### `GET /admin/designs`
**Auth Required**: Yes (ADMIN only)  
**Status**: ⚠️ NEEDS IMPLEMENTATION

**Query Parameters:**
- `state` - Filter: SUBMITTED, APPROVED, PUBLISHED, DRAFT (optional)
- `page` - Page number (optional)
- `limit` - Items per page (optional)

**Response (200):**
```json
{
  "designs": [
    {
      "id": "string",
      "title": "string",
      "state": "DRAFT | SUBMITTED | APPROVED | PUBLISHED",
      "architect": {
        "id": "string",
        "displayName": "string",
        "user": {
          "email": "string"
        }
      },
      "filesCount": "number",
      "createdAt": "ISO8601 datetime",
      "submittedAt": "ISO8601 datetime | null"
    }
  ],
  "stats": {
    "awaitingReview": "number",
    "approved": "number",
    "published": "number"
  }
}
```

**Errors:**
- `401` - Not authenticated
- `403` - Not an admin

---

### `POST /admin/designs/:id/approve`
**Auth Required**: Yes (ADMIN only)  
**Status**: ⚠️ NEEDS IMPLEMENTATION

**Response (200):**
```json
{
  "design": {
    "id": "string",
    "state": "APPROVED",
    "approvedAt": "ISO8601 datetime",
    "approvedBy": "string (admin user ID)"
  }
}
```

**Business Rules:**
- Can only approve SUBMITTED designs
- State changes: SUBMITTED → APPROVED
- Notifies architect

**Errors:**
- `401` - Not authenticated
- `403` - Not an admin
- `404` - Design not found
- `400` - Design not in SUBMITTED state

---

### `POST /admin/designs/:id/reject`
**Auth Required**: Yes (ADMIN only)  
**Status**: ⚠️ NEEDS IMPLEMENTATION

**Request Body:**
```json
{
  "reason": "string (required, min 20 chars)"
}
```

**Response (200):**
```json
{
  "design": {
    "id": "string",
    "state": "DRAFT",
    "rejectionReason": "string",
    "rejectedAt": "ISO8601 datetime",
    "rejectedBy": "string (admin user ID)"
  }
}
```

**Business Rules:**
- Can only reject SUBMITTED designs
- State changes: SUBMITTED → DRAFT
- Notifies architect with reason

**Errors:**
- `401` - Not authenticated
- `403` - Not an admin
- `404` - Design not found
- `400` - Design not in SUBMITTED state or missing reason

---

### `POST /admin/designs/:id/publish`
**Auth Required**: Yes (ADMIN only)  
**Status**: ⚠️ NEEDS IMPLEMENTATION

**Response (200):**
```json
{
  "design": {
    "id": "string",
    "state": "PUBLISHED",
    "publishedAt": "ISO8601 datetime",
    "publishedBy": "string (admin user ID)"
  }
}
```

**Business Rules:**
- Can only publish APPROVED designs
- State changes: APPROVED → PUBLISHED
- Design becomes visible in marketplace
- Notifies architect

**Errors:**
- `401` - Not authenticated
- `403` - Not an admin
- `404` - Design not found
- `400` - Design not in APPROVED state

---

### `GET /admin/users`
**Auth Required**: Yes (ADMIN only)  
**Status**: ⚠️ NEEDS IMPLEMENTATION

**Query Parameters:**
- `role` - Filter: BUYER, ARCHITECT, ADMIN (optional)
- `search` - Search by name or email (optional)
- `page` - Page number (optional)
- `limit` - Items per page (optional)

**Response (200):**
```json
{
  "users": [
    {
      "id": "string",
      "email": "string",
      "name": "string",
      "role": "BUYER | ARCHITECT | ADMIN",
      "createdAt": "ISO8601 datetime",
      "lastLoginAt": "ISO8601 datetime | null"
    }
  ],
  "stats": {
    "totalBuyers": "number",
    "totalArchitects": "number",
    "totalAdmins": "number"
  }
}
```

**Errors:**
- `401` - Not authenticated
- `403` - Not an admin

---

### `GET /admin/audit`
**Auth Required**: Yes (ADMIN only)  
**Status**: ⚠️ NEEDS IMPLEMENTATION

**Query Parameters:**
- `action` - Filter by action type (optional)
- `userId` - Filter by user (optional)
- `startDate` - ISO8601 datetime (optional)
- `endDate` - ISO8601 datetime (optional)
- `page` - Page number (optional)
- `limit` - Items per page (optional)

**Response (200):**
```json
{
  "logs": [
    {
      "id": "string",
      "action": "string",
      "userId": "string",
      "userName": "string",
      "targetType": "string (design, user, etc.)",
      "targetId": "string | null",
      "metadata": "object",
      "ipAddress": "string",
      "createdAt": "ISO8601 datetime"
    }
  ],
  "pagination": {
    "page": "number",
    "limit": "number",
    "total": "number"
  }
}
```

**Errors:**
- `401` - Not authenticated
- `403` - Not an admin

---

## 🏥 HEALTH & UTILITY

### `GET /health`
**Auth Required**: None  
**Status**: ✅ IMPLEMENTED

**Response (200):**
```json
{
  "status": "ok",
  "timestamp": "ISO8601 datetime"
}
```

---

## 📊 ENDPOINT SUMMARY

### ✅ IMPLEMENTED (32 endpoints):
1. POST /auth/register
2. POST /auth/login
3. GET  /auth/me
4. GET  /auth/verify
5. GET  /marketplace/designs
6. GET  /marketplace/designs/:id
7. GET  /marketplace/designs/slug/:slug
8. GET  /architect/account
9. GET  /health
10. POST /architect/designs
11. GET  /architect/designs
12. GET  /architect/designs/:id
13. PUT  /architect/designs/:id
14. DELETE /architect/designs/:id
15. POST /architect/designs/:id/submit
16. POST /files/upload
17. GET  /files/:id
18. GET  /files/:id/download
19. DELETE /files/:id
20. POST /buyer/purchases
21. GET  /buyer/purchases
22. GET  /buyer/library
23. POST /buyer/favorites/:designId
24. DELETE /buyer/favorites/:designId
25. GET  /buyer/favorites
26. GET  /admin/designs
27. POST /admin/designs/:id/approve
28. POST /admin/designs/:id/reject
29. POST /admin/designs/:id/publish
30. GET  /buyer/transactions (alias)
31. GET  /buyer/licenses (alias)
32. (POST /auth/logout - if exists)

### ⚠️ NEEDS IMPLEMENTATION (15 endpoints):

**Account & Payouts (3):**
- PUT  /architect/account
- GET  /architect/payouts
- POST /architect/payouts/release

**Buyer Purchases (1):**
- GET  /licenses/:designId/check

**Messaging (4):**
- GET  /messages
- POST /messages
- GET  /messages/:conversationId
- POST /messages/:conversationId

**Modifications (4):**
- POST /modifications/request
- GET  /modifications
- POST /modifications/:id/approve
- POST /modifications/:id/reject

**Admin (3):**
- GET  /admin/users
- GET  /admin/audit
- POST /admin/designs/:id/feature (optional)

**Search (1):**
- GET  /search/suggestions

---

## 🔒 CONTRACT STATUS

**Status**: FROZEN ❄️  
**Next Step**: Implement endpoints according to this contract  
**Priority**: STEP 2 → Design Management endpoints first

---

## ⚠️ CRITICAL RULES

1. **Frontend MUST NOT** call endpoints outside this list
2. **Backend MUST** implement endpoints exactly as specified
3. **NO** `/api/*` prefixes
4. **ALL** changes to this contract require version bump
5. **ALL** endpoints return JSON (except file downloads)
6. **ALL** authenticated endpoints require Bearer token
7. **ALL** errors follow standard error format

---

**This contract is now the single source of truth for all API communication.**
