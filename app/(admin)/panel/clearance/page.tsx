"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { saveAs } from "file-saver";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { corperToClearanceMergeFields } from "@/lib/letters/corperMergeFields";
import { fetchAndMergeBulkClearance, formatDocxMergeError } from "@/lib/letters/merge";

type CorperDoc = Doc<"corpers">;

function toTitleCase(value: string) {
  return value
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatMonthYear(date: Date) {
  return date.toLocaleString("en-US", { month: "long", year: "numeric" });
}

function nextMonth(date: Date) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + 1);
  return next;
}

export default function AdminBulkClearancePage() {
  const [monthCovered, setMonthCovered] = useState("");
  const [allowanceMonth, setAllowanceMonth] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [sharedMonthLabel, setSharedMonthLabel] = useState("");
  const [sharedFile, setSharedFile] = useState<File | null>(null);
  const [isPublishingSharedFile, setIsPublishingSharedFile] = useState(false);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    const now = new Date();
    setMonthCovered(formatMonthYear(now));
    setAllowanceMonth(formatMonthYear(nextMonth(now)));
    setIssueDate(now.toISOString().slice(0, 10));
  }, []);

  const { results, status, loadMore } = usePaginatedQuery(
    api.corpers.list,
    { status: "ACTIVE" },
    { initialNumItems: 50 }
  );

  const corpers = (results as CorperDoc[]) ?? [];
  const activeCorpers = useMemo(
    () => corpers.filter((row) => String(row.status ?? "").trim().toUpperCase() === "ACTIVE"),
    [corpers]
  );
  const latestSharedForm = useQuery(api.corpers.getLatestSharedMonthlyForm, {});
  const clearanceTemplate = useQuery(api.letters.getActiveTemplate, {
    letterType: "clearance",
  });
  const generateUploadUrl = useMutation(api.corpers.generateMonthlyFormUploadUrl);
  const publishSharedForm = useMutation(api.corpers.publishSharedMonthlyForm);
  const selectedCorpers = useMemo(
    () => activeCorpers.filter((row) => selected[row._id]),
    [activeCorpers, selected]
  );

  function toggleOne(id: string) {
    setSelected((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function selectAllLoaded() {
    const next: Record<string, boolean> = {};
    for (const row of activeCorpers) {
      next[row._id] = true;
    }
    setSelected(next);
  }

  function clearSelection() {
    setSelected({});
  }

  async function generateBulkDocx() {
    if (selectedCorpers.length === 0) return;
    const templateUrl = clearanceTemplate?.downloadUrl;
    if (!templateUrl) {
      setFeedback("Upload an active clearance template under Letter templates.");
      return;
    }

    setIsGenerating(true);
    setFeedback("");

    try {
      const mergeRows = selectedCorpers.map((row) =>
        corperToClearanceMergeFields(
          {
            fullName: row.fullName,
            callUpNumber: row.callUpNumber,
            stateCode: row.stateCode,
            batch: row.batch,
            deploymentUnit: row.deploymentUnit,
          },
          { issueDate, monthCovered, allowanceMonth }
        )
      );

      const blob = await fetchAndMergeBulkClearance(templateUrl, mergeRows);
      saveAs(blob, `nysc-bulk-clearance-${monthCovered.replace(/\s+/g, "-").toLowerCase()}.docx`);
      setFeedback(`Generated ${selectedCorpers.length} letter(s).`);
    } catch (error) {
      setFeedback(formatDocxMergeError(error));
    } finally {
      setIsGenerating(false);
    }
  }

  async function handlePublishSharedFile() {
    if (!sharedFile || !sharedMonthLabel.trim()) {
      setFeedback("Provide a month label and select a file first.");
      return;
    }
    setIsPublishingSharedFile(true);
    setFeedback("");
    try {
      const uploadUrl = await generateUploadUrl({});
      const uploadResult = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": sharedFile.type || "application/octet-stream" },
        body: sharedFile,
      });
      if (!uploadResult.ok) {
        throw new Error("File upload failed");
      }
      const { storageId } = (await uploadResult.json()) as { storageId?: string };
      if (!storageId) throw new Error("Storage id missing from upload response");

      await publishSharedForm({
        monthLabel: sharedMonthLabel.trim(),
        fileName: sharedFile.name,
        fileId: storageId as Id<"_storage">,
      });
      setFeedback("Shared monthly form published successfully.");
      setSharedFile(null);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Unable to publish shared monthly form");
    } finally {
      setIsPublishingSharedFile(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-[#1F4E79]">Bulk Clearance Generation</h1>
            <p className="text-sm text-slate-600">
              Generate monthly clearance body text for selected corpers.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/panel">Back to Panel</Link>
          </Button>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-base font-semibold text-slate-800">Shared Monthly Form (All Corpers)</h2>
          <p className="mt-1 text-sm text-slate-600">
            HR uploads one form template/document for the month. Corpers see it on their dashboards and download it.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="grid gap-1">
              <Label htmlFor="shared-month-label">Month label</Label>
              <Input
                id="shared-month-label"
                value={sharedMonthLabel}
                onChange={(e) => setSharedMonthLabel(e.target.value)}
                placeholder="May 2026"
              />
            </div>
            <div className="grid gap-1 md:col-span-2">
              <Label htmlFor="shared-form-file">Form document (.pdf/.docx)</Label>
              <Input
                id="shared-form-file"
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={(e) => setSharedFile(e.target.files?.[0] ?? null)}
              />
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button onClick={handlePublishSharedFile} disabled={isPublishingSharedFile}>
              {isPublishingSharedFile ? "Publishing..." : "Publish Shared Monthly Form"}
            </Button>
            {latestSharedForm?.downloadUrl ? (
              <Button asChild variant="outline">
                <a href={latestSharedForm.downloadUrl} target="_blank" rel="noreferrer">
                  Download Latest ({latestSharedForm.monthLabel})
                </a>
              </Button>
            ) : null}
          </div>
          {feedback ? <p className="mt-2 text-sm text-slate-700">{feedback}</p> : null}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-base font-semibold text-slate-800">Bulk Clearance Letter Generation</h2>
          <p className="mt-1 text-sm text-slate-600">
            Merges your active clearance .docx once per selected corper and combines pages.
            Use placeholders like <code className="text-xs">{"{formattedIssueDate}"}</code>,{" "}
            <code className="text-xs">{"{fullName}"}</code>,{" "}
            <code className="text-xs">{"{stateCode}"}</code>,{" "}
            <code className="text-xs">{"{callUpNumber}"}</code>,{" "}
            <code className="text-xs">{"{monthCovered}"}</code>,{" "}
            <code className="text-xs">{"{allowanceMonth}"}</code>. No {"{#corpers}"} loop needed.
            Keep top margin ~3500 twips for letterhead.
          </p>
          {clearanceTemplate ? (
            <p className="mt-1 text-xs text-slate-500">
              Active template: {clearanceTemplate.name} (v{clearanceTemplate.version})
            </p>
          ) : (
            <p className="mt-1 text-xs text-amber-700">
              No active clearance template — upload one under Letter templates.
            </p>
          )}
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="grid gap-1">
              <Label htmlFor="month-covered">Month worked satisfactorily</Label>
              <Input
                id="month-covered"
                value={monthCovered}
                onChange={(e) => setMonthCovered(e.target.value)}
                placeholder="April, 2026"
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="allowance-month">Allowance month</Label>
              <Input
                id="allowance-month"
                value={allowanceMonth}
                onChange={(e) => setAllowanceMonth(e.target.value)}
                placeholder="May, 2026"
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="issue-date">Issue date</Label>
              <Input
                id="issue-date"
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
              />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={selectAllLoaded}>
              Select all loaded
            </Button>
            <Button variant="outline" onClick={clearSelection}>
              Clear selection
            </Button>
            <Button
              onClick={generateBulkDocx}
              disabled={
                selectedCorpers.length === 0 || isGenerating || !clearanceTemplate?.downloadUrl
              }
            >
              {isGenerating
                ? "Generating..."
                : `Generate .docx (${selectedCorpers.length} selected)`}
            </Button>
            <p className="text-xs text-slate-500">Active-only loaded: {activeCorpers.length}</p>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-700">Corpers</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {activeCorpers.map((row) => (
              <label key={row._id} className="flex cursor-pointer items-center gap-3 px-4 py-3">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={Boolean(selected[row._id])}
                  onChange={() => toggleOne(row._id)}
                />
                <div className="min-w-0">
                  <div className="text-sm font-medium text-slate-800">{toTitleCase(row.fullName)}</div>
                  <div className="text-xs text-slate-600">
                    {row.stateCode} | {row.callUpNumber}
                  </div>
                </div>
              </label>
            ))}
            {activeCorpers.length === 0 && status !== "LoadingFirstPage" ? (
              <div className="px-4 py-6 text-center text-sm text-slate-600">No corpers found.</div>
            ) : null}
          </div>
          <div className="border-t border-slate-200 px-4 py-3">
            <Button
              variant="outline"
              onClick={() => loadMore(50)}
              disabled={status !== "CanLoadMore"}
            >
              {status === "CanLoadMore" ? "Load more" : "No more"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
