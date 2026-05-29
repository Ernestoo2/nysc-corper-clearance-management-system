import { acceptanceScopeKeyFromCallUp } from "./acceptanceScope";
import { POSTING_REFERENCE_SCOPE_KEY } from "./postingScope";

export function padReferenceSerial(value: number, width = 3) {
    return String(Math.max(1, Math.floor(value))).padStart(width, "0");
}

/** e.g. LCU/REG/CORPS/26/002 — serial = corper order within service-year bucket */
export function formatAcceptanceReference(serviceYearBucket: string, serial: number) {
    return `LCU/REG/CORPS/${serviceYearBucket}/${padReferenceSerial(serial)}`;
}

/** e.g. LCU/REG/GN/002 — global posting letter sequence */
export function formatPostingReference(serial: number) {
    return `LCU/REG/${POSTING_REFERENCE_SCOPE_KEY}/${padReferenceSerial(serial)}`;
}

export function formatClearanceReference(serviceYearBucket: string, serial: number) {
    return `LCU/REG/CLR/${serviceYearBucket}/${padReferenceSerial(serial)}`;
}

export function serviceYearBucketFromCallUp(callUpNumber: string) {
    return acceptanceScopeKeyFromCallUp(callUpNumber);
}

export function isPlaceholderReference(value: string | undefined | null) {
    if (!value?.trim()) return true;
    const upper = value.trim().toUpperCase();
    return upper === "LCU/TEST/0001" || upper.includes("/TEST/");
}
