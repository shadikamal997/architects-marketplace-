# STEP 1 COMPLETE — ADMIN REVIEW FOUNDATION

**Status:** ✅ IMPLEMENTATION COMPLETE  
**Date:** February 4, 2026  
**Phase:** Backend Logic & State Machine Ready

---

## 🎯 STEP 1 OBJECTIVES — COMPLETE

✅ **Database State Rules:** SUBMITTED → APPROVED / REJECTED enforced  
✅ **Service Layer:** Core admin design review logic  
✅ **API Endpoints:** Admin approve/reject operations  
✅ **Permission Enforcement:** Only admins can moderate, architects can edit REJECTED  
✅ **State Machine:** Locked and enforced (no loopholes)

---

## 🔐 LOCKED STATE MACHINE

```
┌─────────┐
│  DRAFT  │ ← Architect creates/edits
└────┬────┘
     │ POST /architect/designs/:id/submit
     │ (architect action)
     ↓
┌───────────┐
│ SUBMITTED │ ← Awaiting admin review
└─────┬─────┘
      │
      ├────── POST /admin/designs/:id/approve ──→ ┌──────────┐
      │       (admin approves)                      │ APPROVED │
      │                                             └──────────┘
      │                                                   ↓
      │                                            (ready for publishing)
      │
      └────── POST /admin/designs/:id/reject ───→ ┌──────────┐
              (admin rejects with reason)           │ REJECTED │
                                                    └────┬─────┘
                                                         │
                                                         │ PUT /architect/designs/:id
                                                         │ (architect edits)
                                                         ↓
                                                    ┌─────────┐
                                                    │  DRAFT  │
                                                    └─────────┘
```

---

## 🔒 STATE TRANSITION RULES (NON-NEGOTIABLE)

| From | Action | To | Who |
|------|--------|----|----|
| DRAFT | Submit | SUBMITTED | Architect |
| SUBMITTED | Approve | APPROVED | Admin |
| SUBMITTED | Reject | REJECTED | Admin |
| REJECTED | Edit | DRAFT | Architect |
| APPROVED | ❌ Edit | BLOCKED | No one |
| SUBMITTED | ❌ Edit | BLOCKED | No one |

**Hard Blocks Enforced:**
- ❌ Admin cannot approve DRAFT designs
- ❌ Admin cannot reject DRAFT designs
- ❌ Architect cannot edit SUBMITTED designs
- ❌ Architect cannot edit APPROVED designs
- ❌ Architect cannot self-approve

---

## 📦 FILES CREATED

### 1. Service Layer
**File:** `src/services/admin-design.service.js`

**Methods:**
```javascript
getSubmittedDesigns()              // Get all designs awaiting review
getDesignForReview(designId)       // Get single design with full details
approveDesign(designId, adminId)   // SUBMITTED → APPROVED
rejectDesign(designId, reason, adminId, adminNotes)  // SUBMITTED → REJECTED
getDesignStats()                   // Get counts by status
getRecentlyReviewed(limit)         // Get recently approved/rejected
canArchitectEdit(status)           // Check if status allows editing
resetRejectedToDraft(designId)     // REJECTED → DRAFT on edit
```

**State Enforcement:**
- Validates status before transitions
- Throws errors for invalid state changes
- Clears rejection data on approval
- Keeps rejection reason when resetting to DRAFT

### 2. Admin Routes (Updated)
**File:** `src/routes/admin.routes.js`

**New/Updated Endpoints:**
```
GET  /admin/designs/submitted      → List designs awaiting review
GET  /admin/designs/stats          → Get design statistics
GET  /admin/designs/recent         → Get recently reviewed designs
GET  /admin/designs/:id            → Get single design for review
POST /admin/designs/:id/approve    → Approve design (SUBMITTED → APPROVED)
POST /admin/designs/:id/reject     → Reject design with reason (SUBMITTED → REJECTED)
```

**Security:**
- All routes require `requireAuth` + `requireRole('ADMIN')`
- Validates design exists
- Validates status before transitions
- Returns 400 for invalid state changes
- Returns 404 for missing designs

### 3. Architect Routes (Updated)
**File:** `src/routes/architect.routes.js`

