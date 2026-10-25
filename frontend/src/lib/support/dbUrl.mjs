// Normalises the Supabase connection strings for /support, so a small paste mistake in the Render env
// vars can't break the database connection or send the tables to the wrong place:
//   - strips surrounding quotes / whitespace and an accidental "NAME=" prefix,
//   - rebuilds the query string, accepting "?" or "&" between parameters (e.g. "?pgbouncer=true?schema=support"),
//   - keeps only parameters Prisma's Postgres connector supports (others make Prisma reject the URL),
//   - always sets schema=support, and pgbouncer=true on Supabase's transaction pooler (port 6543).
// Plain JS (.mjs) so both the Next.js server and scripts/support-setup.mjs can import it.

const PRISMA_PARAMS = new Set([
  "schema",
  "pgbouncer",
  "connection_limit",
  "connect_timeout",
  "pool_timeout",
  "socket_timeout",
  "sslmode",
  "sslcert",
  "sslidentity",
  "sslpassword",
  "sslaccept",
  "statement_cache_size",
  "application_name",
  "options",
]);

/** @param {string | undefined} raw @returns {string | undefined} */
export function supportDbUrl(raw) {
  if (!raw) return raw;
  const s = raw
    .trim()
    .replace(/^[A-Z_]+=/, "")
    .replace(/^['"]+|['"]+$/g, "")
    .trim();

  const q = s.indexOf("?");
  const base = q === -1 ? s : s.slice(0, q);
  const params = new Map();
  if (q !== -1) {
    for (const part of s.slice(q + 1).split(/[?&]/)) {
      const [key, ...rest] = part.split("=");
      const name = key.trim().toLowerCase();
      if (PRISMA_PARAMS.has(name) && rest.length) params.set(name, rest.join("=").trim());
    }
  }

  params.set("schema", "support"); // the support tables always live in their own schema
  if (/:6543(\/|$)/.test(base)) params.set("pgbouncer", "true");

  return `${base}?${[...params].map(([k, v]) => `${k}=${v}`).join("&")}`;
}
