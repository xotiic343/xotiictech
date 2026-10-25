import { Suspense } from "react";
import { prisma } from "@/lib/support/db";
import { requireStaff } from "@/lib/support/staff";
import { getDashboardMetrics } from "@/lib/support/metrics";
import { formatDuration } from "@/lib/support/tickets";
import { SupportStat } from "@/components/support/SupportStat";
import { BarList } from "@/components/support/BarList";
import { ActivityFeed } from "@/components/support/ActivityFeed";
import { BlockSkeleton, StatsSkeleton } from "@/components/support/Skeletons";

export default async function ExoticDashboard() {
  await requireStaff();

  return (
    <div className="space-y-8">
      <header>
        <div className="eyebrow mb-2">// staff panel</div>
        <h1 className="h-display text-2xl sm:text-3xl">Dashboard</h1>
      </header>

      <Suspense fallback={<StatsSkeleton count={6} />}>
        <Overview />
      </Suspense>

      <section aria-labelledby="activity-heading">
        <h2 id="activity-heading" className="eyebrow mb-3">
          // recent activity
        </h2>
        <Suspense fallback={<BlockSkeleton className="h-72" />}>
          <RecentActivity />
        </Suspense>
      </section>
    </div>
  );
}

async function Overview() {
  const m = await getDashboardMetrics();
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
        <SupportStat label="Open now" value={m.open} />
        <SupportStat label="Today" value={m.today} />
        <SupportStat label="This week" value={m.week} />
        <SupportStat label="This month" value={m.month} />
        <SupportStat label="Avg 1st response" value={formatDuration(m.avgFirstResponseMs)} hint="30 days" />
        <SupportStat label="Avg resolution" value={formatDuration(m.avgResolutionMs)} hint="30 days" />
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <BarList title="by category" rows={m.byCategory} />
        <BarList title="by status" rows={m.byState} colorByName />
      </div>
    </div>
  );
}

async function RecentActivity() {
  const entries = await prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 25 });
  return <ActivityFeed entries={entries.map((e) => ({ ...e, createdAt: e.createdAt.toISOString() }))} />;
}
