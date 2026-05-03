import { NextRequest, NextResponse } from "next/server";

function parseJwtPayload(token: string) {
    try {
        const parts = token.split(".");
        if (parts.length < 2) return null;
        const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
        const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
        const decoded = atob(padded);
        const json = decodeURIComponent(
            decoded
                .split("")
                .map((char) => "%" + char.charCodeAt(0).toString(16).padStart(2, "0"))
                .join(""),
        );
        return JSON.parse(json);
    } catch {
        return null;
    }
}

function getRoleFromToken(token?: string) {
    if (!token) return undefined;
    const payload = parseJwtPayload(token);
    if (!payload) return undefined;

    // Check for explicit role field
    if (typeof payload.role === "string") return payload.role;
    if (payload.user && typeof payload.user.role === "string") return payload.user.role;
    if (payload.claims && typeof payload.claims.role === "string") return payload.claims.role;

    // Infer role from username/displayUsername format
    const username = payload.username || payload.displayUsername || payload.user?.username || payload.user?.displayUsername;
    if (username) {
        // Corper usernames are call-up numbers like "NYSC/FUW/2025/291616"
        if (username.includes('/') && username.startsWith('NYSC/')) {
            return 'corper';
        }
        // Admin emails are staff IDs like "LCU/HR/001"
        if (username.includes('/') && !username.includes('@')) {
            return 'admin';
        }
    }

    return undefined;
}

export async function middleware(request: NextRequest) {
    const token = request.cookies.get("convex_jwt")?.value;
    if (!token) {
        return NextResponse.redirect(new URL("/login", request.url));
    }

    const role = getRoleFromToken(token) ?? "";
    const path = request.nextUrl.pathname;

    // Allow authenticated users to access auth routes (login/signup)
    if (path.startsWith("/login") || path.startsWith("/signup")) {
        return NextResponse.next();
    }

    // Corpers can access their own dashboard and clearance routes
    if (path.startsWith("/corper/") && role === "corper") {
        return NextResponse.next();
    }

    // Admins can access admin panel and corper management routes
    if ((path.startsWith("/panel") || path.startsWith("/admin/")) && role === "admin") {
        return NextResponse.next();
    }

    // Redirect based on role
    if (role === "corper") {
        // If corper tries to access admin routes, redirect to login (they shouldn't be here)
        if (path.startsWith("/panel") || path.startsWith("/admin/")) {
            return NextResponse.redirect(new URL("/login", request.url));
        }
        // Allow corpers to access their routes and clearance
        return NextResponse.next();
    } else if (role === "admin") {
        // If admin tries to access corper routes, redirect to panel
        if (path.startsWith("/corper/") || path.startsWith("/dashboard")) {
            return NextResponse.redirect(new URL("/panel", request.url));
        }
        // Allow admins to access their routes
        return NextResponse.next();
    }

    // Unknown role - redirect to login
    return NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
    matcher: ["/dashboard/:path*", "/panel/:path*", "/corper/:path*", "/admin/:path*", "/clearance/:path*"],
};
