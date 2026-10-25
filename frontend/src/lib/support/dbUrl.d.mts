/** Adds schema=support (and pgbouncer=true on port 6543) to a Supabase connection string. See dbUrl.mjs. */
export function supportDbUrl(raw: string | undefined): string | undefined;
