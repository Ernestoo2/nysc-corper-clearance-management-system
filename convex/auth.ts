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
const siteUrl = processEnv?.NEXT_PUBLIC_CONVEX_SITE_URL ?? processEnv?.CONVEX_SITE_URL ?? processEnv?.SITE_URL ?? processEnv?.NEXT_PUBLIC_SITE_URL;
const appUrl = processEnv?.NEXT_PUBLIC_APP_URL ?? processEnv?.APP_URL ?? processEnv?.NEXT_PUBLIC_SITE_URL ?? processEnv?.SITE_URL;
const fallbackLocalUrl = processEnv?.NODE_ENV !== "production" ? "http://localhost:3000" : undefined;
const baseURL = appUrl ?? siteUrl ?? fallbackLocalUrl;
if (!baseURL) {
  throw new Error(
    "Missing NEXT_PUBLIC_APP_URL, APP_URL, NEXT_PUBLIC_CONVEX_SITE_URL, CONVEX_SITE_URL, SITE_URL, or NEXT_PUBLIC_SITE_URL environment variable in convex/auth.ts"
  );
}

const trustedOrigins = new Set<string>([baseURL]);
if (siteUrl) trustedOrigins.add(siteUrl);
if (appUrl) trustedOrigins.add(appUrl);
if (processEnv?.NODE_ENV !== "production") {
  trustedOrigins.add("http://localhost:3000");
  trustedOrigins.add("http://127.0.0.1:3000");
}

// The component client has methods needed for integrating Convex with Better Auth,
// as well as helper methods for general use.
const authComponentApi = components.betterAuth;
export const authComponent = createClient<DataModel>(authComponentApi);

export const createAuth = (ctx: GenericCtx<DataModel>) => {
  return betterAuth({
    baseURL: baseURL,
    trustedOrigins: Array.from(trustedOrigins),
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

// Example function for getting the current user
// Feel free to edit, omit, etc.
export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    return authComponent.getAuthUser(ctx);
  },
});