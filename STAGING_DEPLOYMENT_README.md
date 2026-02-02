# 🚀 STAGING DEPLOYMENT GUIDE

## Overview
This guide provides safe, automated deployment to staging environment with multiple safety checks to prevent production data contamination.

## 🛡️ Safety Features
- **NODE_ENV Validation**: Prevents deployment if production environment detected
- **STAGING_CONFIRM Flag**: Requires explicit confirmation to proceed
- **Non-Destructive Migrations**: Only applies new migrations, never resets schema
- **Separate Resources**: Uses completely isolated staging infrastructure

## 📋 Prerequisites

### Required Accounts & Services
- **Railway/Render/Fly.io** account for backend hosting
- **Vercel** account for frontend hosting
- **Neon/Supabase** account for staging database
- **AWS S3** account for staging file storage
- **Stripe** account with test keys only

### Required Environment Variables
Create these BEFORE running the script:

#### Backend (staging)
```bash
NODE_ENV=staging
DATABASE_URL=postgresql://STAGING_DB
JWT_SECRET=staging_secret_key_min_32_chars
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
S3_BUCKET=architects-staging
S3_ACCESS_KEY=...
S3_SECRET_KEY=...
```

#### Frontend (staging)
```bash
NEXT_PUBLIC_API_URL=https://staging-api.yourdomain.com
NEXT_PUBLIC_ENV=staging
```

## 🚀 Deployment Instructions

### Step 1: Prepare Environment
```bash
# Ensure you're in the project root
cd /Users/shadi/Desktop/architects\ marketplace

# Make script executable (already done)
chmod +x deploy-staging.sh
```

### Step 2: Configure Deployment Platform
Edit `deploy-staging.sh` and uncomment ONE deployment method:

```bash
# Choose ONE of these in the backend deploy section:

# Railway
railway up

# Render
git push render main

# Fly.io
fly deploy --config fly.staging.toml
```

### Step 3: Run Deployment
```bash
# CRITICAL: Use STAGING_CONFIRM=yes to enable deployment
STAGING_CONFIRM=yes ./deploy-staging.sh
```

## 🔍 What the Script Does

### Safety Checks
1. ✅ Verifies `NODE_ENV` is not "production"
2. ✅ Requires `STAGING_CONFIRM=yes` flag
3. ✅ Prevents accidental production deployment

### Backend Deployment
1. 📦 Installs dependencies (`npm ci`)
2. 🔍 Generates Prisma client (`npx prisma generate`)
3. 🗄️ Applies migrations safely (`npx prisma migrate deploy`)
4. 🚀 Deploys to chosen cloud platform

### Frontend Deployment
1. 📦 Installs dependencies (`npm ci`)
2. 🌐 Deploys to Vercel staging environment

### Final Verification
1. ✅ Confirms deployment success
2. 👉 Prompts for smoke tests

## 🧪 Post-Deploy Smoke Tests (REQUIRED)

You MUST manually verify these within 5-10 minutes:

### Health Checks
- [ ] `GET /health` returns `200 OK`

### Authentication
- [ ] User registration works
- [ ] User login works
- [ ] JWT tokens are issued
- [ ] Rate limiting active (3 attempts/15min)

### Architect Features
- [ ] Design upload works
- [ ] Design submission works
- [ ] File storage in staging bucket

### Admin Features
- [ ] Admin login works
- [ ] Design approval works
- [ ] Audit logs are created

### Buyer Features
- [ ] Marketplace browsing works
- [ ] Design purchase works (Stripe test mode)
- [ ] File download with watermarking works

### Security Features
- [ ] Messaging rules enforced
- [ ] File access controls work
- [ ] Unauthorized access blocked

## ⛔ HARD STOP Conditions

**STOP IMMEDIATELY AND ROLLBACK IF:**

- ❌ Data appears in production database
- ❌ Files appear in production S3 bucket
- ❌ Stripe live keys are used (check dashboard)
- ❌ Prisma asks to reset schema
- ❌ Production URLs are affected
- ❌ Any production resources are modified

