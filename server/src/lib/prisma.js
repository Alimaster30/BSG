import { PrismaClient } from '@prisma/client';

let prisma = null;

export function getPrisma() {
  if (!process.env.DATABASE_URL) {
    return null;
  }

  if (!prisma) {
    prisma = new PrismaClient();
  }

  return prisma;
}
