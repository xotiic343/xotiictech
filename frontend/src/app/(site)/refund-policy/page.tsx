import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const revalidate = 300;
export const metadata: Metadata = { title: "Refund Policy" };

export default function Page() {
  return <LegalPage page="refund_policy" title="Refund Policy" />;
}