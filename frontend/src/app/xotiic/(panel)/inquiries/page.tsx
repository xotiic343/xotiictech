"use client";

import { useState } from "react";
import { Badge, Drawer, PageTitle, Panel, Table, adminCall, statusTone, useAdmin, useNotice } from "@/components/admin/kit";
import { dateTime } from "@/lib/format";

type Inquiry = {
  id: number;
  discord_username: string;
  email: string;
  server_size: string;
  purpose: string;
  features: string;
  budget: string;
  timeline: string;
  status: string;
  admin_notes: string | null;
  created_at: string;
};

export default function InquiriesAdmin() {
  const [filter, setFilter] = useState<string>("");
  const { data, reload } = useAdmin<{ items: Inquiry[]; counts: Record<string, number> }>(`/inquiries${filter ? `?status=${filter}` : ""}`);
  const [open, setOpen] = useState<Inquiry | null>(null);
  const { notice, ok, fail } = useNotice();

  async function update(id: number, body: Partial<Inquiry>) {
    try {
      const updated = await adminCall<Inquiry>(`/inquiries/${id}`, "PATCH", body);
      setOpen(updated);
      ok("Updated");
      reload();
    } catch (e) {
      fail(e);
    }
  }

  return (
    <div>
      <PageTitle title="Commission inbox">
        {["", "new", "replied", "closed"].map((s) => (
          <button key={s} onClick={() => setFilter(s)} className={`btn-sm border ${filter === s ? "border-blood text-blood" : "border-edge text-muted"}`}>
            {s || "all"} {s && data?.counts[s] ? `(${data.counts[s]})` : ""}
          </button>
        ))}
      </PageTitle>
      <Panel>
        <Table head={["Received", "Discord", "Budget", "Timeline", "Purpose", "Status"]} empty={!data?.items.length}>
          {(data?.items ?? []).map((i) => (
            <tr key={i.id} className="cursor-pointer hover:bg-panel" onClick={() => setOpen(i)}>
              <td className="whitespace-nowrap px-4 py-3 text-xs text-muted">{dateTime(i.created_at)}</td>
              <td className="px-4 py-3 text-white">{i.discord_username}</td>
              <td className="px-4 py-3">{i.budget}</td>
              <td className="px-4 py-3">{i.timeline}</td>
              <td className="max-w-xs truncate px-4 py-3 text-muted">{i.purpose}</td>
              <td className="px-4 py-3">
                <Badge tone={statusTone(i.status)}>{i.status}</Badge>
              </td>
            </tr>
          ))}
        </Table>
      </Panel>

      <Drawer open={!!open} onClose={() => setOpen(null)} title={`Commission #${open?.id ?? ""}`}>
        {open && (
          <div className="space-y-5 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <KV k="Discord" v={open.discord_username} />
              <KV k="Email" v={<a className="text-blood" href={`mailto:${open.email}?subject=Your XotiicTech bot commission`}>{open.email}</a>} />
              <KV k="Server size" v={open.server_size} />
              <KV k="Budget" v={open.budget} />
              <KV k="Timeline" v={open.timeline} />
              <KV k="Received" v={dateTime(open.created_at)} />
            </div>
            <Block title="Purpose" text={open.purpose} />
            <Block title="Features" text={open.features} />
            <label className="block">
              <span className="label">Private notes</span>
              <textarea
                className="input"
                rows={4}
                defaultValue={open.admin_notes ?? ""}
                onBlur={(e) => e.target.value !== (open.admin_notes ?? "") && update(open.id, { admin_notes: e.target.value })}
              />
            </label>
            <div className="flex flex-wrap gap-2">
              {["new", "replied", "closed"].map((s) => (
                <button key={s} onClick={() => update(open.id, { status: s })} className={s === open.status ? "btn-primary btn-sm" : "btn-ghost btn-sm"}>
                  mark {s}
                </button>
              ))}
              <button
                className="btn-sm ml-auto text-dim hover:text-blood"
                onClick={async () => {
                  if (!confirm("Delete this inquiry?")) return;
                  await adminCall(`/inquiries/${open.id}`, "DELETE").then(() => {
                    setOpen(null);
                    reload();
                  }, fail);
                }}
              >
                delete
              </button>
            </div>
          </div>
        )}
      </Drawer>
      {notice}
    </div>
  );
}

function KV({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="border border-line p-3">
      <div className="text-[10px] uppercase tracking-[0.2em] text-dim">{k}</div>
      <div className="mt-1 break-all text-white">{v}</div>
    </div>
  );
}

function Block({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <div className="label">{title}</div>
      <div className="whitespace-pre-wrap border border-line bg-panel p-3 text-neutral-300">{text}</div>
    </div>
  );
}
