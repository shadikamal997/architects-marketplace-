#!/bin/bash

echo "🚀 Starting Architects Marketplace..."

# Kill any existing processes
echo "🛑 Killing existing processes..."
pkill -9 node 2>/dev/null
pkill -9 ts-node 2>/dev/null
sleep 2

# Start backend server
echo "🔧 Starting backend server..."
cd "/Users/shadi/Desktop/architects marketplace"
node node_modules/.bin/ts-node src/index.ts &
BACKEND_PID=$!

# Wait for backend to start
sleep 3

# Start frontend server
echo "🌐 Starting frontend server..."
cd "/Users/shadi/Desktop/architects marketplace/frontend-app"
PORT=3000 npm run dev &
FRONTEND_PID=$!

# Wait for frontend to start
sleep 5

# Test both servers
echo "🧪 Testing servers..."
echo "Backend (port 5000):"
curl -s http://localhost:5000/marketplace/designs?page=1&limit=1 | jq '.success' 2>/dev/null || echo "❌ Backend not responding"

echo "Frontend (port 3000):"
curl -s http://localhost:3000/explore | grep -o "<title>[^<]*" | head -1 2>/dev/null || echo "❌ Frontend not responding"

echo ""
echo "✅ App started successfully!"
echo "📱 Frontend: http://localhost:3000"
echo "🔧 Backend: http://localhost:5000"
echo ""
echo "Press Ctrl+C to stop both servers"

# Wait for user to stop
trap "echo '🛑 Stopping servers...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT
wait