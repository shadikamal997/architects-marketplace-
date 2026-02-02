# 🔍 LOGIN ISSUE - TROUBLESHOOTING GUIDE

## Test Credentials

Use these credentials to test login:

### Buyer Account
- **Email:** `buyer@example.com`
- **Password:** `password123`
- **Should redirect to:** `/` (homepage)

### Architect Account
- **Email:** `architect@example.com`
- **Password:** `password123`
- **Should redirect to:** `/architect/dashboard`

## Checking If Database Has Users

Run this command:
```bash
cd "/Users/shadi/Desktop/architects marketplace"
npx prisma studio
```

Then open http://localhost:5555 and check the User table.

## If Database Is Empty - Seed It

```bash
cd "/Users/shadi/Desktop/architects marketplace"
npx prisma db seed
```

## Current Status

Both backend and frontend are running:
- ✅ Backend: http://localhost:3001
- ✅ Frontend: http://localhost:3000

## Debugging Steps

1. **Open Browser Console** (F12 → Console tab)
2. **Try to login** with buyer@example.com / password123
3. **Check for errors** in console
4. **Look for these issues:**
   - Network error (backend not running)
   - 401 Unauthorized (wrong credentials or user doesn't exist)
   - Token not being saved to localStorage
   - Redirect not happening

## Common Issues

### Issue 1: "Failed to fetch"
- **Cause:** Backend is not running
- **Solution:** Backend is running on port 3001 ✅

### Issue 2: "Invalid credentials"  
- **Cause:** Database not seeded or wrong password
- **Solution:** Run `npx prisma db seed`

### Issue 3: Login succeeds but no redirect
- **Cause:** localStorage not being set properly
- **Check:** After login attempt, run in console:
  ```javascript
  console.log(localStorage.getItem('token'));
  console.log(localStorage.getItem('user'));
  ```

### Issue 4: User object format mismatch
- **Cause:** Backend response format doesn't match frontend expectation
- **Current format expected:**
  ```json
  {
    "success": true,
    "data": {
      "token": "jwt-token-here",
      "user": {
        "id": "uuid",
        "email": "buyer@example.com",
        "role": "BUYER",
        "name": "Jane Doe"
      }
    }
  }
  ```

## Manual Test via cURL

Test the backend directly:
```bash
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"buyer@example.com","password":"password123"}'
```

Should return:
```json
{
  "success": true,
  "data": {
    "user": {...},
    "token": "..."
  }
}
```

## Next Steps

1. Check if Prisma Studio shows users in database
2. If no users → Run seed command
3. Try login again
4. Check browser console for specific error
5. Report the exact error message
