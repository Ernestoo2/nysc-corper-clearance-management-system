import type { CorperForMerge } from "./corperMergeFields";
import { corperToClearanceMergeFields } from "./corperMergeFields";
import type { MergeData } from "./merge";

export type BulkClearanceMergePayload = {
    corpers: MergeData[];
};

export function buildBulkClearanceMergePayload(
    corpers: CorperForMerge[],
    options: {
        issueDate: string;
        monthCovered: string;
        allowanceMonth: string;
    }
): BulkClearanceMergePayload {
    return {
        corpers: corpers.map((corper) =>
            corperToClearanceMergeFields(corper, {
                issueDate: options.issueDate,
                monthCovered: options.monthCovered,
                allowanceMonth: options.allowanceMonth,
            })
        ),
    };
}
