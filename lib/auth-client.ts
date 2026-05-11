import { createAuthClient } from "better-auth/react";
import { convexClient } from "@convex-dev/better-auth/client/plugins";
import { usernameClient } from "better-auth/client/plugins";

/**
 * Better Auth must call `/api/auth/*` on the same origin as the page.
 * `NEXT_PUBLIC_APP_URL` is often a single fixed URL (e.g. one preview or production),
 * but Vercel gives every deployment a different hostname — using it as `baseURL` here
 * causes cross-origin fetches, missing cookies, bogus CORS errors, and 401s.
 */
const authBaseUrl = typeof window !== "undefined" ? window.location.origin : undefined;

export const authClient = createAuthClient({
  ...(authBaseUrl ? { baseURL: authBaseUrl } : {}),
  plugins: [convexClient(), usernameClient()],
});

export const { signIn, signOut, signUp, useSession } = authClient;