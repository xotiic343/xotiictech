const isDev = process.env.NODE_ENV !== "production";

const backendUrl = (
  process.env.BACKEND_URL ||
  (process.env.BACKEND_HOSTPORT ? `http://${process.env.BACKEND_HOSTPORT}` : "http://localhost:8000")
).replace(/\/$/, "");

const csp = [
  "default-src 'self'",
  // Next.js injects small inline bootstrap scripts; the boot-sequence guard is inline too.
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "media-src 'self' https:",
  "font-src 'self' data:",
  // Admin uploads go straight from the browser to the storage bucket (presigned URLs), so the bucket's
  // host must be allowed here. Override with UPLOAD_CONNECT_SRC (space-separated) for another provider.
  `connect-src 'self' ${
    process.env.UPLOAD_CONNECT_SRC ||
    "https://*.supabase.co https://*.r2.cloudflarestorage.com https://*.backblazeb2.com https://*.amazonaws.com"
  }`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  // discord.com: /support's "Login with Discord" form redirects there for OAuth.
  "form-action 'self' https://checkout.stripe.com https://discord.com",
  "object-src 'none'",
].join("; ");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  eslint: { ignoreDuringBuilds: true },
  // Same-origin proxy: browser → xotiictech.com/api/* → FastAPI (keeps auth cookies first-party).
  // /support's own API lives at /support/api/* (Next.js route handlers), so it never hits this proxy.
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${backendUrl}/api/:path*` }];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
      { source: "/xotiic/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
      { source: "/support/exotic/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
      { source: "/support/api/:path*", headers: [{ key: "Cache-Control", value: "no-store" }] },
    ];
  },
};

export default nextConfig;
