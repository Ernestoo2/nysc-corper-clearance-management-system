import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

const convexUrl = process.env.CONVEX_URL ?? process.env.NEXT_PUBLIC_CONVEX_URL;
if (!convexUrl) {
  throw new Error(
    "Missing CONVEX_URL or NEXT_PUBLIC_CONVEX_URL environment variable in app/api/deployment-units/sync/route.ts"
  );
}

const convex = new ConvexHttpClient(convexUrl);

type SyncPayload = {
  deploymentUnit?: string;
  headOfUnit?: string;
};

export async function POST(req: NextRequest) {
  const syncToken = req.headers.get("x-sync-token") ?? "";
  if (!syncToken) {
    return NextResponse.json({ error: "Missing x-sync-token header" }, { status: 401 });
  }

  let payload: SyncPayload;
  try {
    payload = (await req.json()) as SyncPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const deploymentUnit = (payload.deploymentUnit ?? "").trim();
  if (!deploymentUnit) {
    return NextResponse.json({ error: "deploymentUnit is required" }, { status: 400 });
  }

  try {
    const result = await convex.mutation(api.corpers.upsertDeploymentUnitHeadFromPush, {
      deploymentUnit,
      headOfUnit: payload.headOfUnit?.trim() || undefined,
      pushToken: syncToken,
    });
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    console.error("Deployment unit sync failed", error);
    return NextResponse.json({ error: "Unable to sync deployment unit head" }, { status: 502 });
  }
}
