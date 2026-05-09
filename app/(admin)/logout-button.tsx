"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "@/lib/auth-client";

export function LogoutButton() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleLogout = async () => {
    if (isLoading) return;
    setIsLoading(true);
    try {
      await signOut();
      router.replace("/login");
      router.refresh();
    } catch (error) {
      console.error("Logout failed", error);
      // Fallback hard navigation so users can still leave protected screens.
      window.location.href = "/login";
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={isLoading}
      className="rounded-md bg-[#1F4E79] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#163A5C] disabled:cursor-not-allowed disabled:opacity-70"
    >
      {isLoading ? "Logging out..." : "Logout"}
    </button>
  );
}

