import { NextRequest, NextResponse } from "next/server"
import { ConvexHttpClient } from "convex/browser"
import { api } from "@/convex/_generated/api"
import { corperSignupSchema } from "@/lib/schemas/auth"

const convexUrl = process.env.CONVEX_URL ?? process.env.NEXT_PUBLIC_CONVEX_URL
if (!convexUrl) {
    throw new Error("Missing CONVEX_URL or NEXT_PUBLIC_CONVEX_URL environment variable in app/api/auth/sign-up/corper/route.ts")
}

const convex = new ConvexHttpClient(convexUrl)

function buildOriginHeaders(req: NextRequest) {
    const origin = new URL(req.url).origin
    return {
        "Content-Type": "application/json",
        Origin: origin,
        Referer: origin,
    }
}

function toNextResponse(upstream: Response) {
    const response = new NextResponse(upstream.body, {
        status: upstream.status,
        statusText: upstream.statusText,
    })

    upstream.headers.forEach((value, key) => {
        if (key.toLowerCase() === "content-length") return
        response.headers.append(key, value)
    })

    return response
}

export async function POST(req: NextRequest) {
    const body = await req.json()
    const parsed = corperSignupSchema.safeParse(body)

    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid corper signup data" }, { status: 400 })
    }

    const { callUpNumber, stateCode, displayName, batch } = parsed.data
    const normalizedCallUpNumber = callUpNumber.trim().toUpperCase()
    const normalizedStateCode = stateCode.trim().toUpperCase()
    const email = `${normalizedCallUpNumber.replace(/[^A-Z0-9]+/g, ".").toLowerCase()}@corper.local`
    const headers = buildOriginHeaders(req)

    const signUpUrl = new URL("/api/auth/sign-up/email", req.url)
    const signUpResponse = await fetch(signUpUrl.toString(), {
        method: "POST",
        headers,
        body: JSON.stringify({
            email,
            password: normalizedStateCode,
            name: displayName,
            username: normalizedCallUpNumber,
            displayUsername: normalizedCallUpNumber,
        }),
    })

    if (!signUpResponse.ok && signUpResponse.status !== 409) {
        const payload = await signUpResponse.json().catch(() => ({ error: "Unable to create corper auth account" }))
        return NextResponse.json(
            {
                error: payload.error ?? payload.message ?? "Unable to create corper auth account",
                details: payload,
                callUpNumber: normalizedCallUpNumber,
            },
            { status: signUpResponse.status },
        )
    }

    try {
        console.log("About to call Convex mutation with:", {
            corpers: [{
                callUpNumber: normalizedCallUpNumber,
                stateCode: normalizedStateCode,
                status: "ACTIVE",
                fullName: displayName,
                batch,
                deploymentUnit: "",
                createdAt: Date.now(),
            }]
        })
        const result = await convex.mutation(api.corpers.seedCorpers, {
            corpers: [
                {
                    callUpNumber: normalizedCallUpNumber,
                    stateCode: normalizedStateCode,
                    status: "ACTIVE",
                    fullName: displayName,
                    batch,
                    deploymentUnit: "",
                    createdAt: Date.now(),
                },
            ],
        })
        console.log("Corper storage result:", result)
    } catch (error) {
        console.error("Convex mutation failed:", error)
        console.error("Error details:", JSON.stringify(error, null, 2))
        return NextResponse.json({
            error: "Unable to create or update corper record",
            details: error.message || error
        }, { status: 502 })
    }

    const signInUrl = new URL("/api/auth/sign-in/email", req.url)
    const authResponse = await fetch(signInUrl.toString(), {
        method: "POST",
        headers,
        body: JSON.stringify({ email, password: normalizedStateCode }),
    })

    if (!authResponse.ok) {
        const payload = await authResponse.json().catch(() => ({ error: "Unable to sign in corper" }))
        return NextResponse.json(
            {
                error: payload.error ?? payload.message ?? "Unable to sign in corper",
                details: payload,
                callUpNumber: normalizedCallUpNumber,
            },
            { status: authResponse.status },
        )
    }

    return toNextResponse(authResponse)
}
