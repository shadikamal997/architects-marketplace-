const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function removeDemoData() {
  console.log('🗑️  Removing demo designs and associated data...');

  // Demo design titles to remove
  const demoTitles = [
    'Modern Residential Villa',
    'Commercial Office Building',
    'Minimalist Apartment Interior',
    'Classical Heritage Restoration',
    'Landscape Park Masterplan',
    'Draft Industrial Loft'
  ];

  // First, delete purchases associated with demo designs
  const demoDesigns = await prisma.design.findMany({
    where: { title: { in: demoTitles } },
    select: { id: true, title: true }
  });

  const demoDesignIds = demoDesigns.map(d => d.id);

  if (demoDesignIds.length > 0) {
    // Delete purchases first
    await prisma.purchase.deleteMany({
      where: { designId: { in: demoDesignIds } }
    });
    console.log('✅ Deleted associated purchases');

    // Then delete the designs
    await prisma.design.deleteMany({
      where: { title: { in: demoTitles } }
    });
    console.log('✅ Deleted demo designs');
  }

  // Check remaining designs
  const remainingDesigns = await prisma.design.findMany({
    select: { id: true, title: true, status: true }
  });

  console.log(`\n📋 Remaining designs (${remainingDesigns.length}):`);
  remainingDesigns.forEach(d => console.log(`- ${d.title} (${d.status})`));

  await prisma.$disconnect();
}

removeDemoData().catch(console.error);