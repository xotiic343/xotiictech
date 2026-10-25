// Normalises the Supabase connection strings for /support, so a small mistake in the Render env vars
// can't send the support tables to the wrong place:
//   - adds schema=support when it's missing (the support tables must never land in "public"),
//   - adds pgbouncer=true on Supabase's transaction pooler (port 6543), which Prisma needs there.
// Plain JS (.mjs) so both the Next.js server and scripts/support-setup.mjs can import it.

/** @param {string | undefined} raw @returns {string | undefined} */
export function supportDbUrl(raw) {
  if (!raw) return raw;
  try {
    const url = new URL(raw.trim());
    if (!url.searchParams.get("schema")) url.searchParams.set("schema", "support");
    if (url.port === "6543" && !url.searchParams.get("pgbouncer")) url.searchParams.set("pgbouncer", "true");
    return url.toString();
  } catch {
    return raw; // not a URL we can parse: leave it for Prisma to report clearly
  }
}
