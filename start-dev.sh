#!/bin/bash

# 🏗️ Architects Marketplace - Development Server Startup Script
# This script ensures proper port allocation and prevents port collisions

set -e

echo "============================================================"
echo "🏗️  ARCHITECTS MARKETPLACE - STARTING DEVELOPMENT SERVERS"
echo "============================================================"

# Kill any existing processes on ports 3000 and 3001
echo "🧹 Cleaning up existing processes..."
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
lsof -ti:3001 | xargs kill -9 2>/dev/null || true
sleep 1

# Start backend server on port 3001
echo ""
echo "🚀 Starting Backend Server (Port 3001)..."
cd "$(dirname "$0")"
node server.js &
BACKEND_PID=$!
echo "✅ Backend started with PID: $BACKEND_PID"

# Wait for backend to be ready
sleep 2

# Start frontend server on port 3000
echo ""
echo "🚀 Starting Frontend Server (Port 3000)..."
cd frontend-app
npm run dev &
FRONTEND_PID=$!
echo "✅ Frontend started with PID: $FRONTEND_PID"

# Wait for frontend to be ready
sleep 3

# Verify servers are running
echo ""
echo "🔍 Verifying servers..."
if curl -s http://localhost:3001/health > /dev/null; then
  echo "✅ Backend (3001): OK"
else
  echo "❌ Backend (3001): FAILED"
fi

if curl -s http://localhost:3000 > /dev/null; then
  echo "✅ Frontend (3000): OK"
else
  echo "⚠️  Frontend (3000): Checking..."
fi

echo ""
echo "============================================================"
echo "✅ Development servers started successfully!"
echo "============================================================"
echo "📍 Frontend: http://localhost:3000"
echo "📍 Backend:  http://localhost:3001"
echo ""
echo "Press Ctrl+C to stop all servers"
echo "============================================================"

# Keep script running and wait for Ctrl+C
wait
