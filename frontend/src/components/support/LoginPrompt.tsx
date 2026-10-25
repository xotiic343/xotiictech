// Shown instead of protected /support content for anonymous visitors.
import { signIn } from "@/lib/support/auth";

export function LoginPrompt({ message = "Log in with Discord to continue." }: { message?: string }) {
  return (
    <div className="card corner-brackets mx-auto max-w-md px-6 py-14 text-center">
      <div className="eyebrow">// access required</div>
      <h2 className="h-display mt-3 text-xl">Login required</h2>
      <p className="mt-3 text-sm text-muted">{message}</p>
      <form
        className="mt-7"
        action={async () => {
          "use server";
          await signIn("discord", { redirectTo: "/support/tickets" });
        }}
      >
        <button type="submit" className="btn-primary">
          Login with Discord
        </button>
      </form>
    </div>
  );
}
