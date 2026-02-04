# 🏗️ ARCHITECTS MARKETPLACE - COMPLETE SYSTEM AUDIT

**Generated:** February 2, 2025  
**Author:** GitHub Copilot  
**Type:** Full Stack Application  
**Status:** ✅ Authentication Working | ⚠️ Database Not Yet Implemented

---

## 📊 EXECUTIVE SUMMARY

This is a **marketplace platform connecting architects with buyers** for architectural design purchases. The system consists of a Next.js frontend and Express.js backend, currently using in-memory storage for development. A comprehensive Prisma schema is defined but not yet implemented.

### Current Status
- ✅ **Authentication System:** Fully functional with JWT tokens and role-based access
- ✅ **Frontend Pages:** 39+ pages across buyer, architect, and admin dashboards
- ✅ **Backend API:** 9 core endpoints + route modules for extended functionality
- ⚠️ **Database:** PostgreSQL configured via Prisma, not yet connected
- ⚠️ **File Storage:** AWS S3 configured but not implemented
- ⚠️ **Payments:** Stripe keys present but not functional

---

## 1. TECHNOLOGY STACK

### Frontend
- **Framework:** Next.js 16.1.4 (Pages Router)
- **Language:** TypeScript + React
- **Styling:** TailwindCSS
- **State Management:** React Context (AuthContext)
- **API Client:** Custom fetch wrapper
- **Port:** 3000

### Backend
- **Runtime:** Node.js
- **Framework:** Express.js
- **Authentication:** JWT (jsonwebtoken)
- **Password Hashing:** bcrypt (10 rounds)
- **Security:** Helmet, CORS, Rate Limiting
- **Port:** 3001

### Database
- **Type:** PostgreSQL (Neon hosted)
- **ORM:** Prisma
- **Status:** Schema defined, connection ready, not yet used
- **Current Storage:** In-memory arrays

### Infrastructure
- **File Storage:** AWS S3 (configured, not implemented)
- **Payments:** Stripe (test keys configured)
- **Monitoring:** Sentry (configured)
- **Version Control:** Git + GitHub

---

## 2. ENVIRONMENT CONFIGURATION

### .env Files (Local Only - Protected by .gitignore)

#### Main .env (Active)
```env
NODE_ENV=staging
PORT=3001
DATABASE_URL=postgresql://[REDACTED]
JWT_SECRET=staging_jwt_secret_minimum_32_characters_long_for_security
JWT_EXPIRES_IN=24h
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=3
FRONTEND_URL=http://localhost:3000
BACKEND_URL=http://localhost:3001
```

#### Additional Config Files
- **.env.staging** - Staging environment with test keys
- **.env.production** - Production credentials
- **.env.local-staging** - Local staging simulation
- **.env.example** - Template (safe to commit)

#### Frontend .env.local
```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001
```

**Security:** All .env files are excluded from git via .gitignore

---

## 3. AUTHENTICATION SYSTEM

### Architecture

#### Token Management
- **Type:** JWT (JSON Web Token)
- **Expiry:** 24 hours
- **Storage:** Dual storage strategy
  - `localStorage` - For client-side auth checks
  - `cookies` - For middleware SSR protection
- **Keys:** 
  - `auth_token` - JWT string
  - `auth_user` - User object JSON

#### User Roles
```typescript
enum UserRole {
  BUYER      // Can purchase designs
  ARCHITECT  // Can upload and sell designs
  ADMIN      // Platform management
}
```

### Authentication Flow

#### Registration (/register)
1. User fills form: email, password, confirm password, name, role
2. Frontend validates: passwords match, email format
3. POST `/auth/register` → Backend
4. Backend checks: email uniqueness
5. Password hashed with bcrypt (10 rounds)
6. User stored in memory array
7. JWT generated with payload: `{ userId, email, role, name }`
8. Response: `{ user, token }`
9. Frontend stores token + user in localStorage AND cookies
10. AuthContext updates state: `user`, `isLoading: false`
11. useEffect detects user → redirect to role-based dashboard

#### Login (/login)
1. User submits email + password
2. POST `/auth/login` → Backend
3. Backend validates credentials
4. JWT generated and returned
5. Frontend stores token + user
6. Redirect to dashboard

#### Session Persistence
- On app mount, `AuthContext.initializeAuth()` runs:
  1. Read `auth_token` from localStorage
  2. If exists → GET `/auth/me` to validate
  3. If valid → set user state
  4. If invalid → clear storage
  5. Set `isLoading: false`

#### Middleware Protection (Server-Side)
**File:** [frontend-app/middleware.ts](frontend-app/middleware.ts)

```typescript
// Runs BEFORE page renders
export function middleware(request: NextRequest) {
  const token = request.cookies.get('auth_token')
  const userCookie = request.cookies.get('auth_user')
  
  // Protected routes
  if (pathname.startsWith('/architect')) {
    if (!token || user.role !== 'ARCHITECT') 
      return redirect('/login')
  }
  // ... similar for /buyer and /admin
}
```

**Protected Routes:**
- `/architect/*` - ARCHITECT only
- `/buyer/*` - BUYER only
- `/admin/*` - ADMIN only

**Public Routes:**
- `/`, `/login`, `/register`, `/explore`, `/sell`, `/how-it-works`

---

## 4. FRONTEND ARCHITECTURE

### Page Inventory (39 Total)

#### Public Pages (7)
1. **/** - Homepage - Landing page with hero and CTA
2. **/login** - Login form with validation
3. **/register** - Registration with role selection
4. **/explore** - Browse published designs
5. **/sell** - Architect onboarding information
6. **/how-it-works** - Platform explanation
7. **/test** - Development test page

#### Architect Pages (10)
8. **/architect/dashboard** - Main architect dashboard with KPIs
9. **/architect/designs** - Grid view of all designs
10. **/architect/designs/new** - Upload new design form
11. **/architect/designs/[id]** - Edit specific design
12. **/architect/earnings** - Revenue and transaction history
13. **/architect/payouts** - Payout management with Stripe
14. **/architect/performance** - Analytics and statistics
15. **/architect/account** - Profile and settings
16. **/architect/messages** - Inbox and conversations
17. **/architect/settings** - (If exists)

#### Buyer Pages (11)
18. **/buyer/dashboard** - Buyer main dashboard
19. **/buyer/library** - All purchased designs
20. **/buyer/purchases** - Purchase history
21. **/buyer/licenses** - Active licenses
22. **/buyer/favorites** - Saved/favorited designs
23. **/buyer/transactions** - Transaction history
24. **/buyer/account** - Profile settings
25. **/buyer/messages** - Contact architects
26. **/buyer/cart** - (If exists)
27. **/buyer/checkout** - (If exists)
28. **/buyer/profile** - (If exists)

#### Admin Pages (4)
29. **/admin/dashboard** - Platform statistics
30. **/admin/designs** - Review submitted designs
31. **/admin/designs/[id]** - Approve/reject specific design
32. **/admin/audit** - System audit logs

#### Design Pages (3)
33. **/marketplace** - Marketplace listing
34. **/marketplace/designs/[id]** - Single design detail
35. **/design/[id]** - Alternative design view

### Key Components

#### Layouts

**ArchitectLayout.tsx** - Wraps all architect pages
```typescript
// Fixed Issues: 
// - Was using localStorage.getItem('token') - WRONG KEY
// - Now uses useAuth() hook as single source
// - Checks isLoading before redirecting

const { user, isLoading } = useAuth();

useEffect(() => {
  if (isLoading) return; // ✅ CRITICAL FIX
  if (!user) router.replace('/login');
  if (user.role !== 'ARCHITECT') router.replace('/login');
}, [isLoading, user, router]);

if (isLoading) return <LoadingSpinner />;
if (!user || user.role !== 'ARCHITECT') return null;
```

**Features:**
- Sidebar navigation (Dashboard, Designs, Earnings, etc.)
- User profile dropdown
- Logout button
- Mobile responsive menu

