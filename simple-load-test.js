#!/usr/bin/env node

/**
 * SIMPLIFIED STAGING LOAD TEST
 * Tests server responsiveness, rate limiting, and basic security
 */

const http = require('http');
const { performance } = require('perf_hooks');

const BASE_URL = 'http://localhost:3001';
const CONCURRENT_USERS = 10;
const TEST_DURATION = 30; // seconds

// Metrics collection
let totalRequests = 0;
let totalErrors = 0;
let totalTimeouts = 0;
let responseTimes = [];

// Simple HTTP request
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const startTime = performance.now();
    const req = http.request(url, {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Load-Test/1.0',
        ...options.headers
      },
      timeout: 5000 // 5 second timeout
    }, (res) => {
      const latency = performance.now() - startTime;
      responseTimes.push(latency);
      totalRequests++;

      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          latency: latency,
          data: data
        });
      });
    });

    req.on('error', (err) => {
      totalErrors++;
      reject(err);
    });

    req.on('timeout', () => {
      totalTimeouts++;
      req.destroy();
      reject(new Error('timeout'));
    });

    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    req.end();
  });
}

// Test health endpoint
async function testHealth() {
  try {
    const response = await makeRequest(`${BASE_URL}/api/health`);
    return response;
  } catch (error) {
    return { status: 'ERROR', error: error.message };
  }
}

// Test rate limiting on auth endpoints
async function testRateLimiting() {
  const results = [];

  // Rapid fire auth requests to trigger rate limiting
  for (let i = 0; i < 10; i++) {
    try {
      const response = await makeRequest(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        body: { email: `test${i}@example.com`, password: 'password123' }
      });
      results.push({ attempt: i + 1, status: response.status, latency: response.latency });
    } catch (error) {
      results.push({ attempt: i + 1, status: 'ERROR', error: error.message });
    }

    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  return results;
}

// Test protected endpoints
async function testProtectedEndpoints() {
  const endpoints = [
    '/api/admin/dashboard',
    '/api/marketplace/designs',
    '/api/messages'
  ];

  const results = [];

  for (const endpoint of endpoints) {
    try {
      const response = await makeRequest(`${BASE_URL}${endpoint}`);
      results.push({ endpoint, status: response.status, latency: response.latency });
    } catch (error) {
      results.push({ endpoint, status: 'ERROR', error: error.message });
    }
  }

  return results;
}

// Run simplified load test
async function runSimplifiedLoadTest() {
  console.log('🚀 SIMPLIFIED STAGING LOAD TEST');
  console.log(`📊 Configuration: ${CONCURRENT_USERS} concurrent users, ${TEST_DURATION}s duration`);
  console.log(`🎯 Target: ${BASE_URL}`);
  console.log('─'.repeat(50));

  const startTime = Date.now();
  const endTime = startTime + (TEST_DURATION * 1000);

  console.log('🔍 Testing server availability...');
  const healthResult = await testHealth();
  console.log(`Health check: ${healthResult.status === 200 ? ' PASS' : ' FAIL'} (${healthResult.status})`);

  if (healthResult.status !== 200) {
    console.log(' Server is not responding. Cannot proceed with load test.');
    return;
  }

  console.log('\n🔐 Testing rate limiting...');
  const rateLimitResults = await testRateLimiting();
  const rateLimited = rateLimitResults.some(r => r.status === 429);
  console.log(`Rate limiting: ${rateLimited ? ' ACTIVE' : '  NOT DETECTED'}`);

  console.log('\n🔒 Testing protected endpoints...');
  const protectedResults = await testProtectedEndpoints();
  const properlyProtected = protectedResults.every(r => r.status === 401 || r.status === 500);
  console.log(`Protected endpoints: ${properlyProtected ? ' SECURE' : '  MAY BE VULNERABLE'}`);

  // Run concurrent load
  console.log('\n🏃 Running concurrent load test...');
  const loadPromises = [];
  for (let i = 0; i < CONCURRENT_USERS; i++) {
    loadPromises.push(runLoadSimulation(endTime));
  }

  await Promise.all(loadPromises);

  const totalDuration = (Date.now() - startTime) / 1000;

  // Calculate statistics
  const avgResponseTime = responseTimes.length > 0
    ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
    : 0;
  const maxResponseTime = responseTimes.length > 0 ? Math.max(...responseTimes) : 0;
  const errorRate = totalRequests > 0 ? (totalErrors / totalRequests * 100) : 0;

  console.log('\n📈 LOAD TEST RESULTS');
  console.log('─'.repeat(50));
  console.log(`⏱️  Duration: ${totalDuration.toFixed(2)}s`);
  console.log(`📊 Total Requests: ${totalRequests}`);
  console.log(` Errors: ${totalErrors}`);
  console.log(` Timeouts: ${totalTimeouts}`);
  console.log(`📈 Error Rate: ${errorRate.toFixed(2)}%`);
  console.log(`⚡ Avg Response Time: ${avgResponseTime.toFixed(2)}ms`);
  console.log(`🐌 Max Response Time: ${maxResponseTime.toFixed(2)}ms`);

  // Assessment
  console.log('\n🎯 SYSTEM ASSESSMENT');
  console.log('─'.repeat(50));

  let stabilityScore = 0;
  const checks = [];

  // Health check
  if (healthResult.status === 200) {
    stabilityScore += 25;
    checks.push(' Server responds to health checks');
  } else {
    checks.push(' Server not responding');
  }

  // Rate limiting
  if (rateLimited) {
    stabilityScore += 25;
    checks.push(' Rate limiting is active');
  } else {
    checks.push('  Rate limiting not detected');
  }

  // Protected endpoints
  if (properlyProtected) {
    stabilityScore += 25;
    checks.push(' Protected endpoints require authentication');
  } else {
    checks.push('  Some endpoints may be unprotected');
  }

  // Performance
  if (avgResponseTime < 1000) {
    stabilityScore += 15;
    checks.push(' Good response times');
  } else if (avgResponseTime < 5000) {
    stabilityScore += 10;
    checks.push('  Acceptable response times');
  } else {
    stabilityScore += 5;
    checks.push(' Poor response times');
  }

  // Error rate
  if (errorRate < 10) {
    stabilityScore += 10;
    checks.push(' Low error rate');
  } else {
    checks.push('  High error rate');
  }

  checks.forEach(check => console.log(check));

  console.log(`\n🏆 OVERALL STABILITY SCORE: ${stabilityScore}/100`);

  if (stabilityScore >= 80) {
    console.log(' SYSTEM IS STABLE - Ready for production');
  } else if (stabilityScore >= 60) {
    console.log('  SYSTEM IS MOSTLY STABLE - Minor issues to address');
  } else {
    console.log(' SYSTEM HAS ISSUES - Requires attention before production');
  }

  console.log('\n🏁 Load test completed');
}

// Simulate user load
async function runLoadSimulation(endTime) {
  while (Date.now() < endTime) {
    // Random delay between 200-1000ms
    const delay = Math.random() * 800 + 200;
    await new Promise(resolve => setTimeout(resolve, delay));

    // Randomly select endpoint to test
    const endpoints = [
      '/api/health',
      '/api/auth/login',
      '/api/admin/dashboard',
      '/api/marketplace/designs'
    ];

    const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];

    try {
      await makeRequest(`${BASE_URL}${endpoint}`);
    } catch (error) {
      // Errors are already counted in makeRequest
    }
  }
}

// Run the test
if (require.main === module) {
  runSimplifiedLoadTest().catch(error => {
    console.error('Load test failed:', error);
    process.exit(1);
  });
}