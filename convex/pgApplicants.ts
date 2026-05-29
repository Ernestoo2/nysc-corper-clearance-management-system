import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { authComponent } from "./auth";

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
type AuthedUser = BetterAuthUser & { tokenIdentifier: string };

const pgApplicantFields = {
    fullName: v.string(),
    addressLine1: v.string(),
    addressLine2: v.optional(v.string()),
    city: v.string(),
    state: v.string(),
    country: v.optional(v.string()),
    salutationTitle: v.optional(v.string()),
    salutationName: v.optional(v.string()),
    faculty: v.string(),
    department: v.string(),
    degreeType: v.string(),
    programme: v.string(),
    programmeOption: v.optional(v.string()),
    academicSession: v.string(),
    sessionStartDate: v.string(),
    status: v.string(),
};

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

async function requireSignedInUser(
    ctx: Parameters<typeof authComponent.getAuthUser>[0]
): Promise<AuthedUser> {
    const auth = await authComponent.getAuthUser(ctx);
    const user = extractAuthUser(auth);
    if (user?.tokenIdentifier) {
        return { ...user, tokenIdentifier: user.tokenIdentifier };
    }

    const identity = await ctx.auth.getUserIdentity();
    if (user) {
        if (identity) {
            return { ...user, tokenIdentifier: identity.tokenIdentifier };
        }
        const synthetic = String(user.email ?? user.username ?? user.name ?? "").trim();
        if (synthetic) {
            return { ...user, tokenIdentifier: `better-auth:${synthetic}` };
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

async function requireAdmin(ctx: Parameters<typeof authComponent.getAuthUser>[0]) {
    const user = await requireSignedInUser(ctx);
    if (isCorperIdentity(user)) throw new Error("Forbidden");
    return user;
}

function normalizeOptionalFilter(value: string | null | undefined) {
    const trimmed = value?.trim();
    return trimmed && trimmed.length > 0 ? trimmed : null;
}

function normalizePgApplicantInput(args: {
    fullName: string;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state: string;
    country?: string;
    salutationTitle?: string;
    salutationName?: string;
    faculty: string;
    department: string;
    degreeType: string;
    programme: string;
    programmeOption?: string;
    academicSession: string;
    sessionStartDate: string;
    status: string;
}) {
    const fullName = args.fullName.trim();
    const addressLine1 = args.addressLine1.trim();
    const addressLine2 = args.addressLine2?.trim() || undefined;
    const city = args.city.trim();
    const state = args.state.trim();
    const country = (args.country?.trim() || "Nigeria").trim();
    const salutationTitle = args.salutationTitle?.trim() || undefined;
    const salutationName = args.salutationName?.trim() || undefined;
    const faculty = args.faculty.trim();
    const department = args.department.trim();
    const degreeType = args.degreeType.trim();
    const programme = args.programme.trim();
    const programmeOption = args.programmeOption?.trim() || undefined;
    const academicSession = args.academicSession.trim();
    const sessionStartDate = args.sessionStartDate.trim();
    const status = args.status.trim().toUpperCase();

    if (!fullName) throw new Error("Full name is required");
    if (!addressLine1) throw new Error("Address line 1 is required");
    if (!city) throw new Error("City is required");
    if (!state) throw new Error("State is required");
    if (!faculty) throw new Error("Faculty is required");
    if (!department) throw new Error("Department is required");
    if (!degreeType) throw new Error("Degree type is required");
    if (!programme) throw new Error("Programme is required");
    if (!academicSession) throw new Error("Academic session is required");
    if (!sessionStartDate) throw new Error("Session start date is required");

    const allowedStatuses = new Set(["PENDING", "ADMITTED", "WITHDRAWN"]);
    if (!allowedStatuses.has(status)) {
        throw new Error("Status must be PENDING, ADMITTED, or WITHDRAWN");
    }

    return {
        fullName,
        fullNameSearch: fullName.toUpperCase(),
        addressLine1,
        addressLine2,
        city,
        state,
        country,
        salutationTitle,
        salutationName,
        faculty,
        department,
        degreeType,
        programme,
        programmeOption,
        academicSession,
        sessionStartDate,
        status,
    };
}

export const list = query({
    args: {
        paginationOpts: paginationOptsValidator,
        status: v.optional(v.string()),
        academicSession: v.optional(v.string()),
        searchText: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        await requireAdmin(ctx);

        const status = normalizeOptionalFilter(args.status)?.toUpperCase() ?? null;
        const academicSession = normalizeOptionalFilter(args.academicSession) ?? null;
        const searchText = normalizeOptionalFilter(args.searchText)?.toUpperCase() ?? null;

        if (searchText) {
            return await ctx.db
                .query("pgApplicants")
                .withIndex("by_full_name_search", (q) =>
                    q.gte("fullNameSearch", searchText).lt("fullNameSearch", `${searchText}\uffff`)
                )
                .order("asc")
                .paginate(args.paginationOpts);
        }

        if (academicSession && status) {
            return await ctx.db
                .query("pgApplicants")
                .withIndex("by_academic_session_and_status", (q) =>
                    q.eq("academicSession", academicSession).eq("status", status)
                )
                .order("desc")
                .paginate(args.paginationOpts);
        }

        if (academicSession) {
            return await ctx.db
                .query("pgApplicants")
                .withIndex("by_academic_session", (q) => q.eq("academicSession", academicSession))
                .order("desc")
                .paginate(args.paginationOpts);
        }

        if (status) {
            return await ctx.db
                .query("pgApplicants")
                .withIndex("by_status", (q) => q.eq("status", status))
                .order("desc")
                .paginate(args.paginationOpts);
        }

        return await ctx.db.query("pgApplicants").order("desc").paginate(args.paginationOpts);
    },
});

export const get = query({
    args: { id: v.id("pgApplicants") },
    handler: async (ctx, args) => {
        await requireAdmin(ctx);
        return await ctx.db.get(args.id);
    },
});

export const create = mutation({
    args: pgApplicantFields,
    handler: async (ctx, args) => {
        const user = await requireAdmin(ctx);
        const now = Date.now();
        const normalized = normalizePgApplicantInput(args);

        const applicantId = await ctx.db.insert("pgApplicants", {
            ...normalized,
            createdAt: now,
        });

        await ctx.db.insert("pgApplicantAuditLogs", {
            pgApplicantId: applicantId,
            action: "create",
            timestamp: now,
            actorTokenIdentifier: String(user.tokenIdentifier ?? "unknown"),
            actorEmail: user.email ?? null,
            actorUsername: user.username ?? null,
            summary: `created PG applicant ${normalized.fullName}`,
        });

        return { id: applicantId };
    },
});

export const update = mutation({
    args: {
        id: v.id("pgApplicants"),
        ...pgApplicantFields,
    },
    handler: async (ctx, args) => {
        const user = await requireAdmin(ctx);
        const now = Date.now();

        const existing = await ctx.db.get(args.id);
        if (!existing) throw new Error("PG applicant not found");

        const normalized = normalizePgApplicantInput(args);

        await ctx.db.patch(args.id, normalized);

        await ctx.db.insert("pgApplicantAuditLogs", {
            pgApplicantId: args.id,
            action: "update",
            timestamp: now,
            actorTokenIdentifier: String(user.tokenIdentifier ?? "unknown"),
            actorEmail: user.email ?? null,
            actorUsername: user.username ?? null,
            summary: `updated PG applicant ${normalized.fullName}`,
        });

        return { ok: true };
    },
});

export const remove = mutation({
    args: { id: v.id("pgApplicants") },
    handler: async (ctx, args) => {
        const user = await requireAdmin(ctx);
        const now = Date.now();

        const existing = await ctx.db.get(args.id);
        if (!existing) return { ok: true };

        await ctx.db.delete(args.id);

        await ctx.db.insert("pgApplicantAuditLogs", {
            pgApplicantId: args.id,
            action: "delete",
            timestamp: now,
            actorTokenIdentifier: String(user.tokenIdentifier ?? "unknown"),
            actorEmail: user.email ?? null,
            actorUsername: user.username ?? null,
            summary: `deleted PG applicant ${existing.fullName}`,
        });

        return { ok: true };
    },
});
