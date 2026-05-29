  "use client";

  import { useMemo, useState } from "react";
  import Link from "next/link";
  import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
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
  import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
  } from "@/components/ui/table";
  import { CorperAcceptanceLetterDialog } from "@/components/letters/CorperAcceptanceLetterDialog";
  import { CorperPostingLetterDialog } from "@/components/letters/CorperPostingLetterDialog";

  type CorperForm = {
    callUpNumber: string;
    fullName: string;
    stateCode: string;
    batch: string;
    deploymentUnit: string;
    headOfUnit: string;
    status: string;
  };

  type CorperDoc = Doc<"corpers">;
  type AuditDoc = Doc<"corperAuditLogs">;

  function formatDate(ms: number) {
    try {
      return new Date(ms).toLocaleString();
    } catch {
      return String(ms);
    }
  }

  export default function AdminCorpersPage() {
    const [batch, setBatch] = useState("");
    const [status, setStatus] = useState("");
    const [deploymentUnit, setDeploymentUnit] = useState("");
    const [searchText, setSearchText] = useState("");

    const filters = useMemo(
      () => ({
        batch: batch || undefined,
        status: status || undefined,
        deploymentUnit: deploymentUnit || undefined,
        searchText: searchText || undefined,
      }),
      [batch, status, deploymentUnit, searchText]
    );

    const { results, status: queryStatus, loadMore } = usePaginatedQuery(
      api.corpers.list,
      filters,
      { initialNumItems: 25 }
    );

    const createCorper = useMutation(api.corpers.create);
    const updateCorper = useMutation(api.corpers.update);
    const removeCorper = useMutation(api.corpers.remove);

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [error, setError] = useState<string>("");
  const [createNotice, setCreateNotice] = useState<string>("");
  const [mutationInFlight, setMutationInFlight] = useState<
    "create" | "update" | "delete" | null
  >(null);

    const [form, setForm] = useState<CorperForm>({
      callUpNumber: "",
      fullName: "",
      stateCode: "",
      batch: "",
      deploymentUnit: "",
      headOfUnit: "",
      status: "ACTIVE",
    });

    const [selectedId, setSelectedId] = useState<Id<"corpers"> | null>(null);

  const audit = useQuery(api.corperAudit.listRecent, { limit: 25 });
  const byServiceYear = useQuery(api.corpers.listByServiceYear, { limit: 5000 });
  const latestSharedForm = useQuery(api.corpers.getLatestSharedMonthlyForm, {});

  const createCallUpKey = form.callUpNumber.trim().toUpperCase();
  const existingForCreateCallUp = useQuery(
    api.corpers.findByCallUp,
    createOpen && createCallUpKey.length > 0
      ? { callUpNumber: createCallUpKey }
      : "skip"
  );

  async function handleCreate() {
    if (mutationInFlight) return;
    setMutationInFlight("create");
    setError("");
    setCreateNotice("");
    try {
      const result = await createCorper({
        callUpNumber: form.callUpNumber,
        fullName: form.fullName,
        stateCode: form.stateCode,
        batch: form.batch,
        deploymentUnit: form.deploymentUnit,
        status: form.status,
        headOfUnit: form.headOfUnit || undefined,
      });
      const parts: string[] = ["Corper created."];
      if (result.acceptanceIssuanceId) {
        parts.push("Draft acceptance ready (Acceptance).");
      }
      if (result.postingIssuanceId) {
        parts.push("Draft posting ready (Posting).");
      }
      if (!result.acceptanceIssuanceId && !result.postingIssuanceId) {
        parts.push("Upload letter templates under Letter templates to auto-generate drafts.");
      }
      setCreateNotice(parts.join(" "));
      setCreateOpen(false);
      setForm({
        callUpNumber: "",
        fullName: "",
        stateCode: "",
        batch: "",
        deploymentUnit: "",
        headOfUnit: "",
        status: "ACTIVE",
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unable to create corper");
    } finally {
      setMutationInFlight(null);
    }
  }

  async function handleUpdate() {
    if (!selectedId || mutationInFlight) return;
    setMutationInFlight("update");
    setError("");
    try {
      const result = await updateCorper({
        id: selectedId,
        callUpNumber: form.callUpNumber,
        fullName: form.fullName,
        stateCode: form.stateCode,
        batch: form.batch,
        deploymentUnit: form.deploymentUnit,
        status: form.status,
        headOfUnit: form.headOfUnit || undefined,
      });
      if (result.postingIssuanceId) {
        setCreateNotice(
          "Deployment updated. New draft posting letter created — open Posting on the row."
        );
      }
      setEditOpen(false);
      setSelectedId(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unable to update corper");
    } finally {
      setMutationInFlight(null);
    }
  }

  async function handleDelete() {
    if (!selectedId || mutationInFlight) return;
    setMutationInFlight("delete");
    setError("");
    try {
      await removeCorper({ id: selectedId });
      setDeleteOpen(false);
      setSelectedId(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unable to delete corper");
    } finally {
      setMutationInFlight(null);
    }
  }

    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-6xl space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-[#1F4E79]">Corper Registry</h1>
              <p className="text-sm text-slate-600">Manage corpers and track edits (audit log).</p>
            </div>
            <div className="flex items-center gap-2">
              <Button asChild variant="outline">
                <Link href="/panel">Back to Panel</Link>
              </Button>
              {createNotice ? (
                <p className="text-sm text-emerald-800 max-w-md">{createNotice}</p>
              ) : null}

              <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogTrigger asChild>
                  <Button>Create Corper</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create Corper</DialogTitle>
                    <DialogDescription>Creates a new corper record in the registry.</DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-3">
                    <div className="grid gap-1">
                      <Label htmlFor="create-callup">Call-up number</Label>
                      <Input
                        id="create-callup"
                        value={form.callUpNumber}
                        onChange={(e) => setForm((f) => ({ ...f, callUpNumber: e.target.value }))}
                        placeholder="NYSC/FUW/2025/291616"
                      />
                    </div>
                    <div className="grid gap-1">
                      <Label htmlFor="create-fullname">Full name</Label>
                      <Input
                        id="create-fullname"
                        value={form.fullName}
                        onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                        placeholder="Adebayo Samuel"
                      />
                    </div>
                    <div className="grid gap-1">
                      <Label htmlFor="create-statecode">State code</Label>
                      <Input
                        id="create-statecode"
                        value={form.stateCode}
                        onChange={(e) => setForm((f) => ({ ...f, stateCode: e.target.value }))}
                        placeholder="OY/25C/5371"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="grid gap-1">
                        <Label htmlFor="create-batch">Batch</Label>
                        <Input
                          id="create-batch"
                          value={form.batch}
                          onChange={(e) => setForm((f) => ({ ...f, batch: e.target.value }))}
                          placeholder="2026A"
                        />
                      </div>
                      <div className="grid gap-1">
                        <Label htmlFor="create-status">Status</Label>
                        <Input
                          id="create-status"
                          value={form.status}
                          onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                          placeholder="ACTIVE"
                        />
                      </div>
                    </div>
                    <div className="grid gap-1">
                      <Label htmlFor="create-deploy">Deployment unit</Label>
                      <Input
                        id="create-deploy"
                        value={form.deploymentUnit}
                        onChange={(e) => setForm((f) => ({ ...f, deploymentUnit: e.target.value }))}
                        placeholder="ICT Unit"
                      />
                    </div>
                    <div className="grid gap-1">
                      <Label htmlFor="create-hod">Head of unit (optional)</Label>
                      <Input
                        id="create-hod"
                        value={form.headOfUnit}
                        onChange={(e) => setForm((f) => ({ ...f, headOfUnit: e.target.value }))}
                        placeholder="Dr. John Doe"
                      />
                    </div>
                    {existingForCreateCallUp ? (
                      <p className="text-sm text-amber-700">
                        This call-up number is already in the registry. Edit that record instead of creating
                        a duplicate.
                      </p>
                    ) : null}
                    {error ? <p className="text-sm text-red-600">{error}</p> : null}
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setCreateOpen(false)}>
                      Cancel
                    </Button>
                    <Button
                      onClick={handleCreate}
                      disabled={
                        mutationInFlight !== null ||
                        !!existingForCreateCallUp ||
                        !createCallUpKey ||
                        !form.fullName.trim()
                      }
                    >
                      {mutationInFlight === "create" ? "Creating…" : "Create"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-base font-semibold text-slate-800">Shared Monthly Form (All Corpers)</h2>
            <p className="mt-1 text-sm text-slate-600">
              Latest form uploaded by HR for corps members.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {latestSharedForm?.downloadUrl ? (
                <Button asChild variant="outline">
                  <a href={latestSharedForm.downloadUrl} target="_blank" rel="noreferrer">
                    Download Latest ({latestSharedForm.monthLabel})
                  </a>
                </Button>
              ) : (
                <p className="text-sm text-slate-600">No monthly form uploaded yet by HR.</p>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
              <div className="grid gap-1">
                <Label htmlFor="filter-search">Search (call-up prefix)</Label>
                <Input
                  id="filter-search"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  placeholder="NYSC/FUW/2025"
                />
              </div>
              <div className="grid gap-1">
                <Label htmlFor="filter-batch">Batch</Label>
                <Input
                  id="filter-batch"
                  value={batch}
                  onChange={(e) => setBatch(e.target.value)}
                  placeholder="2026A"
                />
              </div>
              <div className="grid gap-1">
                <Label htmlFor="filter-status">Status</Label>
                <Input
                  id="filter-status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  placeholder="ACTIVE"
                />
              </div>
              <div className="grid gap-1">
                <Label htmlFor="filter-deploy">Deployment unit</Label>
                <Input
                  id="filter-deploy"
                  value={deploymentUnit}
                  onChange={(e) => setDeploymentUnit(e.target.value)}
                  placeholder="ICT"
                />
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm text-slate-600">
                {queryStatus === "LoadingFirstPage" ? "Loading..." : `${results.length} shown`}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setBatch("");
                    setStatus("");
                    setDeploymentUnit("");
                    setSearchText("");
                  }}
                >
                  Clear filters
                </Button>
                <Button
                  variant="outline"
                  onClick={() => loadMore(25)}
                  disabled={queryStatus !== "CanLoadMore"}
                >
                  {queryStatus === "CanLoadMore" ? "Load more" : "No more"}
                </Button>
              </div>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 px-4 py-3">
                <h2 className="text-sm font-semibold text-slate-700">Registry</h2>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Call-up</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Batch</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Deployment</TableHead>
                    <TableHead>Head of Unit</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(results as CorperDoc[]).map((row) => (
                    <TableRow key={row._id}>
                      <TableCell className="font-mono text-xs">{row.callUpNumber}</TableCell>
                      <TableCell>{row.fullName}</TableCell>
                      <TableCell>{row.batch}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{row.status}</Badge>
                      </TableCell>
                      <TableCell>{row.deploymentUnit}</TableCell>
                      <TableCell>{row.headOfUnit ?? "-"}</TableCell>
                      <TableCell className="text-xs text-slate-600">{formatDate(row.createdAt)}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-2">
                          <CorperAcceptanceLetterDialog corper={row} />
                          <CorperPostingLetterDialog corper={row} />
                          <Dialog
                            open={editOpen && selectedId === row._id}
                            onOpenChange={(open) => {
                              setEditOpen(open);
                              if (!open) setSelectedId(null);
                            }}
                          >
                            <DialogTrigger asChild>
                              <Button
                                size="xs"
                                variant="outline"
                                onClick={() => {
                                  setSelectedId(row._id);
                                  setError("");
                                  setForm({
                                    callUpNumber: row.callUpNumber ?? "",
                                    fullName: row.fullName ?? "",
                                    stateCode: row.stateCode ?? "",
                                    batch: row.batch ?? "",
                                    deploymentUnit: row.deploymentUnit ?? "",
                                    headOfUnit: row.headOfUnit ?? "",
                                    status: row.status ?? "ACTIVE",
                                  });
                                  setEditOpen(true);
                                }}
                              >
                                Edit
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Edit corper</DialogTitle>
                                <DialogDescription>Updates this corper record (writes to audit log).</DialogDescription>
                              </DialogHeader>
                              <div className="grid gap-3">
                                <div className="grid gap-1">
                                  <Label>Call-up number</Label>
                                  <Input
                                    value={form.callUpNumber}
                                    onChange={(e) =>
                                      setForm((f) => ({ ...f, callUpNumber: e.target.value }))
                                    }
                                  />
                                </div>
                                <div className="grid gap-1">
                                  <Label>Full name</Label>
                                  <Input
                                    value={form.fullName}
                                    onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                                  />
                                </div>
                                <div className="grid gap-1">
                                  <Label>State code</Label>
                                  <Input
                                    value={form.stateCode}
                                    onChange={(e) => setForm((f) => ({ ...f, stateCode: e.target.value }))}
                                  />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                  <div className="grid gap-1">
                                    <Label>Batch</Label>
                                    <Input
                                      value={form.batch}
                                      onChange={(e) => setForm((f) => ({ ...f, batch: e.target.value }))}
                                    />
                                  </div>
                                  <div className="grid gap-1">
                                    <Label>Status</Label>
                                    <Input
                                      value={form.status}
                                      onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                                    />
                                  </div>
                                </div>
                                <div className="grid gap-1">
                                  <Label>Deployment unit</Label>
                                  <Input
                                    value={form.deploymentUnit}
                                    onChange={(e) =>
                                      setForm((f) => ({ ...f, deploymentUnit: e.target.value }))
                                    }
                                  />
                                </div>
                                <div className="grid gap-1">
                                  <Label>Head of unit (optional)</Label>
                                  <Input
                                    value={form.headOfUnit}
                                    onChange={(e) =>
                                      setForm((f) => ({ ...f, headOfUnit: e.target.value }))
                                    }
                                  />
                                </div>
                                {error ? <p className="text-sm text-red-600">{error}</p> : null}
                              </div>
                              <DialogFooter>
                                <Button variant="outline" onClick={() => setEditOpen(false)}>
                                  Cancel
                                </Button>
                                <Button
                                  onClick={handleUpdate}
                                  disabled={mutationInFlight !== null}
                                >
                                  {mutationInFlight === "update" ? "Saving…" : "Save"}
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>

                          <Dialog
                            open={deleteOpen && selectedId === row._id}
                            onOpenChange={(open) => {
                              setDeleteOpen(open);
                              if (!open) setSelectedId(null);
                            }}
                          >
                            <DialogTrigger asChild>
                              <Button
                                size="xs"
                                variant="destructive"
                                onClick={() => {
                                  setSelectedId(row._id);
                                  setError("");
                                  setDeleteOpen(true);
                                }}
                              >
                                Delete
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Delete corper</DialogTitle>
                                <DialogDescription>
                                  This will remove the corper from the registry and log the action.
                                </DialogDescription>
                              </DialogHeader>
                              {error ? <p className="text-sm text-red-600">{error}</p> : null}
                              <DialogFooter>
                                <Button variant="outline" onClick={() => setDeleteOpen(false)}>
                                  Cancel
                                </Button>
                                <Button
                                  variant="destructive"
                                  onClick={handleDelete}
                                  disabled={mutationInFlight !== null}
                                >
                                  {mutationInFlight === "delete" ? "Deleting…" : "Delete"}
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}

                  {results.length === 0 && queryStatus !== "LoadingFirstPage" ? (
                    <TableRow>
                      <TableCell colSpan={8} className="p-6 text-center text-sm text-slate-600">
                        No corpers found.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white lg:overflow-y-auto h-300 shadow-sm">
              <div className="border-b border-slate-200 px-4 py-3">
                <h2 className="text-sm font-semibold text-slate-700">Recent changes</h2>
              </div>
              <div className="divide-y divide-slate-100">
                {((audit ?? []) as AuditDoc[]).map((event) => (
                  <div key={event._id} className="px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant="outline">{event.action}</Badge>
                      <div className="text-xs text-slate-500">{formatDate(event.timestamp)}</div>
                    </div>
                    <div className="mt-1 text-sm text-slate-700">{event.summary}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {event.actorUsername ?? event.actorEmail ?? event.actorTokenIdentifier}
                    </div>
                  </div>
                ))}
                {audit?.length === 0 ? (
                  <div className="px-4 py-6 text-center text-sm text-slate-600">
                    No changes recorded yet.
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-700">Corpers by Service Year</h2>
              <p className="mt-1 text-xs text-slate-500">
                Registry grouped by year in call-up number (23, 24, 25, etc.).
              </p>
            </div>
            <div className="space-y-4 p-4">
              {byServiceYear?.years?.map((year) => {
                const rows = byServiceYear.grouped[year] ?? [];
                return (
                  <div key={year} className="rounded-lg border border-slate-200">
                    <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-3 py-2">
                      <h3 className="text-sm font-semibold text-slate-700">
                        {year === "Unknown" ? "Unknown Year" : `20${year}`} ({rows.length})
                      </h3>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {rows.map((row) => (
                        <div key={row._id} className="grid grid-cols-1 gap-1 px-3 py-2 text-sm md:grid-cols-5 md:gap-3">
                          <span className="font-mono text-xs text-slate-700">{row.callUpNumber}</span>
                          <span className="text-slate-700">{row.fullName}</span>
                          <span className="text-slate-600">{row.batch}</span>
                          <span className="text-slate-600">{row.status}</span>
                          <span className="text-slate-600">{row.deploymentUnit}</span>
                        </div>
                      ))}
                      {rows.length === 0 ? (
                        <div className="px-3 py-3 text-sm text-slate-500">No corpers in this bucket.</div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
              {!byServiceYear ? (
                <p className="text-sm text-slate-500">Loading grouped registry...</p>
              ) : null}
              {byServiceYear && byServiceYear.years.length === 0 ? (
                <p className="text-sm text-slate-500">No registry rows available yet.</p>
              ) : null}
            </div>
          </div>

        </div>
      </div>
    );
  }

