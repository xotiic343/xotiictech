import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Vending X",
  description:
    "Free and premium digital inventory vending machine. Grab free beta stock or unlock premium accounts — powered by XotiicTech.",
  openGraph: {
    title: "Vending X — Digital Vending Machine",
    description:
      "Free and premium digital inventory vending machine by XotiicTech. Beta items free for everyone.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Vending X — Digital Vending Machine",
    description:
      "Free and premium digital inventory vending machine by XotiicTech.",
  },
};

export default function VendingXLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