**Changes:**
```javascript
PUT /architect/designs/:id
  - Now allows editing REJECTED designs
  - Automatically resets REJECTED → DRAFT on first edit
  - Keeps rejectionReason visible for architect reference

DELETE /architect/designs/:id
  - Now allows deleting REJECTED designs
  - Still blocks deletion of SUBMITTED/APPROVED designs
```

**State Enforcement:**
```javascript
// Old: Only DRAFT editable
if (design.status !== 'DRAFT') { ... }

// New: DRAFT and REJECTED editable
if (!['DRAFT', 'REJECTED'].includes(design.status)) { ... }

// Auto-reset on edit
if (design.status === 'REJECTED') {
  sanitized.status = 'DRAFT';
  // Keep rejectionReason for architect to see
}
```

---

## 🧪 STEP 1 TEST CHECKLIST

### Prerequisites

1. **Backend running** on port 3001
2. **Two test accounts:**
   - Architect account (role: ARCHITECT)
   - Admin account (role: ADMIN)
3. **At least one design** in SUBMITTED status

---

### Test 1: Admin Sees Only SUBMITTED Designs

**Request:**
```bash
GET /admin/designs/submitted
Authorization: Bearer <admin-jwt>
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "designs": [
      {
        "id": "...",
        "title": "Modern Villa",
        "status": "SUBMITTED",
        "submittedAt": "2026-02-04T10:00:00Z",
        "architect": {
          "id": "...",
          "name": "John Architect",
          "email": "john@example.com"
        },
        "filesCount": 4,
        "previewImagesCount": 3,
        "hasMainPackage": true
      }
    ],
    "total": 1
  }
}
```

**✅ Pass Criteria:**
- Only designs with status = SUBMITTED returned
- No DRAFT, APPROVED, or PUBLISHED designs shown
- Architect info included
- File counts accurate

---

### Test 2: Admin Approves Design

**Request:**
```bash
POST /admin/designs/:id/approve
Authorization: Bearer <admin-jwt>
Content-Type: application/json
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "success": true,
    "message": "Design approved successfully",
    "design": {
      "id": "...",
      "title": "Modern Villa",
      "status": "APPROVED",
      "approvedAt": "2026-02-04T11:00:00Z"
    }
  }
}
```

**✅ Pass Criteria:**
- Design status changed from SUBMITTED → APPROVED
- approvedAt timestamp set
- rejectionReason cleared (if previously rejected)
- Architect cannot edit anymore

**Verify in Database:**
```sql
SELECT id, title, status, approvedAt, rejectionReason 
FROM Design 
WHERE id = '...';

-- Should show:
-- status: APPROVED
-- approvedAt: <timestamp>
-- rejectionReason: null
```

---

### Test 3: Admin Rejects Design With Reason

**Request:**
```bash
POST /admin/designs/:id/reject
Authorization: Bearer <admin-jwt>
Content-Type: application/json

{
  "reason": "Design does not meet minimum quality standards. Please improve the following: 1) Structural details missing 2) Sustainability features not documented",
  "adminNotes": "Reviewed by John Admin - lacks foundation details"
}
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "success": true,
    "message": "Design rejected successfully",
    "design": {
      "id": "...",
      "title": "Modern Villa",
      "status": "REJECTED",
      "rejectionReason": "Design does not meet minimum quality standards..."
    }
  }
}
```

