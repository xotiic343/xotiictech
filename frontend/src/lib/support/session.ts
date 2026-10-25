// Current Discord user for /support, from the Auth.js session cookie.
import "server-only";
import { auth } from "./auth";

export type CurrentUser = {
  discordId: string;
  username: string;
  globalName: string | null;
  avatar: string | null;
};

/** The logged-in user, or null. Pages show a login prompt when this is null. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await auth();
  if (!session?.user?.discordId) return null;
  const { discordId, username, globalName, avatar } = session.user;
  return { discordId, username, globalName, avatar };
}
