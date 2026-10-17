"use client";

import { useState } from "react";
import { Badge, PageTitle, Panel, adminCall, statusTone, useAdmin, useNotice } from "@/components/admin/kit";
import { dateTime } from "@/lib/format";

type Msg = { id: number; name: string; email: string; subject: string; message: string; status: string; created_at: string };

export default function MessagesAdmin() {
  const { data, reload } = useAdmin<{ items: Msg[] }>("/messages");
  const [openId, setOpenId] = useState<number | null>(null);
  const { notice, fail } = useNotice();

  const setStatus = (m: Msg, status: string) => adminCall(`/messages/${m.id}`, "PATCH", { status }).then(() => reload(), fail);

  return (
    <div>
      <PageTitle title="Contact messages" />
      <Panel>
        <div className="divide-y divide-line">
          {(data?.items ?? []).map((m) => (
            <div key={m.id}>
              <button onClick={() => setOpenId(openId === m.id ? null : m.id)} className="flex w-full items-center gap-4 px-4 py-3 text-left text-sm hover:bg-panel">
                <Badge tone={statusTone(m.status)}>{m.status}</Badge>
                <span className="w-40 shrink-0 truncate text-white">{m.name}</span>
                <span className="flex-1 truncate text-muted">{m.subject}</span>
                <span className="shrink-0 text-xs text-dim">{dateTime(m.created_at)}</span>
              </button>
              {openId === m.id && (
                <div className="space-y-3 border-t border-line bg-panel px-4 py-4 text-sm">
                  <div className="text-xs text-muted">
                    {m.name} &lt;<a href={`mailto:${m.email}?subject=Re: ${encodeURIComponent(m.subject)}`} className="text-blood">{m.email}</a>&gt;
                  </div>
                  <p className="whitespace-pre-wrap text-neutral-300">{m.message}</p>
                  <div className="flex gap-2">
                    <button className="btn-ghost btn-sm" onClick={() => setStatus(m, "replied")}>mark replied</button>
                    <button className="btn-ghost btn-sm" onClick={() => setStatus(m, "closed")}>close</button>
                    <button
                      className="btn-sm ml-auto text-dim hover:text-blood"
                      onClick={() => confirm("Delete message?") && adminCall(`/messages/${m.id}`, "DELETE").then(() => reload(), fail)}
                    >
                      delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
          {!data?.items.length && <div className="px-4 py-10 text-center text-sm text-dim">No messages.</div>}
        </div>
      </Panel>
      {notice}
    </div>
  );
}
