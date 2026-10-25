import { BlockSkeleton, StatsSkeleton } from "@/components/support/Skeletons";

export default function Loading() {
  return (
    <div className="space-y-8" role="status" aria-label="Loading staff panel">
      <div className="h-8 w-48 animate-pulse bg-line" />
      <StatsSkeleton count={6} />
      <BlockSkeleton className="h-72" />
    </div>
  );
}
