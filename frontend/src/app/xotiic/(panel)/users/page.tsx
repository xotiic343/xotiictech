"use client";

import { Badge, PageTitle, Panel, Table, useAdmin } from "@/components/admin/kit";
import { dateTime } from "@/lib/format";

type User = { id: number; email: string; name: string | null; has_password: boolean; orders: number; created_at: string; last_login_at: string | null; is_active: boolean };
type Sub = { id: number; email: string; source: string | null; created_at: string; unsubscribed_at: string | null };

export default function UsersAdmin() {
  const users = useAdmin<{ items: User[] }>("/users");
  const subs = useAdmin<{ items: Sub[] }>("/newsletter");
  const active = (subs.data?.items ?? []).filter((s) => !s.unsubscribed_at);

  return (
    <div className="space-y-8">
      <PageTitle title="Users & subscribers" />
      <Panel title={`Buyers (${users.data?.items.length ?? "…"})`}>
        <Table head={["Email", "Name", "Paid orders", "Login", "Created", "Last login"]} empty={!users.data?.items.length}>
          {(users.data?.items ?? []).map((u) => (
            <tr key={u.id}>
              <td className="px-4 py-2.5 text-white">{u.email}</td>
              <td className="px-4 py-2.5">{u.name ?? "—"}</td>
              <td className="px-4 py-2.5">{u.orders}</td>
              <td className="px-4 py-2.5">{u.has_password ? <Badge tone="info">password</Badge> : <Badge>magic link</Badge>}</td>
              <td className="px-4 py-2.5 text-xs text-muted">{dateTime(u.created_at)}</td>
              <td className="px-4 py-2.5 text-xs text-muted">{dateTime(u.last_login_at)}</td>
            </tr>
          ))}
        </Table>
      </Panel>
      <Panel
        title={`Newsletter (${active.length} active)`}
        actions={
          <a href="/api/admin/newsletter.csv" className="text-xs text-blood hover:text-white">
            export CSV ↓
          </a>
        }
      >
        <Table head={["Email", "Source", "Subscribed", "State"]} empty={!subs.data?.items.length}>
          {(subs.data?.items ?? []).map((s) => (
            <tr key={s.id}>
              <td className="px-4 py-2.5 text-white">{s.email}</td>
              <td className="px-4 py-2.5 text-muted">{s.source ?? "—"}</td>
              <td className="px-4 py-2.5 text-xs text-muted">{dateTime(s.created_at)}</td>
              <td className="px-4 py-2.5">{s.unsubscribed_at ? <Badge>unsubscribed</Badge> : <Badge tone="ok">active</Badge>}</td>
            </tr>
          ))}
        </Table>
      </Panel>
    </div>
  );
}
