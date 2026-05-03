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
        createdAt: v.number(),
    }).index("by_call_up_number", ["callUpNumber"]),
});
