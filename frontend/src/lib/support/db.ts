// Single Prisma client for /support. Kept on globalThis in dev so hot reloads don't open new pools.
import "server-only";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { supportPrisma?: PrismaClient };

export const prisma =
  globalForPrisma.supportPrisma ??
  new PrismaClient({ log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"] });

if (process.env.NODE_ENV !== "production") globalForPrisma.supportPrisma = prisma;
