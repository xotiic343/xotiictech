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
  DISCORD_GUILD_ID: z.string().regex(/^\d+$/),
  STAFF_ROLE_ID: z.string().min(1), // one ID, or several separated by commas
  BOT_HEARTBEAT_SECRET: z.string().default(""), // shared with the bot: heartbeat + sync events
  BOT_API_URL: z.string().default(""), // the bot's internal API (docs/SUPPORT.md, section B)
  BOT_API_SECRET: z.string().default(""),
});

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
