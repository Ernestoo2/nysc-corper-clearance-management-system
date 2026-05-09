import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
    corpers: defineTable({
        callUpNumber: v.string(),
        stateCode: v.string(),
        status: v.string(),
        fullName: v.string(),
        batch: v.string(),
        deploymentUnit: v.string(),
        headOfUnit: v.optional(v.string()),
        createdAt: v.number(),
    })
        .index("by_call_up_number", ["callUpNumber"])
        .index("by_batch", ["batch"])
        .index("by_status", ["status"])
        .index("by_deployment_unit", ["deploymentUnit"])
        .index("by_batch_and_status", ["batch", "status"])
        .index("by_status_and_deployment_unit", ["status", "deploymentUnit"])
        .index("by_batch_and_deployment_unit", ["batch", "deploymentUnit"])
        .index("by_batch_and_status_and_deployment_unit", ["batch", "status", "deploymentUnit"]),

    corperAuditLogs: defineTable({
        corperId: v.id("corpers"),
        action: v.union(v.literal("create"), v.literal("update"), v.literal("delete")),
        timestamp: v.number(),
        actorTokenIdentifier: v.string(),
        actorEmail: v.union(v.string(), v.null()),
        actorUsername: v.union(v.string(), v.null()),
        summary: v.string(),
    })
        .index("by_timestamp", ["timestamp"])
        .index("by_corper_id_and_timestamp", ["corperId", "timestamp"]),

    deploymentUnits: defineTable({
        deploymentUnit: v.string(),
        headOfUnit: v.optional(v.string()),
        updatedAt: v.number(),
    }).index("by_deployment_unit", ["deploymentUnit"]),

    monthlyClearanceForms: defineTable({
        monthKey: v.string(),
        monthLabel: v.string(),
        fileId: v.id("_storage"),
        fileName: v.string(),
        publishedAt: v.number(),
        publishedBy: v.string(),
    })
        .index("by_published_at", ["publishedAt"])
        .index("by_month_key", ["monthKey"]),
});
