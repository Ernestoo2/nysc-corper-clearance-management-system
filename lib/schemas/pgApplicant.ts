import { z } from "zod";

const requiredText = (label: string) => z.string().trim().min(1, `${label} is required`);

export const pgApplicantStatusSchema = z.enum(["PENDING", "ADMITTED", "WITHDRAWN"]);

export const pgApplicantFormSchema = z.object({
    fullName: requiredText("Full name"),
    addressLine1: requiredText("Address line 1"),
    addressLine2: z.string().trim().optional(),
    city: requiredText("City"),
    state: requiredText("State"),
    country: z.string().trim().min(1).default("Nigeria"),
    salutationTitle: z.string().trim().optional(),
    salutationName: z.string().trim().optional(),
    faculty: requiredText("Faculty"),
    department: requiredText("Department"),
    degreeType: requiredText("Degree type"),
    programme: requiredText("Programme"),
    programmeOption: z.string().trim().optional(),
    academicSession: requiredText("Academic session"),
    sessionStartDate: requiredText("Session start date"),
    status: pgApplicantStatusSchema.default("PENDING"),
});

export type PgApplicantFormValues = z.infer<typeof pgApplicantFormSchema>;

export const validatePgApplicantForm = (input: unknown) => pgApplicantFormSchema.safeParse(input);
