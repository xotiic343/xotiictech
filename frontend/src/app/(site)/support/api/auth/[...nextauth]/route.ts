// Auth.js endpoints for /support: /support/api/auth/signin, /callback/discord, /signout, /session, ...
import { handlers } from "@/lib/support/auth";

export const { GET, POST } = handlers;
