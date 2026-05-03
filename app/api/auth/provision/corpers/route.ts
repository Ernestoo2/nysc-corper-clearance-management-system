import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

const convexUrl = process.env.CONVEX_URL ?? process.env.NEXT_PUBLIC_CONVEX_URL;
if (!convexUrl) {
    throw new Error("Missing CONVEX_URL or NEXT_PUBLIC_CONVEX_URL environment variable in app/api/auth/provision/corpers/route.ts");
}

const convex = new ConvexHttpClient(convexUrl);

function getCorperEmail(callUpNumber: string) {
    return `${callUpNumber.replace(/[^A-Z0-9]+/g, ".").toLowerCase()}@corper.local`;
}

export async function POST(req: NextRequest) {
    let corpers;
    try {
        corpers = await convex.query(api.corpers.findAll);
    } catch (error) {
        console.error("Convex query failed", error);
        return NextResponse.json({ error: "Unable to fetch corpers" }, { status: 502 });
    }

    const allCorpers = Array.isArray(corpers) ? corpers : [];

    if (allCorpers.length === 0) {
        return NextResponse.json({ message: "No corpers found to provision." });
    }

    const origin = new URL(req.url).origin;
    const signUpUrl = new URL("/api/auth/sign-up/email", req.url);
    const results = await Promise.all(allCorpers.map(async (corper: any) => {
        const email = getCorperEmail(corper.callUpNumber);
        const response = await fetch(signUpUrl.toString(), {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Origin: origin,
                Referer: origin,
            },
            body: JSON.stringify({
                email,
                name: corper.fullName,
                username: corper.callUpNumber,
                displayUsername: corper.callUpNumber,
                password: corper.stateCode,
            }),
        });

        return {
            callUpNumber: corper.callUpNumber,
            status: response.status,
            ok: response.ok,
            body: await response.json().catch(() => null),
        };
    }));

    const created = results.filter((r) => r.ok || r.status === 409).length;
    return NextResponse.json({ created, total: allCorpers.length, details: results });
}
