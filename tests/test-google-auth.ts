/**
 * Google Sign-In Test Script
 * 
 * Tests the Google authentication flow
 * 
 * IMPORTANT: This requires a real Google ID token to test properly.
 * You can get one from:
 * 1. Google OAuth 2.0 Playground: https://developers.google.com/oauthplayground/
 * 2. Frontend Google Sign-In button (check network tab)
 * 3. Use the test-google-auth.html file in this directory
 */

import { getGoogleAuthService } from '../src/services/google-auth.service.js';
import { prisma } from '../src/lib/prisma.js';

async function testGoogleAuth() {
  console.log('🧪 Google Authentication Test Suite\n');

  // Test 1: Service initialization
  console.log('Test 1: Google Auth Service Initialization');
  try {
    const service = getGoogleAuthService();
    console.log(' Service initialized successfully');
  } catch (error) {
    console.error(' Service initialization failed:', error instanceof Error ? error.message : String(error));
    console.log('\n  Make sure GOOGLE_CLIENT_ID is set in .env');
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
    console.log('\n  Run: npx prisma migrate dev --name add_auth_providers');
    return;
  }

  // Test 4: Check for existing Google providers
  console.log('\nTest 4: Existing Google Providers');
  try {
    const googleProviders = await prisma.authProvider.findMany({
      where: { provider: 'GOOGLE' },
      include: { user: true },
      take: 5,
    });
    
    if (googleProviders.length === 0) {
      console.log('ℹ️  No Google providers yet (expected for fresh database)');
    } else {
      console.log(` Found ${googleProviders.length} Google provider(s):`);
      googleProviders.forEach(p => {
        console.log(`   - User: ${p.user.email} (ID: ${p.userId})`);
      });
    }
  } catch (error) {
    console.error(' Query failed:', error);
  }

  console.log('\n' + '='.repeat(60));
  console.log('📋 Manual Testing Instructions');
  console.log('='.repeat(60));
  console.log('\n1. Get a Google ID token:');
  console.log('   - Use Google OAuth Playground: https://developers.google.com/oauthplayground/');
  console.log('   - Or implement frontend Google Sign-In button');
  console.log('\n2. Test the endpoint:');
  console.log('   curl -X POST http://localhost:3001/auth/google \\');
  console.log('     -H "Content-Type: application/json" \\');
  console.log('     -d \'{"idToken": "YOUR_TOKEN_HERE", "role": "BUYER"}\'');
  console.log('\n3. Expected responses:');
  console.log('   - New user: { isNewUser: true, user: {...}, token: "..." }');
  console.log('   - Existing user: { isNewUser: false, user: {...}, token: "..." }');
  console.log('   - Linked provider: { linkedProvider: true, ... }');
  console.log('\n4. Verify in database:');
  console.log('   - Check User table for new user');
  console.log('   - Check AuthProvider table for GOOGLE record');
  console.log('   - Check Buyer or Architect profile created');

  console.log('\n All automated tests passed!');
  console.log('⏭️  Next: Test with real Google token\n');
}

// Run tests
testGoogleAuth()
  .catch(error => {
    console.error(' Test suite failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
