import type { Doc } from "@/convex/_generated/dataModel";

export type PgApplicantDoc = Doc<"pgApplicants">;

/** Placeholder keys for PG admission DOCX templates (Milestone 1+). */
export type PgAdmissionMergeFields = {
    fullName: string;
    addressLine1: string;
    addressLine2: string;
    city: string;
    state: string;
    country: string;
    formattedAddress: string;
    salutationLine: string;
    faculty: string;
    department: string;
    degreeType: string;
    programme: string;
    programmeOption: string;
    programmeFull: string;
    academicSession: string;
    sessionStartDate: string;
};

function buildFormattedAddress(applicant: PgApplicantDoc) {
    const parts = [
        applicant.addressLine1,
        applicant.addressLine2,
        applicant.city,
        applicant.state,
        applicant.country,
    ].filter((part) => Boolean(part?.trim()));
    return parts.join(", ");
}

function buildSalutationLine(applicant: PgApplicantDoc) {
    const title = applicant.salutationTitle?.trim();
    const name = applicant.salutationName?.trim();
    if (title && name) return `Dear ${title} ${name},`;
    if (title) return `Dear ${title},`;
    return "Dear Sir/Madam,";
}

function buildProgrammeFull(applicant: PgApplicantDoc) {
    const base = applicant.programme.trim();
    const option = applicant.programmeOption?.trim();
    if (!option) return base;
    return `${base} (${option})`;
}

export function pgApplicantToMergeFields(applicant: PgApplicantDoc): PgAdmissionMergeFields {
    return {
        fullName: applicant.fullName,
        addressLine1: applicant.addressLine1,
        addressLine2: applicant.addressLine2 ?? "",
        city: applicant.city,
        state: applicant.state,
        country: applicant.country,
        formattedAddress: buildFormattedAddress(applicant),
        salutationLine: buildSalutationLine(applicant),
        faculty: applicant.faculty,
        department: applicant.department,
        degreeType: applicant.degreeType,
        programme: applicant.programme,
        programmeOption: applicant.programmeOption ?? "",
        programmeFull: buildProgrammeFull(applicant),
        academicSession: applicant.academicSession,
        sessionStartDate: applicant.sessionStartDate,
    };
}
