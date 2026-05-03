import { z } from "zod";

export const callUpNumberSchema = z
    .string()
    .trim()
    .min(1, "Call-up number is required")
    .regex(/^[A-Za-z0-9/_-]+$/, "Call-up number may only contain letters, numbers, slashes, underscores, and hyphens")
    .transform((value) => value.toUpperCase());

export const stateCodeSchema = z
    .string()
    .trim()
    .min(1, "State code is required")
    .regex(/^[A-Za-z0-9/_-]+$/, "State code may only contain letters, numbers, slashes, underscores, and hyphens")
    .transform((value) => value.toUpperCase());

export const corperLoginSchema = z.object({
    callUpNumber: callUpNumberSchema,
    stateCode: stateCodeSchema,
});

export const staffIdSchema = z
    .string()
    .trim()
    .min(1, "Staff ID is required")
    .regex(/^[A-Za-z0-9/_-]+$/, "Staff ID may only contain letters, numbers, slashes, underscores, and hyphens")
    .transform((value) => value.toUpperCase());

export const passwordSchema = z
    .string()
    .min(6, "Password must be at least 6 characters");

export const adminLoginSchema = z.object({
    staffId: staffIdSchema,
    password: passwordSchema,
});

export const adminSignupSchema = z.object({
    staffId: staffIdSchema,
    displayName: z.string().trim().min(1, "Display name is required"),
    password: passwordSchema,
});

export const batchSchema = z.enum(['2026A', '2026B', '2026C', '2026D'], 'Select a valid 2026 batch.');

export const corperSignupSchema = z.object({
    callUpNumber: callUpNumberSchema,
    stateCode: stateCodeSchema,
    displayName: z.string().trim().min(1, "Display name is required"),
    batch: batchSchema,
});

export const validateCorperLogin = (input: unknown) => corperLoginSchema.safeParse(input);
export const validateAdminLogin = (input: unknown) => adminLoginSchema.safeParse(input);
export const validateAdminSignup = (input: unknown) => adminSignupSchema.safeParse(input);
export const validateCorperSignup = (input: unknown) => corperSignupSchema.safeParse(input);

export type CorperLoginValues = z.infer<typeof corperLoginSchema>;
export type AdminLoginValues = z.infer<typeof adminLoginSchema>;
export type AdminSignupValues = z.infer<typeof adminSignupSchema>;
export type CorperSignupValues = z.infer<typeof corperSignupSchema>;
