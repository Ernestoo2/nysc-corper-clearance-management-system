"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { Document, Packer, PageBreak, Paragraph, TextRun } from "docx";
import { saveAs } from "file-saver";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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

function dayWithOrdinal(day: number) {
  const mod10 = day % 10;
  const mod100 = day % 100;
  if (mod10 === 1 && mod100 !== 11) return `${day}st`;
  if (mod10 === 2 && mod100 !== 12) return `${day}nd`;
  if (mod10 === 3 && mod100 !== 13) return `${day}rd`;
  return `${day}th`;
}

function formatFormalDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const month = date.toLocaleString("en-US", { month: "long" });
  return `${dayWithOrdinal(date.getDate())} ${month}, ${date.getFullYear()}.`;
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
  const [unitName, setUnitName] = useState("");
  const [headOfUnit, setHeadOfUnit] = useState("");
  const [isSavingUnitHead, setIsSavingUnitHead] = useState(false);
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
  const deploymentHeads = useQuery(api.corpers.listDeploymentUnitHeads, {});
  const generateUploadUrl = useMutation(api.corpers.generateMonthlyFormUploadUrl);
  const publishSharedForm = useMutation(api.corpers.publishSharedMonthlyForm);
  const saveUnitHead = useMutation(api.corpers.upsertDeploymentUnitHead);
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
    setIsGenerating(true);

    try {
        const paragraphs: Paragraph[] = [];
        const formattedIssueDate = formatFormalDate(issueDate);
        
        // Define the header section that should appear at the top of each page
        const createHeaderSection = (isFirstPage: boolean = false) => {
           
            return [
                new Paragraph({
                    children: [new TextRun({ text: formattedIssueDate, bold: true, size: 24 })],
                    spacing: { before: 900, after: 250 },
                }),
                new Paragraph({
                    children: [new TextRun({ text: "The State Coordinator,", size: 24 })],
                    spacing: { before: 0 },
                }),
                new Paragraph({ children: [new TextRun({ text: "N.Y.S.C,", size: 24 })] }),
                new Paragraph({ children: [new TextRun({ text: "Oyo State,", size: 24 })] }),
                new Paragraph({
                    children: [new TextRun({ text: "Nigeria.", size: 24 })],
                    spacing: { after: 500 },
                }),
                new Paragraph({
                    children: [new TextRun({ text: "Dear Sir,", size: 24 })],
                    spacing: { after: 260 },
                }),
                new Paragraph({
                    children: [
                        new TextRun({ text: "Monthly Clearance", bold: true, italics: true, underline: {}, size: 26 }),
                    ],
                    spacing: { after: 300 },
                }),
            ];
        };
        
        // Define the body content
        const createBodyContent = (corper: CorperDoc) => {
            return [
                new Paragraph({
                    children: [
                        new TextRun({ text: "This is to certify that ", size: 24 }),
                        new TextRun({ text: toTitleCase(corper.fullName), bold: true, size: 24 }),
                        new TextRun({ text: " with State Code No: ", size: 24 }),
                        new TextRun({ text: corper.stateCode, bold: true, size: 24 }),
                        new TextRun({ text: " and NYSC Call-up No: ", size: 24 }),
                        new TextRun({ text: corper.callUpNumber, bold: true, size: 24 }),
                        new TextRun({
                            text: ` has worked satisfactorily for the month of ${monthCovered} and should be paid monthly allowance for the month of ${allowanceMonth}.`,
                            size: 24,
                        }),
                    ],
                    spacing: { after: 300 },
                }),
                new Paragraph({
                    children: [new TextRun({ text: "Thank you.", size: 24 })],
                    spacing: { after: 700 },
                }),
                new Paragraph({
                    children: [new TextRun({ text: "A. O. Ayanjompe (Mrs.)", bold: true, size: 24 })],
                    spacing: { after: 120 },
                }),
                new Paragraph({
                    children: [new TextRun({ text: "Deputy Registrar, HR (Admin/Tech. Est.)", bold: true, size: 22 })],
                    spacing: { after: 120 },
                }),
                new Paragraph({
                    children: [new TextRun({ text: "For: Registrar", bold: true, italics: true, size: 22 })],
                }),
            ];
        };

        selectedCorpers.forEach((corper, index) => {
            // First page or after page break, we need to add the header section
            // But ensure we don't add duplicate page breaks
            if (index === 0) {
                // First corper on first page with top spacing
                paragraphs.push(...createHeaderSection(true));
                paragraphs.push(...createBodyContent(corper));
            } else {
                // For subsequent corpers, add page break then header with proper spacing
                paragraphs.push(new Paragraph({ children: [new PageBreak()] }));
                paragraphs.push(...createHeaderSection(false));
                paragraphs.push(...createBodyContent(corper));
            }
        });
        
        const doc = new Document({
            sections: [{ 
                properties: {
                    page: {
                        margin: {
                            top: 3500,     
                            right: 720,
                            bottom: 720,
                            left: 720,
                        }
                    }
                }, 
                children: paragraphs 
            }],
        });

        const blob = await Packer.toBlob(doc);
        saveAs(blob, `nysc-bulk-clearance-${monthCovered.replace(/\s+/g, "-").toLowerCase()}.docx`);
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

  async function handleSaveUnitHead() {
    if (!unitName.trim()) {
      setFeedback("Deployment unit is required.");
      return;
    }
    setIsSavingUnitHead(true);
    setFeedback("");
    try {
      await saveUnitHead({
        deploymentUnit: unitName.trim(),
        headOfUnit: headOfUnit.trim() || undefined,
      });
      setFeedback("Head of unit updated.");
      setUnitName("");
      setHeadOfUnit("");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Unable to save head of unit");
    } finally {
      setIsSavingUnitHead(false);
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
          <h2 className="text-base font-semibold text-slate-800">Deployment Unit Heads (Optional)</h2>
          <p className="mt-1 text-sm text-slate-600">
            Supports the dualized mode by mapping each deployment unit to an optional HOD name.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="grid gap-1">
              <Label htmlFor="unit-name">Deployment unit</Label>
              <Input
                id="unit-name"
                value={unitName}
                onChange={(e) => setUnitName(e.target.value)}
                placeholder="ICT Unit"
              />
            </div>
            <div className="grid gap-1 md:col-span-2">
              <Label htmlFor="head-of-unit">Head of unit (optional)</Label>
              <Input
                id="head-of-unit"
                value={headOfUnit}
                onChange={(e) => setHeadOfUnit(e.target.value)}
                placeholder="Dr. John Doe"
              />
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button onClick={handleSaveUnitHead} disabled={isSavingUnitHead}>
              {isSavingUnitHead ? "Saving..." : "Save Unit Head"}
            </Button>
          </div>
          <div className="mt-4 divide-y divide-slate-100 rounded-lg border border-slate-200">
            {(deploymentHeads ?? []).map((row) => (
              <div key={row._id} className="flex items-center justify-between px-3 py-2 text-sm">
                <span className="font-medium text-slate-700">{row.deploymentUnit}</span>
                <span className="text-slate-600">{row.headOfUnit ?? "Not set"}</span>
              </div>
            ))}
            {(deploymentHeads ?? []).length === 0 ? (
              <div className="px-3 py-3 text-sm text-slate-500">No deployment-unit heads configured yet.</div>
            ) : null}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-base font-semibold text-slate-800">Bulk Clearance Letter Generation</h2>
          <p className="mt-1 text-sm text-slate-600">
            Generate monthly clearance letters for selected corpers.
          </p>
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
            <Button onClick={generateBulkDocx} disabled={selectedCorpers.length === 0 || isGenerating}>
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
