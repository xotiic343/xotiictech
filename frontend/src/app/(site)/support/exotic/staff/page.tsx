import { EmptyState } from "@/components/ui";
import { requireStaff } from "@/lib/support/staff";
import { getStaffLeaderboard } from "@/lib/support/metrics";
import { formatDuration } from "@/lib/support/tickets";

export default async function StaffStatsPage() {
  await requireStaff();
  const rows = await getStaffLeaderboard();

  return (
    <div className="space-y-6">
      <header>
        <div className="eyebrow mb-2">// team</div>
        <h1 className="h-display text-2xl sm:text-3xl">Staff stats</h1>
      </header>

      {rows.length === 0 ? (
        <EmptyState title="No closed tickets yet">Per-staff numbers appear once tickets are closed.</EmptyState>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[32rem] text-left text-sm">
            <thead className="border-b border-line text-[11px] uppercase tracking-[0.2em] text-muted">
              <tr>
                <th scope="col" className="px-5 py-3 font-normal">Staff</th>
                <th scope="col" className="px-5 py-3 font-normal">Closed</th>
                <th scope="col" className="px-5 py-3 font-normal">Claimed</th>
                <th scope="col" className="px-5 py-3 font-normal">Avg 1st response</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.staffId} className="border-b border-line last:border-0 hover:bg-crimson/5">
                  <td className="px-5 py-3 text-white">{r.name}</td>
                  <td className="px-5 py-3 tabular-nums text-blood">{r.closed}</td>
                  <td className="px-5 py-3 tabular-nums">{r.claimed}</td>
                  <td className="px-5 py-3 tabular-nums text-muted">{formatDuration(r.avgFirstResponseMs)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
