import { query, mutation, type MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { authComponent } from "./auth";
import { acceptanceScopeKeyFromCallUp } from "../lib/letters/acceptanceScope";
import {
    corperToAcceptanceMergeFields,
    corperToPostingMergeFields,
} from "../lib/letters/corperMergeFields";
import {
    acceptanceReferenceForCorper,
    nextPostingRegistrySerial,
    maxPostingRegistrySerial,
    readCorperRegistrySerial,
    resolveRegistryReferenceNo,
} from "./letterRegistry";
import { POSTING_REFERENCE_SCOPE_KEY } from "../lib/letters/postingScope";
import { isPlaceholderReference } from "../lib/letters/referenceFormat";
import { parseMergeSnapshot, stringifyMergeSnapshot } from "../lib/letters/mergeSnapshot";

const letterTypeValidator = v.union(
    v.literal("acceptance"),
    v.literal("posting"),
    v.literal("clearance"),
    v.literal("pg_admission")
);

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

function padSequence(value: number, width: number) {
    return String(value).padStart(width, "0");
}

async function resolveReportingOfficer(
    corper: { headOfUnit?: string | null }
): Promise<string | undefined> {
    return corper.headOfUnit?.trim() || undefined;
}

function referenceScopeKeyForIssuance(
    letterType: string,
    callUpNumber: string,
    explicitScope?: string
) {
    if (explicitScope?.trim()) return explicitScope.trim();
    if (letterType === "posting") return POSTING_REFERENCE_SCOPE_KEY;
    if (letterType === "acceptance") return acceptanceScopeKeyFromCallUp(callUpNumber);
    return new Date().getFullYear().toString().slice(-2);
}

function formatReferenceNo(letterType: string, scopeKey: string, sequence: number) {
    const seq3 = padSequence(sequence, 3);
    const seq4 = padSequence(sequence, 4);
    switch (letterType) {
        case "acceptance":
            return `LCU/REG/CORPS/${scopeKey}/${seq3}`;
        case "posting":
            return `LCU/REG/GN/${seq3}`;
        case "pg_admission":
            return `LCU/PG/ADM/${scopeKey}/${seq4}`;
        case "clearance":
            return `LCU/REG/CLR/${scopeKey}/${seq3}`;
        default:
            return `LCU/REG/${scopeKey}/${seq3}`;
    }
}

async function deactivateTemplatesForType(
    ctx: MutationCtx,
    letterType: "acceptance" | "posting" | "clearance" | "pg_admission"
) {
    const activeRows = await ctx.db
        .query("letterTemplates")
        .withIndex("by_letter_type", (q) => q.eq("letterType", letterType))
        .collect();

    for (const row of activeRows) {
        if (row.isActive) {
            await ctx.db.patch(row._id, { isActive: false });
        }
    }
}

export const generateTemplateUploadUrl = mutation({
    args: {},
    handler: async (ctx) => {
        await requireAdmin(ctx);
        return await ctx.storage.generateUploadUrl();
    },
});

export const createTemplate = mutation({
    args: {
        letterType: letterTypeValidator,
        name: v.string(),
        fileId: v.id("_storage"),
        fileName: v.string(),
        setActive: v.optional(v.boolean()),
    },
    handler: async (ctx, args) => {
        const user = await requireAdmin(ctx);
        const now = Date.now();
        const name = args.name.trim();
        const fileName = args.fileName.trim();
        if (!name) throw new Error("Template name is required");
        if (!fileName) throw new Error("File name is required");

        const existing = await ctx.db
            .query("letterTemplates")
            .withIndex("by_letter_type", (q) => q.eq("letterType", args.letterType))
            .collect();

        const maxVersion = existing.reduce((max, row) => Math.max(max, row.version), 0);
        const shouldActivate = args.setActive ?? true;

        if (shouldActivate) {
            await deactivateTemplatesForType(ctx, args.letterType);
        }

        const templateId = await ctx.db.insert("letterTemplates", {
            letterType: args.letterType,
            name,
            fileId: args.fileId,
            fileName,
            version: maxVersion + 1,
            isActive: shouldActivate,
            uploadedAt: now,
            uploadedBy: String(user.tokenIdentifier ?? "unknown"),
        });

        return { id: templateId, version: maxVersion + 1 };
    },
});

export const setActiveTemplate = mutation({
    args: { templateId: v.id("letterTemplates") },
    handler: async (ctx, args) => {
        await requireAdmin(ctx);
        const template = await ctx.db.get(args.templateId);
        if (!template) throw new Error("Template not found");

        await deactivateTemplatesForType(ctx, template.letterType);
        await ctx.db.patch(args.templateId, { isActive: true });
        return { ok: true };
    },
});

export const deleteTemplate = mutation({
    args: { templateId: v.id("letterTemplates") },
    handler: async (ctx, args) => {
        await requireAdmin(ctx);
        const template = await ctx.db.get(args.templateId);
        if (!template) return { ok: true };

        if (template.isActive) {
            throw new Error(
                "Cannot delete the active template. Set another version active first."
            );
        }

        const issuancesForType = await ctx.db
            .query("letterIssuances")
            .withIndex("by_letter_type", (q) => q.eq("letterType", template.letterType))
            .collect();
        if (issuancesForType.some((row) => row.templateId === template._id)) {
            throw new Error(
                "This template version was used for draft or issued letters and cannot be deleted."
            );
        }

        const siblings = await ctx.db
            .query("letterTemplates")
            .withIndex("by_letter_type", (q) => q.eq("letterType", template.letterType))
            .collect();
        const fileId = template.fileId;
        const deleteStorageFile = !siblings.some(
            (row) => row._id !== template._id && row.fileId === fileId
        );

        await ctx.db.delete(args.templateId);
        if (deleteStorageFile) {
            await ctx.storage.delete(fileId);
        }

        return { ok: true, deletedStorage: deleteStorageFile };
    },
});

export const listTemplates = query({
    args: { letterType: v.optional(letterTypeValidator) },
    handler: async (ctx, args) => {
        await requireAdmin(ctx);

        const rows = args.letterType
            ? await ctx.db
                  .query("letterTemplates")
                  .withIndex("by_letter_type", (q) => q.eq("letterType", args.letterType!))
                  .collect()
            : await ctx.db.query("letterTemplates").collect();

        const enriched = await Promise.all(
            rows
                .sort((a, b) => b.version - a.version)
                .map(async (row) => ({
                    ...row,
                    downloadUrl: await ctx.storage.getUrl(row.fileId),
                }))
        );

        return enriched;
    },
});

export const getActiveTemplate = query({
    args: { letterType: letterTypeValidator },
    handler: async (ctx, args) => {
        await requireAdmin(ctx);
        const active = await ctx.db
            .query("letterTemplates")
            .withIndex("by_letter_type_and_active", (q) =>
                q.eq("letterType", args.letterType).eq("isActive", true)
            )
            .first();

        if (!active) return null;

        const downloadUrl = await ctx.storage.getUrl(active.fileId);
        return { ...active, downloadUrl };
    },
});

export const reserveReferenceNumber = mutation({
    args: {
        letterType: letterTypeValidator,
        scopeKey: v.string(),
    },
    handler: async (ctx, args) => {
        await requireAdmin(ctx);
        const scopeKey = args.scopeKey.trim();
        if (!scopeKey) throw new Error("scopeKey is required");

        const existing = await ctx.db
            .query("referenceSequences")
            .withIndex("by_letter_type_and_scope", (q) =>
                q.eq("letterType", args.letterType).eq("scopeKey", scopeKey)
            )
            .unique();

        const next = (existing?.lastNumber ?? 0) + 1;

        if (existing) {
            await ctx.db.patch(existing._id, { lastNumber: next });
        } else {
            await ctx.db.insert("referenceSequences", {
                letterType: args.letterType,
                scopeKey,
                lastNumber: next,
            });
        }

        const referenceNo = formatReferenceNo(args.letterType, scopeKey, next);
        return { referenceNo, sequence: next };
    },
});

export const issueIssuance = mutation({
    args: {
        issuanceId: v.id("letterIssuances"),
        scopeKey: v.optional(v.string()),
        referenceNo: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        await requireAdmin(ctx);
        const now = Date.now();

        const issuance = await ctx.db.get(args.issuanceId);
        if (!issuance) throw new Error("Letter issuance not found");
        if (issuance.status === "final") {
            return { ok: true, referenceNo: issuance.referenceNo ?? null };
        }
        if (issuance.status === "void") {
            throw new Error("Cannot issue a void letter");
        }

        const mergeData = parseMergeSnapshot(issuance.mergeSnapshot);
        const previewFromSnapshot =
            typeof mergeData.referenceNo === "string" ? mergeData.referenceNo.trim() : "";
        const previewReference =
            args.referenceNo?.trim() ||
            (isPlaceholderReference(previewFromSnapshot) ? "" : previewFromSnapshot);

        let referenceNo =
            issuance.referenceNo?.trim() ||
            (isPlaceholderReference(previewReference) ? undefined : previewReference);

        if (!referenceNo) {
            if (issuance.letterType === "acceptance" || issuance.letterType === "posting") {
                referenceNo = await resolveRegistryReferenceNo(ctx, {
                    letterType: issuance.letterType,
                    corperId: issuance.corperId,
                    issuanceRegistrySerial: issuance.registrySerial,
                    previewReference,
                });
            } else {
                const corper = issuance.corperId ? await ctx.db.get(issuance.corperId) : null;
                const scopeKey = referenceScopeKeyForIssuance(
                    issuance.letterType,
                    corper?.callUpNumber ?? "",
                    args.scopeKey
                );

                const existing = await ctx.db
                    .query("referenceSequences")
                    .withIndex("by_letter_type_and_scope", (q) =>
                        q.eq("letterType", issuance.letterType).eq("scopeKey", scopeKey)
                    )
                    .unique();

                const next = (existing?.lastNumber ?? 0) + 1;
                if (existing) {
                    await ctx.db.patch(existing._id, { lastNumber: next });
                } else {
                    await ctx.db.insert("referenceSequences", {
                        letterType: issuance.letterType,
                        scopeKey,
                        lastNumber: next,
                    });
                }
                referenceNo = formatReferenceNo(issuance.letterType, scopeKey, next);
            }
        }

        if (!referenceNo) {
            throw new Error("Could not assign a reference number for this letter");
        }

        let updatedMerge = stringifyMergeSnapshot({
            ...mergeData,
            referenceNo,
            ref: referenceNo,
        });

        if (issuance.corperId) {
            const corper = await ctx.db.get(issuance.corperId);
            if (corper) {
                if (issuance.letterType === "acceptance") {
                    updatedMerge = stringifyMergeSnapshot(
                        corperToAcceptanceMergeFields(corper, {
                            issueDate: issuance.issueDate,
                            referenceNo,
                        })
                    );
                } else if (issuance.letterType === "posting") {
                    const prior = parseMergeSnapshot(issuance.mergeSnapshot);
                    const reportingOfficer =
                        typeof prior.reportingOfficer === "string"
                            ? prior.reportingOfficer
                            : (await resolveReportingOfficer(corper)) ?? undefined;
                    const effectiveDate =
                        typeof prior.effectiveDate === "string"
                            ? prior.effectiveDate
                            : issuance.issueDate;
                    updatedMerge = stringifyMergeSnapshot(
                        corperToPostingMergeFields(corper, {
                            issueDate: issuance.issueDate,
                            referenceNo,
                            effectiveDate,
                            reportingOfficer,
                        })
                    );
                }
            }
        }

        await ctx.db.patch(args.issuanceId, {
            status: "final",
            referenceNo,
            mergeSnapshot: updatedMerge,
            issuedAt: now,
        });

        return { ok: true, referenceNo };
    },
});

export async function createAcceptanceDraftForCorper(
    ctx: MutationCtx,
    args: {
        corperId: Id<"corpers">;
        corper: {
            fullName: string;
            callUpNumber: string;
            stateCode: string;
            batch: string;
            deploymentUnit: string;
            headOfUnit?: string;
        };
        createdBy: string;
        trigger: string;
        issueDate?: string;
    }
) {
    const active = await ctx.db
        .query("letterTemplates")
        .withIndex("by_letter_type_and_active", (q) =>
            q.eq("letterType", "acceptance").eq("isActive", true)
        )
        .first();

    if (!active) return null;

    const issueDate = args.issueDate ?? new Date().toISOString().slice(0, 10);
    const mergeFields = corperToAcceptanceMergeFields(args.corper, { issueDate });
    const now = Date.now();

    const issuanceId = await ctx.db.insert("letterIssuances", {
        templateId: active._id,
        templateVersion: active.version,
        letterType: "acceptance",
        corperId: args.corperId,
        issueDate,
        mergeSnapshot: stringifyMergeSnapshot(mergeFields),
        status: "draft",
        trigger: args.trigger,
        createdAt: now,
        createdBy: args.createdBy,
    });

    return { issuanceId, templateId: active._id };
}

export async function createPostingDraftForCorper(
    ctx: MutationCtx,
    args: {
        corperId: Id<"corpers">;
        corper: {
            fullName: string;
            callUpNumber: string;
            stateCode: string;
            batch: string;
            deploymentUnit: string;
            headOfUnit?: string;
        };
        createdBy: string;
        trigger: string;
        issueDate?: string;
        effectiveDate?: string;
    }
) {
    const deploymentUnit = args.corper.deploymentUnit.trim();
    if (!deploymentUnit) return null;

    const active = await ctx.db
        .query("letterTemplates")
        .withIndex("by_letter_type_and_active", (q) =>
            q.eq("letterType", "posting").eq("isActive", true)
        )
        .first();

    if (!active) return null;

    const issueDate = args.issueDate ?? new Date().toISOString().slice(0, 10);
    const effectiveDate = args.effectiveDate ?? issueDate;
    const reportingOfficer = await resolveReportingOfficer(args.corper);

    const registrySerial = await nextPostingRegistrySerial(ctx);
    const mergeFields = corperToPostingMergeFields(args.corper, {
        issueDate,
        effectiveDate,
        reportingOfficer,
    });
    const now = Date.now();

    const issuanceId = await ctx.db.insert("letterIssuances", {
        templateId: active._id,
        templateVersion: active.version,
        letterType: "posting",
        corperId: args.corperId,
        registrySerial,
        issueDate,
        mergeSnapshot: stringifyMergeSnapshot(mergeFields),
        status: "draft",
        trigger: args.trigger,
        createdAt: now,
        createdBy: args.createdBy,
    });

    return { issuanceId, templateId: active._id };
}

export const listIssuancesForCorper = query({
    args: {
        corperId: v.id("corpers"),
        letterType: v.optional(letterTypeValidator),
    },
    handler: async (ctx, args) => {
        await requireAdmin(ctx);
        const rows = await ctx.db
            .query("letterIssuances")
            .withIndex("by_corper_id", (q) => q.eq("corperId", args.corperId))
            .collect();

        const filtered = args.letterType
            ? rows.filter((row) => row.letterType === args.letterType)
            : rows;

        const enriched = await Promise.all(
            filtered
                .sort((a, b) => b.createdAt - a.createdAt)
                .map(async (row) => {
                    const template = await ctx.db.get(row.templateId);
                    const fileUrl = row.fileId ? await ctx.storage.getUrl(row.fileId) : null;
                    const templateDownloadUrl = template
                        ? await ctx.storage.getUrl(template.fileId)
                        : null;
                    let suggestedReferenceNo: string | null = null;
                    if (row.corperId && row.status === "draft") {
                        const corper = await ctx.db.get(row.corperId);
                        if (corper) {
                            if (row.letterType === "acceptance") {
                                const { serviceYearBucket, registrySerial } =
                                    await readCorperRegistrySerial(ctx, corper);
                                suggestedReferenceNo = acceptanceReferenceForCorper(
                                    serviceYearBucket,
                                    registrySerial
                                );
                            } else if (
                                row.letterType === "posting" &&
                                row.registrySerial != null
                            ) {
                                suggestedReferenceNo = `LCU/REG/${POSTING_REFERENCE_SCOPE_KEY}/${String(row.registrySerial).padStart(3, "0")}`;
                            }
                        }
                    }

                    return {
                        ...row,
                        mergeData: parseMergeSnapshot(row.mergeSnapshot),
                        templateName: template?.name ?? null,
                        templateDownloadUrl,
                        fileUrl,
                        suggestedReferenceNo,
                    };
                })
        );

        return enriched;
    },
});

export const getRegistryReferencePreview = query({
    args: {
        corperId: v.id("corpers"),
        letterType: v.union(v.literal("acceptance"), v.literal("posting")),
        issuanceId: v.optional(v.id("letterIssuances")),
    },
    handler: async (ctx, args) => {
        await requireAdmin(ctx);
        const corper = await ctx.db.get(args.corperId);
        if (!corper) return null;

        if (args.letterType === "acceptance") {
            const { serviceYearBucket, registrySerial } = await readCorperRegistrySerial(
                ctx,
                corper
            );
            return {
                referenceNo: acceptanceReferenceForCorper(serviceYearBucket, registrySerial),
                serviceYearBucket,
                registrySerial,
            };
        }

        if (args.issuanceId) {
            const issuance = await ctx.db.get(args.issuanceId);
            if (issuance?.registrySerial != null) {
                return {
                    referenceNo: `LCU/REG/${POSTING_REFERENCE_SCOPE_KEY}/${String(issuance.registrySerial).padStart(3, "0")}`,
                    registrySerial: issuance.registrySerial,
                };
            }
        }

        const serial = (await maxPostingRegistrySerial(ctx)) + 1;
        return {
            referenceNo: `LCU/REG/${POSTING_REFERENCE_SCOPE_KEY}/${String(serial).padStart(3, "0")}`,
            registrySerial: serial,
        };
    },
});

export const getIssuance = query({
    args: { issuanceId: v.id("letterIssuances") },
    handler: async (ctx, args) => {
        await requireAdmin(ctx);
        const row = await ctx.db.get(args.issuanceId);
        if (!row) return null;

        const template = await ctx.db.get(row.templateId);
        const templateUrl = template ? await ctx.storage.getUrl(template.fileId) : null;
        const fileUrl = row.fileId ? await ctx.storage.getUrl(row.fileId) : null;
        const corper = row.corperId ? await ctx.db.get(row.corperId) : null;

        return {
            ...row,
            mergeData: parseMergeSnapshot(row.mergeSnapshot),
            template: template
                ? { ...template, downloadUrl: templateUrl }
                : null,
            fileUrl,
            corper,
            scopeKey: corper
                ? row.letterType === "posting"
                    ? POSTING_REFERENCE_SCOPE_KEY
                    : acceptanceScopeKeyFromCallUp(corper.callUpNumber)
                : null,
        };
    },
});

export const updateDraftOverrides = mutation({
    args: {
        issuanceId: v.id("letterIssuances"),
        issueDate: v.optional(v.string()),
        referenceNo: v.optional(v.string()),
        effectiveDate: v.optional(v.string()),
        reportingOfficer: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        await requireAdmin(ctx);
        const issuance = await ctx.db.get(args.issuanceId);
        if (!issuance) throw new Error("Letter issuance not found");
        if (issuance.status !== "draft") {
            throw new Error("Only draft letters can be edited");
        }
        if (!issuance.corperId) throw new Error("Corper record required for this letter");

        const corper = await ctx.db.get(issuance.corperId);
        if (!corper) throw new Error("Corper not found");

        const issueDate = args.issueDate?.trim() || issuance.issueDate;
        const referenceNo = args.referenceNo?.trim();
        const prior = parseMergeSnapshot(issuance.mergeSnapshot);

        let mergeFields;
        if (issuance.letterType === "posting") {
            const effectiveDate =
                args.effectiveDate?.trim() ||
                (typeof prior.effectiveDate === "string" ? prior.effectiveDate : issueDate);
            const reportingOfficer =
                args.reportingOfficer?.trim() ||
                (typeof prior.reportingOfficer === "string" ? prior.reportingOfficer : undefined) ||
                (await resolveReportingOfficer(corper));
            mergeFields = corperToPostingMergeFields(corper, {
                issueDate,
                referenceNo: referenceNo || undefined,
                effectiveDate,
                reportingOfficer,
            });
        } else if (issuance.letterType === "acceptance") {
            mergeFields = corperToAcceptanceMergeFields(corper, {
                issueDate,
                referenceNo: referenceNo || undefined,
            });
        } else {
            throw new Error("Draft overrides are not supported for this letter type");
        }

        await ctx.db.patch(args.issuanceId, {
            issueDate,
            mergeSnapshot: stringifyMergeSnapshot(mergeFields),
        });

        return { ok: true };
    },
});

export const ensurePostingDraft = mutation({
    args: { corperId: v.id("corpers") },
    handler: async (ctx, args) => {
        const user = await requireAdmin(ctx);
        const corper = await ctx.db.get(args.corperId);
        if (!corper) throw new Error("Corper not found");
        if (!corper.deploymentUnit.trim()) {
            throw new Error("Set a deployment unit before creating a posting letter");
        }

        const result = await createPostingDraftForCorper(ctx, {
            corperId: args.corperId,
            corper,
            createdBy: String(user.tokenIdentifier ?? "unknown"),
            trigger: "manual",
        });
        if (!result) {
            throw new Error(
                "No active posting template. Upload one under Letter templates first."
            );
        }
        return { issuanceId: result.issuanceId, created: true };
    },
});

export const generateIssuanceUploadUrl = mutation({
    args: {},
    handler: async (ctx) => {
        await requireAdmin(ctx);
        return await ctx.storage.generateUploadUrl();
    },
});

export const ensureAcceptanceDraft = mutation({
    args: { corperId: v.id("corpers") },
    handler: async (ctx, args) => {
        const user = await requireAdmin(ctx);
        const corper = await ctx.db.get(args.corperId);
        if (!corper) throw new Error("Corper not found");

        const existing = await ctx.db
            .query("letterIssuances")
            .withIndex("by_corper_id", (q) => q.eq("corperId", args.corperId))
            .collect();

        const openDraft = existing.find(
            (row) => row.letterType === "acceptance" && row.status === "draft"
        );
        if (openDraft) {
            return { issuanceId: openDraft._id, created: false };
        }

        const result = await createAcceptanceDraftForCorper(ctx, {
            corperId: args.corperId,
            corper,
            createdBy: String(user.tokenIdentifier ?? "unknown"),
            trigger: "manual",
        });
        if (!result) {
            throw new Error(
                "No active acceptance template. Upload one under Letter templates first."
            );
        }
        return { issuanceId: result.issuanceId, created: true };
    },
});

export const attachIssuanceFile = mutation({
    args: {
        issuanceId: v.id("letterIssuances"),
        fileId: v.id("_storage"),
    },
    handler: async (ctx, args) => {
        await requireAdmin(ctx);
        const issuance = await ctx.db.get(args.issuanceId);
        if (!issuance) throw new Error("Letter issuance not found");

        await ctx.db.patch(args.issuanceId, { fileId: args.fileId });
        return { ok: true };
    },
});
