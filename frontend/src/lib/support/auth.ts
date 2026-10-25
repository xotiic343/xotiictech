// Auth.js (NextAuth v5) with Discord OAuth, used only by /support.
//
// - Lazy config: env is read per request, so the site still builds when support isn't configured.
// - basePath is pinned under /support/api because the site proxies every other /api/* to FastAPI.
// - trustHost: the public URL comes from the request (works on the Render URL and the custom domain).
// - Staff status is NOT stored in the session; it is checked against Discord per request (staff.ts).
import NextAuth from "next-auth";
import Discord from "next-auth/providers/discord";
import { env } from "./env";
import { prisma } from "./db";

// Last login error, so /support/auth/error can show the real reason instead of a bare "Configuration".
// Holds only the error type and the provider's reply (e.g. "invalid_client"), never secrets or tokens.
const errorStore = globalThis as unknown as { supportLastAuthError?: { at: number; detail: string } };

function describe(error: Error): string {
  const e = error as Error & { type?: string; cause?: { err?: Error } & Record<string, unknown> };
  const inner = e.cause?.err;
  const parts = [e.type ?? e.name, inner?.message ?? e.message].filter(Boolean);
  return parts.join(": ").replace(/\s+/g, " ").slice(0, 300);
}

/** The most recent login error from the last 10 minutes, if any. */
export function lastAuthError(): string | null {
  const last = errorStore.supportLastAuthError;
  return last && Date.now() - last.at < 10 * 60_000 ? last.detail : null;
}

export const { handlers, auth, signIn, signOut } = NextAuth(() => ({
  secret: env().AUTH_SECRET,
  logger: {
    error(error: Error) {
      const detail = describe(error);
      errorStore.supportLastAuthError = { at: Date.now(), detail };
      console.error("[auth][error]", detail, error);
    },
  },
  trustHost: true,
  basePath: "/support/api/auth",
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 7 },
  pages: { error: "/support/auth/error" },
  providers: [
    Discord({
      clientId: env().DISCORD_CLIENT_ID,
      clientSecret: env().DISCORD_CLIENT_SECRET,
      authorization: { params: { scope: "identify guilds" } },
    }),
  ],
  callbacks: {
    async jwt({ token, profile }) {
      // `profile` is only present at sign-in, so this runs once per login.
      if (profile?.id) {
        const p = profile as { id: string; username: string; global_name?: string | null; avatar?: string | null };
        token.discordId = p.id;
        token.username = p.username;
        token.globalName = p.global_name ?? null;
        token.avatar = p.avatar ?? null;
        await prisma.user
          .upsert({
            where: { discordId: p.id },
            update: { username: p.username, globalName: p.global_name ?? null, avatar: p.avatar ?? null, lastLoginAt: new Date() },
            create: { discordId: p.id, username: p.username, globalName: p.global_name ?? null, avatar: p.avatar ?? null },
          })
          .catch((err) => console.error("[support] user upsert failed", err));
      }
      return token;
    },
    async session({ session, token }) {
      session.user = {
        ...session.user,
        discordId: String(token.discordId ?? ""),
        username: String(token.username ?? ""),
        globalName: (token.globalName as string | null) ?? null,
        avatar: (token.avatar as string | null) ?? null,
      };
      return session;
    },
  },
}));
