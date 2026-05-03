"use client";

import { usePathname } from "next/navigation";
import Sidebar from "@/components/Sidebar";

export default function SidebarShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const isLogin = path === "/login";

  if (isLogin) return <>{children}</>;

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 relative z-10" style={{ marginLeft: 228 }}>
        {children}
      </div>
    </div>
  );
}