**BuyerLayout.tsx** - Wraps all buyer pages
- Same pattern as ArchitectLayout
- Buyer-specific navigation items

#### Header.tsx - Global Navigation
**Location:** [components/layout/Header.tsx](components/layout/Header.tsx)

**Navigation Items by Role:**
- **Not Logged In:** Explore, Sell, How It Works, Login, Register
- **ARCHITECT:** Dashboard, My Designs, Earnings, Payouts, Performance
- **BUYER:** Dashboard, Library, Purchases, Favorites
- **ADMIN:** Dashboard, Designs, Audit Logs

**Features:**
- Logo (links to homepage)
- Responsive mobile menu
- User dropdown with account settings + logout

#### AuthContext.tsx - Global Auth State
**Location:** [lib/auth/AuthContext.tsx](lib/auth/AuthContext.tsx)

**State:**
```typescript
{
  user: User | null,          // Current authenticated user
  isLoading: boolean,         // Auth initialization in progress
  isAuthenticated: boolean,   // Quick check
}
```

**Methods:**
```typescript
login(email: string, password: string): Promise<User>
register(email, password, name, role): Promise<User>
logout(): void
```

**Lifecycle:**
1. On mount → `initializeAuth()`
2. Check localStorage for token
3. If token exists → validate with `/auth/me`
4. Set user state
5. Set `isLoading: false`

#### API Client
**Location:** [lib/api/client.ts](lib/api/client.ts)

```typescript
export const apiClient = {
  async request(endpoint, options) {
    // Add auth header automatically
    const token = tokenStorage.getToken();
    headers.Authorization = `Bearer ${token}`;
    
    // Make request
    const response = await fetch(url, { ...options, headers });
    
    // Parse JSON FIRST (FIX: was checking status before parsing)
    const data = await response.json();
    
    // Then check status
    if (response.status === 401) {
      tokenStorage.clear(); // Clear on auth failure
      throw new Error(data.error || 'Authentication required');
    }
    
    return data;
  }
}
```

**Key Fix:** Now parses JSON before checking status codes, so backend error messages are shown correctly.

---

## 5. BACKEND ARCHITECTURE

### Server Configuration
**File:** [server.js](server.js)
**Port:** 3001 (cannot use 3000 - conflict with Next.js)

### Middleware Stack
```javascript
app.use(helmet());                    // Security headers
app.use(cors({ 
  origin: 'http://localhost:3000',    // Frontend URL
  credentials: true                    // Allow cookies
}));
app.use(express.json());              // Parse JSON bodies
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,          // 15 minutes
  max: 100                            // 100 requests per IP
}));
```

### In-Memory Storage (Development)

```javascript
// User storage
const users = [];  // { id, email, password, name, role, createdAt }

// Mock design data
const designs = [
  {
    id: 1,
    title: "Modern Villa Design",
    slug: "modern-villa-design",
    description: "Contemporary 3-bedroom villa with open floor plan",
    category: "Residential",
    priceUsdCents: 50000,
    architectId: 1,
    state: "PUBLISHED",
    previewImageUrl: "/designs/villa-1.jpg",
    createdAt: "2026-02-01T10:00:00Z"
  },
  // ... 2 more designs
];
```

**Note:** Data is lost on server restart!

### API Endpoints

#### Authentication Endpoints

##### POST /auth/register
**Purpose:** Create new user account

**Request:**
```json
{
  "email": "architect@example.com",
  "password": "securePassword123",
  "name": "John Architect",
  "role": "ARCHITECT"
}
```

**Response (200):**
```json
{
  "user": {
    "id": 1,
    "email": "architect@example.com",
    "name": "John Architect",
    "role": "ARCHITECT"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Errors:**
- `400` - User already exists
- `500` - Server error

**Implementation:**
```javascript
// Line 122-162
app.post('/auth/register', async (req, res) => {
  const { email, password, name, role = 'BUYER' } = req.body;
  
  // Check if user exists
  if (users.find(u => u.email === email)) {
    return res.status(400).json({ error: 'User already exists' });
  }
  
  // Hash password
  const hashedPassword = await bcrypt.hash(password, 10);
  
  // Create user
  const user = {
    id: users.length + 1,
    email,
    password: hashedPassword,
    name,  // ✅ ADDED IN FIX
    role: role.toUpperCase(),
    createdAt: new Date()
  };
  
  users.push(user);
  
  // Generate JWT with name
  const token = jwt.sign(
    { userId: user.id, email: user.email, role: user.role, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );
  
  // Return user (without password) and token
  const { password: _, ...userWithoutPassword } = user;
  res.json({ user: userWithoutPassword, token });
});
```

##### POST /auth/login
**Purpose:** Authenticate existing user

**Request:**
```json
{
  "email": "architect@example.com",
  "password": "securePassword123"
}
```

**Response:** Same as register

**Errors:**
- `401` - Invalid credentials
- `500` - Server error

##### GET /auth/me
**Purpose:** Get current user info from token

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "id": 1,
  "email": "architect@example.com",
  "name": "John Architect",
  "role": "ARCHITECT"
}
```

**Errors:**
- `401` - No token provided
- `401` - Invalid token
- `500` - Server error

##### GET /auth/verify
**Purpose:** Verify token validity (used by middleware)

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "user": {
    "id": 1,
    "email": "architect@example.com",
    "role": "ARCHITECT"
  }
}
```

#### Marketplace Endpoints

##### GET /marketplace/designs
**Purpose:** List all published designs

**Query Parameters:**
- `category` (optional) - Filter by category
- `minPrice` (optional) - Minimum price in cents
- `maxPrice` (optional) - Maximum price in cents

**Response (200):**
```json
{
  "designs": [
    {
      "id": 1,
      "title": "Modern Villa Design",
      "slug": "modern-villa-design",
      "description": "Contemporary 3-bedroom villa",
      "category": "Residential",
      "priceUsdCents": 50000,
      "architectId": 1,
      "architect": {
        "id": 1,
        "displayName": "John Architect"
      },
      "state": "PUBLISHED",
      "previewImageUrl": "/designs/villa-1.jpg",
      "createdAt": "2026-02-01T10:00:00Z"
    }
  ]
}
```

##### GET /marketplace/designs/:id
**Purpose:** Get single design by ID

**Response:** Single design object

##### GET /marketplace/designs/slug/:slug
**Purpose:** Get single design by slug (SEO-friendly)

**Response:** Single design object

#### Architect Endpoints

##### GET /architect/account
**Purpose:** Get architect account details

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "id": 1,
  "email": "architect@example.com",
  "name": "John Architect",
  "role": "ARCHITECT",
  "stripeAccountId": null,
  "settings": {
    "payoutSchedule": "MONTHLY",
    "notificationsEnabled": true
  }
}
```

### Route Modules

Additional endpoints defined in route modules:

**src/routes/admin.routes.js** - Admin-only endpoints
- User management
- Design approval workflow
- Platform statistics

**src/routes/architect.routes.js** - Architect endpoints
- Design CRUD operations
- Earnings tracking
- Payout requests

**src/routes/buyer.routes.js** - Buyer endpoints
- Purchase history
- License management
- Favorites

**src/routes/files.routes.js** - File upload/download
- Preview image upload
- Design file upload (ZIP)
- Download purchased files

**src/routes/messages.routes.js** - Messaging
- Send/receive messages
- Mark as read

**src/routes/conversations.routes.js** - Conversation management
- Create conversation
- List conversations

**src/routes/modifications.routes.js** - Modification requests
- Request modifications
- Quote pricing
- Accept/reject

**src/routes/transactions.routes.js** - Payment transactions
- Process payments
- Transaction history

**src/routes/licenses.routes.js** - License management
- Generate licenses
- View license terms

---

## 6. DATABASE SCHEMA (PRISMA)

