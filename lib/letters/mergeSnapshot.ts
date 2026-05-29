import type { MergeData } from "./merge";

export function parseMergeSnapshot(mergeSnapshot: string): MergeData {
    try {
        const parsed = JSON.parse(mergeSnapshot) as unknown;
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
            return {};
        }
        const out: MergeData = {};
        for (const [key, value] of Object.entries(parsed)) {
            if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
                out[key] = value;
            }
        }
        return out;
    } catch {
        return {};
    }
}

export function stringifyMergeSnapshot(data: MergeData) {
    return JSON.stringify(data);
}
