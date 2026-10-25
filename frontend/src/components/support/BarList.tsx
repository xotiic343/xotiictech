// Horizontal bar chart in plain HTML/CSS (no chart library), styled like the rest of the site.
// Used on the staff dashboard for tickets by category and by status.
const STATE_BAR: Record<string, string> = { open: "bg-ok", claimed: "bg-cyan", pending: "bg-amber", closed: "bg-dim" };

export function BarList({ title, rows, colorByName = false }: { title: string; rows: { name: string; value: number }[]; colorByName?: boolean }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  const total = rows.reduce((a, r) => a + r.value, 0);

  return (
    <div className="card p-5">
      <div className="eyebrow mb-4">// {title}</div>
      {rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted">No tickets yet.</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.name}>
              <div className="mb-1 flex justify-between text-xs uppercase tracking-wider">
                <span className="text-neutral-300">{r.name}</span>
                <span className="tabular-nums text-muted">
                  {r.value} <span className="text-dim">({Math.round((r.value / total) * 100)}%)</span>
                </span>
              </div>
              <div className="h-2 bg-line" aria-hidden>
                <div
                  className={`h-full ${colorByName ? STATE_BAR[r.name] ?? "bg-crimson" : "bg-crimson shadow-[0_0_8px_rgba(230,0,0,.6)]"}`}
                  style={{ width: `${(r.value / max) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