### Rollback Procedure
```bash
# Backend rollback (Railway example)
railway rollback

# Frontend rollback (Vercel)
vercel rollback

# Database rollback (if needed)
# Contact Neon/Supabase support
```

## 📊 Expected Results

### Success Indicators
- ✅ Script completes without errors
- ✅ Staging URLs are accessible
- ✅ All smoke tests pass
- ✅ No production data affected

### Performance Benchmarks
- Health check: < 200ms
- Auth endpoints: < 500ms
- File operations: < 2s
- Database queries: < 100ms

## 🔧 Troubleshooting

### Common Issues

**"NODE_ENV=production detected"**
- Solution: Ensure you're using staging environment variables

**"STAGING_CONFIRM not set"**
- Solution: Run with `STAGING_CONFIRM=yes ./deploy-staging.sh`

**Railway/Render/Fly deployment fails**
- Check CLI installation: `which railway`
- Verify login: `railway whoami`
- Check project linking

**Vercel deployment fails**
- Check CLI: `vercel --version`
- Verify login: `vercel whoami`
- Check project linking

**Database connection fails**
- Verify DATABASE_URL format
- Check Neon/Supabase credentials
- Ensure staging database exists

## 📈 Next Steps After Successful Staging

1. **Load Testing**: Run the load test scripts
2. **Security Testing**: Penetration testing on staging
3. **Performance Monitoring**: Set up monitoring dashboards
4. **Production Planning**: Prepare production deployment
5. **Team Notification**: Inform team of staging availability

## 🎯 Success Confirmation

When all smoke tests pass, reply with:

**"Staging deployed and smoke tests passed."**

---

## 📞 Support

If you encounter issues:
1. Check the troubleshooting section above
2. Review deployment logs
3. Verify all prerequisites are met
4. Ensure staging credentials are correct

**Remember: Safety first! Never deploy to production without successful staging validation.**

## Deployment Steps

### Option 1: Automated Deployment (Recommended)

1. **Set Environment Variables**
   ```bash
   export STAGING_DATABASE_URL="your-neon-connection-string"
   export STAGING_JWT_SECRET="your-64-char-secret"
   export STAGING_STORAGE_BUCKET="architects-marketplace-staging-files"
   export STAGING_STORAGE_ACCESS_KEY="your-aws-access-key"
   export STAGING_STORAGE_SECRET_KEY="your-aws-secret-key"
   export STAGING_STRIPE_SECRET_KEY="sk_test_..."
   export STAGING_STRIPE_WEBHOOK_SECRET="whsec_..."
   ```

2. **Run Deployment Script**
   ```bash
   ./deploy-staging.sh
   ```

### Option 2: Manual Deployment

#### 1. Database Setup

1. Create Neon project: `architects-marketplace-staging`
2. Get connection string
3. Update `.env.staging` with the DATABASE_URL

#### 2. Backend Deployment (Railway)

1. **Create Railway Project**
   ```bash
   # Install Railway CLI
   npm install -g @railway/cli

   # Login
   railway login

   # Create project
   railway create architects-marketplace-staging
   ```

2. **Set Environment Variables**
   ```bash
   railway variables set NODE_ENV=staging
   railway variables set DATABASE_URL="your-neon-connection-string"
   railway variables set JWT_SECRET="your-64-char-secret"
   railway variables set FRONTEND_URL="https://architects-marketplace-staging.vercel.app"
   railway variables set BACKEND_URL="https://architects-marketplace-staging-api.up.railway.app"
   railway variables set STORAGE_BUCKET="architects-marketplace-staging-files"
   railway variables set STORAGE_ACCESS_KEY="your-aws-access-key"
   railway variables set STORAGE_SECRET_KEY="your-aws-secret-key"
   railway variables set STRIPE_SECRET_KEY="sk_test_..."
   railway variables set STRIPE_WEBHOOK_SECRET="whsec_..."
   railway variables set PLATFORM_COMMISSION_RATE=0.10
   railway variables set ENABLE_ADMIN_FEATURES=true
   railway variables set ENABLE_SANDBOX_MODE=true
   ```

