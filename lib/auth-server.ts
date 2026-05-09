import { convexBetterAuthNextJs } from "@convex-dev/better-auth/nextjs";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL ?? process.env.CONVEX_URL;
const vercelUrlRaw = process.env.VERCEL_URL ?? process.env.NEXT_PUBLIC_VERCEL_URL;
const inferredAppUrl = vercelUrlRaw ? `https://${vercelUrlRaw}` : undefined;
const convexSiteUrl =
  process.env.NEXT_PUBLIC_CONVEX_SITE_URL ??
  process.env.CONVEX_SITE_URL ??
  process.env.NEXT_PUBLIC_APP_URL ??
  process.env.APP_URL ??
  inferredAppUrl;

if (!convexUrl) {
  throw new Error("Missing NEXT_PUBLIC_CONVEX_URL or CONVEX_URL environment variable in lib/auth-server.ts");
}

if (!convexSiteUrl) {
  throw new Error(
    "Missing NEXT_PUBLIC_CONVEX_SITE_URL, CONVEX_SITE_URL, NEXT_PUBLIC_APP_URL, APP_URL, or VERCEL_URL environment variable in lib/auth-server.ts"
  );
}

export const {
  handler,
  preloadAuthQuery,
  isAuthenticated,
  getToken,
  fetchAuthQuery,
  fetchAuthMutation,
  fetchAuthAction,
} = convexBetterAuthNextJs({
  convexUrl,
  convexSiteUrl,
});