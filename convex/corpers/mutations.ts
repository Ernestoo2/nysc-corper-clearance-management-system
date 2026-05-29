import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { assignRegistrySerialOnCorperCreate } from "../letterRegistry";
import { createAcceptanceDraftForCorper, createPostingDraftForCorper } from "../letters";
import { requireAdmin } from "./auth";
import { normalizeDeploymentUnitKey } from "./normalize";

type CorperInput = {
    callUpNumber: string;
    stateCode: string;
    status: string;
    fullName: string;
    batch: string;
    deploymentUnit: string;
    headOfUnit?: string;
};

function normalizeCorperInput(args: CorperInput) {
    const callUpNumber = args.callUpNumber.trim().toUpperCase();
    const stateCode = args.stateCode.trim().toUpperCase();
    const status = args.status.trim().toUpperCase();
    const fullName = args.fullName.trim();
    const batch = args.batch.trim().toUpperCase();
    const deploymentUnit = args.deploymentUnit.trim();
    const headOfUnit = args.headOfUnit?.trim() || undefined;

    if (!callUpNumber) throw new Error("Call-up number is required");
    if (!fullName) throw new Error("Full name is required");

    return {
        callUpNumber,
        stateCode,
        status,
        fullName,
        batch,
        deploymentUnit,
        headOfUnit,
    };
}

export async function createCorper(ctx: MutationCtx, args: CorperInput) {
    const user = await requireAdmin(ctx);
    const now = Date.now();
    const normalized = normalizeCorperInput(args);

    const duplicate = await ctx.db
        .query("corpers")
        .withIndex("by_call_up_number", (q) => q.eq("callUpNumber", normalized.callUpNumber))
        .unique();
    if (duplicate) {
        throw new Error(
            `A corper with call-up number ${normalized.callUpNumber} already exists. Use edit or remove the duplicate first.`
        );
    }

    const { serviceYearBucket, registrySerial } = await assignRegistrySerialOnCorperCreate(
        ctx,
        normalized.callUpNumber
    );

    const corperId = await ctx.db.insert("corpers", {
        ...normalized,
        createdAt: now,
        serviceYearBucket,
        registrySerial,
    });

    const corperForLetters = {
        fullName: normalized.fullName,
        callUpNumber: normalized.callUpNumber,
        stateCode: normalized.stateCode,
        batch: normalized.batch,
        deploymentUnit: normalized.deploymentUnit,
    };

    const acceptanceDraft = await createAcceptanceDraftForCorper(ctx, {
        corperId,
        corper: corperForLetters,
        createdBy: String(user.tokenIdentifier ?? "unknown"),
        trigger: "corper_created",
    });

    const postingDraft = normalized.deploymentUnit
        ? await createPostingDraftForCorper(ctx, {
              corperId,
              corper: corperForLetters,
              createdBy: String(user.tokenIdentifier ?? "unknown"),
              trigger: "corper_created",
          })
        : null;

    await ctx.db.insert("corperAuditLogs", {
        corperId,
        action: "create",
        timestamp: now,
        actorTokenIdentifier: String(user.tokenIdentifier ?? "unknown"),
        actorEmail: user.email ?? null,
        actorUsername: user.username ?? null,
        summary: `created corper ${normalized.callUpNumber}`,
    });

    return {
        id: corperId,
        acceptanceIssuanceId: acceptanceDraft?.issuanceId ?? null,
        postingIssuanceId: postingDraft?.issuanceId ?? null,
    };
}

export async function updateCorper(ctx: MutationCtx, args: CorperInput & { id: Id<"corpers"> }) {
    const user = await requireAdmin(ctx);
    const now = Date.now();

    const existing = await ctx.db.get(args.id);
    if (!existing) throw new Error("Corper not found");

    const normalized = normalizeCorperInput(args);

    if (normalized.callUpNumber !== existing.callUpNumber) {
        const clash = await ctx.db
            .query("corpers")
            .withIndex("by_call_up_number", (q) => q.eq("callUpNumber", normalized.callUpNumber))
            .unique();
        if (clash && clash._id !== args.id) {
            throw new Error(
                `Another corper already uses call-up number ${normalized.callUpNumber}. Choose a different call-up number.`
            );
        }
    }

    const deploymentChanged =
        normalizeDeploymentUnitKey(normalized.deploymentUnit) !==
        normalizeDeploymentUnitKey(existing.deploymentUnit);

    await ctx.db.patch("corpers", args.id, normalized);

    let postingDraft: { issuanceId: Id<"letterIssuances"> } | null = null;
    if (deploymentChanged && normalized.deploymentUnit) {
        postingDraft = await createPostingDraftForCorper(ctx, {
            corperId: args.id,
            corper: {
                fullName: normalized.fullName,
                callUpNumber: normalized.callUpNumber,
                stateCode: normalized.stateCode,
                batch: normalized.batch,
                deploymentUnit: normalized.deploymentUnit,
            },
            createdBy: String(user.tokenIdentifier ?? "unknown"),
            trigger: "deployment_updated",
        });
    }

    await ctx.db.insert("corperAuditLogs", {
        corperId: args.id,
        action: "update",
        timestamp: now,
        actorTokenIdentifier: String(user.tokenIdentifier ?? "unknown"),
        actorEmail: user.email ?? null,
        actorUsername: user.username ?? null,
        summary: deploymentChanged
            ? `updated corper ${normalized.callUpNumber} (deployment → ${normalized.deploymentUnit})`
            : `updated corper ${normalized.callUpNumber}`,
    });

    return {
        ok: true,
        postingIssuanceId: postingDraft?.issuanceId ?? null,
        deploymentChanged,
    };
}

export async function removeCorper(ctx: MutationCtx, id: Id<"corpers">) {
    const user = await requireAdmin(ctx);
    const now = Date.now();

    const existing = await ctx.db.get(id);
    if (!existing) return { ok: true };

    await ctx.db.delete(id);

    await ctx.db.insert("corperAuditLogs", {
        corperId: id,
        action: "delete",
        timestamp: now,
        actorTokenIdentifier: String(user.tokenIdentifier ?? "unknown"),
        actorEmail: user.email ?? null,
        actorUsername: user.username ?? null,
        summary: `deleted corper ${existing.callUpNumber}`,
    });

    return { ok: true };
}

type SeedRow = {
    callUpNumber: string;
    stateCode: string;
    status: string;
    fullName: string;
    batch: string;
    deploymentUnit: string;
    createdAt: number;
};

export async function seedCorpers(ctx: MutationCtx, rows: SeedRow[]) {
    const byCallUp = new Map<string, SeedRow>();
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
            const { serviceYearBucket, registrySerial } = await assignRegistrySerialOnCorperCreate(
                ctx,
                corper.callUpNumber
            );
            const corperId = await ctx.db.insert("corpers", {
                ...corper,
                serviceYearBucket,
                registrySerial,
            });
            const seeded = {
                fullName: corper.fullName,
                callUpNumber: corper.callUpNumber,
                stateCode: corper.stateCode,
                batch: corper.batch,
                deploymentUnit: corper.deploymentUnit,
            };
            await createAcceptanceDraftForCorper(ctx, {
                corperId,
                corper: seeded,
                createdBy: "seed:corpers",
                trigger: "corper_seeded",
            });
            if (corper.deploymentUnit.trim()) {
                await createPostingDraftForCorper(ctx, {
                    corperId,
                    corper: seeded,
                    createdBy: "seed:corpers",
                    trigger: "corper_seeded",
                });
            }
        }
    }

    return { upserted: deduped.length, skippedEmptyCallUp: rows.length - deduped.length };
}
