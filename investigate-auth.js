const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-dev-secret-do-not-use-in-production';

async function fullInvestigation() {
  console.log('\n' + '='.repeat(60));
  console.log('🔍 FULL AUTHENTICATION INVESTIGATION');
  console.log('='.repeat(60) + '\n');

  // 1. Check JWT_SECRET
  console.log('1️⃣ JWT_SECRET Check:');
  console.log(`   Backend JWT_SECRET: ${JWT_SECRET.substring(0, 20)}...`);
  console.log('');

  // 2. Find test@test.com user
  console.log('2️⃣ Database User Check:');
  const user = await prisma.user.findUnique({
    where: { email: 'test@test.com' },
    include: { architect: true, buyer: true },
  });

  if (!user) {
    console.log('    User NOT found in database!');
    return;
  }

  console.log('    User found:');
  console.log(`      ID: ${user.id}`);
  console.log(`      Email: ${user.email}`);
  console.log(`      Role: ${user.role}`);
  console.log(`      Has Architect: ${!!user.architect}`);
  console.log(`      Architect ID: ${user.architect?.id || 'NULL'}`);
  console.log('');

  // 3. Generate a test token
  console.log('3️⃣ Generate Test Token:');
  const testToken = jwt.sign(
    {
      userId: user.id,
      email: user.email,
      role: user.role,
      buyerId: user.buyer?.id,
      architectId: user.architect?.id,
    },
    JWT_SECRET,
    { expiresIn: '24h' }
  );

  console.log(`   Token (first 50 chars): ${testToken.substring(0, 50)}...`);
  console.log('');

  // 4. Decode the token
  console.log('4️⃣ Decode Token:');
  const decoded = jwt.decode(testToken);
  console.log('   Payload:');
  console.log(`      userId: ${decoded.userId}`);
  console.log(`      email: ${decoded.email}`);
  console.log(`      role: ${decoded.role}`);
  console.log(`      architectId: ${decoded.architectId}`);
  console.log(`      buyerId: ${decoded.buyerId}`);
  console.log('');

  // 5. Test /auth/login endpoint
  console.log('5️⃣ Testing /auth/login Endpoint:');
  try {
    const bcrypt = require('bcryptjs');
    const isPasswordValid = await bcrypt.compare('password123', user.password);
    console.log(`   Password valid: ${isPasswordValid}`);
    
    if (isPasswordValid) {
      console.log('    Login would succeed');
      console.log('   Token that would be returned:');
      console.log(`   ${testToken.substring(0, 80)}...`);
    } else {
      console.log('    Password does not match');
    }
  } catch (error) {
    console.log(`    Error: ${error.message}`);
  }
  console.log('');

  // 6. Test token verification
  console.log('6️⃣ Verify Token:');
  try {
    const verified = jwt.verify(testToken, JWT_SECRET);
    console.log('    Token verification successful');
    console.log(`   userId from token: ${verified.userId}`);
  } catch (error) {
    console.log(`    Token verification failed: ${error.message}`);
  }
  console.log('');

  // 7. Simulate auth middleware
  console.log('7️⃣ Simulate Auth Middleware:');
  try {
    const verified = jwt.verify(testToken, JWT_SECRET);
    
    // Check if userId from token matches a user
    const userFromToken = await prisma.user.findUnique({
      where: { id: verified.userId },
      include: { architect: true },
    });

    if (!userFromToken) {
      console.log('    User from token NOT found in database');
    } else {
      console.log('    User from token found in database');
      console.log(`   User ID: ${userFromToken.id}`);
      console.log(`   Architect ID: ${userFromToken.architect?.id}`);
      
      // This is what req.user.id should be (roleEntityId)
      const roleEntityId = userFromToken.architect?.id || userFromToken.id;
      console.log(`   req.user.id (roleEntityId): ${roleEntityId}`);
    }
  } catch (error) {
    console.log(`    Error: ${error.message}`);
  }
  console.log('');

  console.log('='.repeat(60));
  console.log('📋 SUMMARY');
  console.log('='.repeat(60));
  console.log('\n VALID LOGIN CREDENTIALS:');
  console.log('   Email: test@test.com');
  console.log('   Password: password123');
  console.log('\n🔑 COPY THIS TOKEN TO TEST:');
  console.log(`   ${testToken}`);
  console.log('\n📝 TO TEST IN BROWSER:');
  console.log('   1. Open browser DevTools (F12)');
  console.log('   2. Go to Console tab');
  console.log('   3. Run: localStorage.clear()');
  console.log(`   4. Run: localStorage.setItem('auth_token', '${testToken.substring(0, 50)}...')`);
  console.log('   5. Refresh page');
  console.log('');

  await prisma.$disconnect();
}

fullInvestigation().catch(console.error);
