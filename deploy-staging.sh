#!/usr/bin/env bash
set -e

echo "🚀 Starting STAGING deployment..."

# ============================
# SAFETY CHECKS
# ============================
if [[ "$NODE_ENV" == "production" ]]; then
  echo "❌ ERROR: NODE_ENV=production detected. Aborting."
  exit 1
fi

if [[ -z "$STAGING_CONFIRM" ]]; then
  echo "❌ ERROR: STAGING_CONFIRM not set."
  echo "Run with: STAGING_CONFIRM=yes ./deploy-staging.sh"
  exit 1
fi

echo "✅ Safety checks passed"

# ============================
# BACKEND DEPLOY
# ============================
echo "🔧 Deploying backend (STAGING)..."

cd backend

echo "📦 Installing dependencies..."
npm ci

echo "🔍 Prisma generate..."
npx prisma generate

echo "🗄️ Applying migrations (NON-DESTRUCTIVE)..."
npx prisma migrate deploy

echo "🚀 Deploying backend to cloud..."
# choose ONE depending on your platform

# Railway
# railway up

# Render
# git push render main

# Fly.io
# fly deploy --config fly.staging.toml

cd ..

# ============================
# FRONTEND DEPLOY
# ============================
echo "🎨 Deploying frontend (STAGING)..."

cd frontend

npm ci

echo "🌐 Deploying to Vercel (staging)..."
vercel --prod=false --env NEXT_PUBLIC_ENV=staging

cd ..

# ============================
# FINAL CHECK
# ============================
echo "✅ STAGING deployment completed successfully!"
echo "👉 Next: run smoke tests"</content>
<parameter name="filePath">/Users/shadi/Desktop/architects marketplace/deploy-staging.sh