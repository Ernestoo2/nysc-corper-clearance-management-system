/** Two-digit service year from call-up number (e.g. NYSC/FUW/2025/… → "25"). */
export function acceptanceScopeKeyFromCallUp(callUpNumber: string) {
    const upper = String(callUpNumber).toUpperCase();
    const match = upper.match(/(?:^|\/)(20\d{2})(?:\/|$)/);
    if (match) return match[1]!.slice(-2);
    return new Date().getFullYear().toString().slice(-2);
}
