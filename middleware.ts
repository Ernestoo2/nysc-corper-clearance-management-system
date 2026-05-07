import { NextRequest, NextResponse } from "next/server";

type SessionUser = {
  role?: string;
  username?: string;
  email?: string;
};

type SessionResponse = {
  user?: SessionUser;
};

function getRoleFromSession(session: SessionResponse | null): "corper" | "admin" | undefined {
  const user = session?.user;
  if (!user) return undefined;
  if (user.role === "corper" || user.role === "admin") return user.role;

  const username = user.username?.toUpperCase() ?? "";
  if (username.startsWith("NYSC/")) return "corper";
  return "admin";
}

async function getSession(request: NextRequest): Promise<SessionResponse | null> {
  try {
    const response = await fetch(new URL("/api/auth/get-session", request.url), {
      method: "GET",
      headers: {
        cookie: request.headers.get("cookie") ?? "",
      },
    });

    if (!response.ok) return null;
    const payload = (await response.json()) as SessionResponse | null;
    return payload;
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const session = await getSession(request);
  const role = getRoleFromSession(session);
  const path = request.nextUrl.pathname;

  // Allow unauthenticated users to access admin signup.
  if (path.startsWith("/signup") && !session?.user) {
    return NextResponse.next();
  }

  if (!session?.user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (role === "admin" && (path.startsWith("/dashboard") || path.startsWith("/clearance"))) {
    return NextResponse.redirect(new URL("/panel", request.url));
  }

  if (role === "corper" && (path.startsWith("/panel") || path.startsWith("/signup"))) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/panel/:path*", "/clearance/:path*", "/signup"],
};
