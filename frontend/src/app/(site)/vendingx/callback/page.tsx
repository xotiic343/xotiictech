"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function VendingXCallback() {
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    const code = params.get("code");
    const state = params.get("state");
    if (code && state) {
      fetch(`/vendingx/auth/callback?code=${code}&state=${state}`, {
        credentials: "include",
        redirect: "manual",
      }).then(() => {
        router.replace("/vendingx");
      });
    } else {
      router.replace("/vendingx");
    }
  }, [params, router]);

  return (
    <section className="container-x flex min-h-[50vh] items-center justify-center">
      <div className="text-center">
        <div className="font-display text-2xl text-cyan" style={{ textShadow: "0 0 15px rgba(0,229,255,.4)" }}>
          Authenticating...
        </div>
        <p className="mt-3 text-sm text-muted">Redirecting to Vending X</p>
      </div>
    </section>
  );
}
