import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const revalidate = 300;
export const metadata: Metadata = { title: "Licenses" };

export default function Page() {
  return <LegalPage page="licenses" title="Licenses" />;
}