// app/api/auth/sign-in/corper/route.ts
import { NextRequest, NextResponse } from "next/server"
import { ConvexHttpClient } from "convex/browser"
import { api } from "@/convex/_generated/api"
import { corperLoginSchema } from "@/lib/schemas/auth"

const convexUrl = process.env.CONVEX_URL ?? process.env.NEXT_PUBLIC_CONVEX_URL
if (!convexUrl) {
    throw new Error("Missing CONVEX_URL or NEXT_PUBLIC_CONVEX_URL environment variable in app/api/auth/sign-in/corper/route.ts")
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
    const parsed = corperLoginSchema.safeParse(body)

    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Missing credentials" }, { status: 400 })
    }

    const callUpNumber = parsed.data.callUpNumber.trim().toUpperCase()
    const stateCode = parsed.data.stateCode.trim().toUpperCase()

    console.log("Corper login attempt:", { callUpNumber, stateCode })

    let corper 
    try {
        corper = await convex.query(api.corpers.findByCallUp, { callUpNumber })
        console.log("Found corper:", corper)
    } catch (error) {
        console.error("Convex query failed", error)
        return NextResponse.json({ error: "Unable to reach Convex backend" }, { status: 502 })
    }

    if (!corper) {
        return NextResponse.json({ error: "Corper not found", callUpNumber }, { status: 401 })
    }

    if (corper.stateCode.trim().toUpperCase() !== stateCode) {
        return NextResponse.json({ error: "Invalid state code", callUpNumber }, { status: 401 })
    }

    const headers = buildOriginHeaders(req)
    const email = `${callUpNumber.replace(/[^A-Z0-9]+/g, ".").toLowerCase()}@corper.local`
    const signInUrl = new URL("/api/auth/sign-in/email", req.url)
    let authResponse = await fetch(signInUrl.toString(), {
        method: "POST",
        headers,
        body: JSON.stringify({ email, password: stateCode }),
    })

    if (authResponse.status === 401) {
        const signUpUrl = new URL("/api/auth/sign-up/email", req.url)

        const signUpResponse = await fetch(signUpUrl.toString(), {
            method: "POST",
            headers,
            body: JSON.stringify({
                email,
                name: corper.fullName,
                username: callUpNumber,
                displayUsername: callUpNumber,
                password: stateCode,
            }),
        })

        if (!signUpResponse.ok && signUpResponse.status !== 409) {
            const payload = await signUpResponse.json().catch(() => ({ error: "Unable to provision corper account" }))
            return NextResponse.json(
                {
                    error: payload.error ?? payload.message ?? "Unable to provision corper account",
                    details: payload,
                    callUpNumber,
                },
                { status: signUpResponse.status },
            )
        }

        authResponse = await fetch(signInUrl.toString(), {
            method: "POST",
            headers,
            body: JSON.stringify({ email, password: stateCode }),
        })
    }

    if (!authResponse.ok) {
        const payload = await authResponse.json().catch(() => ({ error: "Corper auth failed" }))
        return NextResponse.json(
            {
                error: payload.error ?? payload.message ?? "Corper auth failed",
                details: payload,
                callUpNumber,
            },
            { status: authResponse.status },
        )
    }

    return toNextResponse(authResponse)
}
