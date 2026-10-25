import { prisma } from "@/lib/support/db";
import { requireStaff } from "@/lib/support/staff";
import { ActivityFeed } from "@/components/support/ActivityFeed";

// Read-only by design: nothing in the UI can edit or delete audit entries.
export default async function AuditPage() {
  await requireStaff();
  const entries = await prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 200 });

  return (
    <div className="space-y-6">
      <header>
        <div className="eyebrow mb-2">// compliance</div>
        <h1 className="h-display text-2xl sm:text-3xl">Audit log</h1>
        <p className="mt-2 text-sm text-muted">Every staff action and bot event, newest first. The latest 200 are shown.</p>
      </header>
      <ActivityFeed entries={entries.map((e) => ({ ...e, createdAt: e.createdAt.toISOString() }))} />
    </div>
  );
}
