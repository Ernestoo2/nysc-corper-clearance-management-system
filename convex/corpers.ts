import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { requireAdmin } from "./corpers/auth";
import {
    generateMonthlyFormUploadUrl as generateMonthlyFormUploadUrlHandler,
    getLatestSharedMonthlyForm as getLatestSharedMonthlyFormHandler,
    getMyClearanceContext as getMyClearanceContextHandler,
    publishSharedMonthlyForm as publishSharedMonthlyFormHandler,
} from "./corpers/clearance";
import {
    createCorper,
    removeCorper,
    seedCorpers as seedCorpersHandler,
    updateCorper,
} from "./corpers/mutations";
import {
    listByServiceYear as listByServiceYearHandler,
    listCorpers,
    reportSummary as reportSummaryHandler,
} from "./corpers/registryQueries";

export const findByCallUp = query({
    args: { callUpNumber: v.string() },
    handler: async ({ db }, { callUpNumber }) => {
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
    handler: async (ctx, args) => listCorpers(ctx, args),
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
    handler: async (ctx, args) => reportSummaryHandler(ctx, args.limit),
});

export const listByServiceYear = query({
    args: { limit: v.optional(v.number()) },
    handler: async (ctx, args) => listByServiceYearHandler(ctx, args.limit),
});

export const generateMonthlyFormUploadUrl = mutation({
    args: {},
    handler: async (ctx) => generateMonthlyFormUploadUrlHandler(ctx),
});

export const publishSharedMonthlyForm = mutation({
    args: {
        monthLabel: v.string(),
        monthKey: v.optional(v.string()),
        fileId: v.id("_storage"),
        fileName: v.string(),
    },
    handler: async (ctx, args) => publishSharedMonthlyFormHandler(ctx, args),
});

export const getLatestSharedMonthlyForm = query({
    args: {},
    handler: async (ctx) => getLatestSharedMonthlyFormHandler(ctx),
});

export const getMyClearanceContext = query({
    args: {},
    handler: async (ctx) => getMyClearanceContextHandler(ctx),
});

export const create = mutation({
    args: {
        callUpNumber: v.string(),
        stateCode: v.string(),
        status: v.string(),
        fullName: v.string(),
        batch: v.string(),
        deploymentUnit: v.string(),
        headOfUnit: v.optional(v.string()),
    },
    handler: async (ctx, args) => createCorper(ctx, args),
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
        headOfUnit: v.optional(v.string()),
    },
    handler: async (ctx, args) => updateCorper(ctx, args),
});

export const remove = mutation({
    args: { id: v.id("corpers") },
    handler: async (ctx, args) => removeCorper(ctx, args.id),
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
    handler: async (ctx, { corpers: rows }) => seedCorpersHandler(ctx, rows),
});
