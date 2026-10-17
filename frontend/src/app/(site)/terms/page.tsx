import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const revalidate = 300;
export const metadata: Metadata = { title: "Terms of Service" };

export default function Page() {
  return <LegalPage page="terms" title="Terms of Service" />;
}