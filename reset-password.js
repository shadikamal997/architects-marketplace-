const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function resetPassword() {
  const email = 'test@test.com';
  const newPassword = 'password123';
  
  console.log(`\n🔧 Resetting password for ${email}...`);
  
  const hashedPassword = await bcrypt.hash(newPassword, 10);
  
  await prisma.user.update({
    where: { email },
    data: { password: hashedPassword },
  });
  
  console.log(` Password reset successfully!`);
  console.log(`\nLogin credentials:`);
  console.log(`  Email: ${email}`);
  console.log(`  Password: ${newPassword}`);
  console.log(`\nGo to: http://localhost:3000/login\n`);
  
  await prisma.$disconnect();
}

resetPassword().catch(console.error);
