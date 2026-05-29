import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { components } from "./_generated/api";
import { DataModel } from "./_generated/dataModel";
import { query } from "./_generated/server";
import { betterAuth } from "better-auth/minimal";
import { username } from "better-auth/plugins/username";
import authConfig from "./auth.config";

type GlobalWithProcess = typeof globalThis & {
  process?: {
    env?: Record<string, string | undefined>;
  };
};

const processEnv = (globalThis as GlobalWithProcess).process?.env;

function normalizeOrigin(value: string | null | undefined) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return undefined;
  try {
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      return new URL(trimmed).origin;
    }
    return new URL(`https://${trimmed}`).origin;
  } catch {
    return undefined;
  }
}

const siteUrl = normalizeOrigin(
  processEnv?.NEXT_PUBLIC_CONVEX_SITE_URL ??
    processEnv?.CONVEX_SITE_URL ??
    processEnv?.SITE_URL ??
    processEnv?.NEXT_PUBLIC_SITE_URL
);
const appUrl = normalizeOrigin(
  processEnv?.NEXT_PUBLIC_APP_URL ??
    processEnv?.APP_URL ??
    processEnv?.NEXT_PUBLIC_SITE_URL ??
    processEnv?.SITE_URL
);
const vercelUrlRaw = processEnv?.VERCEL_URL ?? processEnv?.NEXT_PUBLIC_VERCEL_URL;
const vercelUrl = normalizeOrigin(vercelUrlRaw);
const additionalOriginsRaw = processEnv?.BETTER_AUTH_TRUSTED_ORIGINS ?? processEnv?.ADDITIONAL_TRUSTED_ORIGINS;
const additionalOrigins = additionalOriginsRaw
  ? additionalOriginsRaw
      .split(",")
      .map((origin) => normalizeOrigin(origin))
      .filter((origin): origin is string => Boolean(origin))
  : [];
const fallbackLocalUrl = processEnv?.NODE_ENV !== "production" ? "http://localhost:3000" : undefined;
/** Full URL used when the incoming Host does not match allowedHosts (Better Auth "fallback"). */
const fallbackBaseUrl = appUrl ?? siteUrl ?? vercelUrl ?? fallbackLocalUrl;
if (!fallbackBaseUrl) {
  throw new Error(
    "Missing NEXT_PUBLIC_APP_URL, APP_URL, NEXT_PUBLIC_CONVEX_SITE_URL, CONVEX_SITE_URL, SITE_URL, NEXT_PUBLIC_SITE_URL, or VERCEL_URL environment variable in convex/auth.ts"
  );
}

/**
 * Vercel gives a new *.vercel.app hostname on every preview deployment.
 * Convex runs this code on Convex servers, so process.env.VERCEL_URL is usually unset there.
 * Better Auth supports wildcard trusted origins + dynamic baseURL (allowedHosts).
 * @see https://www.better-auth.com/docs/reference/options (baseURL object, trustedOrigins wildcards)
 */
const allowVercelPreviewHosts =
  processEnv?.AUTH_TRUST_VERCEL_APP !== "0" && processEnv?.AUTH_STATIC_BASE_URL !== "1";

function hostFromOrigin(origin: string | undefined) {
  if (!origin) return null;
  try {
    return new URL(origin).hostname;
  } catch {
    return null;
  }
}

const allowedHosts = new Set<string>();
if (allowVercelPreviewHosts) {
  allowedHosts.add("*.vercel.app");
}
for (const origin of [appUrl, siteUrl, vercelUrl].filter(Boolean) as string[]) {
  const host = hostFromOrigin(origin);
  if (host) allowedHosts.add(host);
}
if (processEnv?.NODE_ENV !== "production") {
  allowedHosts.add("localhost:*");
  allowedHosts.add("127.0.0.1:*");
}

const trustedOriginsList: string[] = [];
if (allowVercelPreviewHosts) {
  trustedOriginsList.push("https://*.vercel.app");
}
if (siteUrl) trustedOriginsList.push(siteUrl);
if (appUrl) trustedOriginsList.push(appUrl);
if (vercelUrl) trustedOriginsList.push(vercelUrl);
trustedOriginsList.push(...additionalOrigins);
if (processEnv?.NODE_ENV !== "production") {
  trustedOriginsList.push("http://localhost:3000", "http://127.0.0.1:3000");
}

