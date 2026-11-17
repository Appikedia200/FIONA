const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkUsers() {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        role: true,
        tenantId: true,
        createdAt: true,
      },
    });

    const tenants = await prisma.tenant.findMany({
      select: {
        id: true,
        name: true,
        createdAt: true,
      },
    });

    console.log('\n📊 DATABASE STATUS:\n');
    console.log(`Total Tenants: ${tenants.length}`);
    console.log(`Total Users: ${users.length}\n`);

    if (tenants.length > 0) {
      console.log('✅ TENANTS:');
      tenants.forEach(t => {
        console.log(`  - ${t.name} (ID: ${t.id.substring(0, 8)}...)`);
      });
    } else {
      console.log('❌ NO TENANTS FOUND');
    }

    console.log('');

    if (users.length > 0) {
      console.log('✅ USERS:');
      users.forEach(u => {
        console.log(`  - ${u.email} | ${u.role} | Tenant: ${u.tenantId.substring(0, 8)}...`);
      });
    } else {
      console.log('❌ NO USERS FOUND');
    }

    await prisma.$disconnect();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkUsers();
