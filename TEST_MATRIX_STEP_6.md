# STEP 6 — TESTING, POLISH & ANALYTICS - TEST MATRIX

## 🎯 Critical Path Testing (MANDATORY)

Run this checklist end-to-end before considering the feature complete.

---

## ✅ PART 1: ARCHITECT FLOW (Primary User Journey)

### Test 1: Create New Design Draft
- [ ] Navigate to `/architect/designs/create`
- [ ] Verify Step 1 loads correctly
- [ ] Fill required fields: title, shortSummary, category
- [ ] Wait 2 seconds → verify "Draft saved" indicator appears
- [ ] Check browser console → design ID should be created
- [ ] **Expected:** Design saved with status=DRAFT

### Test 2: Step Navigation & Data Persistence
- [ ] Fill data in Step 1
- [ ] Click "Next Step" → navigate to Step 2
- [ ] Fill data in Step 2
- [ ] Click "Previous" → return to Step 1
- [ ] **Expected:** Step 1 data still filled (no data loss)
- [ ] Navigate through all 6 steps
- [ ] **Expected:** All data persists during navigation

### Test 3: Autosave Functionality
- [ ] Start in any step
- [ ] Type in a text field
- [ ] Wait exactly 2 seconds
- [ ] **Expected:** "Draft saved" indicator appears
- [ ] Check Network tab → PUT request to `/architect/designs/{id}`
- [ ] Refresh the page
- [ ] **Expected:** Data is still there (autosave worked)

### Test 4: File Upload - Main Package (ZIP)
- [ ] Navigate to Step 5 (Files)
- [ ] If "Save Your Design First" message → complete Steps 1-4 first
- [ ] Drag & drop a ZIP file (or click to browse)
- [ ] **Expected:** Upload progress indicator appears
- [ ] **Expected:** "Upload complete ✓" message
- [ ] Reload page → navigate back to Step 5
- [ ] **Expected:** ZIP file still listed with "Replace" button

### Test 5: File Upload - Preview Images (Min 3)
- [ ] In Step 5, upload 1 image
- [ ] **Expected:** Status shows "1/3 images uploaded (minimum required)"
- [ ] Upload 2 more images (total 3)
- [ ] **Expected:** Status shows "3/3 images ✓ (minimum met)"
- [ ] **Expected:** Thumbnail previews displayed
- [ ] Click "Delete" on one image
- [ ] Confirm deletion
- [ ] **Expected:** Image removed, count updates to "2/3"

### Test 6: File Upload - 3D Assets (Optional)
- [ ] In Step 5, upload a .skp or .fbx file
- [ ] **Expected:** File uploads successfully
- [ ] **Expected:** Listed in "3D Assets" section
- [ ] **Expected:** Can delete the file

### Test 7: Page Reload During Creation
- [ ] Start creating design, complete Steps 1-3
- [ ] Hard refresh browser (Cmd+R / Ctrl+R)
- [ ] **Expected:** Design loads with saved data
- [ ] **Expected:** Can continue from where you left off
- [ ] **Expected:** No error messages

### Test 8: Submit for Review (Happy Path)
- [ ] Complete all 6 steps:
  - Step 1: Title, summary, category ✓
  - Step 2: Description (optional but recommended)
  - Step 3: Design stage ✓
  - Step 4: Code disclaimer ✓
  - Step 5: 1 ZIP + 3 images ✓
  - Step 6: License type, price ✓
- [ ] Click "Submit for Review"
- [ ] **Expected:** Success message: "Design submitted successfully"
- [ ] **Expected:** Redirect to `/architect/designs`
- [ ] **Expected:** Design status = SUBMITTED
- [ ] Check database → `submittedAt` timestamp should be set

### Test 9: Edit After Submit (Should Block)
- [ ] After submitting design (Test 8)
- [ ] Try to navigate back to edit
- [ ] **Expected:** Cannot edit (status locked)
- [ ] Try API call: `PUT /architect/designs/{id}` with status=SUBMITTED
- [ ] **Expected:** 400 error: "Can only update designs in DRAFT status"

---

## ✅ PART 2: EDGE CASE VALIDATION

### Edge Case 1: Submit Without ZIP
- [ ] Create design, complete Steps 1-4, 6
- [ ] Skip Step 5 (no files uploaded)
- [ ] Try to submit
- [ ] **Expected:** Backend returns 400 error
- [ ] **Expected:** Error message: "Main package file required"

### Edge Case 2: Submit With < 3 Images
- [ ] Create design, upload ZIP + only 2 images
- [ ] Try to submit
- [ ] **Expected:** Backend returns 400 error
- [ ] **Expected:** Error message: "Minimum 3 preview images required"

