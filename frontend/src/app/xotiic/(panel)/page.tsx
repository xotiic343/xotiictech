"use client";

import Link from "next/link";
import { Badge, PageTitle, Panel, Table, statusTone, useAdmin } from "@/components/admin/kit";
import { compact, dateTime, money } from "@/lib/format";

type Dash = {
  stats: Record<string, number>;
  revenue_cents: Record<string, number>;
  orders_30d: number;
  views_30d: number;
  unpublished_bots: number;
  new_inquiries: number;
  new_messages: number;
  hosting_requests: number;
  stripe_mode: string;
  recent_orders: { id: number; email: string; product_name: string; amount_cents: number; currency: string; status: string; created_at: string }[];
};

export default function Dashboard() {
  const { data } = useAdmin<Dash>("/dashboard");
  if (!data) return <div className="text-sm text-muted">loading…</div>;
  const revenue = Object.entries(data.revenue_cents).map(([cur, c]) => money(c, cur)).join(" + ") || "$0.00";

  const alerts = [
    data.unpublished_bots > 0 && { href: "/xotiic/bots", text: `${data.unpublished_bots} new bot(s) waiting in the inbox` },
    data.new_inquiries > 0 && { href: "/xotiic/inquiries", text: `${data.new_inquiries} new commission request(s)` },
    data.hosting_requests > 0 && { href: "/xotiic/orders", text: `${data.hosting_requests} hosting request(s) to approve` },
    data.new_messages > 0 && { href: "/xotiic/messages", text: `${data.new_messages} unread contact message(s)` },
  ].filter(Boolean) as { href: string; text: string }[];

  return (
    <div className="space-y-6">
      <PageTitle title="Dashboard">
        <Badge tone={data.stripe_mode === "live" ? "ok" : "warn"}>stripe {data.stripe_mode}</Badge>
      </PageTitle>

      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((a) => (
            <Link key={a.href} href={a.href} className="flex items-center justify-between border border-blood/50 bg-blood/5 px-4 py-2.5 text-sm text-blood hover:bg-blood/10">
              <span>● {a.text}</span>
              <span>→</span>
            </Link>
          ))}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Tile label="Revenue (all time)" value={revenue} />
        <Tile label="Orders / 30d" value={data.orders_30d} />
        <Tile label="Page views / 30d" value={compact(data.views_30d)} />
        <Tile label="Clients" value={data.stats.clients} />
        <Tile label="Bots live" value={`${data.stats.bots_online}/${data.stats.bots_deployed}`} />
        <Tile label="Servers reached" value={compact(data.stats.servers_reached)} />
        <Tile label="Commands" value={data.stats.total_commands} />
        <Tile label="Products sold" value={data.stats.products_sold} />
      </div>

      <Panel title="Recent orders" actions={<Link href="/xotiic/orders" className="text-xs text-blood">all →</Link>}>
        <Table head={["When", "Email", "Product", "Amount", "Status"]} empty={!data.recent_orders.length}>
          {data.recent_orders.map((o) => (
            <tr key={o.id}>
              <td className="px-4 py-2.5 text-xs text-muted">{dateTime(o.created_at)}</td>
              <td className="px-4 py-2.5">{o.email}</td>
              <td className="px-4 py-2.5 text-white">{o.product_name}</td>
              <td className="px-4 py-2.5">{money(o.amount_cents, o.currency)}</td>
              <td className="px-4 py-2.5">
                <Badge tone={statusTone(o.status)}>{o.status}</Badge>
              </td>
            </tr>
          ))}
        </Table>
      </Panel>
    </div>
  );
}

function Tile({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="border border-line bg-ink p-4">
      <div className="text-[10px] uppercase tracking-[0.2em] text-dim">{label}</div>
      <div className="mt-1 font-display text-2xl font-bold text-white">{value ?? "—"}</div>
    </div>
  );
}
