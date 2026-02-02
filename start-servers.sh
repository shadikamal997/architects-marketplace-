#!/bin/bash
# Persistent server startup script for Architects Marketplace

echo "🚀 Starting Architects Marketplace (Persistent Mode)"
echo ""

# Kill existing processes
echo "🧹 Cleaning up old processes..."
pkill -9 node 2>/dev/null
pkill -9 ts-node 2>/dev/null
sleep 2

# Start backend with nohup
echo "🔧 Starting backend server..."
cd "/Users/shadi/Desktop/architects marketplace"
nohup node node_modules/.bin/ts-node src/index.ts > backend.log 2>&1 &
BACKEND_PID=$!
echo "   Backend PID: $BACKEND_PID"
sleep 3

# Check backend started
if lsof -i :5000 > /dev/null 2>&1; then
    echo "   ✅ Backend running on http://localhost:5000"
else
    echo "   ❌ Backend failed to start. Check backend.log"
    exit 1
fi

# Start frontend with nohup
echo "🌐 Starting frontend server..."
cd "/Users/shadi/Desktop/architects marketplace/frontend-app"
nohup npm run dev > frontend.log 2>&1 &
FRONTEND_PID=$!
echo "   Frontend PID: $FRONTEND_PID"
sleep 8

# Check frontend started
if lsof -i :3000 > /dev/null 2>&1; then
    echo "   ✅ Frontend running on http://localhost:3000"
else
    echo "   ❌ Frontend failed to start. Check frontend.log"
    exit 1
fi

echo ""
echo "✅ All servers started successfully!"
echo ""
echo "📱 Frontend: http://localhost:3000/explore"
echo "🔧 Backend:  http://localhost:5000"
echo ""
echo "📝 Logs:"
echo "   Backend:  ~/Desktop/architects marketplace/backend.log"
echo "   Frontend: ~/Desktop/architects marketplace/frontend-app/frontend.log"
echo ""
echo "🛑 To stop servers: pkill -9 node"
echo ""
