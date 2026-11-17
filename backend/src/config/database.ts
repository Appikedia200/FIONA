import { PrismaClient } from '@prisma/client';

// Prisma Client Singleton
let prisma: PrismaClient;

if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient({ log: [] });
} else {
  // In development, use a global variable to prevent multiple instances
  const globalWithPrisma = global as typeof globalThis & {
    prisma: PrismaClient;
  };

  if (!globalWithPrisma.prisma) {
    globalWithPrisma.prisma = new PrismaClient({ log: [] });
  }

  prisma = globalWithPrisma.prisma;
}

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

export default prisma;
