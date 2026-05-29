"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

function EnvRow({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="border-b border-slate-100 py-3 last:border-0">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 break-all font-mono text-sm text-slate-800">{value || "—"}</div>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

export default function AdminSettingsPage() {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL ?? "";
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXT_PUBLIC_CONVEX_SITE_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    "";

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="mx-auto max-w-3xl space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-[#1F4E79]">Settings</h1>
            <p className="mt-1 text-sm text-slate-600">
              Environment and integration status for this deployment. Values here are read-only.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/panel">Back to panel</Link>
          </Button>
        </div>

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-800">Frontend &amp; Convex</h2>
          <p className="mt-1 text-sm text-slate-600">
            Public URLs are baked into the client at build time. Use them to confirm this app points at
            the correct Convex deployment.
          </p>
          <div className="mt-4">
            <EnvRow
              label="NEXT_PUBLIC_CONVEX_URL"
              value={convexUrl}
              hint="Browser and Convex client target. Must match your Convex project."
            />
            <EnvRow
              label="App / site URL (public)"
              value={appUrl}
              hint="Used for auth redirects and Better Auth site URL. Set NEXT_PUBLIC_APP_URL or NEXT_PUBLIC_CONVEX_SITE_URL in .env."
            />
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-800">Registry behaviour</h2>
          <ul className="mt-3 list-inside list-disc space-y-2 text-sm text-slate-600">
            <li>Call-up numbers are unique; creates and call-up edits are blocked if they would duplicate.</li>
            <li>Corper create/update/delete actions are written to the audit log when performed by admins.</li>
            <li>Bulk CSV seeding upserts by call-up number; duplicate rows in one batch are deduped.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
