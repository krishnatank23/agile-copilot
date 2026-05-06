import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import AuthGuard from "@/components/AuthGuard";
import SidebarShell from "@/components/SidebarShell";

export const metadata: Metadata = {
  title: "Agile Copilot",
  description: "AI-powered agile task tracker",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ background: "#ffffff", color: "#111827" }}>
        <AuthProvider>
          <AuthGuard>
            <SidebarShell>{children}</SidebarShell>
          </AuthGuard>
        </AuthProvider>
      </body>
    </html>
  );
}
