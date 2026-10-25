// A single number in the /support stats strip and the staff dashboard.
export function SupportStat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="card corner-brackets p-5">
      <div className="text-[11px] uppercase tracking-[0.2em] text-muted">{label}</div>
      <div className="mt-2 font-display text-2xl font-black tabular-nums text-white sm:text-3xl">{value}</div>
      {hint && <div className="mt-1 text-[11px] uppercase tracking-wider text-dim">{hint}</div>}
    </div>
  );
}
