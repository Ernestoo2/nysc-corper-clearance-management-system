"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";

type CountEntry = { key: string; count: number };

function toEntries(data: Record<string, number> | undefined): CountEntry[] {
  return Object.entries(data ?? {})
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count);
}

function exportCsv(filename: string, headers: string[], rows: string[][]) {
  const escapeValue = (value: string) => `"${value.replaceAll('"', '""')}"`;
  const csv = [headers.map(escapeValue).join(","), ...rows.map((row) => row.map(escapeValue).join(","))].join(
    "\n"
  );
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function AdminReportsPage() {
  const report = useQuery(api.corpers.reportSummary, { limit: 5000 });

  const statusRows = useMemo(() => toEntries(report?.byStatus), [report?.byStatus]);
  const batchRows = useMemo(() => toEntries(report?.byBatch), [report?.byBatch]);
  const deploymentRows = useMemo(
    () => toEntries(report?.byDeploymentUnit),
    [report?.byDeploymentUnit]
  );

  const activeCount = report?.byStatus?.ACTIVE ?? 0;
  const completedCount = report?.byStatus?.COMPLETED ?? 0;
  const withdrawnCount = report?.byStatus?.WITHDRAWN ?? 0;

  function handleExportRegistryCsv() {
    if (!report) return;
    const headers = [
      "Full Name",
      "Call-Up Number",
      "State Code",
      "Batch",
      "Status",
      "Deployment Unit",
      "Created At",
    ];
    const rows = report.rows.map((row) => [
      row.fullName,
      row.callUpNumber,
      row.stateCode,
      row.batch,
      row.status,
      row.deploymentUnit,
      new Date(row.createdAt).toISOString(),
    ]);
    exportCsv("nysc-corpers-registry-report.csv", headers, rows);
  }

  function handleExportSummaryCsv() {
    if (!report) return;
    const headers = ["Category", "Value", "Count"];
    const rows: string[][] = [];

    for (const row of statusRows) rows.push(["Status", row.key, String(row.count)]);
    for (const row of batchRows) rows.push(["Batch", row.key, String(row.count)]);
    for (const row of deploymentRows) rows.push(["Deployment Unit", row.key, String(row.count)]);

    exportCsv("nysc-corpers-summary-report.csv", headers, rows);
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-[#1F4E79]">Reports</h1>
            <p className="text-sm text-slate-600">
              Registry totals, distribution metrics, and downloadable CSV reports.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/panel">Back to Panel</Link>
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Total Corper Records</p>
            <p className="mt-2 text-3xl font-bold text-slate-800">{report?.total ?? "..."}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Active</p>
            <p className="mt-2 text-3xl font-bold text-emerald-700">{activeCount}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Completed</p>
            <p className="mt-2 text-3xl font-bold text-blue-700">{completedCount}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Withdrawn</p>
            <p className="mt-2 text-3xl font-bold text-rose-700">{withdrawnCount}</p>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={handleExportSummaryCsv} disabled={!report}>
              Export Summary CSV
            </Button>
            <Button variant="outline" onClick={handleExportRegistryCsv} disabled={!report}>
              Export Registry CSV
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-700">By Status</h2>
            </div>
            <div className="divide-y divide-slate-100">
              {statusRows.map((row) => (
                <div key={row.key} className="flex items-center justify-between px-4 py-3 text-sm">
                  <span className="font-medium text-slate-700">{row.key}</span>
                  <span className="font-semibold text-slate-900">{row.count}</span>
                </div>
              ))}
              {statusRows.length === 0 ? (
                <div className="px-4 py-4 text-sm text-slate-500">No status data yet.</div>
              ) : null}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-700">By Batch</h2>
            </div>
            <div className="divide-y divide-slate-100">
              {batchRows.map((row) => (
                <div key={row.key} className="flex items-center justify-between px-4 py-3 text-sm">
                  <span className="font-medium text-slate-700">{row.key}</span>
                  <span className="font-semibold text-slate-900">{row.count}</span>
                </div>
              ))}
              {batchRows.length === 0 ? (
                <div className="px-4 py-4 text-sm text-slate-500">No batch data yet.</div>
              ) : null}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-700">By Deployment Unit</h2>
            </div>
            <div className="divide-y divide-slate-100">
              {deploymentRows.map((row) => (
                <div key={row.key} className="flex items-center justify-between px-4 py-3 text-sm">
                  <span className="font-medium text-slate-700">{row.key}</span>
                  <span className="font-semibold text-slate-900">{row.count}</span>
                </div>
              ))}
              {deploymentRows.length === 0 ? (
                <div className="px-4 py-4 text-sm text-slate-500">No deployment data yet.</div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