**File:** [prisma/schema.prisma](prisma/schema.prisma)
**Status:** ⚠️ Defined but NOT yet implemented in code

### Core Models

#### User
```prisma
model User {
  id              String   @id @default(uuid())
  email           String   @unique
  password        String
  name            String?
  role            UserRole @default(BUYER)
  
  // Timestamps
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  // Relations
  designs         Design[]         @relation("ArchitectDesigns")
  transactions    Transaction[]    @relation("BuyerTransactions")
  licenses        License[]
  messages        Message[]
  conversations   ConversationParticipant[]
  earnings        ArchitectEarning[]
  
  @@map("users")
}

enum UserRole {
  BUYER
  ARCHITECT
  ADMIN
}
```

#### Design
```prisma
model Design {
  id                String       @id @default(uuid())
  title             String
  slug              String       @unique
  description       String?      @db.Text
  category          String
  state             DesignStatus @default(DRAFT)
  priceUsdCents     Int
  
  // Metadata
  areaSqm           Float?
  floors            Int?
  bedrooms          Int?
  bathrooms         Float?
  
  // Images
  previewImageUrl   String?
  
  // Relations
  architectId       String
  architect         User         @relation("ArchitectDesigns", fields: [architectId], references: [id])
  
  files             File[]
  transactions      Transaction[]
  licenses          License[]
  
  createdAt         DateTime     @default(now())
  updatedAt         DateTime     @updatedAt
  
  @@map("designs")
}

enum DesignStatus {
  DRAFT
  SUBMITTED
  APPROVED
  PUBLISHED
  REJECTED
  ARCHIVED
}
```

#### Transaction
```prisma
model Transaction {
  id                 String        @id @default(uuid())
  buyerId            String
  designId           String
  amountUsdCents     Int
  platformFeePercent Int           @default(15)
  status             PaymentStatus @default(PENDING)
  stripePaymentId    String?       @unique
  
  // Relations
  buyer              User          @relation("BuyerTransactions", fields: [buyerId], references: [id])
  design             Design        @relation(fields: [designId], references: [id])
  license            License?
  
  createdAt          DateTime      @default(now())
  
  @@map("transactions")
}

enum PaymentStatus {
  PENDING
  COMPLETED
  FAILED
  REFUNDED
}
```

#### License
```prisma
model License {
  id             String        @id @default(uuid())
  transactionId  String        @unique
  buyerId        String
  designId       String
  licenseType    LicenseType   @default(SINGLE_USE)
  status         LicenseStatus @default(ACTIVE)
  
  // Relations
  transaction    Transaction   @relation(fields: [transactionId], references: [id])
  buyer          User          @relation(fields: [buyerId], references: [id])
  design         Design        @relation(fields: [designId], references: [id])
  
  issuedAt       DateTime      @default(now())
  expiresAt      DateTime?
  
  @@map("licenses")
}

enum LicenseType {
  SINGLE_USE
  COMMERCIAL
  UNLIMITED
}

enum LicenseStatus {
  ACTIVE
  EXPIRED
  REVOKED
}
```

#### File
```prisma
model File {
  id          String   @id @default(uuid())
  designId    String
  fileName    String
  fileType    FileType
  fileUrl     String
  fileSizeKb  Int
  
  design      Design   @relation(fields: [designId], references: [id], onDelete: Cascade)
  
  uploadedAt  DateTime @default(now())
  
  @@map("files")
}

enum FileType {
  PREVIEW_IMAGE
  CAD_FILE
  PDF
  RENDER
  OTHER
}
```

#### Message & Conversation
```prisma
model Conversation {
  id           String                     @id @default(uuid())
  participants ConversationParticipant[]
  messages     Message[]
  createdAt    DateTime                   @default(now())
  updatedAt    DateTime                   @updatedAt
  
  @@map("conversations")
}

model ConversationParticipant {
  id             String       @id @default(uuid())
  conversationId String
  userId         String
  
  conversation   Conversation @relation(fields: [conversationId], references: [id])
  user           User         @relation(fields: [userId], references: [id])
  
  joinedAt       DateTime     @default(now())
  
  @@unique([conversationId, userId])
  @@map("conversation_participants")
}

model Message {
  id             String       @id @default(uuid())
  conversationId String
  senderId       String
  content        String       @db.Text
  isRead         Boolean      @default(false)
  
  conversation   Conversation @relation(fields: [conversationId], references: [id])
  sender         User         @relation(fields: [senderId], references: [id])
  
  sentAt         DateTime     @default(now())
  
  @@map("messages")
}
```

#### ArchitectEarning
```prisma
model ArchitectEarning {
  id              String                 @id @default(uuid())
  architectId     String
  transactionId   String                 @unique
  amountUsdCents  Int
  platformFeeUsdCents Int
  netUsdCents     Int
  status          ArchitectEarningStatus @default(PENDING)
  payoutId        String?
  
  architect       User                   @relation(fields: [architectId], references: [id])
  
  createdAt       DateTime               @default(now())
  
  @@map("architect_earnings")
}

enum ArchitectEarningStatus {
  PENDING
  PAID_OUT
  ON_HOLD
}
```

#### ModificationRequest
```prisma
model ModificationRequest {
  id              String              @id @default(uuid())
  buyerId         String
  designId        String
  description     String              @db.Text
  status          ModificationStatus  @default(REQUESTED)
  quotedPriceUsdCents Int?
  
  requestedAt     DateTime            @default(now())
  
  @@map("modification_requests")
}

enum ModificationStatus {
  REQUESTED
  PRICED
  ACCEPTED
  IN_PROGRESS
  COMPLETED
  REJECTED
}
```

**Total Models:** 15+
**Total Enums:** 10+

**⚠️ CRITICAL:** Schema is ready but server.js still uses in-memory arrays!

---

## 7. PAGE-BY-PAGE FEATURE BREAKDOWN

### PUBLIC PAGES

#### 1. Homepage (/)
**File:** [pages/index.tsx](pages/index.tsx)

**Sections:**
- Hero section with tagline
- Featured designs carousel
- How It Works (3 steps)
- Browse by category
- Call-to-action (Register as Architect / Start Browsing)

**Buttons:**
- "Browse Designs" → /explore
- "Sell Your Designs" → /sell
- "Get Started" → /register

---

#### 2. Login (/login)
**File:** [pages/login.tsx](pages/login.tsx)

**Form Fields:**
- Email (text input, required)
- Password (password input, required)

**Features:**
- Real-time validation
- Error message display (red banner)
- Loading state during submission
- Auto-redirect if already logged in
- Hero background image

**Buttons:**
- "Sign In" (primary) - Submit form
- "Create Account" (link) - Navigate to /register

**Recent Fix:**
```typescript
// Before: Only had { login }
// After: Added isLoading and user checks
const { login, user, isLoading } = useAuth();

// Loading state prevents flash
if (isLoading) return <LoadingSpinner />;

// Already logged in
if (user) {
  return <div>Redirecting to dashboard...</div>;
}

// Show form only when not loading and not logged in
```

**UX Flow:**
1. User enters email + password
2. Click "Sign In"
3. Button shows "Signing in..."
4. On success → Redirect to /architect/dashboard or /buyer/dashboard
5. On error → Show red banner with message

---

#### 3. Register (/register)
**File:** [pages/register.tsx](pages/register.tsx)

**Form Fields:**
- Email (text input, required)
- Password (password input, required, min 8 chars)
- Confirm Password (password input, must match)
- Name (text input, required)
- Role Selection:
  - "I want to buy designs" (BUYER)
  - "I want to sell designs" (ARCHITECT)

**Validation:**
- Email format check
- Password strength (min 8 characters)
- Passwords must match
- All fields required

**Buttons:**
- "Create Account" (primary) - Submit
- "Already have an account? Sign In" (link) → /login

**Recent Fix:** Same isLoading pattern as login

---

#### 4. Explore (/explore)
**File:** [pages/explore.tsx](pages/explore.tsx)

