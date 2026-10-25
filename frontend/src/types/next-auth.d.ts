// Adds the Discord fields used by /support to the Auth.js session type.
import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      discordId: string;
      username: string;
      globalName: string | null;
      avatar: string | null;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}
