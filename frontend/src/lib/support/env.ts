// Server-only environment for /support. Read lazily (on first use, not at import), so a missing support
// variable shows up as a clear error on /support pages instead of breaking the whole site's build.
import "server-only";
import { z } from "zod";

const schema = z.object({
  SUPPORT_DATABASE_URL: z.string().min(1),
  SUPPORT_DIRECT_URL: z.string().min(1),
  AUTH_SECRET: z.string().min(16),
  DISCORD_CLIENT_ID: z.string().min(1),
  DISCORD_CLIENT_SECRET: z.string().min(1),
  DISCORD_BOT_TOKEN: z.string().min(1),
  // Xotiic Support server and its staff role. IDs aren't secrets, so they're defaults here;
  // set the env vars on Render only to override them. STAFF_ROLE_ID may list several, comma-separated.
  DISCORD_GUILD_ID: z.string().regex(/^\d+$/).default("1344385779627069541"),
  STAFF_ROLE_ID: z.string().min(1).default("1366825298535907420"),
  // Shared with the bot: authenticates its heartbeat, job polling and sync events.
  BOT_HEARTBEAT_SECRET: z.string().min(16),
});

/** Names (never values) of support variables that are missing or invalid. Shown on the "being set up" page. */
export function missingSupportEnv(): string[] {
  const parsed = schema.safeParse(process.env);
  return parsed.success ? [] : [...new Set(parsed.error.issues.map((i) => String(i.path[0])))];
}

let cached: z.infer<typeof schema> | null = null;

export function env() {
  if (!cached) {
    const parsed = schema.safeParse(process.env);
    if (!parsed.success) {
      const missing = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
      throw new Error(`[support] Invalid or missing environment variables: ${missing}. See docs/SUPPORT.md.`);
    }
    cached = parsed.data;
  }
  return cached;
}

export function staffRoleIds(): string[] {
  return env()
    .STAFF_ROLE_ID.split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
