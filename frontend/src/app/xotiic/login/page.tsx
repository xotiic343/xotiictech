"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { GlitchText } from "@/components/fx/GlitchText";
import { api } from "@/lib/client";
import { adminLoginSchema, fieldErrors } from "@/lib/validation";

export default function AdminLogin() {
  const router = useRouter();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const raw = Object.fromEntries(new FormData(e.currentTarget).entries());
    const parsed = adminLoginSchema.safeParse(raw);
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    setErrors({});
    setError(null);
    setBusy(true);
    try {
      await api("/admin/auth/login", { method: "POST", json: parsed.data });
      router.replace("/xotiic");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-black px-4">
      <div className="crt-overlay" aria-hidden />
      <form onSubmit={submit} className="card corner-brackets w-full max-w-sm space-y-4 p-8 shadow-neon" noValidate>
        <div className="text-center">
          <div className="eyebrow">// restricted</div>
          <h1 className="h-display mt-2 text-2xl">
            <GlitchText text="XOTIIC CONTROL" />
          </h1>
        </div>
        {(["username", "password", "totp"] as const).map((name) => (
          <label key={name} className="block">
            <span className="label">{name === "totp" ? "2FA code" : name}</span>
            <input
              name={name}
              type={name === "password" ? "password" : "text"}
              inputMode={name === "totp" ? "numeric" : undefined}
              autoComplete={name === "totp" ? "one-time-code" : name === "password" ? "current-password" : "username"}
              maxLength={name === "totp" ? 6 : 200}
              className={`input ${name === "totp" ? "text-center text-lg tracking-[0.6em]" : ""}`}
            />
            {errors[name] && <span className="mt-1 block text-xs text-blood">! {errors[name]}</span>}
          </label>
        ))}
        {error && <div className="border border-blood/50 bg-blood/5 px-3 py-2 text-xs text-blood">! {error}</div>}
        <button className="btn-primary w-full" disabled={busy}>
          {busy ? "Verifying…" : "Authenticate"}
        </button>
      </form>
    </div>
  );
}
