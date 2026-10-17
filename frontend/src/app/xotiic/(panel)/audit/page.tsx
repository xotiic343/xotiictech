"use client";

import { useState } from "react";
import { PageTitle, Panel, Table, useAdmin } from "@/components/admin/kit";
import { dateTime } from "@/lib/format";

type Log = { id: number; actor: string; action: string; entity_type: string | null; entity_id: string | null; details: Record<string, unknown> | null; ip: string | null; created_at: string };

const FILTERS = ["", "admin.", "bot", "bots.sync", "products.", "order.", "settings.", "content.", "upload."];

export default function AuditAdmin() {
  const [action, setAction] = useState("");
  const { data } = useAdmin<{ items: Log[] }>(`/audit-logs${action ? `?action=${encodeURIComponent(action)}` : ""}`);
  return (
    <div>
      <PageTitle title="Audit log">
        <select className="input w-auto py-1.5 text-xs" value={action} onChange={(e) => setAction(e.target.value)}>
          {FILTERS.map((f) => (
            <option key={f} value={f}>
              {f || "all actions"}
            </option>
          ))}
        </select>
      </PageTitle>
      <Panel>
        <Table head={["When", "Actor", "Action", "Entity", "Details", "IP"]} empty={!data?.items.length}>
          {(data?.items ?? []).map((l) => (
            <tr key={l.id}>
              <td className="whitespace-nowrap px-4 py-2 text-xs text-muted">{dateTime(l.created_at)}</td>
              <td className="px-4 py-2">{l.actor}</td>
              <td className={`px-4 py-2 font-mono text-xs ${l.action.includes("failed") ? "text-blood" : "text-white"}`}>{l.action}</td>
              <td className="px-4 py-2 text-xs text-muted">{l.entity_type ? `${l.entity_type}#${l.entity_id}` : ""}</td>
              <td className="max-w-sm truncate px-4 py-2 font-mono text-[11px] text-dim" title={l.details ? JSON.stringify(l.details) : ""}>
                {l.details ? JSON.stringify(l.details) : ""}
              </td>
              <td className="px-4 py-2 font-mono text-[11px] text-dim">{l.ip}</td>
            </tr>
          ))}
        </Table>
      </Panel>
    </div>
  );
}