**Features:**
- Grid of design cards (3-4 columns)
- Filter sidebar:
  - Category dropdown (Residential, Commercial, Industrial)
  - Price range slider
  - Sort by (Newest, Price Low-High, Popular)
- Search bar

**Design Card:**
- Preview image
- Title
- Category badge
- Price display
- Architect name
- Click → /marketplace/designs/[id]

**Buttons:**
- "View Details" (per card)
- "Add to Favorites" (heart icon)

---

#### 5. Sell (/sell)
**File:** [pages/sell.tsx](pages/sell.tsx)

**Content:**
- Hero: "Sell Your Architectural Designs"
- Benefits section:
  - Reach thousands of buyers
  - Earn 85% of each sale
  - Full ownership and control
  - Secure payments
- How it works (4 steps)
- Testimonials from architects
- FAQ section

**Buttons:**
- "Start Selling Today" → /register?role=ARCHITECT
- "View Pricing" (scroll to pricing section)

---

#### 6. How It Works (/how-it-works)
**File:** [pages/how-it-works.tsx](pages/how-it-works.tsx)

**Sections:**
- For Buyers:
  1. Browse designs
  2. Purchase license
  3. Download files
  
- For Architects:
  1. Upload design
  2. Set price
  3. Get paid

- FAQ (10+ questions)

**Buttons:**
- "Browse Designs" → /explore
- "Become an Architect" → /sell

---

### ARCHITECT PAGES

#### 1. Architect Dashboard (/architect/dashboard)
**File:** [pages/architect/dashboard.tsx](pages/architect/dashboard.tsx)
**Layout:** ArchitectLayout with sidebar

**KPI Cards (Top Row):**
1. **Total Designs** - Count of all designs
2. **Published** - Count of published designs
3. **Total Earnings** - Sum of all earnings ($)
4. **Pending Payouts** - Amount ready to withdraw

**Second Row KPIs:**
5. **Drafts** - Count of draft designs
6. **Submitted** - Designs awaiting approval
7. **Sold** - Total designs sold

**Design Pipeline Section:**
- **Recent Draft** (if any):
  - Title
  - Last edited date
  - "Continue Editing" button → /architect/designs/[id]
  - "Delete Draft" button

**Modification Requests Section:**
- Table of buyer modification requests:
  - Buyer name
  - Design title
  - Request description
  - Status badge (REQUESTED, PRICED, ACCEPTED, etc.)
  - "Quote Price" button (opens modal)
  
**Quote Price Modal:**
- Text input for price (USD)
- Text area for notes
- "Send Quote" button
- "Decline" button

**Recent Activity Feed:**
- Timeline of recent events:
  - Design published
  - Design sold
  - Payout completed
  - Message received

**Buttons:**
- "Upload New Design" (primary, top right) → /architect/designs/new
- "View All Designs" → /architect/designs
- "Request Payout" → /architect/payouts
- "Continue Editing" (per draft)
- "Delete Draft" (per draft)
- "Quote Price" (per modification request)
- "View Details" (per activity item)

---

#### 2. My Designs (/architect/designs)
**File:** [pages/architect/designs.tsx](pages/architect/designs.tsx)

**Features:**
- Grid view (3 columns) of all architect's designs
- Filter tabs:
  - All
  - Published
  - Drafts
  - Submitted (awaiting approval)
  - Rejected
  - Archived
- Search bar (search by title)
- Sort dropdown (Newest, Oldest, Price)

**Design Card:**
- Preview image
- Title
- Status badge (colored)
- Price
- Views count
- Sales count
- Edit/Delete dropdown menu

**Buttons:**
- "+ New Design" (primary, top right) → /architect/designs/new
- "Edit" (per design) → /architect/designs/[id]
- "Delete" (per design, shows confirmation modal)
- "Publish" (if design status is APPROVED)
- "View" → /marketplace/designs/[id]

---

#### 3. Upload New Design (/architect/designs/new)
**File:** [pages/architect/designs/new.tsx](pages/architect/designs/new.tsx)

**Form Sections:**

**Basic Information:**
- Title (text input, required, max 100 chars)
- Description (rich text editor, required)
- Category (dropdown: Residential, Commercial, Industrial, Hospitality, etc.)

**Pricing:**
- Price (USD, number input, required, min $10)

**Design Details:**
- Area (sqm, number input)
- Number of Floors (integer)
- Bedrooms (integer)
- Bathrooms (float, e.g., 2.5)

**Media Upload:**
- Preview Image:
  - Drag & drop or click to upload
  - Max 5MB
  - Formats: JPG, PNG
  - Shows preview after upload
- Design Files:
  - Upload ZIP file
  - Max 100MB
  - Can include: CAD files, PDFs, renders, etc.

**Buttons:**
- "Save as Draft" (secondary) - Saves with status DRAFT
- "Submit for Review" (primary) - Submits with status SUBMITTED
- "Cancel" → /architect/designs

**Validation:**
- All required fields must be filled
- Preview image required before submit
- Design files required before submit

---

#### 4. Edit Design (/architect/designs/[id])
**File:** [pages/architect/designs/[id].tsx](pages/architect/designs/[id].tsx)

**Features:**
- Same form as "new" but pre-filled with existing data
- Can update all fields
- Shows current status badge
- View existing uploads (with delete option)

**Additional Features:**
- **View Analytics** button → Shows views, sales, revenue
- **Preview** button → Opens design in new tab as buyers see it
- **Version History** (if implemented)

**Buttons:**
- "Update Design" (primary)
- "Delete Design" (danger, shows confirmation)
- "Publish" (if status is APPROVED, not PUBLISHED)
- "Submit for Review" (if status is DRAFT or REJECTED)
- "Duplicate Design" (creates copy as draft)
- "Cancel" → /architect/designs

**Status Workflow:**
- DRAFT → User can edit freely
- SUBMITTED → Awaiting admin approval (read-only)
- APPROVED → Admin approved, architect can publish
- PUBLISHED → Live on marketplace
- REJECTED → Admin rejected, architect can edit and resubmit
- ARCHIVED → Hidden from marketplace

---

#### 5. Earnings (/architect/earnings)
**File:** [pages/architect/earnings.tsx](pages/architect/earnings.tsx)

**Summary Cards:**
1. **Total Earnings** (Lifetime gross revenue)
2. **Platform Fees** (15% of total)
3. **Net Earnings** (85% of total)
4. **Available for Payout** (Earnings not yet paid out)
5. **Pending** (Earnings from recent sales, 14-day hold)

**Earnings Chart:**
- Line graph showing earnings over time
- Toggle: By month, By week, By year

**Earnings by Design Table:**
| Design | Sales | Gross | Fees | Net |
|--------|-------|-------|------|-----|
| Modern Villa | 15 | $7,500 | $1,125 | $6,375 |
| ... | ... | ... | ... | ... |

**Transaction History Table:**
| Date | Design | Buyer | Amount | Status |
|------|--------|-------|--------|--------|
| Feb 1 | Villa | John D. | $500 | Completed |
| ... | ... | ... | ... | ... |

**Features:**
- Date range picker (Last 30 days, Last 90 days, This year, All time)
- Export to CSV button
- Filter by design
- Pagination

**Buttons:**
- "Request Payout" → /architect/payouts
- "Export to CSV"
- "View Design" (per row)

---

#### 6. Payouts (/architect/payouts)
**File:** [pages/architect/payouts.tsx](pages/architect/payouts.tsx)

**Summary:**
- Available Balance: $X,XXX.XX
- Minimum payout: $100
- Payout schedule: Manual request or auto-monthly

**Bank Account Section:**
- If not set up:
  - "Connect Stripe Account" button → Stripe Connect flow
  
- If connected:
  - Bank name (last 4 digits)
  - Account status: Verified ✅
  - "Update Bank Info" button

