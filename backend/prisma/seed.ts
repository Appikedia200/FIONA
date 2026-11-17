import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Hash passwords
  const adminPassword = await bcrypt.hash('admin123', 10);
  const techPassword = await bcrypt.hash('tech123', 10);

  // Create or update admin user
  const admin = await prisma.user.upsert({
    where: { email: 'admin@fiona.local' },
    update: {
      password: adminPassword,
      status: 'ACTIVE',
      role: 'ADMIN',
    },
    create: {
      email: 'admin@fiona.local',
      fullName: 'System Administrator',
      password: adminPassword,
      role: 'ADMIN',
      status: 'ACTIVE',
    },
  });

  console.log('✅ Admin user created/updated:', admin.email);
  console.log('   Email: admin@fiona.local');
  console.log('   Password: admin123');
  console.log('   Role: ADMIN');
  console.log('   Status: ACTIVE');
  console.log('');

  // Create or update technician user
  const technician = await prisma.user.upsert({
    where: { email: 'tech@fiona.local' },
    update: {
      password: techPassword,
      status: 'ACTIVE',
      role: 'TECHNICIAN',
    },
    create: {
      email: 'tech@fiona.local',
      fullName: 'Test Technician',
      password: techPassword,
      role: 'TECHNICIAN',
      status: 'ACTIVE',
    },
  });

  console.log('✅ Technician user created/updated:', technician.email);
  console.log('   Email: tech@fiona.local');
  console.log('   Password: tech123');
  console.log('   Role: TECHNICIAN');
  console.log('   Status: ACTIVE');
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
