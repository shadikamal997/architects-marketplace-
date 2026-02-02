# API CONTRACT VISUAL MAP 🗺️

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                        API CONTRACT OVERVIEW                                 ║
║                         56 Total Endpoints                                   ║
║              9 Implemented ✅  |  47 To Implement ⚠️                          ║
╚══════════════════════════════════════════════════════════════════════════════╝


┌─ 🔐 AUTHENTICATION (4 endpoints) ───────────────────────────────────────────┐
│                                                                              │
│  ✅ POST /auth/register           Create account (BUYER or ARCHITECT)       │
│  ✅ POST /auth/login              Get JWT token                             │
│  ✅ GET  /auth/me                 Get current user info                     │
│  ✅ GET  /auth/verify             Verify JWT token (alias for /me)          │
│                                                                              │
│  Status: COMPLETE - No changes needed                                       │
└──────────────────────────────────────────────────────────────────────────────┘


┌─ 🌍 PUBLIC MARKETPLACE (3 endpoints) ───────────────────────────────────────┐
│                                                                              │
│  ✅ GET  /marketplace/designs      List all PUBLISHED designs               │
│  ✅ GET  /marketplace/designs/:id  Get single design by ID                  │
│  ⚠️  GET  /marketplace/designs/slug/:slug  Get design by slug (SEO)         │
│                                                                              │
│  Status: Mostly complete - Need slug endpoint for better URLs               │
└──────────────────────────────────────────────────────────────────────────────┘


┌─ 🧑‍🎨 ARCHITECT - DESIGN MANAGEMENT (6 endpoints) ──────────────────────────┐
│                                                     ⭐ STEP 3 PRIORITY        │
│  ⚠️  POST   /architect/designs            Create new design (DRAFT)         │
│  ⚠️  GET    /architect/designs            List own designs + stats          │
│  ⚠️  GET    /architect/designs/:id        Get single design (own)           │
│  ⚠️  PUT    /architect/designs/:id        Update design (DRAFT only)        │
│  ⚠️  DELETE /architect/designs/:id        Delete design (DRAFT only)        │
│  ⚠️  POST   /architect/designs/:id/submit Submit for review (DRAFT→SUBMIT)  │
│                                                                              │
│  State Flow: DRAFT → SUBMITTED → APPROVED → PUBLISHED                       │
│  Rules: Only DRAFT can be edited/deleted                                    │
│  Status: NEEDS IMPLEMENTATION (highest priority)                            │
└──────────────────────────────────────────────────────────────────────────────┘


┌─ 📁 FILE MANAGEMENT (4 endpoints) ──────────────────────────────────────────┐
│                                                     ⭐ STEP 4 PRIORITY        │
│  ⚠️  POST   /files/upload             Upload file to design (multipart)     │
│  ⚠️  GET    /files/:id                Get file metadata                     │
│  ⚠️  GET    /files/:id/download       Download file (license check)         │
│  ⚠️  DELETE /files/:id                Delete file (DRAFT only)              │
│                                                                              │
│  Types: IMAGE (.jpg, .png), ZIP (.zip), PDF (.pdf)                          │
│  Limits: 100MB (ZIP), 10MB (image), 20MB (PDF)                              │
│  Auth: Architects (own), Buyers (licensed)                                  │
│  Status: NEEDS IMPLEMENTATION                                               │
└──────────────────────────────────────────────────────────────────────────────┘


┌─ 💰 ARCHITECT - ACCOUNT & PAYOUTS (3 endpoints) ────────────────────────────┐
│                                                                              │
│  ✅ GET  /architect/account           Get account details + banks           │
│  ⚠️  PUT  /architect/account           Update profile, settings             │
│  ⚠️  GET  /architect/payouts           List PENDING + RELEASED payouts      │
│  ⚠️  POST /architect/payouts/release   Release payouts to bank              │
│                                                                              │
│  Commission: 10% platform fee                                               │
│  States: PENDING (unpaid) → RELEASED (sent to bank)                         │
│  Status: GET account done, rest needs implementation                        │
└──────────────────────────────────────────────────────────────────────────────┘


