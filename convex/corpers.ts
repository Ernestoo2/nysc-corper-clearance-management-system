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

function extractAuthUser(auth: unknown): BetterAuthUser | null {
    if (!auth || typeof auth !== "object") {
        return null;
    }

    const asSession = auth as BetterAuthSession;
    if (asSession.user && typeof asSession.user === "object") {
        return asSession.user;
    }

    // better-auth + convex can return the user object directly.
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

async function requireAdmin(ctx: Parameters<typeof authComponent.getAuthUser>[0]) {
    const user = await requireSignedInUser(ctx);
    if (isCorperIdentity(user)) throw new Error("Forbidden");
    return user;
}

function normalizeOptionalFilter(value: string | null | undefined) {
    const trimmed = value?.trim();
    return trimmed && trimmed.length > 0 ? trimmed : null;
}

function normalizeMonthKey(value: string) {
    return value.trim().toLowerCase().replace(/\s+/g, "-");
}

function extractCallUpFromTokenIdentifier(tokenIdentifier: string | null | undefined) {
    const upper = String(tokenIdentifier ?? "").toUpperCase();
    const match = upper.match(/NYSC\/[A-Z0-9/.-]+/);
    return match?.[0] ?? null;
}

function normalizeComparableKey(value: string | null | undefined) {
    return String(value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function getEmailLikeLocalPart(value: string | null | undefined) {
    const raw = String(value ?? "").trim().toUpperCase();
    const at = raw.indexOf("@");
    if (at <= 0) return null;
    return raw.slice(0, at);
}

function normalizeDeploymentUnitKey(value: string | null | undefined) {
    return String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function extractServiceYearBucket(callUpNumber: string) {
    const upper = String(callUpNumber).toUpperCase();
    const match = upper.match(/(?:^|\/)(20\d{2})(?:\/|$)/);
    if (!match) return "Unknown";
    return match[1]!.slice(-2);
}

function getEnv(name: string) {
    const env = (globalThis as typeof globalThis & { process?: { env?: Record<string, string | undefined> } }).process
        ?.env;
    return env?.[name];
}

export const findByCallUp = query({
    args: { callUpNumber: v.string() },
    handler: async ({ db }, { callUpNumber }) => {
        // console.log("Convex query: looking for callUpNumber:", callUpNumber)

        // Use the index range expression (do not post-filter, which can force a scan).
        return await db
            .query("corpers")
            .withIndex("by_call_up_number", (q) => q.eq("callUpNumber", callUpNumber))
            .unique();
    },
});

export const findAll = query({
    handler: async ({ db }) => {
        return await db.query("corpers").collect();
    },
});

export const list = query({
    args: {
        paginationOpts: paginationOptsValidator,
        batch: v.optional(v.string()),
        status: v.optional(v.string()),
        deploymentUnit: v.optional(v.string()),
        searchText: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        // Admin-only registry view
        await requireAdmin(ctx);

        const batch = normalizeOptionalFilter(args.batch)?.toUpperCase() ?? null;
        const status = normalizeOptionalFilter(args.status)?.toUpperCase() ?? null;
        const deploymentUnit = normalizeOptionalFilter(args.deploymentUnit) ?? null;
        const searchText = normalizeOptionalFilter(args.searchText)?.toUpperCase() ?? null;

        // Prefer indexed access patterns. Search takes precedence.
        if (searchText) {
            // Call-up numbers are normalized to uppercase in seed + UI.
            // Use an indexed range scan for "startsWith".
            return await ctx.db
                .query("corpers")
                .withIndex("by_call_up_number", (q) =>
                    q.gte("callUpNumber", searchText).lt("callUpNumber", `${searchText}\uffff`)
                )
                .order("asc")
                .paginate(args.paginationOpts);
        }

        // Choose an index based on the provided filter combination.
        if (batch && status && deploymentUnit) {
            return await ctx.db
                .query("corpers")
                .withIndex("by_batch_and_status_and_deployment_unit", (q) =>
                    q.eq("batch", batch).eq("status", status).eq("deploymentUnit", deploymentUnit)
                )
                .order("desc")
                .paginate(args.paginationOpts);
        }

        if (batch && status) {
            return await ctx.db
                .query("corpers")
                .withIndex("by_batch_and_status", (q) => q.eq("batch", batch).eq("status", status))
                .order("desc")
                .paginate(args.paginationOpts);
        }

        if (status && deploymentUnit) {
            return await ctx.db
                .query("corpers")
                .withIndex("by_status_and_deployment_unit", (q) =>
                    q.eq("status", status).eq("deploymentUnit", deploymentUnit)
                )
                .order("desc")
                .paginate(args.paginationOpts);
        }

        if (batch && deploymentUnit) {
            return await ctx.db
                .query("corpers")
                .withIndex("by_batch_and_deployment_unit", (q) =>
                    q.eq("batch", batch).eq("deploymentUnit", deploymentUnit)
                )
                .order("desc")
                .paginate(args.paginationOpts);
        }

        if (batch) {
            return await ctx.db
                .query("corpers")
                .withIndex("by_batch", (q) => q.eq("batch", batch))
                .order("desc")
                .paginate(args.paginationOpts);
        }

        if (status) {
            return await ctx.db
                .query("corpers")
                .withIndex("by_status", (q) => q.eq("status", status))
                .order("desc")
                .paginate(args.paginationOpts);
        }

        if (deploymentUnit) {
            return await ctx.db
                .query("corpers")
                .withIndex("by_deployment_unit", (q) => q.eq("deploymentUnit", deploymentUnit))
                .order("desc")
                .paginate(args.paginationOpts);
        }

        // Default: bounded + paginated by table order.
        return await ctx.db.query("corpers").order("desc").paginate(args.paginationOpts);
    },
});

export const get = query({
    args: { id: v.id("corpers") },
    handler: async (ctx, args) => {
        await requireAdmin(ctx);
        return await ctx.db.get(args.id);
    },
});

export const reportSummary = query({
    args: { limit: v.optional(v.number()) },
    handler: async (ctx, args) => {
        await requireAdmin(ctx);
        const limit = Math.min(5000, Math.max(1, Math.floor(args.limit ?? 1000)));
        const rows = await ctx.db.query("corpers").order("desc").take(limit);

        const byStatus: Record<string, number> = {};
        const byBatch: Record<string, number> = {};
        const byDeploymentUnit: Record<string, number> = {};

        for (const row of rows) {
            byStatus[row.status] = (byStatus[row.status] ?? 0) + 1;
            byBatch[row.batch] = (byBatch[row.batch] ?? 0) + 1;
            byDeploymentUnit[row.deploymentUnit] = (byDeploymentUnit[row.deploymentUnit] ?? 0) + 1;
        }

        return {
            total: rows.length,
            byStatus,
            byBatch,
            byDeploymentUnit,
            rows: rows.map((row) => ({
                _id: row._id,
                fullName: row.fullName,
                callUpNumber: row.callUpNumber,
                stateCode: row.stateCode,
                batch: row.batch,
                status: row.status,
                deploymentUnit: row.deploymentUnit,
                createdAt: row.createdAt,
            })),
        };
    },
});

export const listByServiceYear = query({
    args: { limit: v.optional(v.number()) },
    handler: async (ctx, args) => {
        await requireAdmin(ctx);
        const limit = Math.min(5000, Math.max(1, Math.floor(args.limit ?? 5000)));
        const rows = await ctx.db.query("corpers").order("desc").take(limit);

        const grouped: Record<string, Array<{
            _id: string;
            callUpNumber: string;
            fullName: string;
            batch: string;
            status: string;
            deploymentUnit: string;
            createdAt: number;
        }>> = {};

        for (const row of rows) {
            const bucket = extractServiceYearBucket(row.callUpNumber);
            if (!grouped[bucket]) grouped[bucket] = [];
            grouped[bucket]!.push({
                _id: row._id,
                callUpNumber: row.callUpNumber,
                fullName: row.fullName,
                batch: row.batch,
                status: row.status,
                deploymentUnit: row.deploymentUnit,
                createdAt: row.createdAt,
            });
        }

        const years = Object.keys(grouped).sort((a, b) => {
            if (a === "Unknown") return 1;
            if (b === "Unknown") return -1;
            return Number(b) - Number(a);
        });

        return {
            total: rows.length,
            years,
            grouped,
        };
    },
});

/** Safe, read-only integration flags for the admin settings panel (no secrets). */
export const adminPanelDiagnostics = query({
    args: {},
    handler: async (ctx) => {
        await requireAdmin(ctx);
        const deploymentSyncTokenConfigured = Boolean(
            String(getEnv("DEPLOYMENT_SYNC_TOKEN") ?? "").trim().length
        );
        return { deploymentSyncTokenConfigured };
    },
});

export const generateMonthlyFormUploadUrl = mutation({
    args: {},
    handler: async (ctx) => {
        await requireAdmin(ctx);
        return await ctx.storage.generateUploadUrl();
    },
});

export const publishSharedMonthlyForm = mutation({
    args: {
        monthLabel: v.string(),
        monthKey: v.optional(v.string()),
        fileId: v.id("_storage"),
        fileName: v.string(),
    },
    handler: async (ctx, args) => {
        const user = await requireAdmin(ctx);
        const now = Date.now();
        const monthKey = normalizeMonthKey(args.monthKey ?? args.monthLabel);

        const existing = await ctx.db
            .query("monthlyClearanceForms")
            .withIndex("by_month_key", (q) => q.eq("monthKey", monthKey))
            .unique();

        if (existing) {
            await ctx.db.patch(existing._id, {
                monthLabel: args.monthLabel.trim(),
                fileId: args.fileId,
                fileName: args.fileName.trim(),
                publishedAt: now,
                publishedBy: String(user.tokenIdentifier),
            });
            return { id: existing._id, updated: true };
        }

        const id = await ctx.db.insert("monthlyClearanceForms", {
            monthKey,
            monthLabel: args.monthLabel.trim(),
            fileId: args.fileId,
            fileName: args.fileName.trim(),
            publishedAt: now,
            publishedBy: String(user.tokenIdentifier),
        });
        return { id, updated: false };
    },
});

export const getLatestSharedMonthlyForm = query({
    args: {},
    handler: async (ctx) => {
        await requireSignedInUser(ctx);
        const latest = await ctx.db
            .query("monthlyClearanceForms")
            .withIndex("by_published_at")
            .order("desc")
            .first();
        if (!latest) return null;
        const downloadUrl = await ctx.storage.getUrl(latest.fileId);
        return {
            ...latest,
            downloadUrl,
        };
    },
});

export const upsertDeploymentUnitHead = mutation({
    args: {
        deploymentUnit: v.string(),
        headOfUnit: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        await requireAdmin(ctx);
        const deploymentUnit = args.deploymentUnit.trim();
        if (!deploymentUnit) throw new Error("deploymentUnit is required");
        const now = Date.now();
        const existing = await ctx.db
            .query("deploymentUnits")
            .withIndex("by_deployment_unit", (q) => q.eq("deploymentUnit", deploymentUnit))
            .unique();
        if (existing) {
            await ctx.db.patch(existing._id, {
                headOfUnit: args.headOfUnit?.trim() || undefined,
                updatedAt: now,
            });
            return { id: existing._id, updated: true };
        }
        const id = await ctx.db.insert("deploymentUnits", {
            deploymentUnit,
            headOfUnit: args.headOfUnit?.trim() || undefined,
            updatedAt: now,
        });
        return { id, updated: false };
    },
});

export const upsertDeploymentUnitHeadFromPush = mutation({
    args: {
        deploymentUnit: v.string(),
        headOfUnit: v.optional(v.string()),
        pushToken: v.string(),
    },
    handler: async (ctx, args) => {
        const expected = getEnv("DEPLOYMENT_SYNC_TOKEN");
        if (!expected || args.pushToken !== expected) {
            throw new Error("Unauthorized");
        }
        const deploymentUnit = args.deploymentUnit.trim();
        if (!deploymentUnit) throw new Error("deploymentUnit is required");
        const now = Date.now();
        const existing = await ctx.db
            .query("deploymentUnits")
            .withIndex("by_deployment_unit", (q) => q.eq("deploymentUnit", deploymentUnit))
            .unique();
        if (existing) {
            await ctx.db.patch(existing._id, {
                headOfUnit: args.headOfUnit?.trim() || undefined,
                updatedAt: now,
            });
            return { id: existing._id, updated: true };
        }
        const id = await ctx.db.insert("deploymentUnits", {
            deploymentUnit,
            headOfUnit: args.headOfUnit?.trim() || undefined,
            updatedAt: now,
        });
        return { id, updated: false };
    },
});

export const listDeploymentUnitHeads = query({
    args: {},
    handler: async (ctx) => {
        await requireAdmin(ctx);
        return await ctx.db.query("deploymentUnits").withIndex("by_deployment_unit").order("asc").take(5000);
    },
});

export const getMyClearanceContext = query({
    args: {},
    handler: async (ctx) => {
        let user: AuthedUser;
        try {
            user = await requireSignedInUser(ctx);
        } catch {
            // During logout, client queries can briefly outlive auth state.
            // Returning null avoids surfacing an exception in the UI.
            return null;
        }
        const candidateFromUsername = String(user.username ?? "").trim().toUpperCase();
        const candidateFromName = String(user.name ?? "").trim().toUpperCase();
        const candidateFromToken = extractCallUpFromTokenIdentifier(user.tokenIdentifier);
        const emailLocalFromToken = getEmailLikeLocalPart(user.tokenIdentifier);
        const emailLocalFromEmail = getEmailLikeLocalPart(user.email);
        const callUpCandidate =
            [candidateFromUsername, candidateFromName, candidateFromToken].find((value) =>
                Boolean(value && value.startsWith("NYSC/"))
            ) ?? "";
        const canResolveCorper = callUpCandidate.startsWith("NYSC/");
        let corper = canResolveCorper
            ? await ctx.db
                .query("corpers")
                .withIndex("by_call_up_number", (q) => q.eq("callUpNumber", callUpCandidate))
                .unique()
            : null;

        if (!corper) {
            // Fallback matching for identities where auth fields are transformed
            // (e.g. token identifiers based on email local parts).
            const fallbackRows = await ctx.db.query("corpers").order("desc").take(5000);
            const rawCandidates = [
                candidateFromUsername,
                candidateFromName,
                candidateFromToken,
                emailLocalFromToken,
                emailLocalFromEmail,
            ].filter(Boolean);
            const comparableCandidates = rawCandidates
                .map((value) => normalizeComparableKey(value))
                .filter((value) => value.length > 0);
            corper =
                fallbackRows.find((row) => {
                    const rowKey = normalizeComparableKey(row.callUpNumber);
                    return comparableCandidates.some(
                        (candidate) =>
                            candidate === rowKey || candidate.includes(rowKey) || rowKey.includes(candidate)
                    );
                }) ?? null;
        }

        let unit = corper
            ? await ctx.db
                .query("deploymentUnits")
                .withIndex("by_deployment_unit", (q) => q.eq("deploymentUnit", corper.deploymentUnit))
                .unique()
            : null;

        if (!unit && corper) {
            const targetUnitKey = normalizeDeploymentUnitKey(corper.deploymentUnit);
            const fallbackUnits = await ctx.db.query("deploymentUnits").order("asc").take(5000);
            unit =
                fallbackUnits.find(
                    (row) => normalizeDeploymentUnitKey(row.deploymentUnit) === targetUnitKey
                ) ?? null;
        }

        const latestForm = await ctx.db
            .query("monthlyClearanceForms")
            .withIndex("by_published_at")
            .order("desc")
            .first();
        const downloadUrl = latestForm ? await ctx.storage.getUrl(latestForm.fileId) : null;

        return {
            corper: corper
                ? {
                    fullName: corper.fullName,
                    callUpNumber: corper.callUpNumber,
                    stateCode: corper.stateCode,
                    deploymentUnit: corper.deploymentUnit,
                    headOfUnit: corper.headOfUnit ?? unit?.headOfUnit ?? null,
                }
                : null,
            latestForm: latestForm
                ? {
                    monthLabel: latestForm.monthLabel,
                    fileName: latestForm.fileName,
                    publishedAt: latestForm.publishedAt,
                    downloadUrl,
                }
                : null,
        };
    },
});

export const create = mutation({
    args: {
        callUpNumber: v.string(),
        stateCode: v.string(),
        status: v.string(),
        fullName: v.string(),
        batch: v.string(),
        deploymentUnit: v.string(),
    },
    handler: async (ctx, args) => {
        const user = await requireAdmin(ctx);
        const now = Date.now();

        const callUpNumber = args.callUpNumber.trim().toUpperCase();
        const stateCode = args.stateCode.trim().toUpperCase();
        const status = args.status.trim().toUpperCase();
        const fullName = args.fullName.trim();
        const batch = args.batch.trim().toUpperCase();
        const deploymentUnit = args.deploymentUnit.trim();

        if (!callUpNumber) throw new Error("Call-up number is required");
        if (!fullName) throw new Error("Full name is required");

        const duplicate = await ctx.db
            .query("corpers")
            .withIndex("by_call_up_number", (q) => q.eq("callUpNumber", callUpNumber))
            .unique();
        if (duplicate) {
            throw new Error(
                `A corper with call-up number ${callUpNumber} already exists. Use edit or remove the duplicate first.`
            );
        }

        const corperId = await ctx.db.insert("corpers", {
            callUpNumber,
            stateCode,
            status,
            fullName,
            batch,
            deploymentUnit,
            createdAt: now,
        });

        await ctx.db.insert("corperAuditLogs", {
            corperId,
            action: "create",
            timestamp: now,
            actorTokenIdentifier: String(user.tokenIdentifier ?? "unknown"),
            actorEmail: user.email ?? null,
            actorUsername: user.username ?? null,
            summary: `created corper ${callUpNumber}`,
        });

        return { id: corperId };
    },
});

export const update = mutation({
    args: {
        id: v.id("corpers"),
        callUpNumber: v.string(),
        stateCode: v.string(),
        status: v.string(),
        fullName: v.string(),
        batch: v.string(),
        deploymentUnit: v.string(),
    },
    handler: async (ctx, args) => {
        const user = await requireAdmin(ctx);
        const now = Date.now();

        const existing = await ctx.db.get(args.id);
        if (!existing) throw new Error("Corper not found");

        const callUpNumber = args.callUpNumber.trim().toUpperCase();
        const stateCode = args.stateCode.trim().toUpperCase();
        const status = args.status.trim().toUpperCase();
        const fullName = args.fullName.trim();
        const batch = args.batch.trim().toUpperCase();
        const deploymentUnit = args.deploymentUnit.trim();

        if (!callUpNumber) throw new Error("Call-up number is required");
        if (!fullName) throw new Error("Full name is required");

        if (callUpNumber !== existing.callUpNumber) {
            const clash = await ctx.db
                .query("corpers")
                .withIndex("by_call_up_number", (q) => q.eq("callUpNumber", callUpNumber))
                .unique();
            if (clash && clash._id !== args.id) {
                throw new Error(
                    `Another corper already uses call-up number ${callUpNumber}. Choose a different call-up number.`
                );
            }
        }

        await ctx.db.patch("corpers", args.id, {
            callUpNumber,
            stateCode,
            status,
            fullName,
            batch,
            deploymentUnit,
        });

        await ctx.db.insert("corperAuditLogs", {
            corperId: args.id,
            action: "update",
            timestamp: now,
            actorTokenIdentifier: String(user.tokenIdentifier ?? "unknown"),
            actorEmail: user.email ?? null,
            actorUsername: user.username ?? null,
            summary: `updated corper ${callUpNumber}`,
        });

        return { ok: true };
    },
});

export const remove = mutation({
    args: { id: v.id("corpers") },
    handler: async (ctx, args) => {
        const user = await requireAdmin(ctx);
        const now = Date.now();

        const existing = await ctx.db.get(args.id);
        if (!existing) return { ok: true };

        await ctx.db.delete(args.id);

        await ctx.db.insert("corperAuditLogs", {
            corperId: args.id,
            action: "delete",
            timestamp: now,
            actorTokenIdentifier: String(user.tokenIdentifier ?? "unknown"),
            actorEmail: user.email ?? null,
            actorUsername: user.username ?? null,
            summary: `deleted corper ${existing.callUpNumber}`,
        });

        return { ok: true };
    },
});

export const seedCorpers = mutation({
    args: {
        corpers: v.array(
            v.object({
                callUpNumber: v.string(),
                stateCode: v.string(),
                status: v.string(),
                fullName: v.string(),
                batch: v.string(),
                deploymentUnit: v.string(),
                createdAt: v.number(),
            })
        ),
    },
    handler: async (ctx, { corpers: rows }) => {
        const byCallUp = new Map<string, (typeof rows)[number]>();
        for (const row of rows) {
            const key = row.callUpNumber.trim().toUpperCase();
            if (!key) continue;
            byCallUp.set(key, { ...row, callUpNumber: key });
        }
        const deduped = [...byCallUp.values()];

        for (const corper of deduped) {
            const existingCorper = await ctx.db
                .query("corpers")
                .withIndex("by_call_up_number", (q) => q.eq("callUpNumber", corper.callUpNumber))
                .unique();

            if (existingCorper) {
                await ctx.db.patch("corpers", existingCorper._id, corper);
            } else {
                await ctx.db.insert("corpers", corper);
            }
        }

        return { upserted: deduped.length, skippedEmptyCallUp: rows.length - deduped.length };
    },
});