### Edge Case 3: Submit Without Code Disclaimer
- [ ] Create design, complete all steps
- [ ] In Step 4, do NOT check "code disclaimer" checkbox
- [ ] Try to submit
- [ ] **Expected:** Alert: "You must accept the code compliance disclaimer"
- [ ] **Expected:** Submit blocked

### Edge Case 4: Submit With Price = 0
- [ ] Create design, set standardPrice = 0 in Step 6
- [ ] Try to submit
- [ ] **Expected:** Frontend validation error: "Minimum price is $1"

### Edge Case 5: Exclusive Price < Standard Price
- [ ] In Step 6, set:
  - License Type: Standard
  - Standard Price: $500
  - Exclusive Price: $400 (less than standard)
- [ ] Try to proceed
- [ ] **Expected:** Validation error: "Exclusive price must be greater than standard"

### Edge Case 6: Upload File > Size Limit
- [ ] Try to upload ZIP file > 500MB
- [ ] **Expected:** Client-side rejection: "File too large. Max: 500MB"
- [ ] Try to upload image > 10MB
- [ ] **Expected:** Client-side rejection: "File too large. Max: 10MB"

### Edge Case 7: Upload Wrong File Type
- [ ] Try to upload .exe or .pdf as main package (not .zip)
- [ ] **Expected:** Client-side rejection: "Invalid file type. Use .zip"
- [ ] Try to upload .txt as preview image
- [ ] **Expected:** Client-side rejection: "Invalid file type. Use JPG/PNG/WebP"

### Edge Case 8: Upload After Submission
- [ ] Submit a design (status=SUBMITTED)
- [ ] Try to upload files via API: `POST /architect/designs/{id}/files`
- [ ] **Expected:** 400 error: "Can only upload files when design status is DRAFT"

### Edge Case 9: Delete Design After Submission
- [ ] Submit a design (status=SUBMITTED)
- [ ] Try to delete via API: `DELETE /architect/designs/{id}`
- [ ] **Expected:** 400 error: "Can only delete designs in DRAFT status"

---

## ✅ PART 3: BUYER FLOW (Regression Check)

### Test 10: Browse Marketplace
- [ ] Navigate to `/marketplace`
- [ ] **Expected:** List of PUBLISHED designs loads
- [ ] **Expected:** DRAFT/SUBMITTED designs NOT visible
- [ ] Click on a design
- [ ] **Expected:** Design detail page loads

### Test 11: Purchase Flow
- [ ] As BUYER, select a design
- [ ] Click "Purchase"
- [ ] Complete payment (if implemented)
- [ ] **Expected:** Transaction created
- [ ] **Expected:** Access granted to design files

### Test 12: Download Files (Access Control)
- [ ] As BUYER who purchased design
- [ ] Navigate to "My Purchases"
- [ ] **Expected:** Can see purchased designs
- [ ] Click "Download"
- [ ] **Expected:** Files accessible
- [ ] As BUYER who did NOT purchase
- [ ] Try to access file URL directly
- [ ] **Expected:** 403 Forbidden (access denied)

### Test 13: Leave Review (Purchase Required)
- [ ] As BUYER who purchased design
- [ ] Try to leave review
- [ ] **Expected:** Review form accessible
- [ ] As BUYER who did NOT purchase
- [ ] Try to leave review
- [ ] **Expected:** Blocked (must purchase first)

---

## ✅ PART 4: AUTHENTICATION REGRESSION

### Test 14: Email Login
- [ ] Logout
- [ ] Login with email + password
- [ ] **Expected:** Successful login
- [ ] **Expected:** JWT token stored
- [ ] **Expected:** Redirected to dashboard

### Test 15: Google OAuth
- [ ] Logout
- [ ] Click "Sign in with Google"
- [ ] Complete Google OAuth flow
- [ ] **Expected:** Successful login
- [ ] **Expected:** Account created/linked

### Test 16: Apple OAuth
- [ ] Logout
- [ ] Click "Sign in with Apple"
- [ ] Complete Apple OAuth flow
- [ ] **Expected:** Successful login
- [ ] **Expected:** Account created/linked

### Test 17: Social Account Linking
- [ ] User already exists with email
- [ ] Login with Google using same email
- [ ] **Expected:** Accounts linked (not duplicate created)

---

## ✅ PART 5: ANALYTICS VERIFICATION

### Test 18: Step View Tracking
- [ ] Open browser console
- [ ] Create new design
- [ ] Navigate to Step 1
- [ ] **Expected:** Console log: `[Analytics] design_create_step_viewed { step: 1 }`
- [ ] Navigate to Step 2
- [ ] **Expected:** Console log: `[Analytics] design_create_step_viewed { step: 2 }`

