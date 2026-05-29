import { authComponent } from "../auth";

type BetterAuthSession = {
    user?: {
        tokenIdentifier?: string;
        email?: string | null;
        username?: string | null;
        name?: string | null;
        role?: string | null;
    };
};

type BetterAuthUser = NonNullable<BetterAuthSession["user"]>;
export type AuthedUser = BetterAuthUser & { tokenIdentifier: string };

function extractAuthUser(auth: unknown): BetterAuthUser | null {
    if (!auth || typeof auth !== "object") {
        return null;
    }

    const asSession = auth as BetterAuthSession;
    if (asSession.user && typeof asSession.user === "object") {
        return asSession.user;
    }

    return auth as BetterAuthUser;
}

function isCorperIdentity(user: {
    username?: string | null;
    name?: string | null;
    role?: string | null;
    tokenIdentifier?: string;
}) {
    const username = String(user.username ?? user.name ?? "").toUpperCase();
    const tokenIdentifier = String(user.tokenIdentifier ?? "").toUpperCase();
    if (String(user.role ?? "").toLowerCase() === "corper") return true;
    if (username.startsWith("NYSC/")) return true;
    if (tokenIdentifier.includes("NYSC/")) return true;
    return false;
}

export async function requireSignedInUser(
    ctx: Parameters<typeof authComponent.getAuthUser>[0]
): Promise<AuthedUser> {
    const auth = await authComponent.getAuthUser(ctx);
    const user = extractAuthUser(auth);
    if (user?.tokenIdentifier) {
        return {
            ...user,
            tokenIdentifier: user.tokenIdentifier,
        };
    }

    const identity = await ctx.auth.getUserIdentity();
    if (user) {
        if (identity) {
            return {
                ...user,
                tokenIdentifier: identity.tokenIdentifier,
            };
        }
        const synthetic = String(user.email ?? user.username ?? user.name ?? "").trim();
        if (synthetic) {
            return {
                ...user,
                tokenIdentifier: `better-auth:${synthetic}`,
            };
        }
        throw new Error("Unauthorized");
    }

    if (!identity) throw new Error("Unauthorized");
    return {
        tokenIdentifier: identity.tokenIdentifier,
        email: identity.email ?? null,
        username: identity.nickname ?? identity.name ?? null,
        name: identity.name ?? null,
        role: null,
    };
}

export async function requireAdmin(ctx: Parameters<typeof authComponent.getAuthUser>[0]) {
    const user = await requireSignedInUser(ctx);
    if (isCorperIdentity(user)) throw new Error("Forbidden");
    return user;
}
