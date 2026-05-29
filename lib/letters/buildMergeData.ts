import type { Doc } from "@/convex/_generated/dataModel";
import type { LetterType } from "./types";
import {
    corperToAcceptanceMergeFields,
    corperToClearanceMergeFields,
    corperToPostingMergeFields,
} from "./corperMergeFields";
import { formatFormalDate } from "./formatDate";
import { pgApplicantToMergeFields } from "./pgMergeFields";
import type { MergeData } from "./merge";

type CorperDoc = Doc<"corpers">;
type PgApplicantDoc = Doc<"pgApplicants">;

export const SAMPLE_CORPER: CorperDoc = {
    _id: "sample" as CorperDoc["_id"],
    _creationTime: 0,
    fullName: "EZE ERNEST CHIBUEZE",
    callUpNumber: "NYSC/FUW/2025/291616",
    stateCode: "OY/25C/5371",
    batch: "25C",
    deploymentUnit: "Admissions Department",
    status: "ACTIVE",
    createdAt: Date.now(),
};

export const SAMPLE_PG_APPLICANT: PgApplicantDoc = {
    _id: "sample" as PgApplicantDoc["_id"],
    _creationTime: 0,
    fullName: "EZE Ernest Chibueze",
    fullNameSearch: "EZE ERNEST CHIBUEZE",
    addressLine1: "40 Temidire Odeku Street, Off Liberty Academy Road",
    city: "Ibadan",
    state: "Oyo State",
    country: "Nigeria",
    salutationTitle: "Mr.",
    salutationName: "Eze",
    faculty: "Faculty of Engineering",
    department: "Department of Electrical Engineering",
    degreeType: "Master of Science (M.Sc)",
    programme: "Electrical Engineering",
    programmeOption: "Control Engineering",
    academicSession: "2025/2026",
    sessionStartDate: "2025-09-29",
    status: "ADMITTED",
    createdAt: Date.now(),
};

function letterExtras() {
    const issueDate = new Date().toISOString().slice(0, 10);
    const formattedIssueDate = formatFormalDate(issueDate);
    return {
        issueDate,
        referenceNo: "",
        formattedIssueDate,
        currentDate: formattedIssueDate,
        date: formattedIssueDate,
        ref: "",
    };
}

export function buildMergeDataForLetterType(
    letterType: LetterType,
    options?: {
        corper?: CorperDoc;
        pgApplicant?: PgApplicantDoc;
        monthCovered?: string;
        allowanceMonth?: string;
    }
): MergeData {
    const extras = letterExtras();
    const corper = options?.corper ?? SAMPLE_CORPER;
    const pgApplicant = options?.pgApplicant ?? SAMPLE_PG_APPLICANT;

    switch (letterType) {
        case "acceptance":
            return corperToAcceptanceMergeFields(corper, extras);
        case "posting":
            return corperToPostingMergeFields(corper, extras);
        case "clearance": {
            const now = new Date();
            const monthCovered =
                options?.monthCovered ??
                now.toLocaleString("en-US", { month: "long", year: "numeric" });
            const next = new Date(now);
            next.setMonth(next.getMonth() + 1);
            const allowanceMonth =
                options?.allowanceMonth ??
                next.toLocaleString("en-US", { month: "long", year: "numeric" });
            return corperToClearanceMergeFields(corper, {
                ...extras,
                monthCovered,
                allowanceMonth,
            });
        }
        case "pg_admission":
            return {
                ...pgApplicantToMergeFields(pgApplicant),
                ...extras,
                formattedSessionStartDate: formatFormalDate(pgApplicant.sessionStartDate),
            };
        default:
            return extras;
    }
}
