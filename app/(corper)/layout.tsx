import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { LogoutButton } from "@/app/(corper)/logout-button";

type SessionPayload = {
  user?: {
    role?: string;
    username?: string;
  };
};

async function getRole() {
  try {
    const h = await headers();
    const host = h.get("host");
    if (!host) return undefined;
    const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
    const response = await fetch(`${protocol}://${host}/api/auth/get-session`, {
      headers: { cookie: h.get("cookie") ?? "" },
      cache: "no-store",
    });
    if (!response.ok) return undefined;
    const payload = (await response.json()) as SessionPayload | null;
    if (!payload?.user) return undefined;
    if (payload.user.role === "admin" || payload.user.role === "corper") return payload.user.role;
    if (payload.user.username?.toUpperCase().startsWith("NYSC/")) return "corper";
    return "admin";
  } catch {
    return undefined;
  }
}

export default async function CorperLayout({ children }: { children: React.ReactNode }) {
  const role = await getRole();
  if (role !== "corper") redirect("/login");
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <p className="text-sm font-semibold text-[#1F4E79]">Corper Panel</p>
          <LogoutButton />
        </div>
      </header>
      {children}
    </div>
  );
}
