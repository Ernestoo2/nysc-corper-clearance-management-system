import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import {
    serviceYearBucketFromCallUp,
} from "../lib/letters/referenceFormat";
import {
    formatAcceptanceReference,
    formatPostingReference,
    isPlaceholderReference,
} from "../lib/letters/referenceFormat";

type CorperDoc = Doc<"corpers">;

export async function assignRegistrySerialOnCorperCreate(
    ctx: MutationCtx,
    callUpNumber: string
) {
    const serviceYearBucket = serviceYearBucketFromCallUp(callUpNumber);
    const peers = await ctx.db
        .query("corpers")
        .withIndex("by_service_year_bucket", (q) => q.eq("serviceYearBucket", serviceYearBucket))
        .collect();

    const registrySerial =
        peers.reduce((max, row) => Math.max(max, row.registrySerial ?? 0), 0) + 1;

    return { serviceYearBucket, registrySerial };
}

export async function ensureCorperRegistrySerial(
    ctx: MutationCtx,
    corper: CorperDoc
): Promise<{ serviceYearBucket: string; registrySerial: number }> {
    const serviceYearBucket =
        corper.serviceYearBucket ?? serviceYearBucketFromCallUp(corper.callUpNumber);

    if (corper.registrySerial != null && corper.serviceYearBucket) {
        return { serviceYearBucket: corper.serviceYearBucket, registrySerial: corper.registrySerial };
    }

    const peers = await ctx.db
        .query("corpers")
        .withIndex("by_service_year_bucket", (q) => q.eq("serviceYearBucket", serviceYearBucket))
        .collect();

    const sorted = [...peers].sort((a, b) => a.createdAt - b.createdAt);
    const index = sorted.findIndex((row) => row._id === corper._id);
    const registrySerial =
        index >= 0
            ? index + 1
            : peers.reduce((max, row) => Math.max(max, row.registrySerial ?? 0), 0) + 1;

    await ctx.db.patch(corper._id, { serviceYearBucket, registrySerial });
    return { serviceYearBucket, registrySerial };
}

export async function nextPostingRegistrySerial(ctx: MutationCtx) {
    return (await maxPostingRegistrySerial(ctx)) + 1;
}

export async function maxPostingRegistrySerial(ctx: QueryCtx | MutationCtx) {
    const rows = await ctx.db
        .query("letterIssuances")
        .withIndex("by_letter_type", (q) => q.eq("letterType", "posting"))
        .collect();

    return rows.reduce((max, row) => Math.max(max, row.registrySerial ?? 0), 0);
}

export async function readCorperRegistrySerial(ctx: QueryCtx, corper: CorperDoc) {
    if (corper.registrySerial != null && corper.serviceYearBucket) {
        return { serviceYearBucket: corper.serviceYearBucket, registrySerial: corper.registrySerial };
    }

    const serviceYearBucket = serviceYearBucketFromCallUp(corper.callUpNumber);
    const peers = await ctx.db
        .query("corpers")
        .withIndex("by_service_year_bucket", (q) => q.eq("serviceYearBucket", serviceYearBucket))
        .collect();

    const cohort = peers.some((row) => row._id === corper._id) ? peers : [...peers, corper];
    const sorted = [...cohort].sort((a, b) => a.createdAt - b.createdAt);
    const registrySerial = sorted.findIndex((row) => row._id === corper._id) + 1;

    return { serviceYearBucket, registrySerial };
}

export function acceptanceReferenceForCorper(
    serviceYearBucket: string,
    registrySerial: number
) {
    return formatAcceptanceReference(serviceYearBucket, registrySerial);
}

export function postingReferenceForSerial(registrySerial: number) {
    return formatPostingReference(registrySerial);
}

export async function resolveRegistryReferenceNo(
    ctx: MutationCtx,
    args: {
        letterType: string;
        corperId?: Id<"corpers">;
        issuanceRegistrySerial?: number;
        previewReference?: string;
    }
): Promise<string | undefined> {
    const preview = args.previewReference?.trim();
    if (preview && !isPlaceholderReference(preview)) {
        return preview;
    }

    if (args.letterType === "acceptance" && args.corperId) {
        const corper = await ctx.db.get(args.corperId);
        if (!corper) return undefined;
        const { serviceYearBucket, registrySerial } = await ensureCorperRegistrySerial(ctx, corper);
        return acceptanceReferenceForCorper(serviceYearBucket, registrySerial);
    }

    if (args.letterType === "posting" && args.issuanceRegistrySerial != null) {
        return postingReferenceForSerial(args.issuanceRegistrySerial);
    }

    return undefined;
}
