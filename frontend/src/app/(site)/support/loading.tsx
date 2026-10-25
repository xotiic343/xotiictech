import { RowsSkeleton, StatsSkeleton } from "@/components/support/Skeletons";

export default function Loading() {
  return (
    <div className="container-x space-y-8 py-14" role="status" aria-label="Loading support">
      <div className="h-10 w-64 animate-pulse bg-line" />
      <StatsSkeleton />
      <RowsSkeleton rows={4} />
    </div>
  );
}
