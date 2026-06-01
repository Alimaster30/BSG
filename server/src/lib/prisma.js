let prisma = null;

export async function getPrisma() {
  if (!process.env.DATABASE_URL) {
    return null;
  }

  if (!prisma) {
    try {
      const { PrismaClient } = await import('@prisma/client');
      prisma = new PrismaClient();
    } catch (error) {
      console.warn('Prisma client is unavailable; continuing without database persistence:', error.message);
      return null;
    }
  }

  return prisma;
}
