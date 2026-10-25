// Creates/updates the /support tables and seeds ticket categories.
// Runs at build (npm run support:setup) AND before every start (npm "prestart"), so the tables exist
// even if the Render build command was never changed. Safe to repeat: prisma db push is idempotent.
// Never fails the build or the start: the rest of the site must keep working, and /support reports
// the problem instead.
import { execSync } from "node:child_process";
import { supportDbUrl } from "../src/lib/support/dbUrl.mjs";

if (!process.env.SUPPORT_DATABASE_URL || !process.env.SUPPORT_DIRECT_URL) {
  console.log("[support] SUPPORT_DATABASE_URL / SUPPORT_DIRECT_URL not set: skipping support database setup.");
  process.exit(0);
}

// Same normalisation the app uses, so tables are created exactly where the app looks for them.
const env = {
  ...process.env,
  SUPPORT_DATABASE_URL: supportDbUrl(process.env.SUPPORT_DATABASE_URL),
  SUPPORT_DIRECT_URL: supportDbUrl(process.env.SUPPORT_DIRECT_URL),
};
const run = (cmd) => execSync(cmd, { stdio: "inherit", env });

try {
  run("npx prisma db push --skip-generate");
  run("node prisma/seed-support.mjs");
  console.log('[support] database ready (schema "support")');
} catch {
  console.error("[support] database setup failed. /support will not work until this is fixed (see the error above).");
}
