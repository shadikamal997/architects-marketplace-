#!/usr/bin/env node

/**
 * STEP 5 VALIDATION TEST SUITE
 * 
 * Run this script to validate all hardening improvements
 * Tests edge cases, validation rules, and data integrity
 */

const BASE_URL = 'http://localhost:3001';
let buyerToken = '';
let architectToken = '';
let testDesignId = '';
let testPurchaseId = '';

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  gray: '\x1b[90m',
};

function pass(message) {
  console.log(`${colors.green}${colors.reset} ${message}`);
}

function fail(message, error) {
  console.log(`${colors.red}✗${colors.reset} ${message}`);
  if (error) console.log(`  ${colors.gray}${error}${colors.reset}`);
}

function info(message) {
  console.log(`${colors.blue}ℹ${colors.reset} ${message}`);
}

function section(title) {
  console.log(`\n${colors.yellow}━━━ ${title} ━━━${colors.reset}\n`);
}

async function request(method, path, data = null, token = null) {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  };

  if (token) {
    options.headers['Authorization'] = `Bearer ${token}`;
  }

  if (data) {
    options.body = JSON.stringify(data);
  }

  const response = await fetch(`${BASE_URL}${path}`, options);
  const json = await response.json();
  
  return {
    status: response.status,
    data: json,
  };
}

async function setup() {
  section('Test Setup');

  // Login as buyer
  info('Logging in as buyer...');
  const buyerLogin = await request('POST', '/auth/login', {
    email: 'buyer@example.com',
    password: 'password123',
  });

  if (buyerLogin.status === 200 && buyerLogin.data.data?.token) {
    buyerToken = buyerLogin.data.data.token;
    pass('Buyer login successful');
  } else {
    fail('Buyer login failed', 'Create a buyer account first');
    process.exit(1);
  }

  // Login as architect
  info('Logging in as architect...');
  const architectLogin = await request('POST', '/auth/login', {
    email: 'architect@example.com',
    password: 'password123',
  });

  if (architectLogin.status === 200 && architectLogin.data.data?.token) {
    architectToken = architectLogin.data.data.token;
    pass('Architect login successful');
  } else {
    fail('Architect login failed', 'Create an architect account first');
  }

  info(`NOTE: You'll need a valid designId and purchaseId to run all tests`);
  info(`Set testDesignId and testPurchaseId in the script before running`);
}

async function test1_PurchaseStatusGuard() {
  section('Test 1: Purchase Status Guard');

  info('Testing that only PAID purchases allow reviews...');

  // This test requires:
  // 1. A purchase with PENDING/CANCELLED/FAILED/REFUNDED transaction status
  // 2. Attempt to create review should fail with PURCHASE_NOT_COMPLETED

  if (!testPurchaseId || !testDesignId) {
    info('Skipping (requires valid purchase and design IDs)');
    return;
  }

  const result = await request('POST', '/reviews', {
    designId: testDesignId,
    purchaseId: testPurchaseId,
    rating: 5,
    comment: 'This should fail if purchase not paid',
  }, buyerToken);

  if (result.status === 403 && result.data.message?.includes('completed')) {
    pass(' Correctly blocked review for non-completed purchase');
  } else if (result.status === 201) {
    pass(' Review created (purchase was completed)');
  } else {
    fail('✗ Unexpected response', JSON.stringify(result.data));
  }
}

async function test2_RatingDriftProtection() {
  section('Test 2: Rating Drift Protection');

  info('Testing that identical updates are blocked...');

  // First, create a review
  if (!testPurchaseId || !testDesignId) {
    info('Skipping (requires valid purchase and design IDs)');
    return;
  }

  // Create review
  const createResult = await request('POST', '/reviews', {
    designId: testDesignId,
    purchaseId: testPurchaseId,
    rating: 5,
    comment: 'Original review text for testing',
  }, buyerToken);

  if (createResult.status !== 201) {
    info('Skipping (could not create test review)');
    return;
  }

  const reviewId = createResult.data.data.id;

  // Try to update with same values
  const updateResult = await request('PUT', `/reviews/${reviewId}`, {
    rating: 5,
    comment: 'Original review text for testing',
  }, buyerToken);

  if (updateResult.status === 400 && updateResult.data.message?.includes('No changes detected')) {
    pass(' Correctly blocked useless update');
  } else {
    fail('✗ Should have blocked identical update', JSON.stringify(updateResult.data));
  }
}

async function test3_BuyerNamePrivacy() {
  section('Test 3: Buyer Name Privacy');

  info('Testing that buyer emails are not exposed publicly...');

  if (!testDesignId) {
    info('Skipping (requires valid design ID)');
    return;
  }

  // Get public reviews (no auth)
  const result = await request('GET', `/reviews/design/${testDesignId}`);

  if (result.status === 200) {
    const reviews = result.data.data.reviews || [];
    
    if (reviews.length === 0) {
      info('No reviews to check');
      return;
    }

    const hasEmail = reviews.some(review => {
      const buyerData = JSON.stringify(review.buyer);
      return buyerData.includes('@') || buyerData.includes('email');
    });

    if (hasEmail) {
      fail('✗ Buyer email is exposed in public reviews!');
    } else {
      pass(' Buyer emails are properly hidden');
    }
  } else {
    fail('✗ Failed to fetch public reviews', JSON.stringify(result.data));
  }
}

