import Link from "next/link";
import { GlitchText } from "@/components/fx/GlitchText";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <div className="crt-overlay" aria-hidden />
      <div className="eyebrow">// error 0x194</div>
      <h1 className="h-display mt-4 text-7xl sm:text-9xl">
        <GlitchText text="404" className="glow-text" />
      </h1>
      <p className="mt-4 text-sm text-muted">Signal lost. This page doesn&apos;t exist, or it was moved.</p>
      <Link href="/" className="btn-primary mt-8">
        Return to base
      </Link>
    </div>
  );
}
