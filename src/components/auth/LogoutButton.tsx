"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  async function handleLogout() {
    setLoading(true);
    setFailed(false);

    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        setFailed(true);
        return;
      }

      router.replace("/login");
      router.refresh();
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      className="btn btn-secondary"
      type="button"
      onClick={handleLogout}
      disabled={loading}
      aria-busy={loading}
    >
      {loading ? "Signing out..." : failed ? "Retry sign out" : "Sign out"}
    </button>
  );
}