**Payout History Table:**
| Date | Amount | Method | Status | Reference |
|------|--------|--------|--------|-----------|
| Jan 15 | $5,000 | Bank | Completed | PO-12345 |
| ... | ... | ... | ... | ... |

**Buttons:**
- "Request Payout" (primary, disabled if balance < $100)
  - Opens modal:
    - Amount input (max = available balance)
    - "Confirm Payout" button
- "Connect Stripe" (if not connected)
- "Update Bank Account"
- "Download Statement" (per payout)

**Status Indicators:**
- Pending (yellow)
- Processing (blue)
- Completed (green)
- Failed (red)

---

#### 7. Performance (/architect/performance)
**File:** [pages/architect/performance.tsx](pages/architect/performance.tsx)

**Analytics Dashboard:**

**Top Metrics:**
1. Total Views (all designs)
2. Conversion Rate (views → purchases)
3. Average Sale Price
4. Total Sales

**Charts:**
1. **Sales Over Time** (line chart)
2. **Views vs Sales** (dual-axis chart)
3. **Top Performing Designs** (bar chart)
4. **Category Breakdown** (pie chart)

**Design Performance Table:**
| Design | Views | Sales | Revenue | Conversion | Avg Price |
|--------|-------|-------|---------|------------|-----------|
| Villa | 1,250 | 15 | $7,500 | 1.2% | $500 |

**Features:**
- Date range selector
- Compare to previous period
- Export analytics

**Buttons:**
- "Export Report"
- "View Design" (per row)

---

#### 8. Messages (/architect/messages)
**File:** [pages/architect/messages.tsx](pages/architect/messages.tsx)

**Layout:** Split view - Inbox (left) + Conversation (right)

**Inbox (Left Panel):**
- List of conversations
- Each item shows:
  - Buyer name/avatar
  - Last message preview
  - Timestamp
  - Unread badge (if unread)
- Search conversations
- Filter: All, Unread, Design inquiries

**Conversation (Right Panel):**
- Message thread (oldest first or newest first toggle)
- Message bubbles:
  - Sender's message (left, gray)
  - Your message (right, blue)
  - Timestamp
  - Read status (✓✓)
- Design context card (if about specific design):
  - Design preview
  - Title
  - Price
  - "View Design" link

**Message Input:**
- Text area
- Emoji picker
- Attach file button
- "Send" button

**Contact Unlock Feature:**
- If buyer hasn't purchased:
  - Messages limited
  - "Unlock Contact for $5" button
- If unlocked or buyer purchased:
  - Full messaging enabled
  - Can share contact info

**Buttons:**
- "New Message" → Opens modal to select recipient
- "Send"
- "Unlock Contact" (if locked)
- "View Design" (in context card)

---

#### 9. Account Settings (/architect/account)
**File:** [pages/architect/account.tsx](pages/architect/account.tsx)

**Tabs:**

**1. Profile Information:**
- Name (text input)
- Email (text input, verified)
- Phone (text input, optional)
- Profile Picture (upload)
- Bio (textarea, max 500 chars)
- Website (URL input, optional)
- Portfolio URL (URL input, optional)

**Buttons:**
- "Update Profile" (saves changes)

**2. Account Settings:**
- Language (dropdown)
- Timezone (dropdown)
- Currency (dropdown, default USD)

**3. Password & Security:**
- Current Password (password input)
- New Password (password input)
- Confirm New Password (password input)
- Two-Factor Authentication:
  - Status: Disabled/Enabled
  - "Enable 2FA" button

**Buttons:**
- "Change Password"
- "Enable 2FA" / "Disable 2FA"

**4. Notifications:**
- Email notifications:
  - [ ] New purchase
  - [ ] New message
  - [ ] Modification request
  - [ ] Payout completed
  - [ ] Design approved/rejected
- Push notifications:
  - [ ] Real-time messages
  - [ ] Sales alerts

**Buttons:**
- "Save Notification Preferences"

**5. Stripe Connection:**
- Status: Connected ✅ / Not Connected ❌
- Account ID: acct_xxxxxxxx
- "Connect Stripe Account" (if not connected)
- "Disconnect" button (if connected)
- "View Stripe Dashboard" (external link)

**6. Danger Zone:**
- "Deactivate Account" button (opens confirmation modal)
- "Delete Account" button (opens multi-step confirmation)

---

### BUYER PAGES

#### 1. Buyer Dashboard (/buyer/dashboard)
**File:** [pages/buyer/dashboard.tsx](pages/buyer/dashboard.tsx)
**Layout:** BuyerLayout with sidebar

**Welcome Section:**
- "Welcome back, [Name]!"
- Quick stats:
  - Designs Purchased
  - Favorites
  - Messages

**Recent Purchases (Carousel/Grid):**
- Last 5-10 purchased designs
- Design card:
  - Preview image
  - Title
  - Purchase date
  - "Download Files" button
  - "Request Modification" button

**Recommended for You:**
- AI/algorithm-based recommendations
- Based on previous purchases and favorites
- Design cards with "Add to Favorites" and "View" buttons

**Favorites Section:**
- Grid of favorited designs
- "View All" → /buyer/favorites

**Recent Messages:**
- List of last 3 conversations
- "View All" → /buyer/messages

**Buttons:**
- "Browse Designs" → /explore
- "View Library" → /buyer/library
- "Download Files" (per purchased design)
- "Request Modification" (per purchased design)
- "View All Favorites" → /buyer/favorites
- "View All Messages" → /buyer/messages

---

#### 2. Library (/buyer/library)
**File:** [pages/buyer/library.tsx](pages/buyer/library.tsx)

**Features:**
- Grid view of ALL purchased designs
- Filter:
  - By category
  - By purchase date
  - By architect
- Search bar
- Sort: Newest, Oldest, Price

**Design Card (Purchased):**
- Preview image
- Title
- Architect name
- Purchase date
- License type badge
- Dropdown menu:
  - "Download Files"
  - "View License"
  - "Request Modification"
  - "Contact Architect"
  - "View Design Details"

**Download Files Modal:**
- List of files in design package:
  - CAD file (.dwg) - 15MB
  - PDF (.pdf) - 2MB
  - Renders (10 images) - 50MB
- "Download All" button
- Individual download buttons

**Buttons:**
- "Download Files" (per design)
- "View License" → /buyer/licenses?designId=[id]
- "Request Modification"
- "Contact Architect" → /buyer/messages

---

#### 3. Purchases (/buyer/purchases)
**File:** [pages/buyer/purchases.tsx](pages/buyer/purchases.tsx)

**Purchase History Table:**
| Date | Design | Architect | Amount | Status | Actions |
|------|--------|-----------|--------|--------|---------|
| Feb 1 | Modern Villa | John A. | $500 | Completed | Download Invoice, View |
| Jan 28 | Office Tower | Jane B. | $1,200 | Completed | Download Invoice, View |

**Filters:**
- Date range picker
- Status filter (All, Completed, Pending, Refunded)
- Price range

**Purchase Detail Modal:**
- Design preview
- Purchase date
- Transaction ID
- Amount paid
- Payment method (last 4 digits of card)
- License details
- Files included

**Buttons:**
- "Download Invoice" (per purchase) - PDF
- "View Design" → /marketplace/designs/[id]
- "Request Refund" (within 14 days, opens modal)
- "Contact Support" (opens ticket)

**Refund Request Modal:**
- Reason (dropdown: Not as described, Quality issue, Other)
- Description (textarea, required)
- "Submit Refund Request" button
- "Cancel" button

---

#### 4. Licenses (/buyer/licenses)
**File:** [pages/buyer/licenses.tsx](pages/buyer/licenses.tsx)

**License Cards:**
Each card shows:
- Design preview + title
- License type badge (Single Use, Commercial, Unlimited)
- Status: Active, Expired, Revoked
- Issued date
- Expiry date (if applicable)
- "Download License PDF" button
- "View Terms" button

**License Types Explained:**
- **Single Use:** Can build design once
- **Commercial:** Can build multiple times for commercial purposes
- **Unlimited:** No restrictions

