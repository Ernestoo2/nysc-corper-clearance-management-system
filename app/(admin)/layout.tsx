import { headers } from "next/headers";
import { redirect } from "next/navigation";

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

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const role = await getRole();
  if (role !== "admin") redirect("/login");
  return <>{children}</>;
}
