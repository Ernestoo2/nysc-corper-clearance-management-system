"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { saveAs } from "file-saver";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { buildMergeDataForLetterType } from "@/lib/letters/buildMergeData";
import { fetchAndMergeDocx, formatDocxMergeError } from "@/lib/letters/merge";
import { LETTER_TYPE_LABELS, LETTER_TYPES, type LetterType } from "@/lib/letters/types";

type CorperDoc = Doc<"corpers">;
type PgApplicantDoc = Doc<"pgApplicants">;

const MERGE_FIELD_HINTS: Record<LetterType, string> = {
    acceptance: "{fullName}, {callUpNumber}, {stateCode}, {formattedIssueDate}, {referenceNo}",
    posting:
        "{currentDate}, {referenceNo}, {fullName}, {deploymentUnit}, {formattedEffectiveDate}, {reportingOfficer}",
    clearance:
        "{formattedIssueDate}, {fullName}, {stateCode}, {callUpNumber}, {monthCovered}, {allowanceMonth} (one letter per page in bulk)",
    pg_admission:
        "{fullName}, {formattedAddress}, {salutationLine}, {faculty}, {department}, {degreeType}, {programmeFull}, {academicSession}, {formattedSessionStartDate}, {referenceNo}",
};

export default function LetterTemplatesPage() {
    const [letterType, setLetterType] = useState<LetterType>("acceptance");
    const [templateName, setTemplateName] = useState("");
    const [templateFile, setTemplateFile] = useState<File | null>(null);
    const [feedback, setFeedback] = useState("");
    const [isUploading, setIsUploading] = useState(false);
    const [isMerging, setIsMerging] = useState(false);
    const [deletingId, setDeletingId] = useState<Id<"letterTemplates"> | null>(null);
    const [selectedCorperId, setSelectedCorperId] = useState<string>("");
    const [selectedPgId, setSelectedPgId] = useState<string>("");

    const activeTemplate = useQuery(api.letters.getActiveTemplate, { letterType });
    const templates = useQuery(api.letters.listTemplates, { letterType });
    const generateUploadUrl = useMutation(api.letters.generateTemplateUploadUrl);
    const createTemplate = useMutation(api.letters.createTemplate);
    const setActiveTemplate = useMutation(api.letters.setActiveTemplate);
    const deleteTemplate = useMutation(api.letters.deleteTemplate);

    const { results: corpers } = usePaginatedQuery(
        api.corpers.list,
        { status: "ACTIVE" },
        { initialNumItems: 30 }
    );
    const { results: pgApplicants } = usePaginatedQuery(
        api.pgApplicants.list,
        {},
        { initialNumItems: 30 }
    );

    const selectedCorper = useMemo(() => {
        if (!selectedCorperId) return undefined;
        return (corpers as CorperDoc[] | undefined)?.find((row) => row._id === selectedCorperId);
    }, [corpers, selectedCorperId]);

    const selectedPg = useMemo(() => {
        if (!selectedPgId) return undefined;
        return (pgApplicants as PgApplicantDoc[] | undefined)?.find((row) => row._id === selectedPgId);
    }, [pgApplicants, selectedPgId]);

    async function handleUploadTemplate() {
        if (!templateFile || !templateName.trim()) {
            setFeedback("Provide a template name and select a .docx file.");
            return;
        }
        if (!templateFile.name.toLowerCase().endsWith(".docx")) {
            setFeedback("Template must be a .docx file.");
            return;
        }

        setIsUploading(true);
        setFeedback("");
        try {
            const uploadUrl = await generateUploadUrl({});
            const uploadResult = await fetch(uploadUrl, {
                method: "POST",
                headers: {
                    "Content-Type":
                        templateFile.type ||
                        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                },
                body: templateFile,
            });
            if (!uploadResult.ok) throw new Error("File upload failed");
            const { storageId } = (await uploadResult.json()) as { storageId?: string };
            if (!storageId) throw new Error("Storage id missing from upload response");

            await createTemplate({
                letterType,
                name: templateName.trim(),
                fileId: storageId as Id<"_storage">,
                fileName: templateFile.name,
                setActive: true,
            });
            setFeedback(`Template uploaded and set active for ${LETTER_TYPE_LABELS[letterType]}.`);
            setTemplateName("");
            setTemplateFile(null);
        } catch (error) {
            setFeedback(error instanceof Error ? error.message : "Upload failed");
        } finally {
            setIsUploading(false);
        }
    }

    async function handleTestMerge() {
        if (!activeTemplate?.downloadUrl) {
            setFeedback("Upload and activate a template before running test merge.");
            return;
        }

        setIsMerging(true);
        setFeedback("");
        try {
            const mergeData = buildMergeDataForLetterType(letterType, {
                corper: letterType === "pg_admission" ? undefined : selectedCorper,
                pgApplicant: letterType === "pg_admission" ? selectedPg : undefined,
            });
            const blob = await fetchAndMergeDocx(activeTemplate.downloadUrl, mergeData);
            const slug = letterType.replace(/_/g, "-");
            saveAs(blob, `test-merge-${slug}-v${activeTemplate.version}.docx`);
            setFeedback("Test merge downloaded.");
        } catch (error) {
            setFeedback(
                `${formatDocxMergeError(error)}. Use single placeholders like {fullName} — not split across lines in Word.`
            );
        } finally {
            setIsMerging(false);
        }
    }

    async function handleSetActive(templateId: Id<"letterTemplates">) {
        setFeedback("");
        try {
            await setActiveTemplate({ templateId });
            setFeedback("Active template updated.");
        } catch (error) {
            setFeedback(error instanceof Error ? error.message : "Unable to set active template");
        }
    }

    async function handleDelete(
        templateId: Id<"letterTemplates">,
        label: string
    ) {
        const confirmed = window.confirm(
            `Delete ${label}? This removes the template record and its .docx from Convex storage. This cannot be undone.`
        );
        if (!confirmed) return;

        setDeletingId(templateId);
        setFeedback("");
        try {
            await deleteTemplate({ templateId });
            setFeedback("Template version deleted.");
        } catch (error) {
            setFeedback(error instanceof Error ? error.message : "Unable to delete template");
        } finally {
            setDeletingId(null);
        }
    }

    return (
        <div className="min-h-screen bg-slate-50 p-6">
            <div className="mx-auto max-w-5xl space-y-6">
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-bold text-[#1F4E79]">Letter templates</h1>
                        <p className="text-sm text-slate-600">
                            Upload .docx templates with {"{placeholders}"}. Test merge uses registry
                            data or built-in samples. Margins stay in your template for pre-printed
                            letterhead.
                        </p>
                    </div>
                    <Button asChild variant="outline">
                        <Link href="/panel">Back to Panel</Link>
                    </Button>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="grid gap-3 md:grid-cols-2">
                        <div className="grid gap-1">
                            <Label htmlFor="letter-type">Letter type</Label>
                            <select
                                id="letter-type"
                                className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm"
                                value={letterType}
                                onChange={(e) => setLetterType(e.target.value as LetterType)}
                            >
                                {LETTER_TYPES.map((type) => (
                                    <option key={type} value={type}>
                                        {LETTER_TYPE_LABELS[type]}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="grid gap-1 text-sm text-slate-600">
                            <span className="font-medium text-slate-800">Placeholder hints</span>
                            <p className="text-xs leading-relaxed">{MERGE_FIELD_HINTS[letterType]}</p>
                        </div>
                    </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <h2 className="text-base font-semibold text-slate-800">Active template</h2>
                    {activeTemplate ? (
                        <div className="mt-2 space-y-1 text-sm text-slate-700">
                            <p>
                                <span className="font-medium">{activeTemplate.name}</span> (v
                                {activeTemplate.version}) — {activeTemplate.fileName}
                            </p>
                            {activeTemplate.downloadUrl ? (
                                <a
                                    href={activeTemplate.downloadUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-[#1F4E79] underline"
                                >
                                    Download template file
                                </a>
                            ) : null}
                        </div>
                    ) : (
                        <p className="mt-2 text-sm text-slate-500">No active template for this type yet.</p>
                    )}
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <h2 className="text-base font-semibold text-slate-800">Upload template</h2>
                    <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                        <div className="grid gap-1">
                            <Label htmlFor="template-name">Template name</Label>
                            <Input
                                id="template-name"
                                value={templateName}
                                onChange={(e) => setTemplateName(e.target.value)}
                                placeholder="Acceptance letter May 2026"
                            />
                        </div>
                        <div className="grid gap-1">
                            <Label htmlFor="template-file">.docx file</Label>
                            <Input
                                id="template-file"
                                type="file"
                                accept=".docx"
                                onChange={(e) => setTemplateFile(e.target.files?.[0] ?? null)}
                            />
                        </div>
                    </div>
                    <div className="mt-3">
                        <Button onClick={handleUploadTemplate} disabled={isUploading}>
                            {isUploading ? "Uploading..." : "Upload & set active"}
                        </Button>
                    </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <h2 className="text-base font-semibold text-slate-800">Test merge</h2>
                    <p className="mt-1 text-sm text-slate-600">
                        Uses selected registry record when available; otherwise built-in sample data.
                    </p>
                    <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                        {letterType !== "pg_admission" ? (
                            <div className="grid gap-1">
                                <Label htmlFor="test-corper">Corper (optional)</Label>
                                <select
                                    id="test-corper"
                                    className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm"
                                    value={selectedCorperId}
                                    onChange={(e) => setSelectedCorperId(e.target.value)}
                                >
                                    <option value="">Sample corper</option>
                                    {(corpers as CorperDoc[] | undefined)?.map((row) => (
                                        <option key={row._id} value={row._id}>
                                            {row.fullName} — {row.callUpNumber}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        ) : (
                            <div className="grid gap-1">
                                <Label htmlFor="test-pg">PG applicant (optional)</Label>
                                <select
                                    id="test-pg"
                                    className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm"
                                    value={selectedPgId}
                                    onChange={(e) => setSelectedPgId(e.target.value)}
                                >
                                    <option value="">Sample applicant</option>
                                    {(pgApplicants as PgApplicantDoc[] | undefined)?.map((row) => (
                                        <option key={row._id} value={row._id}>
                                            {row.fullName} — {row.academicSession}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>
                    <div className="mt-3">
                        <Button
                            onClick={handleTestMerge}
                            disabled={isMerging || !activeTemplate?.downloadUrl}
                        >
                            {isMerging ? "Merging..." : "Download test merge"}
                        </Button>
                    </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
                    <div className="border-b border-slate-200 px-4 py-3">
                        <h2 className="text-sm font-semibold text-slate-700">All versions</h2>
                        <p className="mt-1 text-xs text-slate-500">
                            Inactive versions can be deleted to free Convex storage. Versions linked to
                            letter issuances cannot be removed.
                        </p>
                    </div>
                    <div className="divide-y divide-slate-100">
                        {(templates ?? []).map((row) => (
                            <div
                                key={row._id}
                                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
                            >
                                <div>
                                    <span className="font-medium text-slate-800">{row.name}</span>
                                    <span className="ml-2 text-slate-500">
                                        v{row.version}
                                        {row.isActive ? " · active" : ""}
                                    </span>
                                </div>
                                <div className="flex gap-2">
                                    {row.downloadUrl ? (
                                        <Button asChild variant="outline" size="sm">
                                            <a href={row.downloadUrl} target="_blank" rel="noreferrer">
                                                Download
                                            </a>
                                        </Button>
                                    ) : null}
                                    {!row.isActive ? (
                                        <>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleSetActive(row._id)}
                                                disabled={deletingId !== null}
                                            >
                                                Set active
                                            </Button>
                                            <Button
                                                variant="destructive"
                                                size="sm"
                                                onClick={() =>
                                                    handleDelete(
                                                        row._id,
                                                        `${row.name} v${row.version}`
                                                    )
                                                }
                                                disabled={deletingId !== null}
                                            >
                                                {deletingId === row._id ? "Deleting…" : "Delete"}
                                            </Button>
                                        </>
                                    ) : null}
                                </div>
                            </div>
                        ))}
                        {(templates ?? []).length === 0 ? (
                            <div className="px-4 py-6 text-center text-sm text-slate-500">
                                No templates uploaded for this letter type.
                            </div>
                        ) : null}
                    </div>
                </div>

                {feedback ? <p className="text-sm text-slate-700">{feedback}</p> : null}
            </div>
        </div>
    );
}
