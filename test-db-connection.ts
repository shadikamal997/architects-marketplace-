/**
 * Database Connection Test
 * 
 * Tests Prisma connection to PostgreSQL database
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testConnection() {
  console.log('🔍 Testing database connection...\n');
  
  try {
    // Test database connection
    await prisma.$connect();
    console.log(' Database connection successful!\n');
    
    // Test query execution
    console.log('🔍 Testing query execution...');
    const result = await prisma.$queryRaw`SELECT version()`;
    console.log(' Query executed successfully!');
    console.log('📊 PostgreSQL Version:', result);
    
    return true;
  } catch (error: any) {
    console.error(' Database connection failed!');
    console.error('Error:', error.message);
    
    if (error.message.includes('Can\'t reach database server')) {
      console.error('\n💡 Troubleshooting:');
      console.error('1. Check DATABASE_URL in .env file');
      console.error('2. Verify Supabase database is running');
      console.error('3. Check database credentials');
      console.error('4. Verify network connectivity');
    }
    
    return false;
  } finally {
    await prisma.$disconnect();
  }
}

// Run test
testConnection()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });
