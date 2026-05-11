import { createAuthClient } from "better-auth/react";
import { convexClient } from "@convex-dev/better-auth/client/plugins";
import { usernameClient } from "better-auth/client/plugins";

const appBase =
  typeof process !== "undefined" && process.env.NEXT_PUBLIC_APP_URL
    ? process.env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "")
    : undefined;

export const authClient = createAuthClient({
  ...(appBase ? { baseURL: appBase } : {}),
  plugins: [convexClient(), usernameClient()],
});

export const { signIn, signOut, signUp, useSession } = authClient;