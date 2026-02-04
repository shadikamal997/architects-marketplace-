const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-dev-secret-do-not-use-in-production';

async function diagnose() {
  console.log('\n🔍 DATABASE DIAGNOSTIC\n' + '='.repeat(50));
  
  // Get all users
  const users = await prisma.user.findMany({
    include: {
      architect: true,
      buyer: true,
    },
  });

  console.log(`\n📊 Total users in database: ${users.length}\n`);

  users.forEach((user, index) => {
    console.log(`User ${index + 1}:`);
    console.log(`  ID: ${user.id}`);
    console.log(`  Email: ${user.email}`);
    console.log(`  Role: ${user.role}`);
    console.log(`  Has Architect: ${!!user.architect}`);
    console.log(`  Has Buyer: ${!!user.buyer}`);
    if (user.architect) console.log(`  Architect ID: ${user.architect.id}`);
    if (user.buyer) console.log(`  Buyer ID: ${user.buyer.id}`);
    console.log('');
  });

  // Check for broken accounts
  const architectUsers = users.filter(u => u.role === 'ARCHITECT' && !u.architect);
  const buyerUsers = users.filter(u => u.role === 'BUYER' && !u.buyer);

  if (architectUsers.length > 0) {
    console.log(`\n  ${architectUsers.length} ARCHITECT users missing architect record:`);
    architectUsers.forEach(u => console.log(`   - ${u.email} (ID: ${u.id})`));
  }

  if (buyerUsers.length > 0) {
    console.log(`\n  ${buyerUsers.length} BUYER users missing buyer record:`);
    buyerUsers.forEach(u => console.log(`   - ${u.email} (ID: ${u.id})`));
  }

  if (architectUsers.length === 0 && buyerUsers.length === 0) {
    console.log('\n All users have correct records!\n');
  } else {
    console.log('\n Found broken accounts - run fix script!\n');
  }

  console.log('='.repeat(50));
  await prisma.$disconnect();
}

diagnose().catch(console.error);
