import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const findByCallUp = query({
    args: { callUpNumber: v.string() },
    handler: async ({ db }, { callUpNumber }) => {
        // console.log("Convex query: looking for callUpNumber:", callUpNumber)

        // Try with index first
        const result = await db
            .query("corpers")
            .withIndex("by_call_up_number")
            .filter((q) => q.eq("callUpNumber", callUpNumber))
            .first();

        // console.log("Convex query result (with index):", result)

        // If not found, try without index
        if (!result) {
            // console.log("Trying without index...")
            const allCorpers = await db.query("corpers").collect();
            // console.log("All corpers in DB:", allCorpers.map(c => ({ callUpNumber: c.callUpNumber, id: c._id })))

            const manualResult = allCorpers.find(c => c.callUpNumber === callUpNumber);
            // console.log("Manual lookup result:", manualResult)
            return manualResult;
        }

        return result;
    },
});

export const findAll = query({
    handler: async ({ db }) => {
        return await db.query("corpers").collect();
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
    handler: async ({ db }, { corpers }) => {
        // console.log("seedCorpers called with:", corpers.length, "corpers")
        await Promise.all(
            corpers.map(async (corper) => {
                // console.log("Processing corper:", corper.callUpNumber)
                const existingCorper = await db
                    .query("corpers")
                    .filter((q) => q.eq("callUpNumber", corper.callUpNumber))
                    .first();

                if (existingCorper) {
                   // console.log("Updating existing corper:", existingCorper._id)
                    await db.patch("corpers", existingCorper._id, corper);
                } else {
                   // console.log("Inserting new corper:", corper.callUpNumber)
                    await db.insert("corpers", corper);
                }
            })
        );

        return { upserted: corpers.length };
    },
});
