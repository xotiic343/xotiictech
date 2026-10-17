import { z } from "zod";

export const commissionSchema = z.object({
  discord_username: z.string().trim().min(2, "Too short").max(100),
  email: z.string().trim().email("Enter a valid email"),
  server_size: z.enum(["<100", "100-1k", "1k-10k", "10k-100k", "100k+"]),
  purpose: z.string().trim().min(10, "Tell me a bit more (10+ chars)").max(3000),
  features: z.string().trim().min(10, "List the features you need (10+ chars)").max(5000),
  budget: z.enum(["<$50", "$50-150", "$150-500", "$500-1500", "$1500+"]),
  timeline: z.enum(["asap", "1-2 weeks", "1 month", "flexible"]),
  reference_bot: z.string().optional(),
  website: z.string().max(0).optional(),
});

export const contactSchema = z.object({
  name: z.string().trim().min(1, "Required").max(120),
  email: z.string().trim().email("Enter a valid email"),
  subject: z.string().trim().min(2, "Required").max(200),
  message: z.string().trim().min(10, "At least 10 characters").max(5000),
  website: z.string().max(0).optional(),
});

export const emailSchema = z.object({ email: z.string().trim().email("Enter a valid email") });

export const adminLoginSchema = z.object({
  username: z.string().min(1, "Required"),
  password: z.string().min(1, "Required"),
  totp: z.string().regex(/^\d{6}$/, "6-digit code"),
});

export const passwordSchema = z.object({
  new_password: z.string().min(10, "At least 10 characters").max(128),
  current_password: z.string().optional(),
});

export function fieldErrors(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const k = issue.path.join(".");
    if (!out[k]) out[k] = issue.message;
  }
  return out;
}
