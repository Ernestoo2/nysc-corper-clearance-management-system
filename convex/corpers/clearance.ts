import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { requireAdmin, requireSignedInUser, type AuthedUser } from "./auth";
import {
    extractCallUpFromTokenIdentifier,
    getEmailLikeLocalPart,
    normalizeComparableKey,
    normalizeMonthKey,
} from "./normalize";

export async function generateMonthlyFormUploadUrl(ctx: MutationCtx) {
    await requireAdmin(ctx);
    return await ctx.storage.generateUploadUrl();
}

export async function publishSharedMonthlyForm(
    ctx: MutationCtx,
    args: {
        monthLabel: string;
        monthKey?: string;
        fileId: Id<"_storage">;
        fileName: string;
    }
) {
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
}

export async function getLatestSharedMonthlyForm(ctx: QueryCtx) {
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
}

async function resolveCorperForUser(ctx: QueryCtx, user: AuthedUser) {
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

    return corper;
}

export async function getMyClearanceContext(ctx: QueryCtx) {
    let user: AuthedUser;
    try {
        user = await requireSignedInUser(ctx);
    } catch {
        return null;
    }

    const corper = await resolveCorperForUser(ctx, user);

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
                  headOfUnit: corper.headOfUnit ?? null,
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
}
