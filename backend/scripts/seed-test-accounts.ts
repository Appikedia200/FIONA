/**
 * Quick seed script to create admin + technician for testing
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function seed() {
  try {
    console.log("🌱 Seeding test accounts...");

    // Create Admin tenant
    const adminTenant = await prisma.tenant.create({
      data: {
        name: "Admin Tenant",
      },
    });

    console.log("✅ Admin tenant created:", adminTenant.id);

    // Create Admin user
    const hashedAdminPassword = await bcrypt.hash("admin123456", 10);
    const admin = await prisma.user.create({
      data: {
        email: "admin@fiona.local",
        password: hashedAdminPassword,
        role: "ADMIN",
        tenantId: adminTenant.id,
      },
    });

    console.log("✅ Admin account created:", admin.email);

    // Create Technician tenant
    const techTenant = await prisma.tenant.create({
      data: {
        name: "Tech User Tenant",
      },
    });

    console.log("✅ Technician tenant created:", techTenant.id);

    // Create Technician user
    const hashedTechPassword = await bcrypt.hash("tech123456", 10);
    const tech = await prisma.user.create({
      data: {
        email: "tech@test.com",
        password: hashedTechPassword,
        role: "CUSTOMER",
        tenantId: techTenant.id,
      },
    });

    console.log("✅ Technician account created:", tech.email);

    console.log("\n🎉 Seed complete!");
    console.log("\n📋 Test Accounts:");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("ADMIN:");
    console.log("  Email: admin@fiona.local");
    console.log("  Password: admin123456");
    console.log("  Login: http://localhost:3000/admin/login");
    console.log("\nTECHNICIAN:");
    console.log("  Email: tech@test.com");
    console.log("  Password: tech123456");
    console.log("  Login: http://localhost:3000/login");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  } catch (error) {
    console.error("❌ Seed failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

seed();
