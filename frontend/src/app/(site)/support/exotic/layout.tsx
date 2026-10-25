// Support staff panel. Wrapped in the server-side staff guard; each page also calls requireStaff()
// itself, so a new page can't forget the check. Not linked anywhere for non-staff.
import type { Metadata } from "next";
import { StaffOnlyGuard } from "@/components/support/StaffOnlyGuard";
import { SupportTabs } from "@/components/support/SupportTabs";

export const metadata: Metadata = { title: "Staff", robots: { index: false, follow: false } };

const TABS = [
  { href: "/support/exotic", label: "Dashboard" },
  { href: "/support/exotic/tickets", label: "Queue" },
  { href: "/support/exotic/staff", label: "Staff" },
  { href: "/support/exotic/audit", label: "Audit log" },
];

export default function ExoticLayout({ children }: { children: React.ReactNode }) {
  return (
    <StaffOnlyGuard>
      <div className="container-x space-y-8 py-10">
        <nav aria-label="Staff panel" className="border-b border-line">
          <SupportTabs tabs={TABS} />
        </nav>
        {children}
      </div>
    </StaffOnlyGuard>
  );
}
