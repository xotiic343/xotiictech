import type { Metadata } from "next";
import Link from "next/link";
import { ContactForm } from "@/components/forms";
import { PageHeader } from "@/components/ui";
import { apiGet } from "@/lib/backend";
import type { SiteData } from "@/lib/types";

export const revalidate = 60;
export const metadata: Metadata = { title: "Contact" };

export default async function ContactPage() {
  const site = await apiGet<SiteData>("/site");
  return (
    <>
      <PageHeader eyebrow="open channel" title="Contact" subtitle="Questions, support or business inquiries. For custom bots, use the commission form." />
      <div className="container-x grid gap-10 lg:grid-cols-[1fr_340px]">
        <div className="card corner-brackets p-6 sm:p-8">
          <ContactForm />
        </div>
        <aside className="space-y-4">
          <Link href="/bots/commission" className="card card-hover block p-5">
            <div className="eyebrow mb-1">// need a bot?</div>
            <div className="font-display font-bold uppercase text-white">Commission form →</div>
          </Link>
          <Link href="/docs" className="card card-hover block p-5">
            <div className="eyebrow mb-1">// stuck on setup?</div>
            <div className="font-display font-bold uppercase text-white">Docs & FAQ →</div>
          </Link>
          {site?.socials?.discord && (
            <a href={site.socials.discord} target="_blank" rel="noopener noreferrer" className="card card-hover block p-5">
              <div className="eyebrow mb-1">// fastest reply</div>
              <div className="font-display font-bold uppercase text-white">Discord ↗</div>
            </a>
          )}
          {site?.footer?.support_email && (
            <div className="card p-5 text-sm">
              <div className="eyebrow mb-1">// email</div>
              <a href={`mailto:${site.footer.support_email}`} className="text-blood hover:text-white">
                {site.footer.support_email}
              </a>
            </div>
          )}
        </aside>
      </div>
    </>
  );
}
