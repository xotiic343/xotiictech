import "server-only";
import { backendUrl } from "./backend";
import { getGuildMember } from "./support/discord";
import { getCurrentUser, type CurrentUser } from "./support/session";

const PREMIUM_ROLE_ID = process.env.VENDINGX_PREMIUM_ROLE_ID || "1474136325912399994";

export type VendUser = CurrentUser & { premium: boolean; inServer: boolean };

/** Logged-in Discord user plus their Premium status: the Premium role or boosting the main server. */
export async function getVendUser(): Promise<VendUser | null> {
  const user = await getCurrentUser().catch(() => null);
  if (!user) return null;
  try {
    const member = await getGuildMember(user.discordId);
    if (!member) return { ...user, premium: false, inServer: false };
    return { ...user, premium: member.roles.includes(PREMIUM_ROLE_ID) || !!member.premium_since, inServer: true };
  } catch {
    return { ...user, premium: false, inServer: false };
  }
}

/** Server-to-server call to the API's Vending X endpoints that only the bot and this site may use. */
export function vendApi(path: string, body: unknown) {
  return fetch(`${backendUrl()}/api/vendingx${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${process.env.VENDINGX_BOT_SECRET ?? ""}`,
    },
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
}
