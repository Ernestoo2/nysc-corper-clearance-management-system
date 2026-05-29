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
import { acceptanceScopeKeyFromCallUp } from "@/lib/letters/acceptanceScope";
import { corperToAcceptanceMergeFields } from "@/lib/letters/corperMergeFields";
import { fetchAndMergeDocx, formatDocxMergeError } from "@/lib/letters/merge";
import { isPlaceholderReference } from "@/lib/letters/referenceFormat";

type CorperDoc = Doc<"corpers">;

type Props = {
    corper: CorperDoc;
};

export function CorperAcceptanceLetterDialog({ corper }: Props) {
    const [open, setOpen] = useState(false);
    const [focusDraftId, setFocusDraftId] = useState<Id<"letterIssuances"> | null>(null);
    const [issueDate, setIssueDate] = useState("");
    const [previewReference, setPreviewReference] = useState("");
    const [feedback, setFeedback] = useState("");
    const [busy, setBusy] = useState<"download" | "issue" | "save" | "create" | null>(null);

    const issuances = useQuery(
        api.letters.listIssuancesForCorper,
        open ? { corperId: corper._id, letterType: "acceptance" as const } : "skip"
    );
    const activeTemplate = useQuery(
        api.letters.getActiveTemplate,
        open ? { letterType: "acceptance" } : "skip"
    );

    const ensureDraft = useMutation(api.letters.ensureAcceptanceDraft);
    const updateOverrides = useMutation(api.letters.updateDraftOverrides);
    const issueIssuance = useMutation(api.letters.issueIssuance);

    type IssuanceRow = NonNullable<typeof issuances>[number];

    const latest = useMemo(() => {
        if (!issuances?.length) return null;
        if (focusDraftId) {
            const focused = issuances.find((row) => row._id === focusDraftId);
            if (focused) return focused;
        }
        return issuances[0] ?? null;
    }, [issuances, focusDraftId]) as IssuanceRow | null;

    const suggestedRef = latest?.suggestedReferenceNo ?? null;

    const awaitingNewDraft =
        focusDraftId !== null && !issuances?.some((row) => row._id === focusDraftId);

    const isDraft = latest?.status === "draft" || awaitingNewDraft;
    const isFinal = latest?.status === "final" && !awaitingNewDraft;

    useEffect(() => {
        if (!open) {
            setFocusDraftId(null);
            return;
        }
    }, [open]);

    useEffect(() => {
        if (!open || !latest || awaitingNewDraft) return;
        setIssueDate(latest.issueDate);
        const ref =
            latest.referenceNo ??
            (typeof latest.mergeData?.referenceNo === "string"
                ? latest.mergeData.referenceNo
                : "");
        setPreviewReference(ref === "LCU/TEST/0001" ? "" : ref);
    }, [open, latest?._id, latest?.issueDate, latest?.referenceNo, latest?.mergeData]);

    const scopeKey = useMemo(
        () => acceptanceScopeKeyFromCallUp(corper.callUpNumber),
        [corper.callUpNumber]
    );

    async function handleEnsureDraft() {
        setBusy("create");
        setFeedback("");
        try {
            const result = await ensureDraft({ corperId: corper._id });
            setFocusDraftId(result.issuanceId);
            const today = new Date().toISOString().slice(0, 10);
            setIssueDate(today);
            setPreviewReference("");
            setFeedback(
                result.created
                    ? "Edit the fields below, then download or issue."
                    : "Existing draft opened — edit below, then download or issue."
            );
        } catch (error) {
            setFeedback(error instanceof Error ? error.message : "Unable to create draft");
        } finally {
            setBusy(null);
        }
    }

    async function handleSaveOverrides() {
        if (!latest || !isDraft || awaitingNewDraft) return;
        setBusy("save");
        setFeedback("");
        try {
            await updateOverrides({
                issuanceId: latest._id,
                issueDate: issueDate || undefined,
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
        const resolvedIssueDate = issueDate || latest?.issueDate;
        const resolvedReference =
            previewReference.trim() ||
            latest?.referenceNo ||
            (typeof latest?.mergeData?.referenceNo === "string"
                ? latest.mergeData.referenceNo
                : undefined);
        const referenceNo =
            resolvedReference && !isPlaceholderReference(resolvedReference)
                ? resolvedReference
                : undefined;

        return corperToAcceptanceMergeFields(corper, {
            issueDate: resolvedIssueDate,
            referenceNo,
        });
    }

    async function downloadMerged() {
        if (!latest || awaitingNewDraft) return;
        const templateUrl =
            latest.templateDownloadUrl ?? activeTemplate?.downloadUrl ?? null;
        if (!templateUrl) {
            setFeedback("Upload an active acceptance template first.");
            return;
        }

        setBusy("download");
        setFeedback("");
        try {
            if (isDraft && (issueDate || previewReference.trim())) {
                await updateOverrides({
                    issuanceId: latest._id,
                    issueDate: issueDate || undefined,
                    referenceNo: previewReference.trim() || undefined,
                });
            }

            const blob = await fetchAndMergeDocx(templateUrl, buildMergePayload());
            const slug = corper.callUpNumber.replace(/[^A-Z0-9]+/gi, "-");
            const suffix = latest.status === "final" ? "issued" : "draft";
            saveAs(blob, `acceptance-${slug}-${suffix}.docx`);
            setFeedback("Letter downloaded.");
        } catch (error) {
            setFeedback(formatDocxMergeError(error));
        } finally {
            setBusy(null);
        }
    }

    async function handleIssue() {
        if (!latest || !isDraft || awaitingNewDraft) return;
        setBusy("issue");
        setFeedback("");
        try {
            if (issueDate || previewReference.trim()) {
                await updateOverrides({
                    issuanceId: latest._id,
                    issueDate: issueDate || undefined,
                    referenceNo: previewReference.trim() || undefined,
                });
            }
            const result = await issueIssuance({
                issuanceId: latest._id,
                scopeKey,
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
                    Acceptance
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>Acceptance letter</DialogTitle>
                    <DialogDescription>
                        {corper.fullName} — {corper.callUpNumber}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    {!latest && !awaitingNewDraft ? (
                        <div className="space-y-2 text-sm text-slate-600">
                            <p>No acceptance letter on file for this corper.</p>
                            {!activeTemplate ? (
                                <p className="text-amber-700">
                                    Upload an active acceptance template under Letter templates
                                    first.
                                </p>
                            ) : null}
                            <Button
                                onClick={handleEnsureDraft}
                                disabled={busy !== null || !activeTemplate}
                            >
                                {busy === "create" ? "Creating…" : "Create draft"}
                            </Button>
                        </div>
                    ) : (
                        <>
                            <div className="flex flex-wrap items-center gap-2">
                                <Badge
                                    variant={
                                        isFinal ? "default" : isDraft ? "secondary" : "outline"
                                    }
                                >
                                    {awaitingNewDraft && !latest
                                        ? "draft"
                                        : latest?.status ?? "draft"}
                                </Badge>
                                {latest?.referenceNo ? (
                                    <span className="font-mono text-xs text-slate-700">
                                        {latest.referenceNo}
                                    </span>
                                ) : null}
                            </div>
                            <p className="text-xs text-slate-500">
                                Registry serial for 20{scopeKey}:{" "}
                                {suggestedRef ?? `LCU/REG/CORPS/${scopeKey}/…`} (assigned on
                                issue unless you override below).
                            </p>

                            {isDraft ? (
                                <div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                                    {awaitingNewDraft ? (
                                        <p className="text-xs text-slate-500">Loading draft…</p>
                                    ) : null}
                                    <p className="text-sm font-medium text-slate-800">Edit draft</p>
                                    <div className="grid gap-1">
                                        <Label htmlFor={`issue-date-${corper._id}`}>
                                            Issue date
                                        </Label>
                                        <Input
                                            id={`issue-date-${corper._id}`}
                                            type="date"
                                            value={issueDate}
                                            onChange={(e) => setIssueDate(e.target.value)}
                                        />
                                    </div>
                                    <div className="grid gap-1">
                                        <Label htmlFor={`preview-ref-${corper._id}`}>
                                            Reference (preview, optional)
                                        </Label>
                                        <Input
                                            id={`preview-ref-${corper._id}`}
                                            value={previewReference}
                                            onChange={(e) => setPreviewReference(e.target.value)}
                                            placeholder={suggestedRef ?? `LCU/REG/CORPS/${scopeKey}/001`}
                                        />
                                        <p className="text-xs text-slate-500">
                                            Optional override. Leave blank to use registry serial on
                                            issue.
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
                                        This letter is <strong>final</strong>. Create a new draft
                                        to change details and issue again.
                                    </p>
                                    <Button
                                        size="sm"
                                        onClick={handleEnsureDraft}
                                        disabled={busy !== null || !activeTemplate}
                                    >
                                        {busy === "create" ? "Creating…" : "New draft & edit"}
                                    </Button>
                                </div>
                            )}

                            <div className="flex flex-wrap gap-2">
                                <Button
                                    variant="outline"
                                    onClick={downloadMerged}
                                    disabled={busy !== null || !activeTemplate?.downloadUrl}
                                >
                                    {busy === "download" ? "Downloading…" : "Download DOCX"}
                                </Button>
                                {isDraft ? (
                                    <Button onClick={handleIssue} disabled={busy !== null}>
                                        {busy === "issue" ? "Issuing…" : "Issue (finalise)"}
                                    </Button>
                                ) : null}
                            </div>

                            {latest && issuances && issuances.length > 1 ? (
                                <p className="text-xs text-slate-500">
                                    {issuances.length} acceptance letter(s) on file (showing latest).
                                </p>
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
