"use client";

import { useEffect, useState, useTransition } from "react";
import { api, type SprintProgress } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

const MEMBER_COLORS: Record<string, string> = {
  Dhwani: "#d946ef", Shaily: "#8b5cf6", Shriya: "#3b82f6",
  Ravi: "#10b981", Yash: "#f59e0b", Yogini: "#ec4899",
  Kriishna: "#06b6d4", Harshil: "#f97316", Rinal: "#14b8a6", Prince: "#6366f1",
};

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

function memberColor(name: string) {
  return MEMBER_COLORS[name] ?? "#64748b";
}

interface MetricCardProps {
  label: string;
  value: string | number;
  sub: string;
  trend?: "up" | "down" | "neutral";
  color: "green" | "purple" | "amber" | "blue";
  icon: React.ReactNode;
}

function MetricCard({ label, value, sub, trend = "neutral", color, icon }: MetricCardProps) {
  const palette = {
    green:  { ico: "rgba(16,185,129,.12)",  txt: "#10b981", glow: "#10b981" },
    purple: { ico: "rgba(217,70,239,.12)",  txt: "#d946ef", glow: "#d946ef" },
    amber:  { ico: "rgba(245,158,11,.12)",  txt: "#f59e0b", glow: "#f59e0b" },
    blue:   { ico: "rgba(59,130,246,.12)",  txt: "#3b82f6", glow: "#3b82f6" },
  }[color];

  const trendColor = trend === "up" ? "#10b981" : trend === "down" ? "#ef4444" : "#6b7280";

  return (
    <div
      className="relative overflow-hidden rounded-[12px] cursor-default transition-transform hover:-translate-y-px"
      style={{ background: "#ffffff", border: "1px solid rgba(0,0,0,0.07)", padding: "18px 20px" }}
    >
      <div className="absolute -bottom-5 -right-5 w-20 h-20 rounded-full opacity-[0.09]" style={{ background: palette.glow }} />
      <div className="flex items-start justify-between mb-[11px]">
        <span className="text-[11px] font-medium uppercase tracking-[0.5px] text-gray-600">{label}</span>
        <div className="flex items-center justify-center w-[30px] h-[30px] rounded-[8px]" style={{ background: palette.ico, color: palette.txt }}>
          {icon}
        </div>
      </div>
      <div className="text-[30px] font-extrabold text-gray-900 leading-none tracking-[-1px] mb-[6px]">{value}</div>
      <div className="text-[11.5px]" style={{ color: trendColor }}>{sub}</div>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [progress, setProgress] = useState<SprintProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [countdown, setCountdown] = useState(30);
  const [, startTransition] = useTransition();

  const isSuperAdmin = user?.role === "super_admin";

  function loadData(silent = false) {
    if (!silent) setLoading(true);
    api.dashboard
      .sprintProgress()
      .then((data) => {
        startTransition(() => {
          setProgress(data);
          setLastRefreshed(new Date());
          setError("");
        });
      })
      .catch(() => setError("Could not load sprint data — is the backend running?"))
      .finally(() => { if (!silent) setLoading(false); });
  }

  // Initial load
  useEffect(() => { loadData(); }, []);

  // Auto-poll every 30 seconds
  useEffect(() => {
    setCountdown(30);
    const pollInterval = setInterval(() => loadData(true), 30_000);
    const tickInterval = setInterval(() => {
      setCountdown((c) => (c <= 1 ? 30 : c - 1));
    }, 1000);
    return () => { clearInterval(pollInterval); clearInterval(tickInterval); };
  }, []);

  const totals = progress.reduce(
    (acc, p) => ({
      tasks: acc.tasks + p.total_tasks,
      wip: acc.wip + p.wip,
      closed: acc.closed + p.closed,
      approval: acc.approval + p.sent_for_approval,
      expected: acc.expected + p.expected_sp,
      actual: acc.actual + p.actual_sp,
    }),
    { tasks: 0, wip: 0, closed: 0, approval: 0, expected: 0, actual: 0 }
  );
  const teamPct = totals.expected > 0 ? Math.round((totals.actual / totals.expected) * 100) : 0;
  const activeMembers = progress.filter((p) => p.total_tasks > 0).length;

  // Group by workspace for super_admin view
  const workspaces = isSuperAdmin
    ? Array.from(new Map(progress.map((p) => [p.workspace_id, p.workspace_name])))
    : [];

  const tableHeaders = isSuperAdmin
    ? ["Member", "Team", "WIP", "In Review", "Closed", "Total", "Exp SP", "Act SP", "Blocked by", "Progress"]
    : ["Member", "WIP", "In Review", "Closed", "Total", "Exp SP", "Act SP", "Blocked by", "Progress"];

  return (
    <>
      {/* Topbar */}
      <div
        className="sticky top-0 z-10 flex items-center justify-between px-[26px] py-[13px]"
        style={{ background: "rgba(255,255,255,0.95)", backdropFilter: "blur(14px)", borderBottom: "1px solid rgba(0,0,0,0.07)" }}
      >
        <div>
          <h1 className="text-[19px] font-bold text-gray-900 tracking-[-0.5px]">
            {isSuperAdmin ? "Org Overview" : "Dashboard"}
          </h1>
          <p className="text-[11.5px] text-gray-600 mt-[2px]">
            {isSuperAdmin
              ? `${workspaces.length} team${workspaces.length !== 1 ? "s" : ""} · ${activeMembers} active members`
              : `${activeMembers} member${activeMembers !== 1 ? "s" : ""} active this sprint`}
          </p>
        </div>
        <div className="flex items-center gap-[9px]">
          <div
            className="flex items-center gap-[5px] px-[11px] py-[5px] rounded-[7px] text-[12px] font-medium cursor-default"
            style={{ border: "1px solid rgba(139,92,246,0.2)", background: "rgba(139,92,246,0.08)", color: "#7c3aed" }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-[13px] h-[13px]">
              <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            Sprint
          </div>
          {lastRefreshed && (
            <span className="text-[11px] text-gray-600">synced {lastRefreshed.toLocaleTimeString()}</span>
          )}
          <button
            id="dashboard-refresh-btn"
            onClick={() => { loadData(false); setCountdown(30); }}
            className="flex items-center gap-[5px] px-[11px] py-[5px] rounded-[7px] text-[12px] font-medium transition-all cursor-pointer"
            style={{ border: "1px solid rgba(99,102,241,0.25)", background: "rgba(99,102,241,0.08)", color: "#4f46e5" }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-[13px] h-[13px]">
              <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
            </svg>
            Refresh <span className="opacity-50 text-[10px]">({countdown}s)</span>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-[26px] flex flex-col gap-[22px]">

        {error && (
          <div className="rounded-[10px] px-4 py-3 text-sm" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#dc2626" }}>
            {error}
          </div>
        )}

        {/* Metric cards */}
        {!loading && !error && (
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-[13px]">
            <MetricCard
              label="Completed Tasks"
              value={totals.closed}
              sub={`${totals.tasks} total tasks this sprint`}
              trend="up"
              color="green"
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-[14px] h-[14px]">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              }
            />
            <MetricCard
              label="Completion Rate"
              value={`${teamPct}%`}
              sub={`${totals.actual} / ${totals.expected} story points`}
              trend={teamPct >= 60 ? "up" : "down"}
              color="purple"
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-[14px] h-[14px]">
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
                </svg>
              }
            />
            <MetricCard
              label="Pending Approvals"
              value={totals.approval}
              sub={totals.approval > 0 ? "Need review" : "All clear"}
              trend={totals.approval > 0 ? "down" : "neutral"}
              color="amber"
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-[14px] h-[14px]">
                  <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                </svg>
              }
            />
            <MetricCard
              label={isSuperAdmin ? "Teams / Members" : "Team Overview"}
              value={isSuperAdmin ? `${workspaces.length} / ${progress.length}` : `${activeMembers} / ${progress.length}`}
              sub={isSuperAdmin ? `${activeMembers} active members` : `${totals.wip} tasks in progress`}
              trend="neutral"
              color="blue"
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-[14px] h-[14px]">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
              }
            />
          </div>
        )}

        {/* Sprint progress table */}
        <div className="rounded-[12px] overflow-hidden" style={{ background: "#ffffff", border: "1px solid rgba(0,0,0,0.07)" }}>
          <div className="flex items-center justify-between px-[18px] py-[15px]" style={{ borderBottom: "1px solid rgba(0,0,0,0.07)" }}>
            <div>
              <h2 className="text-[14px] font-semibold text-gray-900">Sprint Progress</h2>
              <p className="text-[11.5px] text-gray-600 mt-[2px]">
                {isSuperAdmin ? "All teams · per-member breakdown" : "Per-member breakdown"}
              </p>
            </div>
          </div>

          <div className="overflow-auto" style={{ maxHeight: "calc(100vh - 380px)" }}>
            {loading ? (
              <div className="px-[18px] py-10 text-center text-[13px] text-gray-500">Loading...</div>
            ) : progress.length === 0 && !error ? (
              <div className="px-[18px] py-12 text-center text-[13px] text-gray-500">
                No sprint data yet. Members will appear once they post EOD updates.
              </div>
            ) : (
              <table className="w-full border-collapse text-[12.5px]">
                <thead className="sticky top-0 z-10">
                  <tr>
                    {tableHeaders.map((h) => (
                      <th
                        key={h}
                        className="px-[13px] py-[9px] text-left text-[10px] font-semibold uppercase tracking-[0.6px] whitespace-nowrap"
                        style={{ color: "#6b7280", background: "#ffffff", borderBottom: "1px solid rgba(0,0,0,0.07)" }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {progress.map((p) => {
                    const pct = p.expected_sp > 0 ? Math.round((p.actual_sp / p.expected_sp) * 100) : 0;
                    const color = memberColor(p.member);
                    return (
                      <tr
                        key={p.member_id}
                        className="transition-colors"
                        style={{ borderBottom: "1px solid rgba(0,0,0,0.032)" }}
                        onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.025)")}
                        onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "")}
                      >
                        <td className="px-[13px] py-[11px] whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <div
                              className="flex-shrink-0 flex items-center justify-center rounded-full text-[9px] font-bold text-white"
                              style={{ width: 24, height: 24, background: color }}
                            >
                              {initials(p.member)}
                            </div>
                            <span className="font-medium text-gray-900">{p.member}</span>
                          </div>
                        </td>
                        {isSuperAdmin && (
                          <td className="px-[13px] py-[11px] whitespace-nowrap">
                            <span className="text-[11px] px-[8px] py-[2px] rounded-[5px]"
                              style={{ background: "rgba(99,102,241,0.1)", color: "#818cf8" }}>
                              {p.workspace_name || "—"}
                            </span>
                          </td>
                        )}
                        <td className="px-[13px] py-[11px] whitespace-nowrap">                          <span className="inline-flex items-center gap-1 px-[9px] py-[3px] rounded-[20px] text-[11px] font-semibold" style={{ background: "rgba(59,130,246,.12)", color: "#2563eb" }}>
                            {p.wip}
                          </span>
                        </td>
                        <td className="px-[13px] py-[11px] whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 px-[9px] py-[3px] rounded-[20px] text-[11px] font-semibold" style={{ background: "rgba(245,158,11,.12)", color: "#d97706" }}>
                            {p.sent_for_approval}
                          </span>
                        </td>
                        <td className="px-[13px] py-[11px] whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 px-[9px] py-[3px] rounded-[20px] text-[11px] font-semibold" style={{ background: "rgba(16,185,129,.12)", color: "#10b981" }}>
                            {p.closed}
                          </span>
                        </td>
                        <td className="px-[13px] py-[11px] whitespace-nowrap text-gray-600">{p.total_tasks}</td>
                        <td className="px-[13px] py-[11px] whitespace-nowrap text-gray-600">{p.expected_sp}</td>
                        <td className="px-[13px] py-[11px] whitespace-nowrap font-semibold text-gray-900">{p.actual_sp}</td>
                        <td className="px-[13px] py-[11px] max-w-[200px]">
                          {p.dependencies && p.dependencies.length > 0 ? (
                            <div className="flex flex-col gap-[3px]">
                              {p.dependencies.map((dep, i) => (
                                <span
                                  key={i}
                                  className="inline-block text-[10.5px] px-[7px] py-[2px] rounded-[5px] truncate max-w-[180px]"
                                  style={{ background: "rgba(239,68,68,0.1)", color: "#f87171" }}
                                  title={dep}
                                >
                                  {dep}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-[11px] text-gray-600">—</span>
                          )}
                        </td>
                        <td className="px-[13px] py-[11px] whitespace-nowrap min-w-[120px]">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-[5px] rounded-full" style={{ background: "rgba(0,0,0,0.1)" }}>
                              <div
                                className="h-full rounded-full transition-all"
                                style={{ width: `${Math.min(pct, 100)}%`, background: pct >= 80 ? "#10b981" : pct >= 50 ? "#d946ef" : "#f59e0b" }}
                              />
                            </div>
                            <span className="text-[11px] text-gray-600 w-8 text-right">{pct}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Footer totals */}
          {!loading && progress.length > 0 && (
            <div
              className="flex items-center gap-[18px] px-[18px] py-[11px] flex-wrap"
              style={{ borderTop: "1px solid rgba(0,0,0,0.07)", background: "rgba(0,0,0,0.02)" }}
            >
              {[
                { label: "Total Tasks", val: totals.tasks, color: "#9ca3af" },
                { label: "WIP", val: totals.wip, color: "#2563eb" },
                { label: "In Review", val: totals.approval, color: "#d97706" },
                { label: "Closed", val: totals.closed, color: "#10b981" },
                { label: "SP Done", val: `${totals.actual} / ${totals.expected}`, color: "#9ca3af" },
              ].map((s, i) => (
                <span key={s.label} className="flex items-center gap-[5px] text-[12px] text-gray-600">
                  {i > 0 && <span className="w-[1px] h-[13px] mr-[13px]" style={{ background: "rgba(0,0,0,0.07)" }} />}
                  <strong style={{ color: s.color }}>{s.val}</strong> {s.label}
                </span>
              ))}
            </div>
          )}
        </div>

      </div>
    </>
  );
}
