// Staff check for /support/exotic: logged in with Discord AND holds a STAFF_ROLE_ID role in the guild.
// Asked of Discord (bot token) per request, cached 60s. Fails closed on a Discord outage.
import "server-only";
import { redirect } from "next/navigation";
import { getCurrentUser, type CurrentUser } from "./session";
import { getGuildMember } from "./discord";
import { staffRoleIds } from "./env";

const TTL_MS = 60_000;
const cache = new Map<string, { staff: boolean; at: number }>();

export async function isStaffUser(discordId: string): Promise<boolean> {
  const hit = cache.get(discordId);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.staff;
  try {
    const member = await getGuildMember(discordId);
    const roles = new Set(staffRoleIds());
    const staff = !!member && member.roles.some((r) => roles.has(r));
    cache.set(discordId, { staff, at: Date.now() });
    return staff;
  } catch (err) {
    console.error("[support] staff check failed", err);
    return false; // fail closed, and don't cache the outage
  }
}

/** For API routes: the staff user, or null (routes answer 404 so the panel stays hidden). */
export async function getStaffUser(): Promise<CurrentUser | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  return (await isStaffUser(user.discordId)) ? user : null;
}

/** For /support/exotic pages: anyone who isn't staff is sent to /support. */
export async function requireStaff(): Promise<CurrentUser> {
  const user = await getStaffUser();
  if (!user) redirect("/support");
  return user;
}
