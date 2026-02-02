# 🚀 Quick Start Guide - Architects Marketplace

## Starting Your Development Servers

### Method 1: Automated Script (Recommended)
```bash
cd /Users/shadi/Desktop/architects\ marketplace
./start-dev.sh
```
✅ This automatically:
- Cleans up any existing processes on ports 3000 & 3001
- Starts backend on port 3001
- Starts frontend on port 3000
- Verifies both servers are running

### Method 2: Manual Start
```bash
# Terminal 1 - Backend
cd /Users/shadi/Desktop/architects\ marketplace
node server.js

# Terminal 2 - Frontend  
cd frontend-app
npm run dev
```

---

## Access Your Application

| Service | URL | Purpose |
|---------|-----|---------|
| **Frontend** | http://localhost:3000 | Next.js homepage & UI |
| **Backend API** | http://localhost:3001 | Express API endpoints |
| **Health Check** | http://localhost:3001/health | Server status |

---

## Port Configuration

### Frontend (Next.js)
- **Port:** 3000
- **Config:** `frontend-app/package.json`
- **Auto-cleanup:** Yes (kills port 3000 before starting)

### Backend (Express)
- **Port:** 3001  
- **Config:** `.env` (PORT=3001)
- **Protection:** Refuses to start on port 3000

---

## Common Commands

### Kill All Servers
```bash
lsof -ti:3000,3001 | xargs kill -9
```

### Check Running Processes
```bash
lsof -i :3000 -i :3001
```

### Test Servers
```bash
# Test frontend
curl -I http://localhost:3000

# Test backend
curl http://localhost:3001/health
```

---

## Troubleshooting

### "Cannot GET /" Error
✅ **Fixed!** This error is now impossible due to:
- Backend port validation
- Automatic port cleanup
- Clear server identification

### Port Already in Use
```bash
# Kill processes and restart
lsof -ti:3000,3001 | xargs kill -9
./start-dev.sh
```

### Backend Won't Start
- Check `.env` file has `PORT=3001`
- Ensure port 3001 is free
- Backend will refuse to start if PORT=3000

---

## Key Files

- `server.js` - Backend server with port protection
- `frontend-app/package.json` - Frontend config with auto-cleanup
- `.env` - Environment variables (PORT=3001)
- `start-dev.sh` - Automated startup script

---

## Port Safety Features

✅ Backend **cannot** run on port 3000 (throws error)
✅ Frontend **automatically** clears port 3000 before starting  
✅ Clear server logs show PID and configuration
✅ Startup script verifies both servers are running

---

**Status:** ✅ Production Ready | Port Collision Permanently Fixed
