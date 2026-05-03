"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function LoginPage() {
  const { login, user, loading } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace("/");
  }, [user, loading, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await login(username, password);
      router.replace("/");
    } catch {
      setError("Incorrect username or password.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: "#09090f" }}
    >
      {/* Glow */}
      <div
        className="fixed top-0 left-0 w-[560px] h-[560px] pointer-events-none"
        style={{ background: "radial-gradient(ellipse at 0% 0%, rgba(147,51,234,0.13) 0%, transparent 65%)" }}
      />

      <div
        className="relative w-full max-w-sm rounded-[16px] p-8 flex flex-col gap-6"
        style={{ background: "#11111b", border: "1px solid rgba(255,255,255,0.07)" }}
      >
        {/* Brand */}
        <div className="flex flex-col items-center gap-3">
          <div
            className="flex items-center justify-center rounded-[12px] text-[22px]"
            style={{
              width: 48,
              height: 48,
              background: "linear-gradient(135deg,#d946ef,#9333ea)",
              boxShadow: "0 0 24px rgba(217,70,239,0.4)",
            }}
          >
            ⚡
          </div>
          <div className="text-center">
            <p className="text-[18px] font-bold text-slate-100 tracking-tight">Agile Copilot</p>
            <p className="text-[12px] text-slate-600 mt-[2px]">Sign in to your account</p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-[6px]">
            <label className="text-[12px] font-medium text-slate-400">Username</label>
            <input
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              placeholder="manager"
              className="px-3 py-[10px] rounded-[8px] text-[13px] text-slate-100 placeholder:text-slate-600 outline-none transition-colors"
              style={{ background: "#09090f", border: "1px solid rgba(255,255,255,0.07)" }}
              onFocus={(e) => ((e.target as HTMLElement).style.borderColor = "rgba(217,70,239,0.4)")}
              onBlur={(e) => ((e.target as HTMLElement).style.borderColor = "rgba(255,255,255,0.07)")}
            />
          </div>

          <div className="flex flex-col gap-[6px]">
            <label className="text-[12px] font-medium text-slate-400">Password</label>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              className="px-3 py-[10px] rounded-[8px] text-[13px] text-slate-100 placeholder:text-slate-600 outline-none transition-colors"
              style={{ background: "#09090f", border: "1px solid rgba(255,255,255,0.07)" }}
              onFocus={(e) => ((e.target as HTMLElement).style.borderColor = "rgba(217,70,239,0.4)")}
              onBlur={(e) => ((e.target as HTMLElement).style.borderColor = "rgba(255,255,255,0.07)")}
            />
          </div>

          {error && (
            <p className="text-[12px] text-center" style={{ color: "#f87171" }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full py-[10px] rounded-[8px] text-[13px] font-semibold transition-opacity disabled:opacity-60 mt-1"
            style={{
              background: "linear-gradient(135deg,#d946ef,#9333ea)",
              color: "#fff",
              boxShadow: "0 0 18px rgba(217,70,239,0.3)",
            }}
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