┌─ 🛒 BUYER - PURCHASES & LIBRARY (5 endpoints) ──────────────────────────────┐
│                                                                              │
│  ⚠️  POST /buyer/purchases            Create purchase (Stripe)              │
│  ⚠️  GET  /buyer/purchases            List purchase history                 │
│  ⚠️  GET  /buyer/library              List licensed designs                 │
│  ⚠️  GET  /licenses/:designId/check   Check if has license                  │
│  ⚠️  POST /transactions               Alias for /buyer/purchases            │
│                                                                              │
│  License Types: STANDARD (download only) | EXCLUSIVE (+ messaging)          │
│  License States: ACTIVE (can download) | REVOKED (blocked)                  │
│  Status: NEEDS IMPLEMENTATION                                               │
└──────────────────────────────────────────────────────────────────────────────┘


┌─ ⭐ BUYER - FAVORITES (3 endpoints) ─────────────────────────────────────────┐
│                                                                              │
│  ⚠️  POST   /buyer/favorites/:designId   Add to favorites                   │
│  ⚠️  DELETE /buyer/favorites/:designId   Remove from favorites              │
│  ⚠️  GET    /buyer/favorites             List favorite designs              │
│                                                                              │
│  Purpose: Wishlist / saved items                                            │
│  Status: NEEDS IMPLEMENTATION (lower priority)                              │
└──────────────────────────────────────────────────────────────────────────────┘


┌─ ✉️ MESSAGING (4 endpoints) ────────────────────────────────────────────────┐
│                                                     🔐 ANTI-BYPASS SAFE      │
│  ⚠️  GET  /messages                  List conversations                     │
│  ⚠️  POST /messages                  Create conversation (license check!)   │
│  ⚠️  GET  /messages/:conversationId  Get conversation + messages            │
│  ⚠️  POST /messages/:conversationId  Send message                           │
│                                                                              │
│  🚨 CRITICAL: STANDARD license → BLOCKED (403)                              │
│             EXCLUSIVE license → ALLOWED                                     │
│                                                                              │
│  Purpose: Prevent buyers from bypassing platform with STANDARD licenses     │
│  Status: NEEDS IMPLEMENTATION                                               │
└──────────────────────────────────────────────────────────────────────────────┘


┌─ 🛠 MODIFICATIONS (4 endpoints) ─────────────────────────────────────────────┐
│                                                     🔐 EXCLUSIVE ONLY         │
│  ⚠️  POST /modifications/request      Request modification (EXCLUSIVE)      │
│  ⚠️  GET  /modifications              List requests (filtered by role)      │
│  ⚠️  POST /modifications/:id/approve  Architect approves request            │
│  ⚠️  POST /modifications/:id/reject   Architect rejects request             │
│                                                                              │
│  🚨 CRITICAL: Requires EXCLUSIVE license (STANDARD blocked!)                │
│                                                                              │
│  States: PENDING → APPROVED / REJECTED → COMPLETED                          │
│  Status: NEEDS IMPLEMENTATION                                               │
└──────────────────────────────────────────────────────────────────────────────┘


┌─ 🧑‍⚖️ ADMIN (6 endpoints) ──────────────────────────────────────────────────┐
│                                                                              │
│  ⚠️  GET  /admin/designs              List designs (filter by state)        │
│  ⚠️  POST /admin/designs/:id/approve  SUBMITTED → APPROVED                  │
│  ⚠️  POST /admin/designs/:id/reject   SUBMITTED → DRAFT (with reason)       │
│  ⚠️  POST /admin/designs/:id/publish  APPROVED → PUBLISHED                  │
│  ⚠️  GET  /admin/users                List all users                        │
│  ⚠️  GET  /admin/audit                Audit log of actions                  │
│                                                                              │
│  Purpose: Content moderation, user management                               │
│  Status: NEEDS IMPLEMENTATION (lower priority)                              │
└──────────────────────────────────────────────────────────────────────────────┘


