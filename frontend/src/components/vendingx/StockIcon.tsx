"use client";

import type { ReactNode } from "react";
import { useState } from "react";

/* Lucide icons (ISC license), matched against the item name when no custom icon is set. */
const S = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
const svg = (children: ReactNode) => (cls: string) => (
  <svg viewBox="0 0 24 24" className={cls} {...S} aria-hidden>
    {children}
  </svg>
);

const BUILTIN: [string, (cls: string) => ReactNode][] = [
  ["steam", svg(<><line x1="6" x2="10" y1="11" y2="11" /><line x1="8" x2="8" y1="9" y2="13" /><line x1="15" x2="15.01" y1="12" y2="12" /><line x1="18" x2="18.01" y1="10" y2="10" /><path d="M17.32 5H6.68a4 4 0 0 0-3.978 3.59C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.545-.604-6.584-.685-7.258A4 4 0 0 0 17.32 5z" /></>)],
  ["netflix", svg(<><rect width="18" height="18" x="3" y="3" rx="2" /><path d="M7 3v18M3 7.5h4M3 12h18M3 16.5h4M17 3v18M17 7.5h4M17 16.5h4" /></>)],
  ["spotify", svg(<><path d="M21 16V3a1 1 0 0 0-1.28-.96l-10 2.917a1 1 0 0 0-.72.96V19" /><circle cx="18" cy="16" r="3" /><circle cx="6" cy="19" r="3" /></>)],
  ["nitro", svg(<><path d="M10.5 3 8 9l4 13 4-13-2.5-6" /><path d="M17 3a2 2 0 0 1 1.6.8l3 4a2 2 0 0 1 .013 2.382l-7.99 10.986a2 2 0 0 1-3.247 0l-7.99-10.986A2 2 0 0 1 2.4 7.8l2.998-3.997A2 2 0 0 1 7 3z" /><path d="M2 9h20" /></>)],
  ["minecraft", svg(<><path d="m14 13-8.381 8.38a1 1 0 0 1-3.001-3L11 9.999" /><path d="M18.352 3.352a1.205 1.205 0 0 0-1.704 0l-5.296 5.296a1.205 1.205 0 0 0 0 1.704l2.296 2.296a1.205 1.205 0 0 0 1.704 0l5.296-5.296a1.205 1.205 0 0 0 0-1.704z" /></>)],
  ["roblox", svg(<><path d="M10 22V7a1 1 0 0 0-1-1H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5a1 1 0 0 0-1-1H2" /><rect x="14" y="2" width="8" height="8" rx="1" /></>)],
  ["epic", svg(<path d="M15.914 4a1.5 1.5 0 00-2.474-1.561l-9 9A1.5 1.5 0 005.5 14h4.002a.5.5 0 01.471.666L8.086 20a1.5 1.5 0 002.475 1.56l9-9A1.5 1.5 0 0018.5 10h-3.997a.5.5 0 01-.472-.667z" />)],
  ["ubisoft", svg(<><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></>)],
  ["instagram", svg(<><rect width="20" height="20" x="2" y="2" rx="5" /><circle cx="12" cy="12" r="4" /><line x1="17.5" x2="17.51" y1="6.5" y2="6.5" /></>)],
  ["onlyfans", svg(<path d="M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5" />)],
  ["disney", svg(<><path d="M12 3l2.5 5 5.5.8-4 3.9.9 5.5L12 15.6 7.1 18.2 8 12.7 4 8.8l5.5-.8z" /></>)],
  ["hulu", svg(<><rect width="20" height="15" x="2" y="4" rx="2" /><path d="M8 21h8" /></>)],
  ["vpn", svg(<><rect width="18" height="11" x="3" y="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></>)],
  ["ip", svg(<><circle cx="12" cy="12" r="10" /><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20M2 12h20" /></>)],
  ["proxy", svg(<><circle cx="12" cy="12" r="10" /><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20M2 12h20" /></>)],
  ["r6", svg(<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />)],
  ["email", svg(<><path d="m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7" /><rect x="2" y="4" width="20" height="16" rx="2" /></>)],
  ["mail", svg(<><path d="m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7" /><rect x="2" y="4" width="20" height="16" rx="2" /></>)],
  ["random", svg(<><rect width="18" height="18" x="3" y="3" rx="2" /><circle cx="8" cy="8" r="1" fill="currentColor" /><circle cx="16" cy="8" r="1" fill="currentColor" /><circle cx="12" cy="12" r="1" fill="currentColor" /><circle cx="8" cy="16" r="1" fill="currentColor" /><circle cx="16" cy="16" r="1" fill="currentColor" /></>)],
];

const FALLBACK = svg(<><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" /><path d="m3.3 7 8.7 5 8.7-5M12 22V12" /></>);

function builtin(key: string, name: string, cls: string): ReactNode {
  const hay = `${key} ${name}`.toLowerCase();
  const hit = BUILTIN.find(([k]) => hay.includes(k));
  return (hit ? hit[1] : FALLBACK)(cls);
}

/** Custom uploaded icon when set; otherwise a built-in icon picked from the item key/name. */
export function StockIcon({
  icon,
  stockKey,
  name,
  className = "h-8 w-8",
}: {
  icon?: string | null;
  stockKey: string;
  name: string;
  className?: string;
}) {
  const [broken, setBroken] = useState<string | null>(null);
  if (icon && broken !== icon) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={icon} alt="" draggable={false} className={`${className} object-contain`} onError={() => setBroken(icon)} />
    );
  }
  return builtin(stockKey, name, className);
}
