// Seeds the /support ticket categories. Safe to run on every deploy: rows are upserted by key.
// Plain JavaScript (not TypeScript) so it runs with `node` and needs no extra tooling.
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const categories = [
  { key: 'support', label: 'Support', description: 'General help and questions', sortOrder: 1 },
  { key: 'report', label: 'Report', description: 'Report a user, bug or issue', sortOrder: 2 },
  { key: 'purchase', label: 'Purchase', description: 'Billing, orders and purchases', sortOrder: 3 },
  { key: 'appeal', label: 'Appeal', description: 'Appeal a punishment or decision', sortOrder: 4 },
];

try {
  for (const c of categories) {
    await prisma.ticketCategory.upsert({ where: { key: c.key }, update: c, create: c });
  }
  console.log(`[support] seeded ${categories.length} ticket categories`);
} catch (err) {
  console.error('[support] seed failed', err);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
