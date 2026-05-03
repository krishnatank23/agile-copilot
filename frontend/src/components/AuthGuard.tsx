"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const path = usePathname();

  useEffect(() => {
    if (!loading && !user && path !== "/login") {
      router.replace("/login");
    }
  }, [user, loading, path, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#09090f" }}>
        <div className="text-slate-600 text-[13px]">Loading…</div>
      </div>
    );
  }

  if (!user && path !== "/login") return null;

  return <>{children}</>;
}
