"use client";

import { useState } from "react";
import { PageTitle, Panel, Table, useAdmin } from "@/components/admin/kit";
import { compact, money } from "@/lib/format";

type Day = { date: string; views: number; sales: number; revenue_cents: number };
type Analytics = {
  days: Day[];
  totals: { views: number; sales: number; revenue_cents: number };
  top_products: { name: string; sales: number; revenue_cents: number }[];
  top_bots: { name: string; slug: string; views: number }[];
  top_pages: { path: string; views: number }[];
};

export default function AnalyticsAdmin() {
  const [days, setDays] = useState(30);
  const { data } = useAdmin<Analytics>(`/analytics?days=${days}`);

  return (
    <div className="space-y-6">
      <PageTitle title="Analytics">
        {[7, 30, 90, 365].map((d) => (
          <button key={d} onClick={() => setDays(d)} className={`btn-sm border ${days === d ? "border-blood text-blood" : "border-edge text-muted"}`}>
            {d}d
          </button>
        ))}
      </PageTitle>
      {data && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Tile label="Page views" value={compact(data.totals.views)} />
            <Tile label="Sales" value={data.totals.sales} />
            <Tile label="Revenue" value={money(data.totals.revenue_cents)} />
          </div>
          {/* One measure per chart: views and revenue have different scales, so they never share an axis. */}
          <BarChart title="Page views per day" days={data.days} value={(d) => d.views} format={(v) => `${v} views`} />
          <BarChart title="Revenue per day" days={data.days} value={(d) => d.revenue_cents} format={(v) => money(v)} />
          <div className="grid gap-6 xl:grid-cols-3">
            <Panel title="Top products">
              <Table head={["Product", "Sales", "Revenue"]} empty={!data.top_products.length}>
                {data.top_products.map((p) => (
                  <tr key={p.name}>
                    <td className="px-4 py-2 text-white">{p.name}</td>
                    <td className="px-4 py-2">{p.sales}</td>
                    <td className="px-4 py-2">{money(p.revenue_cents)}</td>
                  </tr>
                ))}
              </Table>
            </Panel>
            <Panel title="Top bots (page views)">
              <Table head={["Bot", "Views"]} empty={!data.top_bots.length}>
                {data.top_bots.map((b) => (
                  <tr key={b.slug}>
                    <td className="px-4 py-2 text-white">{b.name}</td>
                    <td className="px-4 py-2">{b.views}</td>
                  </tr>
                ))}
              </Table>
            </Panel>
            <Panel title="Top pages">
              <Table head={["Path", "Views"]} empty={!data.top_pages.length}>
                {data.top_pages.map((p) => (
                  <tr key={p.path}>
                    <td className="px-4 py-2 font-mono text-xs text-white">{p.path}</td>
                    <td className="px-4 py-2">{p.views}</td>
                  </tr>
                ))}
              </Table>
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}

function Tile({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="border border-line bg-ink p-4">
      <div className="text-[10px] uppercase tracking-[0.2em] text-dim">{label}</div>
      <div className="mt-1 font-display text-2xl font-bold text-white">{value}</div>
    </div>
  );
}

/** Single-series daily bars: thin marks, 2px gaps, rounded data-ends on the baseline, hover tooltip. */
function BarChart({ title, days, value, format }: { title: string; days: Day[]; value: (d: Day) => number; format: (v: number) => string }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...days.map(value));
  const h = hover !== null ? days[hover] : null;
  return (
    <Panel title={title} actions={<span className="text-xs text-muted">{h ? `${h.date} · ${format(value(h))}` : `peak ${format(max)}`}</span>}>
      <div className="p-4">
        <div className="relative flex h-40 items-end gap-[2px] border-b border-l border-line" onMouseLeave={() => setHover(null)} role="img" aria-label={title}>
          {/* recessive gridline at 50% */}
          <div className="pointer-events-none absolute inset-x-0 top-1/2 border-t border-dashed border-line" />
          {days.map((d, i) => {
            const v = value(d);
            return (
              <div key={d.date} className="flex h-full flex-1 items-end" onMouseEnter={() => setHover(i)}>
                <div
                  className={`w-full rounded-t-[4px] transition-colors ${hover === i ? "bg-blood" : "bg-crimson/70"}`}
                  style={{ height: `${(v / max) * 100}%`, minHeight: v > 0 ? 2 : 0 }}
                />
              </div>
            );
          })}
        </div>
        <div className="mt-1 flex justify-between text-[10px] text-dim">
          <span>{days[0]?.date}</span>
          <span>{days[days.length - 1]?.date}</span>
        </div>
      </div>
    </Panel>
  );
}
