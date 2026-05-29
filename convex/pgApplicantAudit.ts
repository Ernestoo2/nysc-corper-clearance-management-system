import { query } from "./_generated/server";
import { v } from "convex/values";
import { authComponent } from "./auth";

type BetterAuthSession = {
    user?: {
        username?: string | null;
        name?: string | null;
        role?: string | null;
    };
};

type BetterAuthUser = NonNullable<BetterAuthSession["user"]>;

function extractAuthUser(auth: unknown): BetterAuthUser | null {
    if (!auth || typeof auth !== "object") return null;
    const asSession = auth as BetterAuthSession;
    if (asSession.user && typeof asSession.user === "object") return asSession.user;
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

async function requireAdmin(ctx: Parameters<typeof authComponent.getAuthUser>[0]) {
    const auth = await authComponent.getAuthUser(ctx);
    const user = extractAuthUser(auth);
    if (user) {
        if (isCorperIdentity(user)) throw new Error("Forbidden");
        return user;
    }

    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const derivedUser: BetterAuthUser = {
        username: identity.nickname ?? identity.name ?? null,
        name: identity.name ?? null,
        role: null,
    };
    if (isCorperIdentity({ ...derivedUser, tokenIdentifier: identity.tokenIdentifier })) {
        throw new Error("Forbidden");
    }
    return derivedUser;
}

export const listRecent = query({
    args: { limit: v.optional(v.number()) },
    handler: async (ctx, args) => {
        await requireAdmin(ctx);
        const limit = Math.min(100, Math.max(1, args.limit ?? 25));
        return await ctx.db
            .query("pgApplicantAuditLogs")
            .withIndex("by_timestamp")
            .order("desc")
            .take(limit);
    },
});

export const listByApplicant = query({
    args: { pgApplicantId: v.id("pgApplicants"), limit: v.optional(v.number()) },
    handler: async (ctx, args) => {
        await requireAdmin(ctx);
        const limit = Math.min(100, Math.max(1, args.limit ?? 25));
        return await ctx.db
            .query("pgApplicantAuditLogs")
            .withIndex("by_pg_applicant_id_and_timestamp", (q) => q.eq("pgApplicantId", args.pgApplicantId))
            .order("desc")
            .take(limit);
    },
});