3. **Deploy Backend**
   ```bash
   railway deploy
   ```

4. **Run Database Migrations**
   ```bash
   # Set the staging database URL
   export DATABASE_URL="your-staging-database-url"

   # Run migrations
   npx prisma migrate deploy
   ```

#### 3. Frontend Deployment (Vercel)

1. **Create Vercel Project**
   ```bash
   cd frontend-app

   # Install Vercel CLI
   npm install -g vercel

   # Login
   vercel login

   # Link project
   vercel link
   ```

2. **Set Environment Variables**
   ```bash
   # Set API URL (update with actual Railway URL)
   vercel env add NEXT_PUBLIC_API_BASE_URL
   # Enter: https://architects-marketplace-staging-api.up.railway.app

   vercel env add NODE_ENV
   # Enter: staging

   vercel env add NEXT_PUBLIC_ENABLE_SANDBOX_MODE
   # Enter: true

   vercel env add NEXT_PUBLIC_ENABLE_ADMIN_FEATURES
   # Enter: true
   ```

3. **Deploy Frontend**
   ```bash
   vercel --prod
   ```

## Verification Checklist

After deployment, verify these core flows:

### 🔐 Authentication
- [ ] User registration works
- [ ] User login works
- [ ] JWT tokens are properly issued
- [ ] Protected routes require authentication
- [ ] Role-based access works (BUYER/ARCHITECT/ADMIN)

### 🏗️ Design Management
- [ ] Architects can create designs
- [ ] Design status transitions work (DRAFT → SUBMITTED → APPROVED → PUBLISHED)
- [ ] Admin can approve/reject designs
- [ ] Public can browse published designs

### 📁 File Management
- [ ] File uploads work for architects
- [ ] File downloads require licenses
- [ ] Watermarking works for standard licenses
- [ ] Exclusive licenses get clean downloads

### 💬 Messaging System
- [ ] Messaging requires proper permissions (exclusive license or paid modification)
- [ ] Contact information is filtered appropriately
- [ ] Conversation creation works

### 📊 Audit Logging
- [ ] Critical actions are logged (design approvals, file downloads, etc.)
- [ ] Audit logs are accessible to admins

## Environment URLs

After successful deployment:

- **Frontend**: https://architects-marketplace-staging.vercel.app
- **Backend**: https://architects-marketplace-staging-api.up.railway.app

## Troubleshooting

### Common Issues

1. **Database Connection Failed**
   - Verify Neon connection string
   - Check if database allows external connections
   - Ensure SSL mode is set to `require`

2. **File Uploads Fail**
   - Verify AWS S3 credentials
   - Check bucket permissions
   - Ensure bucket exists in correct region

3. **Stripe Payments Fail**
   - Verify test keys are being used
   - Check webhook endpoints are configured
   - Ensure success/cancel URLs are correct

4. **CORS Issues**
   - Verify FRONTEND_URL in backend matches Vercel URL
   - Check CORS configuration in Railway

### Logs & Debugging

**Backend Logs (Railway)**:
```bash
railway logs
```

**Frontend Logs (Vercel)**:
```bash
vercel logs
```

**Database Logs (Neon)**:
Check Neon console for connection/query logs.

## Security Notes

- ✅ Separate database from production
- ✅ Separate S3 bucket from production
- ✅ Test Stripe keys (no real payments)
- ✅ Sandbox mode enabled
- ✅ Admin features enabled for testing
- ✅ JWT secrets are staging-specific

## Next Steps

1. **Load Testing**: Test with multiple concurrent users
2. **Integration Testing**: End-to-end user flows
3. **Security Testing**: Penetration testing on staging
4. **Performance Monitoring**: Set up monitoring/alerts
5. **Production Deployment**: Use this as template for production

---

**Status**: Ready for staging deployment
**Estimated Deployment Time**: 30-45 minutes
**Risk Level**: Low (separate resources from production)</content>
<parameter name="filePath">/Users/shadi/Desktop/architects marketplace/STAGING_DEPLOYMENT_README.md