### Test 19: Step Completion Tracking
- [ ] Fill out Step 1 completely
- [ ] Click "Next Step"
- [ ] **Expected:** Console log: `[Analytics] design_create_step_completed { step: 1 }`

### Test 20: Abandonment Tracking
- [ ] Create design, complete Steps 1-3
- [ ] Close browser tab (don't submit)
- [ ] **Expected:** Console log: `[Analytics] design_create_abandoned { lastStep: 3 }`

### Test 21: Submission Tracking
- [ ] Complete design and submit for review
- [ ] **Expected:** Console log: `[Analytics] design_submitted_for_review { timeToCompleteMinutes: X }`

### Test 22: Autosave Tracking
- [ ] Edit any field
- [ ] Wait for autosave
- [ ] **Expected:** Console log: `[Analytics] design_autosave { success: true }`

---

## ✅ PART 6: UX POLISH VERIFICATION

### Test 23: Visual Progress Indicator
- [ ] Navigate through wizard
- [ ] **Expected:** Step numbers (1-6) highlight current step
- [ ] **Expected:** Progress line connects completed steps
- [ ] **Expected:** Current step is blue, completed steps are blue, future steps are gray

### Test 24: Draft Save Indicator
- [ ] Edit a field
- [ ] Wait 2 seconds
- [ ] **Expected:** "Draft saved X seconds ago" text appears
- [ ] **Expected:** Subtle, not intrusive

### Test 25: Button Language (Professional Tone)
- [ ] Check button text throughout wizard
- [ ] **Expected:** "Submit for Review" (not just "Submit")
- [ ] **Expected:** "Save Draft" (not just "Save")
- [ ] **Expected:** "Next Step →" (not just "Next")
- [ ] **Expected:** "Design Deliverables" (not just "Files")

### Test 26: Sustainability Nudge (Soft Warning)
- [ ] In Step 4, leave sustainability tags empty
- [ ] **Expected:** Blue info box appears
- [ ] **Expected:** Message: "Designs with sustainability features typically attract 30% more interest"
- [ ] **Expected:** Not blocking, just informative

### Test 27: Upload Success Feedback
- [ ] Upload a file
- [ ] **Expected:** Progress bar animates
- [ ] **Expected:** Green checkmark icon on success
- [ ] **Expected:** "✓ Upload complete" message

---

## 📊 ANALYTICS DASHBOARD (Future Implementation)

Once analytics are flowing to a backend, create dashboards for:

### Key Metrics to Monitor:

**Completion Rate:**
```
(Submitted Designs / Started Designs) × 100
Target: >60%
```

**Step Dropout:**
```
Track which step has highest abandonment
Action: Simplify or add help text
```

**Time to Complete:**
```
Median time from Step 1 to Submit
Target: <30 minutes
```

**Upload Success Rate:**
```
(Successful Uploads / Attempted Uploads) × 100
Target: >95%
```

**File Type Errors:**
```
Count of "Invalid file type" errors
Action: Improve instructions
```

---

## 🔒 FINAL CHECKLIST (Before Lock)

- [ ] All Part 1 tests passing ✅
- [ ] All Part 2 edge cases handled ✅
- [ ] All Part 3 buyer flows working ✅
- [ ] All Part 4 auth flows working ✅
- [ ] All Part 5 analytics logging ✅
- [ ] All Part 6 UX polish visible ✅
- [ ] Backend validation comprehensive ✅
- [ ] No silent failures ✅
- [ ] No data loss scenarios ✅
- [ ] Professional tone throughout ✅

---

## ✅ PASS CRITERIA

**Feature is LOCKED and PRODUCTION-READY when:**

✅ All critical path tests pass (Part 1)  
✅ All edge cases properly blocked (Part 2)  
✅ No regression in buyer flows (Part 3)  
✅ Analytics tracking verified (Part 5)  
✅ UX polish complete (Part 6)  
✅ Zero known data loss scenarios  
✅ Zero silent failures  

**Once locked, only allow:**
- Bug fixes
- Performance optimizations
- UX micro-improvements
- New features via extensions (not rewrites)

---

## 🚀 STATUS TRACKING

**Date Started:** [Fill in]  
**Tester:** [Fill in]  
**Date Completed:** [Fill in]  

**Results:**
- Tests Passed: ___ / 27
- Critical Failures: ___
- Minor Issues: ___
- Blockers: ___

**Notes:**
[Add any observations, bugs found, or improvement suggestions]

---

**This is your QA checklist. Complete it before declaring victory.**
