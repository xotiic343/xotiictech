// Single Prisma client for /support. Kept on globalThis in dev so hot reloads don't open new pools.
import "server-only";
import { PrismaClient } from "@prisma/client";
import { supportDbUrl } from "./dbUrl.mjs";

const globalForPrisma = globalThis as unknown as { supportPrisma?: PrismaClient };

export const prisma =
  globalForPrisma.supportPrisma ??
  new PrismaClient({
    // Always the "support" schema, even if the env var forgot ?schema=support.
    datasourceUrl: supportDbUrl(process.env.SUPPORT_DATABASE_URL),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.supportPrisma = prisma;
