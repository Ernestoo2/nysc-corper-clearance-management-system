export const LETTER_TYPES = [
    "acceptance",
    "posting",
    "clearance",
    "pg_admission",
] as const;

export type LetterType = (typeof LETTER_TYPES)[number];

export const LETTER_TYPE_LABELS: Record<LetterType, string> = {
    acceptance: "Acceptance for primary assignment",
    posting: "Posting",
    clearance: "Monthly clearance",
    pg_admission: "Postgraduate admission",
};

export type LetterIssuanceStatus = "draft" | "final" | "void";
