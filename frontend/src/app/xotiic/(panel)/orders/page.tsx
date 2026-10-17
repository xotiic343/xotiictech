"use client";

import { useState } from "react";
import { Badge, Drawer, PageTitle, Panel, Table, adminCall, statusTone, useAdmin, useNotice } from "@/components/admin/kit";
import { dateTime, money } from "@/lib/format";

type Order = {
  id: number;
  public_id: string;
  email: string;
  product_name: string;
  product_slug: string | null;
  amount_cents: number;
  currency: string;
  status: string;
  stripe_session_id: string | null;
  stripe_payment_intent: string | null;
  paid_at: string | null;
  created_at: string;
  download_expires_at: string | null;
  download_count: number;
  last_emailed_at: string | null;
  refund_notes: string | null;
  admin_notes: string | null;
  hosting_status: string;
  hosting_server_id: string | null;
};

export default function OrdersAdmin() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [hosting, setHosting] = useState("");
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (status) params.set("status", status);
  if (hosting) params.set("hosting", hosting);
  const { data, reload } = useAdmin<{ items: Order[]; total: number }>(`/orders?${params}`);
  const [open, setOpen] = useState<Order | null>(null);
  const { notice, ok, fail } = useNotice();

  async function patch(body: Partial<Order>) {
    if (!open) return;
    try {
      setOpen(await adminCall<Order>(`/orders/${open.id}`, "PATCH", body));
      ok("Saved");
      reload();
    } catch (e) {
      fail(e);
    }
  }

  async function resend() {
    if (!open) return;
    try {
      await adminCall(`/orders/${open.id}/resend`, "POST");
      ok(`Download link re-sent to ${open.email}`);
      reload();
    } catch (e) {
      fail(e);
    }
  }

  return (
    <div>
      <PageTitle title={`Orders${data ? ` (${data.total})` : ""}`}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="email, product, id…" className="input w-56 py-1.5 text-xs" />
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="input w-auto py-1.5 text-xs">
          <option value="">any status</option>
          {["paid", "pending", "refunded", "failed"].map((s) => <option key={s}>{s}</option>)}
        </select>
        <select value={hosting} onChange={(e) => setHosting(e.target.value)} className="input w-auto py-1.5 text-xs">
          <option value="">any hosting</option>
          {["requested", "approved", "deployed", "rejected"].map((s) => <option key={s}>{s}</option>)}
        </select>
      </PageTitle>
      <Panel>
        <Table head={["Created", "Email", "Product", "Amount", "Status", "Hosting", "DLs"]} empty={!data?.items.length}>
          {(data?.items ?? []).map((o) => (
            <tr key={o.id} className="cursor-pointer hover:bg-panel" onClick={() => setOpen(o)}>
              <td className="whitespace-nowrap px-4 py-3 text-xs text-muted">{dateTime(o.created_at)}</td>
              <td className="px-4 py-3">{o.email}</td>
              <td className="px-4 py-3 text-white">{o.product_name}</td>
              <td className="px-4 py-3">{money(o.amount_cents, o.currency)}</td>
              <td className="px-4 py-3"><Badge tone={statusTone(o.status)}>{o.status}</Badge></td>
              <td className="px-4 py-3">{o.hosting_status !== "none" && <Badge tone={statusTone(o.hosting_status)}>{o.hosting_status}</Badge>}</td>
              <td className="px-4 py-3">{o.download_count}</td>
            </tr>
          ))}
        </Table>
      </Panel>

      <Drawer open={!!open} onClose={() => setOpen(null)} title={`Order ${open?.public_id.slice(0, 8) ?? ""}`}>
        {open && (
          <div className="space-y-5 text-sm">
            <dl className="grid grid-cols-2 gap-3 text-xs">
              {[
                ["Email", open.email],
                ["Product", open.product_name],
                ["Amount", money(open.amount_cents, open.currency)],
                ["Status", open.status],
                ["Paid", dateTime(open.paid_at)],
                ["Link expires", dateTime(open.download_expires_at)],
                ["Downloads", String(open.download_count)],
                ["Last emailed", dateTime(open.last_emailed_at)],
                ["Stripe session", open.stripe_session_id ?? "—"],
                ["Payment intent", open.stripe_payment_intent ?? "—"],
              ].map(([k, v]) => (
                <div key={k} className="border border-line p-2.5">
                  <dt className="text-[10px] uppercase tracking-[0.2em] text-dim">{k}</dt>
                  <dd className="mt-1 break-all text-white">{v}</dd>
                </div>
              ))}
            </dl>
            {open.status === "paid" && (
              <button className="btn-primary btn-sm" onClick={resend}>
                Resend download email (resets expiry)
              </button>
            )}
            {open.hosting_status !== "none" && (
              <div className="border border-amber/40 p-4">
                <div className="label">Hosted bot: server {open.hosting_server_id ?? "(not submitted)"}</div>
                <div className="flex flex-wrap gap-2">
                  {["approved", "deployed", "rejected"].map((s) => (
                    <button key={s} className={open.hosting_status === s ? "btn-primary btn-sm" : "btn-ghost btn-sm"} onClick={() => patch({ hosting_status: s })}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <label className="block">
              <span className="label">Refund notes</span>
              <textarea className="input" rows={3} defaultValue={open.refund_notes ?? ""} onBlur={(e) => e.target.value !== (open.refund_notes ?? "") && patch({ refund_notes: e.target.value })} />
              <span className="mt-1 block text-[11px] text-dim">Issue refunds in the Stripe dashboard; the webhook marks the order refunded automatically.</span>
            </label>
            <label className="block">
              <span className="label">Admin notes</span>
              <textarea className="input" rows={3} defaultValue={open.admin_notes ?? ""} onBlur={(e) => e.target.value !== (open.admin_notes ?? "") && patch({ admin_notes: e.target.value })} />
            </label>
          </div>
        )}
      </Drawer>
      {notice}
    </div>
  );
}