**✅ Pass Criteria:**
- Design status changed from SUBMITTED → REJECTED
- rejectionReason saved (architect can see this)
- adminNotes saved (internal only, architect doesn't see)
- Architect can now edit the design

**Verify in Database:**
```sql
SELECT id, title, status, rejectionReason, adminNotes 
FROM Design 
WHERE id = '...';

-- Should show:
-- status: REJECTED
-- rejectionReason: "Design does not meet..."
-- adminNotes: "Rejected by admin ... lacks foundation details"
```

---

### Test 4: Architect Edits Rejected Design → Resets to DRAFT

**Setup:** Design is in REJECTED status (from Test 3)

**Request:**
```bash
PUT /architect/designs/:id
Authorization: Bearer <architect-jwt>
Content-Type: application/json

{
  "title": "Modern Villa (Updated)",
  "description": "Added structural details and sustainability documentation"
}
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "design": {
      "id": "...",
      "title": "Modern Villa (Updated)",
      "status": "DRAFT",
      "rejectionReason": "Design does not meet..." // Still visible
    },
    "message": "Design updated successfully"
  }
}
```

**✅ Pass Criteria:**
- Design status changed from REJECTED → DRAFT
- Architect can see rejection reason (to know what to fix)
- Design becomes editable again
- Architect can resubmit after fixing issues

**Verify in Database:**
```sql
SELECT id, title, status, rejectionReason 
FROM Design 
WHERE id = '...';

-- Should show:
-- status: DRAFT (changed from REJECTED)
-- rejectionReason: <still present for reference>
```

---

### Test 5: Architect Cannot Edit SUBMITTED Design

**Setup:** Design is in SUBMITTED status

**Request:**
```bash
PUT /architect/designs/:id
Authorization: Bearer <architect-jwt>
Content-Type: application/json

{
  "title": "Trying to edit submitted design"
}
```

**Expected Response:**
```json
{
  "error": "Design locked",
  "message": "Can only update designs in DRAFT or REJECTED status",
  "currentStatus": "SUBMITTED"
}
```

**Status Code:** 400 Bad Request

**✅ Pass Criteria:**
- Edit blocked with clear error message
- Status remains SUBMITTED
- No changes saved to database

---

### Test 6: Architect Cannot Edit APPROVED Design

**Setup:** Design is in APPROVED status

**Request:**
```bash
PUT /architect/designs/:id
Authorization: Bearer <architect-jwt>
Content-Type: application/json

{
  "title": "Trying to edit approved design"
}
```

**Expected Response:**
```json
{
  "error": "Design locked",
  "message": "Can only update designs in DRAFT or REJECTED status",
  "currentStatus": "APPROVED"
}
```

**Status Code:** 400 Bad Request

**✅ Pass Criteria:**
- Edit blocked with clear error message
- Status remains APPROVED
- No changes saved to database

---

### Test 7: Admin Cannot Approve DRAFT Design

**Setup:** Design is in DRAFT status

**Request:**
```bash
POST /admin/designs/:id/approve
Authorization: Bearer <admin-jwt>
```

**Expected Response:**
```json
{
  "error": "Invalid state",
  "message": "Cannot approve design with status: DRAFT. Only SUBMITTED designs can be approved."
}
```

**Status Code:** 400 Bad Request

**✅ Pass Criteria:**
- Approval blocked with clear error message
- Status remains DRAFT
- No changes saved to database

---

### Test 8: Admin Cannot Reject DRAFT Design

**Setup:** Design is in DRAFT status

**Request:**
```bash
POST /admin/designs/:id/reject
Authorization: Bearer <admin-jwt>
Content-Type: application/json

{
  "reason": "Testing rejection of draft"
}
```

**Expected Response:**
```json
{
  "error": "Invalid request",
  "message": "Cannot reject design with status: DRAFT. Only SUBMITTED designs can be rejected."
}
```

**Status Code:** 400 Bad Request

**✅ Pass Criteria:**
- Rejection blocked with clear error message
- Status remains DRAFT
- No changes saved to database

---

### Test 9: Rejection Requires Minimum 10 Characters

**Request:**
```bash
POST /admin/designs/:id/reject
Authorization: Bearer <admin-jwt>
Content-Type: application/json

{
  "reason": "Bad"
}
```

**Expected Response:**
```json
{
  "error": "Validation failed",
  "message": "Rejection reason must be at least 10 characters"
}
```

**Status Code:** 400 Bad Request

**✅ Pass Criteria:**
- Rejection blocked due to short reason
- Design status unchanged
- Clear validation error message

---

### Test 10: Get Design Statistics

**Request:**
```bash
GET /admin/designs/stats
Authorization: Bearer <admin-jwt>
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "stats": {
      "total": 15,
      "draft": 5,
      "submitted": 3,
      "approved": 4,
      "published": 2,
      "rejected": 1
    }
  }
}
```

**✅ Pass Criteria:**
- Accurate counts for each status
- Total equals sum of all statuses
- Real-time data from database

---

### Test 11: Get Recently Reviewed Designs

**Request:**
```bash
GET /admin/designs/recent?limit=5
Authorization: Bearer <admin-jwt>
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "designs": [
      {
        "id": "...",
        "title": "Modern Villa",
        "status": "APPROVED",
        "updatedAt": "2026-02-04T11:00:00Z",
        "approvedAt": "2026-02-04T11:00:00Z",
        "rejectionReason": null,
        "architect": {
          "id": "...",
          "name": "John Architect"
        }
      },
      {
        "id": "...",
        "title": "Urban Loft",
        "status": "REJECTED",
        "updatedAt": "2026-02-04T10:30:00Z",
        "approvedAt": null,
        "rejectionReason": "Incomplete documentation",
        "architect": {
          "id": "...",
          "name": "Jane Architect"
        }
      }
    ]
  }
}
```

**✅ Pass Criteria:**
- Only APPROVED and REJECTED designs returned
- Sorted by updatedAt descending (newest first)
- Limit parameter respected
- Includes architect info

---

## ✅ STEP 1 PASS CRITERIA

**All tests must pass:**
- ✅ Test 1: Admin sees only SUBMITTED designs
- ✅ Test 2: Admin approves → status = APPROVED
- ✅ Test 3: Admin rejects → status = REJECTED + reason saved
- ✅ Test 4: Architect edits rejected → status resets to DRAFT
- ✅ Test 5: Architect cannot edit SUBMITTED
- ✅ Test 6: Architect cannot edit APPROVED
- ✅ Test 7: Admin cannot approve DRAFT
- ✅ Test 8: Admin cannot reject DRAFT
- ✅ Test 9: Rejection requires min 10 chars
- ✅ Test 10: Stats endpoint accurate
- ✅ Test 11: Recent designs filtered correctly

**Foundation is solid when:**
- ✅ Services implemented
- ✅ State transitions enforced
- ✅ No loopholes (all hard blocks work)
- ✅ Clear error messages
- ✅ Database state always consistent

---

## 🔐 PERMISSION MATRIX

| Action | DRAFT | SUBMITTED | APPROVED | REJECTED |
|--------|-------|-----------|----------|----------|
| **Architect Edit** | ✅ Yes | ❌ No | ❌ No | ✅ Yes → DRAFT |
| **Architect Delete** | ✅ Yes | ❌ No | ❌ No | ✅ Yes |
| **Architect Submit** | ✅ Yes | ❌ No | ❌ No | ✅ Yes (after edit) |
| **Admin Approve** | ❌ No | ✅ Yes | ❌ No | ❌ No |
| **Admin Reject** | ❌ No | ✅ Yes | ❌ No | ❌ No |

---

## 📊 DATABASE FIELDS CONFIRMED

```prisma
model Design {
  // ... existing fields ...
  
  status          DesignStatus  @default(DRAFT)
  submittedAt     DateTime?
  approvedAt      DateTime?
  publishedAt     DateTime?
  rejectionReason String?       @db.Text
  adminNotes      String?       @db.Text
  
  // ... rest of model ...
}

enum DesignStatus {
  DRAFT
  SUBMITTED
  APPROVED
  PUBLISHED
  REJECTED
}
```

**Field Usage:**
- `status`: Current state in workflow
- `submittedAt`: When architect submitted for review
- `approvedAt`: When admin approved (APPROVED only)
- `publishedAt`: When design went live (future: PUBLISHED state)
- `rejectionReason`: Public message architect sees
- `adminNotes`: Internal notes (architect never sees)

---

## 🚀 NEXT STEPS (AFTER STEP 1 PASSES)

### Step 2: Email Notifications (Optional)
- Send email when design approved
- Send email when design rejected (with reason)
- Email templates for architect communication

### Step 3: Admin Dashboard UI (Frontend)
- View submitted designs queue
- Design review page (full details)
- Approve/Reject buttons
- Recent activity feed
- Statistics dashboard

### Step 4: Publishing Workflow
- Admin publishes approved designs
- APPROVED → PUBLISHED transition
- Public marketplace visibility
- Search indexing

---

## 🎉 STEP 1 STATUS: COMPLETE

**✅ Implementation:** 100% Complete  
**⏳ Testing:** Awaiting User Execution  
**✅ Documentation:** Complete

**Run the 11 tests above to verify the foundation is solid, then move to Step 2.**
