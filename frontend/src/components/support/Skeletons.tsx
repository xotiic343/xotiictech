// Loading placeholders for /support (used by loading.tsx files and Suspense fallbacks).
export function BlockSkeleton({ className = "h-40" }: { className?: string }) {
  return <div className={`animate-pulse border border-line bg-panel/60 ${className}`} aria-hidden />;
}

export function StatsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4" role="status" aria-label="Loading">
      {Array.from({ length: count }).map((_, i) => (
        <BlockSkeleton key={i} className="h-28" />
      ))}
    </div>
  );
}

export function RowsSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="card" role="status" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 border-b border-line px-5 py-4 last:border-0">
          <div className="h-4 w-16 animate-pulse bg-line" />
          <div className="h-4 flex-1 animate-pulse bg-line" />
          <div className="h-5 w-20 animate-pulse bg-line" />
        </div>
      ))}
    </div>
  );
}
