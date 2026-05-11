"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function LoginPage() {
  const { login, user, loading } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ username?: string; password?: string }>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace(user.role === "super_admin" ? "/settings" : "/dashboard");
  }, [user, loading, router]);

  function validate() {
    const errors: { username?: string; password?: string } = {};
    if (!username.trim()) {
      errors.username = "Username is required.";
    }
    if (!password) {
      errors.password = "Password is required.";
    } else if (password.length < 4) {
      errors.password = "Password must be at least 4 characters.";
    }
    return errors;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errors = validate();
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});
    setBusy(true);
    setError("");
    try {
      await login(username, password);
      // redirect is handled by the useEffect above once user state is set
    } catch {
      setError("Incorrect username or password.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: "#f3f4f6" }}
    >
      {/* Glow */}
      <div
        className="fixed top-0 left-0 w-[560px] h-[560px] pointer-events-none"
        style={{ background: "radial-gradient(ellipse at 0% 0%, rgba(139,92,246,0.08) 0%, transparent 65%)" }}
      />

      <div
        className="relative w-full max-w-sm rounded-[16px] p-8 flex flex-col gap-6"
        style={{ background: "#ffffff", border: "1px solid rgba(0,0,0,0.1)" }}
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
            <p className="text-[18px] font-bold text-gray-900 tracking-tight">Agile Copilot</p>
            <p className="text-[12px] text-gray-600 mt-[2px]">Sign in to your account</p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-[6px]">
            <label className="text-[12px] font-medium text-gray-700">Username</label>
            <input
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => { setUsername(e.target.value); setFieldErrors((prev) => ({ ...prev, username: undefined })); }}
              placeholder="manager"
              className="px-3 py-[10px] rounded-[8px] text-[13px] text-gray-900 placeholder:text-gray-500 outline-none transition-colors"
              style={{ background: "#f9fafb", border: `1px solid ${fieldErrors.username ? "#dc2626" : "rgba(0,0,0,0.1)"}` }}
              onFocus={(e) => { if (!fieldErrors.username) (e.target as HTMLElement).style.borderColor = "rgba(139,92,246,0.4)"; }}
              onBlur={(e) => { if (!fieldErrors.username) (e.target as HTMLElement).style.borderColor = "rgba(0,0,0,0.1)"; }}
            />
            {fieldErrors.username && (
              <p className="text-[11px]" style={{ color: "#dc2626" }}>{fieldErrors.username}</p>
            )}
          </div>

          <div className="flex flex-col gap-[6px]">
            <label className="text-[12px] font-medium text-gray-700">Password</label>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setFieldErrors((prev) => ({ ...prev, password: undefined })); }}
              placeholder="••••••••"
              className="px-3 py-[10px] rounded-[8px] text-[13px] text-gray-900 placeholder:text-gray-500 outline-none transition-colors"
              style={{ background: "#f9fafb", border: `1px solid ${fieldErrors.password ? "#dc2626" : "rgba(0,0,0,0.1)"}` }}
              onFocus={(e) => { if (!fieldErrors.password) (e.target as HTMLElement).style.borderColor = "rgba(139,92,246,0.4)"; }}
              onBlur={(e) => { if (!fieldErrors.password) (e.target as HTMLElement).style.borderColor = "rgba(0,0,0,0.1)"; }}
            />
            {fieldErrors.password && (
              <p className="text-[11px]" style={{ color: "#dc2626" }}>{fieldErrors.password}</p>
            )}
          </div>

          {error && (
            <p className="text-[12px] text-center" style={{ color: "#dc2626" }}>{error}</p>
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
