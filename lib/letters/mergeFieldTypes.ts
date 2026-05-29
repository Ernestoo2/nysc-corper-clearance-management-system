/** Shared letter metadata placeholders (header block). */
export type LetterHeaderMergeFields = {
    issueDate: string;
    formattedIssueDate: string;
    /** Alias used in posting letter template.docx */
    currentDate: string;
    /** Common shortcuts */
    date: string;
    referenceNo: string;
    ref: string;
};

export type CorperIdentityMergeFields = {
    fullName: string;
    callUpNumber: string;
    stateCode: string;
    batch: string;
    deploymentUnit: string;
};

export type AcceptanceLetterMergeFields = LetterHeaderMergeFields &
    CorperIdentityMergeFields;

export type PostingLetterMergeFields = LetterHeaderMergeFields &
    CorperIdentityMergeFields & {
        effectiveDate: string;
        formattedEffectiveDate: string;
        reportingOfficer: string;
    };

export type ClearanceLetterMergeFields = LetterHeaderMergeFields &
    CorperIdentityMergeFields & {
        monthCovered: string;
        allowanceMonth: string;
    };

export const POSTING_TEMPLATE_PLACEHOLDERS: (keyof PostingLetterMergeFields)[] = [
    "currentDate",
    "formattedIssueDate",
    "referenceNo",
    "ref",
    "fullName",
    "deploymentUnit",
    "formattedEffectiveDate",
    "reportingOfficer",
];

export function withLetterHeaderAliases<T extends Record<string, string | number | boolean>>(
    fields: T,
    header: Pick<LetterHeaderMergeFields, "issueDate" | "formattedIssueDate" | "referenceNo">
): T & LetterHeaderMergeFields {
    const referenceNo = header.referenceNo ?? "";
    return {
        ...fields,
        issueDate: header.issueDate,
        formattedIssueDate: header.formattedIssueDate,
        currentDate: header.formattedIssueDate,
        date: header.formattedIssueDate,
        referenceNo,
        ref: referenceNo,
    };
}