┌─ 🏥 HEALTH (1 endpoint) ─────────────────────────────────────────────────────┐
│                                                                              │
│  ✅ GET /health                       Server health check                   │
│                                                                              │
│  Status: COMPLETE                                                           │
└──────────────────────────────────────────────────────────────────────────────┘


╔══════════════════════════════════════════════════════════════════════════════╗
║                         IMPLEMENTATION ROADMAP                               ║
╚══════════════════════════════════════════════════════════════════════════════╝

  STEP 3 (NEXT)       → Design CRUD (6 endpoints)         [HIGH PRIORITY]
  STEP 4              → File Management (4 endpoints)     [HIGH PRIORITY]
  STEP 5              → Payouts (2 endpoints)             [MEDIUM PRIORITY]
  STEP 6              → Buyer Features (5 endpoints)      [HIGH PRIORITY]
  STEP 7              → Favorites (3 endpoints)           [LOW PRIORITY]
  STEP 8              → Messaging (4 endpoints)           [MEDIUM PRIORITY]
  STEP 9              → Modifications (4 endpoints)       [MEDIUM PRIORITY]
  STEP 10             → Admin Panel (6 endpoints)         [LOW PRIORITY]


╔══════════════════════════════════════════════════════════════════════════════╗
║                         AUTH & PERMISSION MATRIX                             ║
╚══════════════════════════════════════════════════════════════════════════════╝

