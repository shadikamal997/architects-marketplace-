#!/bin/bash
echo "🚀 Starting Architects Marketplace..."

# Kill existing processes
pkill -9 node 2>/dev/null
pkill -9 ts-node 2>/dev/null
sleep 2

# Start backend
echo "🔧 Starting backend..."
cd "/Users/shadi/Desktop/architects marketplace"
node node_modules/.bin/ts-node src/index.ts &
BACKEND_PID=$!

# Start frontend
echo "🌐 Starting frontend..."
cd "/Users/shadi/Desktop/architects marketplace/frontend-app"
PORT=3000 npm run dev &
FRONTEND_PID=$!

echo "✅ Servers starting..."
echo "📱 Frontend: http://localhost:3000"
echo "🔧 Backend: http://localhost:5000"
echo ""
echo "Press Ctrl+C to stop"

# Keep running
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null" INT
wait