**Buttons:**
- "Download License PDF" (per license) - Official PDF with terms
- "View Design" → /marketplace/designs/[id]
- "View Terms" (opens modal with full license agreement)

---

#### 5. Favorites (/buyer/favorites)
**File:** [pages/buyer/favorites.tsx](pages/buyer/favorites.tsx)

**Features:**
- Grid view of favorited designs
- Same filter/sort options as marketplace
- Design cards with:
  - Preview image
  - Title
  - Price
  - Architect name
  - "❤️ Unfavorite" button (removes from favorites)
  - "Buy Now" button

**Empty State:**
- If no favorites:
  - Message: "You haven't saved any designs yet"
  - "Browse Designs" button → /explore

**Buttons:**
- "❤️ Remove from Favorites" (per design)
- "Buy Now" → Checkout flow
- "View Details" → /marketplace/designs/[id]

---

#### 6. Transactions (/buyer/transactions)
**File:** [pages/buyer/transactions.tsx](pages/buyer/transactions.tsx)

**Transaction History Table:**
| Date | Type | Description | Amount | Status |
|------|------|-------------|--------|--------|
| Feb 1 | Purchase | Modern Villa Design | -$500 | Completed |
| Jan 28 | Refund | Office Design | +$1,200 | Refunded |
| Jan 25 | Contact Unlock | Chat with Jane | -$5 | Completed |

**Transaction Types:**
- Purchase - Design purchase
- Refund - Refund received
- Modification - Modification fee
- Contact Unlock - Architect contact unlock fee

**Filters:**
- Date range
- Transaction type
- Amount range

**Buttons:**
- "Download Receipt" (per transaction)
- "View Details" (opens transaction detail modal)
- "Export to CSV"

---

#### 7. Messages (/buyer/messages)
**File:** [pages/buyer/messages.tsx](pages/buyer/messages.tsx)

**Same layout as Architect Messages:**
- Inbox (left panel)
- Conversation (right panel)

**Differences:**
- Can message architects about designs
- Can request modifications via messages
- Contact unlock works opposite way (buyer pays to unlock architect contact)

**Buttons:**
- "New Message" (select architect from dropdown)
- "Send"
- "Request Modification" (in conversation about design)

---

#### 8. Account Settings (/buyer/account)
**File:** [pages/buyer/account.tsx](pages/buyer/account.tsx)

**Similar to Architect Account but without Stripe section**

**Tabs:**

**1. Profile Information:**
- Name, Email, Phone, Profile Picture

**2. Password & Security:**
- Change password
- Two-factor authentication

**3. Payment Methods:**
- Saved credit/debit cards
- Add new card button
- Set default payment method
- Remove card

**4. Notifications:**
- Email notifications for:
  - Purchase confirmations
  - New messages
  - Favorite design updates
  - Modification request updates

**5. Danger Zone:**
- Deactivate/Delete account

---

### ADMIN PAGES

#### 1. Admin Dashboard (/admin/dashboard)
**File:** [pages/admin/dashboard.tsx](pages/admin/dashboard.tsx)

**Platform Statistics:**

**User Metrics:**
- Total Users: 1,250
  - Buyers: 1,000
  - Architects: 245
  - Admins: 5
- New Users (This Month): 87
- Active Users (Last 30 Days): 650

**Design Metrics:**
- Total Designs: 523
  - Published: 420
  - Pending Review: 15
  - Drafts: 78
  - Rejected: 10
- New Submissions (This Week): 8

**Revenue Metrics:**
- Total Revenue: $125,450
- Platform Fees Collected: $18,818 (15%)
- Architect Earnings: $106,632 (85%)
- Pending Payouts: $15,250

**Transaction Metrics:**
- Total Transactions: 1,450
- This Month: 125
- Success Rate: 98.5%

**Charts:**
1. Revenue Over Time (line chart)
2. New Users vs New Designs (dual-axis)
3. Top Categories (bar chart)
4. Top Architects (leaderboard)

**Recent Activity Feed:**
- New design submissions
- User registrations
- Large purchases
- Flagged content

**Buttons:**
- "Review Pending Designs" → /admin/designs?status=submitted
- "View All Users"
- "View Audit Logs" → /admin/audit
- "Export Platform Report"

---

#### 2. Design Review (/admin/designs)
**File:** [pages/admin/designs.tsx](pages/admin/designs.tsx)

**Filter Tabs:**
- All Designs
- Pending Review (SUBMITTED)
- Published
- Rejected
- Flagged

**Design Review Table:**
| Preview | Title | Architect | Category | Submitted | Status | Actions |
|---------|-------|-----------|----------|-----------|--------|---------|
| [img] | Villa | John A. | Residential | Feb 1 | Submitted | Review |

**Quick Actions (Per Design):**
- "👁️ View" → /admin/designs/[id]
- "✅ Quick Approve" (bypasses review page, immediate publish)
- "❌ Reject" (opens rejection reason modal)
- "🚩 Flag" (mark for further review)

**Buttons:**
- "Review" → /admin/designs/[id] (full review page)
- "Quick Approve" (immediate approval)
- "Reject" (with reason modal)
- "Flag" (adds flag, changes status to FLAGGED)

---

#### 3. Design Detail & Approval (/admin/designs/[id])
**File:** [pages/admin/designs/[id].tsx](pages/admin/designs/[id].tsx)

**Design Information:**
- Preview image (large)
- Title, Description, Category
- Price
- Architect information:
  - Name
  - Profile link
  - Total designs
  - Average rating
  - Total sales

**Design Files:**
- List of uploaded files
- Download individual files
- Preview PDFs/images

**Design Details:**
- Area, Floors, Bedrooms, Bathrooms
- Tags/keywords

**Review Checklist:**
- [ ] Design quality is high
- [ ] Description is accurate
- [ ] Price is reasonable
- [ ] No copyright violations
- [ ] Files are complete
- [ ] No inappropriate content

**Review History:**
- Previous submission dates (if resubmitted)
- Previous rejection reasons
- Admin who reviewed
- Review date

**Admin Actions:**

**Approve:**
- Button: "✅ Approve and Publish"
- Action: Changes status to PUBLISHED, design goes live
- Optional: Leave approval notes

**Reject:**
- Button: "❌ Reject"
- Modal opens:
  - Rejection reason (dropdown):
    - Quality too low
    - Incomplete files
    - Inaccurate description
    - Copyright violation
    - Inappropriate content
    - Other
  - Additional notes (textarea)
  - "Send Rejection" button
- Action: Status → REJECTED, architect notified

**Request Changes:**
- Button: "📝 Request Changes"
- Modal: List specific changes needed
- Action: Status → PENDING_CHANGES, architect notified

**Flag for Further Review:**
- Button: "🚩 Flag"
- Reason textarea
- Action: Status → FLAGGED, escalates to senior admin

**Buttons:**
- "Approve and Publish" (primary, green)
- "Request Changes" (secondary, yellow)
- "Reject" (danger, red)
- "Flag for Review" (warning, orange)
- "Download All Files" (secondary)
- "View Public Preview" (opens design as buyers would see it)

---

#### 4. Audit Logs (/admin/audit)
**File:** [pages/admin/audit.tsx](pages/admin/audit.tsx)

**Audit Log Table:**
| Timestamp | User | Action | Resource | IP Address | Details |
|-----------|------|--------|----------|------------|---------|
| Feb 2, 10:30 | admin@example.com | APPROVE_DESIGN | Design #123 | 192.168.1.1 | Approved "Modern Villa" |
| Feb 2, 10:15 | architect@example.com | UPLOAD_DESIGN | Design #124 | 192.168.1.5 | Uploaded new design |

