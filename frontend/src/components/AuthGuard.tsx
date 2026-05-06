"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const path = usePathname();

  useEffect(() => {
    const publicPaths = ["/login", "/"];
    if (!loading && !user && !publicPaths.includes(path)) {
      router.replace("/login");
    }
  }, [user, loading, path, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#f5f5f5" }}>
        <div className="text-gray-600 text-[13px]">Loading…</div>
      </div>
    );
  }

  const publicPaths = ["/login", "/"];
  if (!user && !publicPaths.includes(path)) return null;

  return <>{children}</>;
}
