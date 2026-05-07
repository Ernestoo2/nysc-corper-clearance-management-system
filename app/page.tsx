import Link from "next/link";

const palette = {
  primary: "#1F4E79",
  primaryDark: "#163A5C",
  accent: "#F4B400",
  surface: "#F8FAFC",
  text: "#0F172A",
};

const quickLinks = [
  { label: "Undergraduate Admissions", href: "https://admissions.lcu.edu.ng/" },
  { label: "University Main Website", href: "https://www.lcu.edu.ng/" },
  { label: "Registrar Contact", href: "mailto:registrar@lcu.edu.ng" },
  { label: "Postgraduate Enquiries", href: "mailto:pgschool@lcu.edu.ng" },
];

export default function HomePage() {
  return (
    <main className="min-h-screen" style={{ backgroundColor: palette.surface, color: palette.text }}>
      <section className="px-6 py-8 md:px-10 lg:px-16" style={{ backgroundColor: palette.primary }}>
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-widest text-blue-100">Lead City University</p>
            <h1 className="text-2xl font-bold text-white md:text-3xl">NYSC Corper Clearance Management System</h1>
          </div>
          <div className="flex gap-3">
            <Link
              href="/login"
              className="rounded-md px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
              style={{ backgroundColor: palette.primaryDark }}
            >
              Login
            </Link>
            <Link
              href="/signup"
              className="rounded-md px-4 py-2 text-sm font-semibold text-slate-900 transition hover:opacity-90"
              style={{ backgroundColor: palette.accent }}
            >
              Admin Signup
            </Link>
          </div>
        </div>
      </section>

      <section className="px-6 py-12 md:px-10 lg:px-16">
        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1.3fr_1fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
            <p className="mb-3 text-sm font-semibold uppercase tracking-wide" style={{ color: palette.primary }}>
              Welcome
            </p>
            <h2 className="mb-4 text-3xl font-bold leading-tight">
              Digital monthly clearance workflow for corpers and HR teams
            </h2>
            <p className="text-slate-600">
              This portal helps corps members manage monthly clearance steps and enables HR/Admin staff to monitor,
              approve, and generate required documents in a central system.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/login"
                className="rounded-md px-4 py-2 text-sm font-semibold text-white"
                style={{ backgroundColor: palette.primary }}
              >
                Continue to Login
              </Link>
              <a
                href="https://faculty-of-engineering-and-technolo.vercel.app/"
                target="_blank"
                rel="noreferrer"
                className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
              >
                View LCU Faculty Page
              </a>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
            <h3 className="mb-4 text-lg font-semibold" style={{ color: palette.primary }}>
              LCU Quick Links
            </h3>
            <ul className="space-y-3">
              {quickLinks.map((item) => (
                <li key={item.href}>
                  <a
                    href={item.href}
                    target="_blank"
                    rel="noreferrer"
                    className="block rounded-md border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="px-6 pb-12 md:px-10 lg:px-16">
        <div className="mx-auto max-w-6xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <h3 className="mb-5 text-xl font-semibold" style={{ color: palette.primary }}>
            Color Template (From LCU Web Style)
          </h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {Object.entries(palette).map(([name, value]) => (
              <div key={name} className="overflow-hidden rounded-lg border border-slate-200">
                <div className="h-16" style={{ backgroundColor: value }} />
                <div className="bg-white px-3 py-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{name}</p>
                  <p className="text-sm font-mono text-slate-800">{value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
