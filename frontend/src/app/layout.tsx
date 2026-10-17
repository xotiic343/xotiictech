import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Orbitron } from "next/font/google";
import "./globals.css";

const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });
const display = Orbitron({ subsets: ["latin"], variable: "--font-display", weight: ["500", "700", "900"], display: "swap" });

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://xotiictech.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "XotiicTech — Discord bots, clients & software", template: "%s // XotiicTech" },
  description: "Custom Discord bots, Minecraft clients, PC applications and source code. Built to spec, shipped in red.",
  openGraph: { siteName: "XotiicTech", type: "website" },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = { themeColor: "#000000", colorScheme: "dark" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${mono.variable} ${display.variable}`} suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
