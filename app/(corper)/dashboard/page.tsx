"use client";

import { useSession } from "@/lib/auth-client";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

function formatPublishedAt(value: number | undefined) {
  if (!value) return "Not published yet";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return "Not published yet";
  }
}

function DashboardCardsSkeleton() {
  return (
    <div
      className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3"
      aria-hidden="true"
    >
      {[0, 1, 2].map((i) => (
        <div key={i} className="animate-pulse rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 h-6 w-40 rounded bg-slate-200" />
          <div className="mb-3 h-4 w-24 rounded bg-slate-100" />
          <div className="h-4 w-full rounded bg-slate-100" />
          <div className="mt-2 h-4 w-2/3 rounded bg-slate-100" />
        </div>
      ))}
    </div>
  );
}

function CorperDashboardContent() {
  const clearanceContext = useQuery(api.corpers.getMyClearanceContext, {});
  const isClearanceReady = Boolean(clearanceContext?.latestForm?.downloadUrl);

  if (clearanceContext === undefined) {
    return <DashboardCardsSkeleton />;
  }

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-xl font-semibold">Clearance Status</h2>
        <div className="mb-2">
          <span
            className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
              isClearanceReady
                ? "bg-emerald-100 text-emerald-700"
                : "bg-slate-200 text-slate-700"
            }`}
          >
            {isClearanceReady ? "Ready" : "Not Ready"}
          </span>
        </div>
        <p className="text-gray-600">
          Current month form:{" "}
          {clearanceContext?.latestForm?.monthLabel ?? "Not yet published by HR"}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Last update: {formatPublishedAt(clearanceContext?.latestForm?.publishedAt)}
        </p>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-xl font-semibold">Documents</h2>
        {clearanceContext?.latestForm?.downloadUrl ? (
          <a
            className="font-medium text-[#1F4E79] hover:underline"
            href={clearanceContext.latestForm.downloadUrl}
            target="_blank"
            rel="noreferrer"
          >
            Download HR Monthly Form ({clearanceContext.latestForm.monthLabel})
          </a>
        ) : (
          <p className="text-gray-600">No monthly form uploaded yet by HR.</p>
        )}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-xl font-semibold">Profile</h2>
        <p className="text-gray-600">
          Deployment Unit: {clearanceContext?.corper?.deploymentUnit ?? "-"}
        </p>
        <p className="mt-1 text-gray-600">
          Head of Unit: {clearanceContext?.corper?.headOfUnit ?? "Not set by HR"}
        </p>
      </div>
    </div>
  );
}

export default function CorperDashboard() {
  const { data: session } = useSession();
  const sessionUser = session?.user as Record<string, unknown> | undefined;
  const normalizedRole =
    typeof sessionUser?.role === "string" ? sessionUser.role.trim().toLowerCase() : "";
  const callUpCandidate = String(
    (typeof sessionUser?.username === "string" ? sessionUser.username : undefined) ??
      session?.user?.name ??
      ""
  )
    .trim()
    .toUpperCase();
  const isCorper = normalizedRole === "corper" || callUpCandidate.startsWith("NYSC/");
  const callUpNumber = callUpCandidate || "Corper";

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="mx-auto max-w-4xl">
        <h1 className="mb-8 text-3xl font-bold text-[#1F4E79]">Corps Member Dashboard</h1>
        <p className="mb-8 text-lg text-gray-600">
          Welcome, {session?.user?.name} {callUpNumber}
        </p>
        {!isCorper ? (
          <div className="mb-8 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900">
            This dashboard is only available to corper accounts. Please sign in with your
            call-up number account (for example, <code>NYSC/...</code>).
          </div>
        ) : null}

        {isCorper ? <CorperDashboardContent /> : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-lg border border-slate-200 bg-white p-6 text-gray-600 shadow-sm">
              Sign in as a corper to see clearance status and documents.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
