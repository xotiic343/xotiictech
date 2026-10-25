// Shown instantly while a page's data loads, so navigation reacts to the click right away instead of
// waiting on the API. Navbar, footer and background stay in place (they're in the layout).
export default function Loading() {
  return (
    <div className="container-x py-20" role="status" aria-label="Loading">
      <div className="h-3 w-24 animate-pulse bg-crimson/30" />
      <div className="mt-4 h-10 w-2/3 max-w-lg animate-pulse bg-line" />
      <div className="mt-3 h-4 w-1/2 max-w-md animate-pulse bg-line/70" />
      <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-56 animate-pulse border border-line bg-panel/60" />
        ))}
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}
