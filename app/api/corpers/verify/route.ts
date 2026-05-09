import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

const convexUrl = process.env.CONVEX_URL ?? process.env.NEXT_PUBLIC_CONVEX_URL;
if (!convexUrl) {
  throw new Error(
    "Missing CONVEX_URL or NEXT_PUBLIC_CONVEX_URL environment variable in app/api/corpers/verify/route.ts"
  );
}

const convex = new ConvexHttpClient(convexUrl);

type VerifyPayload = {
  callUpNumber?: string;
  stateCode?: string;
};

export async function POST(req: NextRequest) {
  let payload: VerifyPayload;
  try {
    payload = (await req.json()) as VerifyPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const callUpNumber = (payload.callUpNumber ?? "").trim().toUpperCase();
  const stateCode = (payload.stateCode ?? "").trim().toUpperCase();

  if (!callUpNumber || !stateCode) {
    return NextResponse.json({ error: "callUpNumber and stateCode are required" }, { status: 400 });
  }

  let corper:
    | {
        callUpNumber: string;
        stateCode: string;
        fullName: string;
        batch: string;
        deploymentUnit: string;
        status: string;
      }
    | null = null;
  try {
    corper = await convex.query(api.corpers.findByCallUp, { callUpNumber });
  } catch (error) {
    console.error("Convex query failed", error);
    return NextResponse.json({ error: "Unable to verify corper" }, { status: 502 });
  }

  if (!corper) {
    return NextResponse.json({ error: "Corper not found. Ask admin to seed the registry." }, { status: 404 });
  }

  if ((corper.stateCode ?? "").toUpperCase() !== stateCode) {
    return NextResponse.json({ error: "State code does not match registry record." }, { status: 401 });
  }

  return NextResponse.json({
    ok: true,
    corper: {
      callUpNumber: corper.callUpNumber,
      fullName: corper.fullName,
      batch: corper.batch,
      deploymentUnit: corper.deploymentUnit,
      status: corper.status,
    },
  });
}

