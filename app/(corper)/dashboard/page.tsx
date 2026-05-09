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

export default function CorperDashboard() {
  const { data: session } = useSession();
  const normalizedRole = String(session?.user?.role ?? "").trim().toLowerCase();
  const callUpCandidate = String(session?.user?.username ?? session?.user?.name ?? "").trim().toUpperCase();
  const isCorper = normalizedRole === "corper" || callUpCandidate.startsWith("NYSC/");
  const callUpNumber = callUpCandidate || "Corper";
  const clearanceContext = useQuery(api.corpers.getMyClearanceContext, {});
  const isClearanceReady = Boolean(clearanceContext?.latestForm?.downloadUrl);

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-[#1F4E79] mb-8">Corps Member Dashboard</h1>
        <p className="text-lg text-gray-600 mb-8">Welcome, {session?.user?.name} {callUpNumber}</p>
        {!isCorper ? (
          <div className="mb-8 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900">
            This dashboard is only available to corper accounts. Please sign in with your
            call-up number account (for example, <code>NYSC/...</code>).
          </div>
        ) : null}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <h2 className="text-xl font-semibold mb-4">Clearance Status</h2>
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

          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <h2 className="text-xl font-semibold mb-4">Documents</h2>
            {clearanceContext?.latestForm?.downloadUrl ? (
              <a
                className="text-[#1F4E79] font-medium hover:underline"
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

          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <h2 className="text-xl font-semibold mb-4">Profile</h2>
            <p className="text-gray-600">
              Deployment Unit: {clearanceContext?.corper?.deploymentUnit ?? "-"}
            </p>
            <p className="text-gray-600 mt-1">
              Head of Unit: {clearanceContext?.corper?.headOfUnit ?? "Not set by HR"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