if (processEnv?.DEBUG_AUTH_ORIGINS === "1") {
  console.log("Auth allowedHosts:", Array.from(allowedHosts));
  console.log("Auth trustedOrigins:", trustedOriginsList);
}

/** Origins we always allow when present on the incoming request (wildcard matching in Better Auth is flaky for some versions). */
const explicitEnvOrigins = new Set(
  [siteUrl, appUrl, vercelUrl, ...additionalOrigins].filter(Boolean) as string[]
);

function readClientOrigin(request: Request): string | null {
  const raw = request.headers.get("origin");
  if (raw && raw !== "null") {
    try {
      return new URL(raw).origin;
    } catch {
      return null;
    }
  }
  const referer = request.headers.get("referer");
  if (referer) {
    try {
      return new URL(referer).origin;
    } catch {
      return null;
    }
  }
  return null;
}

function originIsExplicitlyConfigured(origin: string): boolean {
  return explicitEnvOrigins.has(origin);
}

function originIsAllowedVercelPreview(origin: string): boolean {
  if (!allowVercelPreviewHosts) return false;
  try {
    const { protocol, hostname } = new URL(origin);
    return protocol === "https:" && hostname.endsWith(".vercel.app");
  } catch {
    return false;
  }
}

function originIsAllowedLocalDev(origin: string): boolean {
  if (processEnv?.NODE_ENV === "production") return false;
  try {
    const { protocol, hostname } = new URL(origin);
    if (hostname !== "localhost" && hostname !== "127.0.0.1") return false;
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Merge static patterns with the actual browser origin on each request.
 * Convex does not have Vercel's VERCEL_URL at runtime, and `https://*.vercel.app`
 * does not always match preview URLs across Better Auth releases — that yields 403 INVALID_ORIGIN.
 */
async function trustedOriginsForRequest(request: Request | undefined): Promise<string[]> {
  const merged = new Set<string>(trustedOriginsList);
  if (request) {
    const clientOrigin = readClientOrigin(request);
    if (clientOrigin) {
      if (
        originIsExplicitlyConfigured(clientOrigin) ||
        originIsAllowedVercelPreview(clientOrigin) ||
        originIsAllowedLocalDev(clientOrigin)
      ) {
        merged.add(clientOrigin);
      } else if (processEnv?.DEBUG_AUTH_ORIGINS === "1") {
        console.log("Auth rejected client origin (not merged):", clientOrigin);
      }
    }
  }
  return Array.from(merged);
}

const dynamicProtocol =
  fallbackBaseUrl.startsWith("http://") && !fallbackBaseUrl.startsWith("https://")
    ? ("auto" as const)
    : ("https" as const);

const betterAuthBaseUrl =
  allowVercelPreviewHosts && allowedHosts.size > 0
    ? {
        allowedHosts: Array.from(allowedHosts),
        protocol: dynamicProtocol,
        fallback: fallbackBaseUrl,
      }
    : fallbackBaseUrl;

// The component client has methods needed for integrating Convex with Better Auth,
// as well as helper methods for general use.
const authComponentApi = components.betterAuth;
export const authComponent = createClient<DataModel>(authComponentApi);

export const createAuth = (ctx: GenericCtx<DataModel>) => {
  return betterAuth({
    baseURL: betterAuthBaseUrl,
    trustedOrigins: trustedOriginsForRequest,
    database: authComponent.adapter(ctx),
    // Configure simple, non-verified email/password to get started for admins
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
      minPasswordLength: 1,
    },
    plugins: [
      // Custom corper login using call-up number as username
      username({
        usernameValidator: (username) => {
          return /^[A-Za-z0-9/_-]+$/.test(username.trim());
        },
        usernameNormalization: (username) => username.trim().toUpperCase(),
      }),
      // The Convex plugin is required for Convex compatibility
      convex({ authConfig }),
    ],
  })
}

export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    return authComponent.getAuthUser(ctx);
  },
});