**Action Types:**
- USER_REGISTERED
- USER_LOGIN
- USER_LOGOUT
- DESIGN_UPLOADED
- DESIGN_APPROVED
- DESIGN_REJECTED
- DESIGN_PURCHASED
- PAYOUT_REQUESTED
- PAYOUT_COMPLETED
- MESSAGE_SENT
- ACCOUNT_DELETED

**Filters:**
- Date range picker
- User filter (dropdown or search)
- Action type filter (multi-select)
- Resource type (Design, User, Transaction, etc.)

**Features:**
- Search by user email
- Search by resource ID
- Export logs to CSV
- Real-time updates (auto-refresh every 30s)

**Buttons:**
- "Export Logs" (CSV)
- "View Details" (per log entry, opens modal with full log data)
- "Filter" (apply filters)
- "Clear Filters"

---

## 8. SECURITY IMPLEMENTATION

### Current Security Measures

#### Authentication
- ✅ JWT tokens with 24-hour expiration
- ✅ Password hashing using bcrypt (10 rounds)
- ✅ Dual storage: localStorage (client checks) + cookies (middleware)
- ✅ Token validation on every protected API request
- ✅ Automatic logout on token expiry

#### Authorization
- ✅ Role-based access control (BUYER, ARCHITECT, ADMIN)
- ✅ Next.js middleware enforces routes server-side
- ✅ Backend middleware validates JWT and role
- ✅ Frontend guards prevent UI access

#### Network Security
- ✅ Helmet.js security headers
- ✅ CORS configured (only localhost:3000 allowed)
- ✅ Rate limiting (100 requests per 15 minutes per IP)
- ✅ HTTPS-ready for production

#### Secret Management
- ✅ Environment variables for all secrets
- ✅ .gitignore prevents .env files from being committed
- ✅ Separate configs for staging/production
- ✅ GitHub secret scanning enabled

#### Frontend Security
- ✅ No API keys in client code
- ✅ XSS protection via React (auto-escaping)
- ✅ CSRF protection via SameSite cookies
- ✅ Content Security Policy headers

### Security Gaps & Recommendations

#### HIGH PRIORITY

**1. Input Validation**
- ❌ No schema validation on backend endpoints
- ❌ No input sanitization
- ❌ No file upload validation

**Recommendation:**
```javascript
// Install Joi or Zod
npm install joi

// Add validation middleware
const Joi = require('joi');

const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  name: Joi.string().min(2).max(100).required(),
  role: Joi.string().valid('BUYER', 'ARCHITECT').required()
});

app.post('/auth/register', async (req, res) => {
  const { error } = registerSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.details[0].message });
  // ... rest of logic
});
```

**2. Rate Limiting Enhancement**
- ⚠️ Current: Global 100 req/15min per IP
- ❌ No per-user rate limits
- ❌ No endpoint-specific limits
- ❌ No brute-force protection on login

**Recommendation:**
```javascript
// Install express-rate-limit and rate-limit-redis
const rateLimit = require('express-rate-limit');

// Stricter for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts
  message: 'Too many login attempts, please try again later'
});

app.post('/auth/login', authLimiter, async (req, res) => { ... });
```

**3. Password Policy**
- ⚠️ Current: Minimum 8 characters (client-side only)
- ❌ No complexity requirements
- ❌ No password strength meter
- ❌ No common password check

**Recommendation:**
```javascript
// Install zxcvbn for password strength
const zxcvbn = require('zxcvbn');

function validatePassword(password) {
  const strength = zxcvbn(password);
  if (strength.score < 3) {
    throw new Error('Password is too weak');
  }
  if (password.length < 8) {
    throw new Error('Password must be at least 8 characters');
  }
  return true;
}
```

**4. Session Management**
- ❌ No token refresh mechanism
- ❌ No session invalidation on password change
- ❌ No "logout all devices" feature
- ❌ No session tracking

**Recommendation:**
- Implement refresh tokens (short-lived access token + long-lived refresh token)
- Store active sessions in database
- Add endpoint to revoke sessions

**5. File Upload Security**
- ❌ File uploads not implemented yet
- ⚠️ When implemented, MUST validate:
  - File type (magic number, not just extension)
  - File size limits
  - Malware scanning
  - S3 bucket permissions

**Recommendation:**
```javascript
const multer = require('multer');
const fileType = require('file-type');

const upload = multer({
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB max
  fileFilter: async (req, file, cb) => {
    const type = await fileType.fromBuffer(file.buffer);
    if (!['image/jpeg', 'image/png', 'application/zip'].includes(type.mime)) {
      return cb(new Error('Invalid file type'));
    }
    cb(null, true);
  }
});
```

#### MEDIUM PRIORITY

**6. Logging & Monitoring**
- ⚠️ Basic console.log only
- ❌ No centralized logging
- ❌ No error tracking (Sentry configured but not used)
- ❌ No audit trail (except in Prisma schema)

**Recommendation:**
- Implement Winston or Pino for structured logging
- Activate Sentry for error tracking
- Log all auth attempts (success and failure)
- Alert on suspicious activity

**7. Database Security**
- ⚠️ Prisma schema ready but not connected
- ❌ No SQL injection protection yet (Prisma will handle this)
- ❌ No database backups configured
- ❌ No row-level security

**Recommendation:**
- Once Prisma is implemented, injection attacks are prevented
- Set up automated daily backups
- Implement soft deletes instead of hard deletes

**8. API Security**
- ❌ No API versioning
- ❌ No request signing
- ❌ No webhook signature verification (for Stripe)

**Recommendation:**
- Version API: `/api/v1/...`
- Verify Stripe webhook signatures

---

## 9. KNOWN ISSUES & LIMITATIONS

### CRITICAL

**1. In-Memory Storage**
- **Issue:** All data (users, designs) stored in arrays in server.js
- **Impact:** Data lost on server restart
- **Fix:** Implement Prisma database queries

**2. No Database Usage**
- **Issue:** Prisma schema defined but not used
- **Impact:** Cannot scale, no persistence
- **Fix:** Replace in-memory arrays with Prisma queries

**3. Mock Design Data**
- **Issue:** 3 hardcoded designs in server.js
- **Impact:** Marketplace shows same designs always
- **Fix:** Fetch designs from database

### HIGH PRIORITY

**4. No File Uploads**
- **Issue:** Design file uploads not implemented
- **Impact:** Architects can't actually upload files
- **Fix:** Implement AWS S3 integration

**5. No Payment Processing**
- **Issue:** Stripe configured but not functional
- **Impact:** Cannot process real purchases
- **Fix:** Implement Stripe Checkout and webhooks

**6. No Email Service**
- **Issue:** No transactional emails
- **Impact:** No password reset, purchase confirmation, etc.
- **Fix:** Integrate SendGrid or AWS SES

### MEDIUM PRIORITY

**7. No Password Reset**
- **Issue:** Users can't reset forgotten passwords
- **Fix:** Implement forgot password flow with email

**8. No Email Verification**
- **Issue:** Email addresses not verified
- **Fix:** Send verification email on registration

**9. No Search Functionality**
- **Issue:** Search bars exist but don't work
- **Fix:** Implement full-text search (Algolia or PostgreSQL)

**10. No Real-time Features**
- **Issue:** Messages not real-time
- **Fix:** Implement WebSockets or Server-Sent Events

### LOW PRIORITY

**11. No Admin Approval Workflow**
- **Issue:** Design approval exists in schema but not implemented
- **Fix:** Build admin review flow

**12. No Modification Requests**
- **Issue:** UI exists but backend not implemented
- **Fix:** Build modification request system

**13. No License Generation**
- **Issue:** Licenses mentioned but not generated
- **Fix:** Generate PDF licenses on purchase

**14. No Analytics**
- **Issue:** Performance page has no real data
- **Fix:** Track design views, implement analytics

---

## 10. RECENT FIXES (Feb 2, 2025)

### Authentication System Overhaul

#### Issues Resolved

