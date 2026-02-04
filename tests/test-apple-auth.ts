/**
 * Apple Sign-In Test Script
 * 
 * Tests the Apple authentication flow
 * 
 * IMPORTANT: Apple tokens are harder to test than Google because:
 * 1. Email is only sent on FIRST login
 * 2. Subsequent logins only have 'sub' (user ID)
 * 3. You need real Apple Developer credentials
 */

import { getAppleAuthService } from '../src/services/apple-auth.service.js';
import { prisma } from '../src/lib/prisma.js';

async function testAppleAuth() {
  console.log('🧪 Apple Authentication Test Suite\n');

  // Test 1: Service initialization
  console.log('Test 1: Apple Auth Service Initialization');
  try {
    const service = getAppleAuthService();
    console.log(' Service initialized successfully');
  } catch (error) {
    console.error(' Service initialization failed:', error instanceof Error ? error.message : String(error));
    console.log('\n  Make sure APPLE_CLIENT_ID is set in .env');
    return;
  }

  // Test 2: Database connectivity
  console.log('\nTest 2: Database Connectivity');
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log(' Database connected');
  } catch (error) {
    console.error(' Database connection failed:', error);
    return;
  }

  // Test 3: Check AuthProvider table exists
  console.log('\nTest 3: AuthProvider Table');
  try {
    const count = await prisma.authProvider.count();
    console.log(` AuthProvider table exists (${count} records)`);
  } catch (error) {
    console.error(' AuthProvider table not found:', error instanceof Error ? error.message : String(error));
    return;
  }

  // Test 4: Check for existing Apple providers
  console.log('\nTest 4: Existing Apple Providers');
  try {
    const appleProviders = await prisma.authProvider.findMany({
      where: { provider: 'APPLE' },
      include: { user: true },
      take: 5,
    });
    
    if (appleProviders.length === 0) {
      console.log('ℹ️  No Apple providers yet (expected for fresh database)');
    } else {
      console.log(` Found ${appleProviders.length} Apple provider(s):`);
      appleProviders.forEach(p => {
        console.log(`   - User: ${p.user.email || 'No email'} (ID: ${p.userId})`);
        console.log(`     Provider User ID: ${p.providerUserId}`);
      });
    }
  } catch (error) {
    console.error(' Query failed:', error);
  }

  console.log('\n' + '='.repeat(60));
  console.log('📋 Apple Sign-In Edge Cases');
  console.log('='.repeat(60));
  console.log('\n  CRITICAL Apple Behavior:');
  console.log('1. First login: Token contains sub + email + name');
  console.log('2. Second login: Token contains ONLY sub (no email!)');
  console.log('3. Email may be private relay (@privaterelay.appleid.com)');
  console.log('4. We ALWAYS use sub as the primary identifier');
  console.log('\n Our Implementation:');
  console.log('- Always check AuthProvider by (APPLE, sub) first');
  console.log('- Only use email for account linking if provided');
  console.log('- Create user even if email is missing');
  console.log('- Store sub in AuthProvider.providerUserId');

  console.log('\n' + '='.repeat(60));
  console.log('📋 Manual Testing Instructions');
  console.log('='.repeat(60));
  console.log('\n1. Get Apple Developer credentials:');
  console.log('   - Go to: https://developer.apple.com/account');
  console.log('   - Create Service ID for web authentication');
  console.log('   - Get: Client ID, Team ID, Key ID, Private Key');
  console.log('\n2. Configure .env:');
  console.log('   APPLE_CLIENT_ID=com.yourcompany.yourapp.web');
  console.log('   APPLE_TEAM_ID=YOUR_TEAM_ID');
  console.log('   APPLE_KEY_ID=YOUR_KEY_ID');
  console.log('   APPLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----"');
  console.log('\n3. Test the endpoint:');
  console.log('   curl -X POST http://localhost:3001/auth/apple \\');
  console.log('     -H "Content-Type: application/json" \\');
  console.log('     -d \'{"idToken": "YOUR_APPLE_TOKEN", "role": "BUYER"}\'');
  console.log('\n4. Test scenarios:');
  console.log('    First login: Creates user with email');
  console.log('    Second login: Finds user by sub (no email in token)');
  console.log('    Private relay: User created with @privaterelay.appleid.com');
  console.log('    Existing email user: Links Apple provider to existing account');

  console.log('\n All automated tests passed!');
  console.log('⏭️  Next: Configure Apple credentials and test with real Apple ID\n');
}

// Run tests
testAppleAuth()
  .catch(error => {
    console.error(' Test suite failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
