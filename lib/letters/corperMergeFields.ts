import { formatFormalDate, formatLongDate } from "./formatDate";
import {
    withLetterHeaderAliases,
    type AcceptanceLetterMergeFields,
    type ClearanceLetterMergeFields,
    type PostingLetterMergeFields,
} from "./mergeFieldTypes";

/** Corper fields required for letter merge (Convex-safe — no generated imports). */
export type CorperForMerge = {
    fullName: string;
    callUpNumber: string;
    stateCode: string;
    batch: string;
    deploymentUnit: string;
    headOfUnit?: string;
};

export type CorperDoc = CorperForMerge;
export type { AcceptanceLetterMergeFields, PostingLetterMergeFields, ClearanceLetterMergeFields };

function toTitleCase(value: string) {
    return value
        .toLowerCase()
        .split(" ")
        .filter(Boolean)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
}

export type CorperLetterExtras = {
    issueDate?: string;
    referenceNo?: string;
    monthCovered?: string;
    allowanceMonth?: string;
    effectiveDate?: string;
    reportingOfficer?: string;
};

function baseCorperFields(corper: CorperDoc, extras: CorperLetterExtras) {
    const issueDate = extras.issueDate ?? new Date().toISOString().slice(0, 10);
    const effectiveDate = extras.effectiveDate ?? issueDate;
    const formattedIssueDate = formatFormalDate(issueDate);
    const referenceNo = extras.referenceNo ?? "";

    const core = {
        fullName: toTitleCase(corper.fullName),
        callUpNumber: corper.callUpNumber,
        stateCode: corper.stateCode,
        batch: corper.batch,
        deploymentUnit: corper.deploymentUnit,
        issueDate,
        formattedIssueDate,
        effectiveDate,
        formattedEffectiveDate: formatLongDate(effectiveDate),
        referenceNo,
        reportingOfficer: extras.reportingOfficer ?? "Deputy Registrar, Admissions office",
    };

    return withLetterHeaderAliases(core, {
        issueDate,
        formattedIssueDate,
        referenceNo,
    });
}

export function corperToAcceptanceMergeFields(
    corper: CorperDoc,
    extras: CorperLetterExtras = {}
): AcceptanceLetterMergeFields {
    return baseCorperFields(corper, extras);
}

export function corperToPostingMergeFields(
    corper: CorperDoc,
    extras: CorperLetterExtras = {}
): PostingLetterMergeFields {
    return baseCorperFields(corper, extras);
}

export function corperToClearanceMergeFields(
    corper: CorperDoc,
    extras: CorperLetterExtras & { monthCovered: string; allowanceMonth: string }
): ClearanceLetterMergeFields {
    return {
        ...baseCorperFields(corper, extras),
        monthCovered: extras.monthCovered,
        allowanceMonth: extras.allowanceMonth,
    };
}
