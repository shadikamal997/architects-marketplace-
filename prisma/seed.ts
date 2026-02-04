import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Clear existing data
  await prisma.purchase.deleteMany();
  await prisma.design.deleteMany();
  await prisma.architect.deleteMany();
  await prisma.buyer.deleteMany();
  await prisma.user.deleteMany();

  // Create demo users with hashed passwords
  const hashedPassword = await bcrypt.hash('password123', 10);

  // Create Architect User
  const architectUser = await prisma.user.create({
    data: {
      email: 'architect@example.com',
      name: 'John Smith',
      password: hashedPassword,
      role: 'ARCHITECT',
      architect: {
        create: {
          displayName: 'John Smith Architecture'
        }
      }
    },
    include: {
      architect: true
    }
  });

  // Create Buyer User
  const buyerUser = await prisma.user.create({
    data: {
      email: 'buyer@example.com',
      name: 'Jane Doe',
      password: hashedPassword,
      role: 'BUYER',
      buyer: {
        create: {}
      }
    },
    include: {
      buyer: true
    }
  });

  // Create Admin User
  const adminUser = await prisma.user.create({
    data: {
      email: 'admin@example.com',
      name: 'Admin User',
      password: hashedPassword,
      role: 'ADMIN'
    }
  });

  console.log(' Created demo users (architect@example.com, buyer@example.com, admin@example.com)');
  console.log('  Password for all: password123');

  // Create sample designs
  const designs: any[] = [
    {
      title: 'Modern Residential Villa',
      description: 'Sleek 3-bedroom villa with open-plan living and smart home integration',
      category: 'residential',
      price: 12999.00,
      status: 'PUBLISHED' as const,
      architectId: architectUser.architect!.id,
      previewImageUrl: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&h=600&fit=crop'
    },
    {
      title: 'Commercial Office Building',
      description: 'Contemporary office complex with flexible workspace design',
      category: 'commercial',
      price: 45999.00,
      status: 'PUBLISHED' as const,
      architectId: architectUser.architect!.id,
      previewImageUrl: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&h=600&fit=crop'
    },
    {
      title: 'Minimalist Apartment Interior',
      description: 'Elegant 2-bedroom apartment with Scandinavian minimalist design',
      category: 'interior',
      price: 3999.00,
      status: 'PUBLISHED' as const,
      architectId: architectUser.architect!.id,
      previewImageUrl: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800&h=600&fit=crop'
    },
    {
      title: 'Classical Heritage Restoration',
      description: 'Historic building restoration maintaining period architectural details',
      category: 'residential',
      price: 34999.00,
      status: 'PUBLISHED' as const,
      architectId: architectUser.architect!.id,
      previewImageUrl: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=800&h=600&fit=crop'
    },
    {
      title: 'Landscape Park Masterplan',
      description: 'Large-scale landscape design with recreational facilities and green spaces',
      category: 'landscape',
      price: 28999.00,
      status: 'PUBLISHED' as const,
      architectId: architectUser.architect!.id,
      previewImageUrl: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&h=600&fit=crop'
    },
    {
      title: 'Draft Industrial Loft',
      description: 'Work in progress - converted warehouse into modern loft apartments',
      category: 'residential',
      price: 19999.00,
      status: 'DRAFT' as const,
      architectId: architectUser.architect!.id,
      previewImageUrl: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&h=600&fit=crop'
    }
  ];

  const createdDesigns = [];
  for (const designData of designs) {
    const design = await prisma.design.create({
      data: designData
    });
    createdDesigns.push(design);
  }

  console.log(` Created ${designs.length} sample designs (5 published, 1 draft)`);

  // Create sample purchases
  const publishedDesigns = createdDesigns.filter(d => d.status === 'PUBLISHED').slice(0, 2);
  
  for (const design of publishedDesigns) {
    await prisma.purchase.create({
      data: {
        buyerId: buyerUser.buyer!.id,
        designId: design.id,
        price: design.price
      }
    });
  }

  console.log(` Created ${publishedDesigns.length} sample purchases for buyer`);

  console.log('\n🎉 Database seeded successfully!\n');
  console.log('You can now:');
  console.log('  - Login as architect: architect@example.com / password123');
  console.log('  - Login as buyer: buyer@example.com / password123');
  console.log('  - Login as admin: admin@example.com / password123');
  console.log('\nView data in Prisma Studio: npx prisma studio');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
