"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { saveAs } from "file-saver";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { corperToPostingMergeFields } from "@/lib/letters/corperMergeFields";
import { fetchAndMergeDocx, formatDocxMergeError } from "@/lib/letters/merge";
import { isPlaceholderReference } from "@/lib/letters/referenceFormat";
import { POSTING_REFERENCE_SCOPE_KEY } from "@/lib/letters/postingScope";

type CorperDoc = Doc<"corpers">;

type IssuanceRow = {
    _id: Id<"letterIssuances">;
    status: string;
    referenceNo?: string;
    issueDate: string;
    createdAt: number;
    trigger: string;
    registrySerial?: number;
    mergeData: Record<string, string | number | boolean>;
    templateDownloadUrl: string | null;
    suggestedReferenceNo?: string | null;
};

type Props = {
    corper: CorperDoc;
};

function formatWhen(ms: number) {
    try {
        return new Date(ms).toLocaleString();
    } catch {
        return String(ms);
    }
}

export function CorperPostingLetterDialog({ corper }: Props) {
    const [open, setOpen] = useState(false);
    const [selectedId, setSelectedId] = useState<string>("");
    /** After creating a draft, keep selection on it until the query catches up. */
    const [focusDraftId, setFocusDraftId] = useState<Id<"letterIssuances"> | null>(null);
    const [issueDate, setIssueDate] = useState("");
    const [effectiveDate, setEffectiveDate] = useState("");
    const [reportingOfficer, setReportingOfficer] = useState("");
    const [previewReference, setPreviewReference] = useState("");
    const [feedback, setFeedback] = useState("");
    const [busy, setBusy] = useState<"download" | "issue" | "save" | "create" | null>(null);

    const issuances = useQuery(
        api.letters.listIssuancesForCorper,
        open ? { corperId: corper._id, letterType: "posting" as const } : "skip"
    );
    const activeTemplate = useQuery(
        api.letters.getActiveTemplate,
        open ? { letterType: "posting" } : "skip"
    );

    const ensureDraft = useMutation(api.letters.ensurePostingDraft);
    const updateOverrides = useMutation(api.letters.updateDraftOverrides);
    const issueIssuance = useMutation(api.letters.issueIssuance);

    const rows = (issuances ?? []) as IssuanceRow[];

    const selected = useMemo(() => {
        if (!rows.length) return null;
        if (focusDraftId) {
            const focused = rows.find((row) => row._id === focusDraftId);
            if (focused) return focused;
        }
        if (selectedId) {
            return rows.find((row) => row._id === selectedId) ?? rows[0]!;
        }
        return rows[0]!;
    }, [rows, selectedId, focusDraftId]);

    const awaitingNewDraft =
        focusDraftId !== null && !rows.some((row) => row._id === focusDraftId);

    const isDraft = selected?.status === "draft" || awaitingNewDraft;
    const isFinal = selected?.status === "final";
    const hasDeployment = Boolean(corper.deploymentUnit?.trim());

    useEffect(() => {
        if (!open) {
            setFocusDraftId(null);
            return;
        }
        if (!issuances?.length) return;

        if (focusDraftId && issuances.some((row) => row._id === focusDraftId)) {
            setSelectedId(focusDraftId);
            return;
        }

        setSelectedId((current) => {
            if (current && issuances.some((row) => row._id === current)) return current;
            const draft = issuances.find((row) => row.status === "draft");
            return (draft ?? issuances[0])._id;
        });
    }, [open, issuances, focusDraftId]);

    useEffect(() => {
        if (!open || !selected || awaitingNewDraft) return;
        setIssueDate(selected.issueDate);
        const prior = selected.mergeData;
        setEffectiveDate(
            typeof prior.effectiveDate === "string" ? prior.effectiveDate : selected.issueDate
        );
        setReportingOfficer(
            typeof prior.reportingOfficer === "string" ? prior.reportingOfficer : ""
        );
        const ref =
            selected.referenceNo ??
            (typeof prior.referenceNo === "string" ? prior.referenceNo : "");
        setPreviewReference(ref === "LCU/TEST/0001" ? "" : ref);
    }, [open, selected?._id, selected?.issueDate, selected?.referenceNo, selected?.mergeData]);

    function primeEditFieldsForNewDraft() {
        const today = new Date().toISOString().slice(0, 10);
        setIssueDate(today);
        setEffectiveDate(today);
        setPreviewReference("");
        setReportingOfficer("");
    }

    async function handleEnsureDraft() {
        setBusy("create");
        setFeedback("");
        try {
            const result = await ensureDraft({ corperId: corper._id });
            setFocusDraftId(result.issuanceId);
            setSelectedId(result.issuanceId);
            primeEditFieldsForNewDraft();
            setFeedback("Edit the fields below, then download or issue.");
        } catch (error) {
            setFeedback(error instanceof Error ? error.message : "Unable to create draft");
        } finally {
            setBusy(null);
        }
    }

    async function handleSaveOverrides() {
        if (!selected || !isDraft || awaitingNewDraft) return;
        setBusy("save");
        setFeedback("");
        try {
            await updateOverrides({
                issuanceId: selected._id,
                issueDate: issueDate || undefined,
                effectiveDate: effectiveDate || undefined,
                reportingOfficer: reportingOfficer.trim() || undefined,
                referenceNo: previewReference.trim() || undefined,
            });
            setFeedback("Preview fields saved.");
        } catch (error) {
            setFeedback(error instanceof Error ? error.message : "Unable to save overrides");
        } finally {
            setBusy(null);
        }
    }

    function buildMergePayload() {
        const resolvedIssueDate = issueDate || selected?.issueDate;
        const resolvedEffective = effectiveDate || resolvedIssueDate;
        const resolvedReference =
            previewReference.trim() ||
            selected?.referenceNo ||
            (typeof selected?.mergeData?.referenceNo === "string"
                ? selected.mergeData.referenceNo
                : undefined);
        const referenceNo =
            resolvedReference && !isPlaceholderReference(resolvedReference)
                ? resolvedReference
                : undefined;

        return corperToPostingMergeFields(corper, {
            issueDate: resolvedIssueDate,
            effectiveDate: resolvedEffective,
            reportingOfficer: reportingOfficer.trim() || undefined,
            referenceNo,
        });
    }

    async function downloadMerged() {
        if (!selected || awaitingNewDraft) return;
        const templateUrl =
            selected.templateDownloadUrl ?? activeTemplate?.downloadUrl ?? null;
        if (!templateUrl) {
            setFeedback("Upload an active posting template first.");
            return;
        }

        setBusy("download");
        setFeedback("");
        try {
            if (isDraft) {
                await updateOverrides({
                    issuanceId: selected._id,
                    issueDate: issueDate || undefined,
                    effectiveDate: effectiveDate || undefined,
                    reportingOfficer: reportingOfficer.trim() || undefined,
                    referenceNo: previewReference.trim() || undefined,
                });
            }

            const blob = await fetchAndMergeDocx(templateUrl, buildMergePayload());
            const slug = corper.callUpNumber.replace(/[^A-Z0-9]+/gi, "-");
            const suffix = selected.status === "final" ? "issued" : "draft";
            saveAs(blob, `posting-${slug}-${suffix}.docx`);
            setFeedback("Letter downloaded.");
        } catch (error) {
            setFeedback(formatDocxMergeError(error));
        } finally {
            setBusy(null);
        }
    }

    async function handleIssue() {
        if (!selected || !isDraft || awaitingNewDraft) return;
        setBusy("issue");
        setFeedback("");
        try {
            await updateOverrides({
                issuanceId: selected._id,
                issueDate: issueDate || undefined,
                effectiveDate: effectiveDate || undefined,
                reportingOfficer: reportingOfficer.trim() || undefined,
                referenceNo: previewReference.trim() || undefined,
            });
            const result = await issueIssuance({
                issuanceId: selected._id,
                scopeKey: POSTING_REFERENCE_SCOPE_KEY,
                referenceNo: previewReference.trim() || undefined,
            });
            setFeedback(`Issued with reference ${result.referenceNo ?? "—"}.`);
        } catch (error) {
            setFeedback(error instanceof Error ? error.message : "Unable to issue letter");
        } finally {
            setBusy(null);
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button size="xs" variant="outline">
                    Posting
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Posting letters</DialogTitle>
                    <DialogDescription>
                        {corper.fullName} — {corper.callUpNumber}
                        {hasDeployment ? (
                            <span className="block mt-1">Unit: {corper.deploymentUnit}</span>
                        ) : null}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    {!hasDeployment ? (
                        <p className="text-sm text-amber-700">
                            No deployment unit set. Assign a unit to generate posting letters.
                        </p>
                    ) : null}

                    {rows.length === 0 ? (
                        <div className="space-y-2 text-sm text-slate-600">
                            <p>No posting letters on file yet.</p>
                            {!activeTemplate ? (
                                <p className="text-amber-700">
                                    Upload an active posting template under Letter templates first.
                                </p>
                            ) : null}
                            <Button
                                onClick={handleEnsureDraft}
                                disabled={busy !== null || !activeTemplate || !hasDeployment}
                            >
                                {busy === "create" ? "Creating…" : "Create draft"}
                            </Button>
                        </div>
                    ) : (
                        <>
                            <div className="grid gap-1">
                                <Label htmlFor={`posting-history-${corper._id}`}>History</Label>
                                <select
                                    id={`posting-history-${corper._id}`}
                                    className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm"
                                    value={selected?._id ?? ""}
                                    onChange={(e) => {
                                        setFocusDraftId(null);
                                        setSelectedId(e.target.value);
                                    }}
                                >
                                    {rows.map((row) => (
                                        <option key={row._id} value={row._id}>
                                            {formatWhen(row.createdAt)} — {row.status}
                                            {row.referenceNo ? ` — ${row.referenceNo}` : ""}
                                            {typeof row.mergeData.deploymentUnit === "string"
                                                ? ` — ${row.mergeData.deploymentUnit}`
                                                : ""}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {selected || awaitingNewDraft ? (
                                <>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <Badge
                                            variant={
                                                isFinal && !awaitingNewDraft
                                                    ? "default"
                                                    : isDraft
                                                      ? "secondary"
                                                      : "outline"
                                            }
                                        >
                                            {awaitingNewDraft ? "draft" : selected!.status}
                                        </Badge>
                                        {selected?.referenceNo ? (
                                            <span className="font-mono text-xs text-slate-700">
                                                {selected.referenceNo}
                                            </span>
                                        ) : null}
                                    </div>
                                    <p className="text-xs text-slate-500">
                                        On issue:{" "}
                                        {selected?.suggestedReferenceNo ??
                                            `LCU/REG/${POSTING_REFERENCE_SCOPE_KEY}/…`}{" "}
                                        (posting letter #{selected?.registrySerial ?? "—"} in
                                        registry).
                                    </p>

                                    {isDraft ? (
                                        <div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                                            {awaitingNewDraft ? (
                                                <p className="text-xs text-slate-500">
                                                    Loading new draft…
                                                </p>
                                            ) : null}
                                            <p className="text-sm font-medium text-slate-800">
                                                Edit draft
                                            </p>
                                            <p className="text-xs text-slate-500">
                                                Adjust dates, reporting officer, and reference,
                                                then download or issue.
                                            </p>
                                            <div className="grid gap-1">
                                                <Label htmlFor={`posting-issue-${corper._id}`}>
                                                    Issue date
                                                </Label>
                                                <Input
                                                    id={`posting-issue-${corper._id}`}
                                                    type="date"
                                                    value={issueDate}
                                                    onChange={(e) => setIssueDate(e.target.value)}
                                                />
                                            </div>
                                            <div className="grid gap-1">
                                                <Label
                                                    htmlFor={`posting-effective-${corper._id}`}
                                                >
                                                    Effective date
                                                </Label>
                                                <Input
                                                    id={`posting-effective-${corper._id}`}
                                                    type="date"
                                                    value={effectiveDate}
                                                    onChange={(e) =>
                                                        setEffectiveDate(e.target.value)
                                                    }
                                                />
                                            </div>
                                            <div className="grid gap-1">
                                                <Label
                                                    htmlFor={`posting-officer-${corper._id}`}
                                                >
                                                    Reporting officer
                                                </Label>
                                                <Input
                                                    id={`posting-officer-${corper._id}`}
                                                    value={reportingOfficer}
                                                    onChange={(e) =>
                                                        setReportingOfficer(e.target.value)
                                                    }
                                                    placeholder="From deployment unit head, or override"
                                                />
                                            </div>
                                            <div className="grid gap-1">
                                                <Label htmlFor={`posting-ref-${corper._id}`}>
                                                    Reference (preview, optional)
                                                </Label>
                                                <Input
                                                    id={`posting-ref-${corper._id}`}
                                                    value={previewReference}
                                                    onChange={(e) =>
                                                        setPreviewReference(e.target.value)
                                                    }
                                                    placeholder={
                                                        selected?.suggestedReferenceNo ??
                                                        "LCU/REG/GN/001"
                                                    }
                                                />
                                                <p className="text-xs text-slate-500">
                                                    Optional override. Leave blank for registry
                                                    serial on issue.
                                                </p>
                                            </div>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={handleSaveOverrides}
                                                disabled={busy !== null}
                                            >
                                                {busy === "save" ? "Saving…" : "Save preview fields"}
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
                                            <p>
                                                This letter is <strong>final</strong> (reference
                                                locked). To reassign details and issue again, create
                                                a new draft.
                                            </p>
                                            <Button
                                                size="sm"
                                                onClick={handleEnsureDraft}
                                                disabled={
                                                    busy !== null || !activeTemplate || !hasDeployment
                                                }
                                            >
                                                {busy === "create"
                                                    ? "Creating…"
                                                    : "New draft & edit"}
                                            </Button>
                                        </div>
                                    )}

                                    <div className="flex flex-wrap gap-2">
                                        <Button
                                            variant="outline"
                                            onClick={downloadMerged}
                                            disabled={
                                                busy !== null ||
                                                !(
                                                    selected?.templateDownloadUrl ??
                                                    activeTemplate?.downloadUrl
                                                )
                                            }
                                        >
                                            {busy === "download"
                                                ? "Downloading…"
                                                : "Download DOCX"}
                                        </Button>
                                        {isDraft ? (
                                            <Button
                                                onClick={handleIssue}
                                                disabled={busy !== null}
                                            >
                                                {busy === "issue" ? "Issuing…" : "Issue (finalise)"}
                                            </Button>
                                        ) : null}
                                    </div>
                                </>
                            ) : null}

                            {isDraft ? (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleEnsureDraft}
                                    disabled={busy !== null || !activeTemplate || !hasDeployment}
                                >
                                    {busy === "create" ? "Creating…" : "Another posting draft"}
                                </Button>
                            ) : null}
                        </>
                    )}

                    {feedback ? <p className="text-sm text-slate-700">{feedback}</p> : null}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>
                        Close
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