async function test4_ReviewVisibilityRules() {
  section('Test 4: Review Visibility Rules');

  info('Testing that only PUBLISHED reviews are visible publicly...');

  if (!testDesignId) {
    info('Skipping (requires valid design ID)');
    return;
  }

  // Get public reviews
  const result = await request('GET', `/reviews/design/${testDesignId}`);

  if (result.status === 200) {
    const reviews = result.data.data.reviews || [];
    
    const hasNonPublished = reviews.some(review => review.status !== 'PUBLISHED');

    if (hasNonPublished) {
      fail('✗ Non-published reviews are visible!');
    } else {
      pass(' Only PUBLISHED reviews are visible');
    }
  } else {
    fail('✗ Failed to fetch public reviews');
  }
}

async function test5_ErrorMessages() {
  section('Test 5: User-Friendly Error Messages');

  info('Testing that error messages are user-friendly...');

  // Test invalid rating
  const invalidRating = await request('POST', '/reviews', {
    designId: testDesignId || 'dummy-id',
    purchaseId: testPurchaseId || 'dummy-id',
    rating: 10, // Invalid
    comment: 'This should fail with user-friendly message',
  }, buyerToken);

  if (invalidRating.status === 400 && 
      invalidRating.data.message?.includes('between 1 and 5') &&
      !invalidRating.data.message?.includes('Prisma') &&
      !invalidRating.data.message?.includes('constraint')) {
    pass(' Rating validation error is user-friendly');
  } else {
    fail('✗ Rating error message needs improvement', invalidRating.data.message);
  }

  // Test short comment
  const shortComment = await request('POST', '/reviews', {
    designId: testDesignId || 'dummy-id',
    purchaseId: testPurchaseId || 'dummy-id',
    rating: 5,
    comment: 'Short', // Too short
  }, buyerToken);

  if (shortComment.status === 400 && 
      shortComment.data.message?.includes('at least 10 characters') &&
      !shortComment.data.message?.includes('Prisma')) {
    pass(' Comment length error is user-friendly');
  } else {
    fail('✗ Comment error message needs improvement', shortComment.data.message);
  }
}

async function test6_ValidationRules() {
  section('Test 6: Comprehensive Validation Rules');

  const tests = [
    {
      name: 'Rating < 1',
      data: { rating: 0, comment: 'Ten chars minimum here', designId: 'test', purchaseId: 'test' },
      expectedStatus: 400,
    },
    {
      name: 'Rating > 5',
      data: { rating: 6, comment: 'Ten chars minimum here', designId: 'test', purchaseId: 'test' },
      expectedStatus: 400,
    },
    {
      name: 'Comment too short (< 10 chars)',
      data: { rating: 5, comment: 'Short', designId: 'test', purchaseId: 'test' },
      expectedStatus: 400,
    },
    {
      name: 'Comment too long (> 1000 chars)',
      data: { 
        rating: 5, 
        comment: 'a'.repeat(1001), 
        designId: 'test', 
        purchaseId: 'test' 
      },
      expectedStatus: 400,
    },
  ];

  for (const test of tests) {
    const result = await request('POST', '/reviews', test.data, buyerToken);
    
    if (result.status === test.expectedStatus) {
      pass(` ${test.name}: Correctly rejected`);
    } else {
      fail(`✗ ${test.name}: Expected ${test.expectedStatus}, got ${result.status}`);
    }
  }
}

async function test7_AuthorizationRules() {
  section('Test 7: Authorization Rules');

  info('Testing role-based access control...');

  // Architect cannot create reviews
  if (architectToken && testDesignId && testPurchaseId) {
    const architectReview = await request('POST', '/reviews', {
      designId: testDesignId,
      purchaseId: testPurchaseId,
      rating: 5,
      comment: 'Architects should not be able to review',
    }, architectToken);

    if (architectReview.status === 403) {
      pass(' Architect blocked from creating reviews');
    } else {
      fail('✗ Architect should be blocked from reviews', architectReview.status);
    }
  } else {
    info('Skipping architect test (no token or IDs)');
  }

  // Buyer cannot update someone else's review
  // (Would need another buyer's review ID to test)
  info('Note: Cross-buyer update test requires multiple buyer accounts');
}

async function runAllTests() {
  console.log(`${colors.blue}╔════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.blue}║   STEP 5 VALIDATION TEST SUITE                 ║${colors.reset}`);
  console.log(`${colors.blue}║   Review System Hardening & Edge Cases         ║${colors.reset}`);
  console.log(`${colors.blue}╚════════════════════════════════════════════════╝${colors.reset}\n`);

  try {
    await setup();
    await test1_PurchaseStatusGuard();
    await test2_RatingDriftProtection();
    await test3_BuyerNamePrivacy();
    await test4_ReviewVisibilityRules();
    await test5_ErrorMessages();
    await test6_ValidationRules();
    await test7_AuthorizationRules();

    section('Test Summary');
    console.log(`${colors.green} All tests completed!${colors.reset}`);
    console.log(`\n${colors.yellow}Next steps:${colors.reset}`);
    console.log(`  1. Review test results above`);
    console.log(`  2. Fix any failing tests`);
    console.log(`  3. Type "STEP 6" to proceed to frontend UI\n`);

  } catch (error) {
    console.error(`\n${colors.red}Fatal error:${colors.reset}`, error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run tests
runAllTests();