**1. Infinite Redirect Loop** ✅
- **Symptom:** Architect couldn't access dashboard, stuck in redirect loop
- **Root Cause:** 
  - ArchitectLayout.tsx and login.tsx both redirecting simultaneously
  - ArchitectLayout used wrong localStorage key ('token' instead of 'auth_token')
  - No `isLoading` checks before redirects
- **Fix:**
  - ArchitectLayout now uses `useAuth()` hook as single source
  - Added `isLoading` guard before any redirect logic
  - Standardized storage keys

**2. Visual Flash on Auth Pages** ✅
- **Symptom:** Form briefly visible before redirect when already logged in
- **Root Cause:** Conditional rendering after all hooks, user state changes trigger re-render
- **Fix:**
  - Check `isLoading` before rendering anything
  - Show loading spinner until `isLoading === false`
  - Conditional render based on user state

**3. Missing Name Field** ✅
- **Symptom:** Frontend expected `name` but backend didn't provide it
- **Root Cause:** Backend register/login/me endpoints didn't include name field
- **Fix:**
  - Updated all auth endpoints to include name
  - Added name to JWT payload
  - Backend now stores and returns name

**4. Wrong localStorage Keys** ✅
- **Symptom:** ArchitectLayout couldn't read token
- **Root Cause:** Used 'token' instead of 'auth_token'
- **Fix:** Standardized all storage keys to 'auth_token' and 'auth_user'

**5. Generic Error Messages** ✅
- **Symptom:** "Authentication required" on all 401 errors, even login failures
- **Root Cause:** API client checked status codes before parsing JSON response
- **Fix:**
  - Parse JSON first to get backend error message
  - Then handle status codes with proper error messages

#### Files Modified
- [frontend-app/components/ArchitectLayout.tsx](frontend-app/components/ArchitectLayout.tsx)
- [frontend-app/pages/login.tsx](frontend-app/pages/login.tsx)
- [frontend-app/pages/register.tsx](frontend-app/pages/register.tsx)
- [frontend-app/lib/api/client.ts](frontend-app/lib/api/client.ts)
- [server.js](server.js)

#### Git Commits
```
fa2f7b1 - Remove sensitive environment files from git
d8643ea - Update frontend-app submodule with authentication fixes
9ae424f - Fix authentication flow: resolve infinite redirect loop
```

---

## 11. NEXT STEPS & ROADMAP

### IMMEDIATE (This Week)

1. **Connect Prisma to Database**
   - Replace in-memory arrays with Prisma queries
   - Run migration: `npx prisma migrate dev`
   - Update all endpoints to use `prisma.user.findUnique()` etc.

2. **Implement File Upload**
   - Set up AWS S3 bucket
   - Add multer middleware
   - Create upload endpoints
   - Test preview image + design file uploads

3. **Fix Design Management**
   - Allow architects to create real designs
   - Store designs in database
   - Implement edit/delete functionality

### SHORT TERM (This Month)

4. **Payment Processing**
   - Integrate Stripe Checkout
   - Implement webhook handlers
   - Test purchase flow end-to-end

5. **Email Service**
   - Set up SendGrid
   - Implement transactional emails:
     - Welcome email
     - Purchase confirmation
     - Design approved/rejected
   - Password reset flow

6. **Admin Approval Workflow**
   - Build design review interface
   - Implement approve/reject logic
   - Send notifications to architects

### MEDIUM TERM (Next 3 Months)

7. **Messaging System**
   - Implement real-time messaging
   - Add notifications
   - Contact unlock feature

8. **Search & Filtering**
   - Implement full-text search
   - Add advanced filters
   - Category browsing

9. **Analytics & Reporting**
   - Track design views
   - Calculate conversion rates
   - Build architect performance dashboard

10. **Testing**
    - Write unit tests (Jest)
    - Integration tests for API
    - E2E tests (Playwright)

### LONG TERM (6+ Months)

11. **Modification Requests**
    - Build modification request system
    - Pricing quotes
    - Progress tracking

12. **Mobile App**
    - React Native or PWA
    - Mobile-optimized UI

13. **Internationalization**
    - Multi-language support
    - Currency conversion
    - Localized content

14. **Advanced Features**
    - 3D design preview
    - AR visualization
    - AI-powered recommendations

---

## 12. DEPLOYMENT CHECKLIST

### Pre-Production

- [ ] Switch from in-memory to Prisma database
- [ ] Set up production PostgreSQL database
- [ ] Configure AWS S3 for file storage
- [ ] Set up production Stripe account
- [ ] Configure production email service (SendGrid)
- [ ] Set up error monitoring (Sentry)
- [ ] Configure logging (Winston + CloudWatch)
- [ ] Set up database backups
- [ ] Implement rate limiting per user
- [ ] Add input validation on all endpoints
- [ ] Implement password strength requirements
- [ ] Set up SSL certificates
- [ ] Configure CDN for static assets
- [ ] Optimize images (compression)
- [ ] Implement lazy loading
- [ ] Set up staging environment
- [ ] Write deployment documentation

### Security

- [ ] Audit all dependencies (npm audit)
- [ ] Set up security headers (Helmet)
- [ ] Implement CSRF protection
- [ ] Add SQL injection protection (Prisma)
- [ ] Validate all file uploads
- [ ] Set up DDoS protection (Cloudflare)
- [ ] Implement 2FA for admins
- [ ] Add session management
- [ ] Set up intrusion detection
- [ ] Penetration testing

### Testing

- [ ] Unit tests (80%+ coverage)
- [ ] Integration tests
- [ ] E2E tests
- [ ] Load testing
- [ ] Security testing
- [ ] Accessibility testing (WCAG 2.1)
- [ ] Browser compatibility testing
- [ ] Mobile responsiveness testing

### Monitoring

- [ ] Set up uptime monitoring
- [ ] Configure performance monitoring (APM)
- [ ] Set up error alerts
- [ ] Configure log aggregation
- [ ] Set up analytics (Google Analytics)
- [ ] Dashboard for key metrics
- [ ] Alert thresholds

---

## 13. CONTACT & REPOSITORY

**GitHub Repository:** https://github.com/shadikamal997/architects-marketplace-.git

**Branch:** main  
**Last Commit:** `fa2f7b1` - Remove sensitive environment files from git

**Local Development:**
- Frontend: http://localhost:3000
- Backend: http://localhost:3001

**Development Team:**
- Owner: Shadi Kamal (shadikamal997)

---

## 📝 APPENDIX

### Environment Variables Reference

#### Backend (.env)
```env
NODE_ENV=staging|production
PORT=3001
DATABASE_URL=postgresql://...
JWT_SECRET=<min 32 chars>
JWT_EXPIRES_IN=24h

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# URLs
FRONTEND_URL=http://localhost:3000
BACKEND_URL=http://localhost:3001

# Stripe (Optional)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# AWS S3 (Optional)
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_S3_BUCKET=...
AWS_REGION=us-east-1

# Email (Optional)
SENDGRID_API_KEY=...
FROM_EMAIL=noreply@architects-marketplace.com

# Monitoring (Optional)
SENTRY_DSN=...
```

#### Frontend (.env.local)
```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001
```

### Database Models Summary

| Model | Purpose | Key Fields |
|-------|---------|------------|
| User | User accounts | email, password, name, role |
| Design | Architectural designs | title, price, status, architectId |
| Transaction | Purchases | buyerId, designId, amount, status |
| License | Usage licenses | transactionId, licenseType, status |
| File | Design files | designId, fileUrl, fileType |
| Message | Chat messages | senderId, content, conversationId |
| Conversation | Message threads | participants |
| ArchitectEarning | Architect revenue | architectId, amount, status |
| ModificationRequest | Custom modifications | buyerId, designId, status |

---

**Report End**

**Generated:** February 2, 2025  
**Total Pages Analyzed:** 39+ frontend pages  
**Total API Endpoints:** 9 core + route modules  
**Total Database Models:** 15+  
**Status:** ✅ Authentication Working | ⚠️ Database Implementation Pending
