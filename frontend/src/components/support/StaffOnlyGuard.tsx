// Server-side staff gate for /support/exotic. Hiding links is never a substitute for this check.
import { requireStaff } from "@/lib/support/staff";

export async function StaffOnlyGuard({ children }: { children: React.ReactNode }) {
  await requireStaff();
  return <>{children}</>;
}
