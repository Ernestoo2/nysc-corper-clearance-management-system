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
        /** Two-digit service year from call-up (e.g. 25, 26). */
        serviceYearBucket: v.optional(v.string()),
        /** Serial within service-year cohort (1 = first corper added in that bucket). */
        registrySerial: v.optional(v.number()),
    })
        .index("by_call_up_number", ["callUpNumber"])
        .index("by_service_year_bucket", ["serviceYearBucket"])
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

    /** Postgraduate admission registry — separate from NYSC corpers. */
    pgApplicants: defineTable({
        fullName: v.string(),
        fullNameSearch: v.string(),
        addressLine1: v.string(),
        addressLine2: v.optional(v.string()),
        city: v.string(),
        state: v.string(),
        country: v.string(),
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
        createdAt: v.number(),
    })
        .index("by_full_name_search", ["fullNameSearch"])
        .index("by_status", ["status"])
        .index("by_academic_session", ["academicSession"])
        .index("by_academic_session_and_status", ["academicSession", "status"]),

    pgApplicantAuditLogs: defineTable({
        pgApplicantId: v.id("pgApplicants"),
        action: v.union(v.literal("create"), v.literal("update"), v.literal("delete")),
        timestamp: v.number(),
        actorTokenIdentifier: v.string(),
        actorEmail: v.union(v.string(), v.null()),
        actorUsername: v.union(v.string(), v.null()),
        summary: v.string(),
    })
        .index("by_timestamp", ["timestamp"])
        .index("by_pg_applicant_id_and_timestamp", ["pgApplicantId", "timestamp"]),

    letterTemplates: defineTable({
        letterType: v.union(
            v.literal("acceptance"),
            v.literal("posting"),
            v.literal("clearance"),
            v.literal("pg_admission")
        ),
        name: v.string(),
        fileId: v.id("_storage"),
        fileName: v.string(),
        version: v.number(),
        isActive: v.boolean(),
        uploadedAt: v.number(),
        uploadedBy: v.string(),
    })
        .index("by_letter_type", ["letterType"])
        .index("by_letter_type_and_active", ["letterType", "isActive"]),

    letterIssuances: defineTable({
        templateId: v.id("letterTemplates"),
        templateVersion: v.number(),
        letterType: v.union(
            v.literal("acceptance"),
            v.literal("posting"),
            v.literal("clearance"),
            v.literal("pg_admission")
        ),
        corperId: v.optional(v.id("corpers")),
        pgApplicantId: v.optional(v.id("pgApplicants")),
        referenceNo: v.optional(v.string()),
        /** Posting: global letter sequence; used when formatting LCU/REG/GN/{serial}. */
        registrySerial: v.optional(v.number()),
        issueDate: v.string(),
        mergeSnapshot: v.string(),
        status: v.union(v.literal("draft"), v.literal("final"), v.literal("void")),
        fileId: v.optional(v.id("_storage")),
        trigger: v.string(),
        createdAt: v.number(),
        createdBy: v.string(),
        issuedAt: v.optional(v.number()),
    })
        .index("by_status", ["status"])
        .index("by_letter_type", ["letterType"])
        .index("by_corper_id", ["corperId"])
        .index("by_pg_applicant_id", ["pgApplicantId"]),

    referenceSequences: defineTable({
        letterType: v.string(),
        scopeKey: v.string(),
        lastNumber: v.number(),
    }).index("by_letter_type_and_scope", ["letterType", "scopeKey"]),
});
