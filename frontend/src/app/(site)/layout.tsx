import { BootSequence } from "@/components/fx/BootSequence";
import { MatrixBackground } from "@/components/fx/MatrixBackground";
import { Footer } from "@/components/layout/Footer";
import { Navbar } from "@/components/layout/Navbar";
import { PageViewTracker } from "@/components/layout/PageViewTracker";
import { apiGet } from "@/lib/backend";
import { bootGuardScript } from "@/lib/boot";
import type { SiteData } from "@/lib/types";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const site = await apiGet<SiteData>("/site", 60);
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: bootGuardScript }} />
      <BootSequence />
      <MatrixBackground />
      <div className="crt-overlay" aria-hidden />
      <PageViewTracker />
      <Navbar />
      <main className="relative">{children}</main>
      <Footer site={site} />
    </>
  );
}
