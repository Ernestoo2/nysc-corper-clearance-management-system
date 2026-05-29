import type { QueryCtx } from "../_generated/server";
import type { PaginationOptions } from "convex/server";
import { requireAdmin } from "./auth";
import { extractServiceYearBucket, normalizeOptionalFilter } from "./normalize";

type ListArgs = {
    paginationOpts: PaginationOptions;
    batch?: string;
    status?: string;
    deploymentUnit?: string;
    searchText?: string;
};

export async function listCorpers(ctx: QueryCtx, args: ListArgs) {
    await requireAdmin(ctx);

    const batch = normalizeOptionalFilter(args.batch)?.toUpperCase() ?? null;
    const status = normalizeOptionalFilter(args.status)?.toUpperCase() ?? null;
    const deploymentUnit = normalizeOptionalFilter(args.deploymentUnit) ?? null;
    const searchText = normalizeOptionalFilter(args.searchText)?.toUpperCase() ?? null;

    if (searchText) {
        return await ctx.db
            .query("corpers")
            .withIndex("by_call_up_number", (q) =>
                q.gte("callUpNumber", searchText).lt("callUpNumber", `${searchText}\uffff`)
            )
            .order("asc")
            .paginate(args.paginationOpts);
    }

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

    return await ctx.db.query("corpers").order("desc").paginate(args.paginationOpts);
}

export async function reportSummary(ctx: QueryCtx, limit?: number) {
    await requireAdmin(ctx);
    const bounded = Math.min(5000, Math.max(1, Math.floor(limit ?? 1000)));
    const rows = await ctx.db.query("corpers").order("desc").take(bounded);

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
}

export async function listByServiceYear(ctx: QueryCtx, limit?: number) {
    await requireAdmin(ctx);
    const bounded = Math.min(5000, Math.max(1, Math.floor(limit ?? 5000)));
    const rows = await ctx.db.query("corpers").order("desc").take(bounded);

    const grouped: Record<
        string,
        Array<{
            _id: string;
            callUpNumber: string;
            fullName: string;
            batch: string;
            status: string;
            deploymentUnit: string;
            createdAt: number;
        }>
    > = {};

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
}
