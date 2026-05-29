export function normalizeOptionalFilter(value: string | null | undefined) {
    const trimmed = value?.trim();
    return trimmed && trimmed.length > 0 ? trimmed : null;
}

export function normalizeMonthKey(value: string) {
    return value.trim().toLowerCase().replace(/\s+/g, "-");
}

export function extractCallUpFromTokenIdentifier(tokenIdentifier: string | null | undefined) {
    const upper = String(tokenIdentifier ?? "").toUpperCase();
    const match = upper.match(/NYSC\/[A-Z0-9/.-]+/);
    return match?.[0] ?? null;
}

export function normalizeComparableKey(value: string | null | undefined) {
    return String(value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function getEmailLikeLocalPart(value: string | null | undefined) {
    const raw = String(value ?? "").trim().toUpperCase();
    const at = raw.indexOf("@");
    if (at <= 0) return null;
    return raw.slice(0, at);
}

export function normalizeDeploymentUnitKey(value: string | null | undefined) {
    return String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

export function extractServiceYearBucket(callUpNumber: string) {
    const upper = String(callUpNumber).toUpperCase();
    const match = upper.match(/(?:^|\/)(20\d{2})(?:\/|$)/);
    if (!match) return "Unknown";
    return match[1]!.slice(-2);
}