┌─────────────────────────┬─────────┬──────────┬───────┬────────────────────┐
│ Endpoint                │ Public  │ Buyer    │ Arch  │ Admin              │
├─────────────────────────┼─────────┼──────────┼───────┼────────────────────┤
│ /marketplace/*          │   ✓     │    ✓     │   ✓   │    ✓               │
│ /auth/*                 │   ✓     │    ✓     │   ✓   │    ✓               │
│ /architect/designs      │   ✗     │    ✗     │   ✓   │    ✗               │
│ /architect/account      │   ✗     │    ✗     │   ✓   │    ✗               │
│ /architect/payouts      │   ✗     │    ✗     │   ✓   │    ✗               │
│ /files/upload           │   ✗     │    ✗     │   ✓   │    ✗               │
│ /files/:id/download     │   ✗     │  ✓ (L)   │   ✓   │    ✓               │
│ /buyer/purchases        │   ✗     │    ✓     │   ✗   │    ✗               │
│ /buyer/library          │   ✗     │    ✓     │   ✗   │    ✗               │
│ /buyer/favorites        │   ✗     │    ✓     │   ✗   │    ✗               │
│ /messages (POST)        │   ✗     │  ✓ (E)   │   ✗   │    ✗               │
│ /messages (GET)         │   ✗     │    ✓     │   ✓   │    ✗               │
│ /modifications/request  │   ✗     │  ✓ (E)   │   ✗   │    ✗               │
│ /modifications/*        │   ✗     │    ✓     │   ✓   │    ✗               │
│ /admin/*                │   ✗     │    ✗     │   ✗   │    ✓               │
└─────────────────────────┴─────────┴──────────┴───────┴────────────────────┘

Legend:
  ✓   = Allowed
  ✗   = Forbidden (403)
  (L) = Requires active license
  (E) = Requires EXCLUSIVE license


╔══════════════════════════════════════════════════════════════════════════════╗
║                         ERROR CODE REFERENCE                                 ║
╚══════════════════════════════════════════════════════════════════════════════╝

  200 OK                    → Success (GET, PUT, DELETE)
  201 Created               → Success (POST create)
  400 Bad Request           → Validation error, missing fields
  401 Unauthorized          → Missing or invalid token
  403 Forbidden             → Valid token but insufficient permissions
  404 Not Found             → Resource doesn't exist
  409 Conflict              → Duplicate (email exists, already favorited)
  413 Payload Too Large     → File size exceeded
  500 Internal Server Error → Backend error (should be rare)


╔══════════════════════════════════════════════════════════════════════════════╗
║                         STANDARD ERROR RESPONSE                              ║
╚══════════════════════════════════════════════════════════════════════════════╝

All errors return:
{
  "error": "Human-readable error message",
  "code": "ERROR_CODE_CONSTANT",
  "status": 400
}

Examples:
{
  "error": "Email already exists",
  "code": "EMAIL_EXISTS",
  "status": 409
}

{
  "error": "You do not have permission to access this resource",
  "code": "FORBIDDEN",
  "status": 403
}


╔══════════════════════════════════════════════════════════════════════════════╗
║                         DESIGN STATE MACHINE                                 ║
╚══════════════════════════════════════════════════════════════════════════════╝

                    ┌─────────────────────────┐
                    │        DRAFT            │
                    │ (editable by architect) │
                    └───────────┬─────────────┘
                                │
                                │ POST /architect/designs/:id/submit
                                │
                                ▼
                    ┌─────────────────────────┐
                    │      SUBMITTED          │
                    │  (awaiting admin review)│
                    └───────┬─────────┬───────┘
                            │         │
        POST /admin/:id/reject      POST /admin/:id/approve
                            │         │
                            │         ▼
                            │     ┌─────────────────────────┐
                            │     │       APPROVED          │
                            │     │  (ready for publishing) │
                            │     └───────────┬─────────────┘
                            │                 │
                            │                 │ POST /admin/:id/publish
                            │                 │
                            ▼                 ▼
                    ┌─────────────────────────┐
                    │      PUBLISHED          │
                    │  (visible in marketplace)│
                    └─────────────────────────┘

Rules:
  • Architect can only edit DRAFT
  • Architect can submit DRAFT → SUBMITTED
  • Admin can approve SUBMITTED → APPROVED
  • Admin can reject SUBMITTED → DRAFT
  • Admin can publish APPROVED → PUBLISHED
  • Published designs cannot be edited


╔══════════════════════════════════════════════════════════════════════════════╗
║                         LICENSE COMPARISON                                   ║
╚══════════════════════════════════════════════════════════════════════════════╝

┌────────────────────────┬────────────────────┬──────────────────────────────┐
│ Feature                │ STANDARD License   │ EXCLUSIVE License            │
├────────────────────────┼────────────────────┼──────────────────────────────┤
│ Download Files         │        ✓           │              ✓               │
│ View Design Details    │        ✓           │              ✓               │
│ Message Architect      │        ✗           │              ✓               │
│ Request Modifications  │        ✗           │              ✓               │
│ Price                  │     Base Price     │      Base Price × 2-3        │
│ API Access             │     Limited        │           Full               │
└────────────────────────┴────────────────────┴──────────────────────────────┘

🚨 Anti-Bypass Protection:
   POST /messages → 403 if STANDARD license
   POST /modifications/request → 403 if STANDARD license


╔══════════════════════════════════════════════════════════════════════════════╗
║                         CONTRACT ENFORCEMENT                                 ║
╚══════════════════════════════════════════════════════════════════════════════╝

❌ FORBIDDEN ACTIONS:

  1. Frontend calling endpoints not in contract
  2. Backend implementing endpoints not in contract
  3. Using /api/* prefixes (all routes from root)
  4. Changing response format without updating contract
  5. Adding endpoints without documentation

✅ REQUIRED ACTIONS:

  1. Always check API_CONTRACT.md before coding
  2. Implement endpoints exactly as specified
  3. Return errors in standard format
  4. Enforce authentication as documented
  5. Test with curl before frontend integration


╔══════════════════════════════════════════════════════════════════════════════╗
║                         QUICK REFERENCE                                      ║
╚══════════════════════════════════════════════════════════════════════════════╝

Base URL:     http://localhost:3001
Auth Header:  Authorization: Bearer <token>
Content-Type: application/json (except multipart uploads)

Get Token:
  curl -X POST http://localhost:3001/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"password123"}'

Use Token:
  curl http://localhost:3001/architect/designs \
    -H "Authorization: Bearer YOUR_TOKEN_HERE"

Test Endpoint:
  curl -i http://localhost:3001/health


```

---

**STEP 2 COMPLETE** ✅  
**Contract Locked** 🔒  
**Ready for STEP 3** 🚀

Open [API_CONTRACT.md](API_CONTRACT.md) for full details!
