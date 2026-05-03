"use client";

import { useEffect, useState } from "react";
import { api, type SprintProgress } from "@/lib/api";

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

  const trendColor = trend === "up" ? "#10b981" : trend === "down" ? "#ef4444" : "#475569";

  return (
    <div
      className="relative overflow-hidden rounded-[12px] cursor-default transition-transform hover:-translate-y-px"
      style={{
        background: "#11111b",
        border: "1px solid rgba(255,255,255,0.07)",
        padding: "18px 20px",
      }}
    >
      {/* glow blob */}
      <div
        className="absolute -bottom-5 -right-5 w-20 h-20 rounded-full opacity-[0.09]"
        style={{ background: palette.glow }}
      />
      <div className="flex items-start justify-between mb-[11px]">
        <span className="text-[11px] font-medium uppercase tracking-[0.5px] text-slate-600">{label}</span>
        <div className="flex items-center justify-center w-[30px] h-[30px] rounded-[8px]" style={{ background: palette.ico, color: palette.txt }}>
          {icon}
        </div>
      </div>
      <div className="text-[30px] font-extrabold text-slate-100 leading-none tracking-[-1px] mb-[6px]">{value}</div>
      <div className="text-[11.5px]" style={{ color: trendColor }}>{sub}</div>
    </div>
  );
}

export default function DashboardPage() {
  const [progress, setProgress] = useState<SprintProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api.dashboard
      .sprintProgress()
      .then(setProgress)
      .catch(() => setError("Could not load sprint data — is the backend running?"))
      .finally(() => setLoading(false));
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

  return (
    <>
      {/* Topbar */}
      <div
        className="sticky top-0 z-10 flex items-center justify-between px-[26px] py-[13px]"
        style={{
          background: "rgba(9,9,15,0.88)",
          backdropFilter: "blur(14px)",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
        }}
      >
        <div>
          <h1 className="text-[19px] font-bold text-slate-100 tracking-[-0.5px]">Dashboard</h1>
          <p className="text-[11.5px] text-slate-600 mt-[2px]">
            {activeMembers} member{activeMembers !== 1 ? "s" : ""} active this sprint
          </p>
        </div>
        <div className="flex items-center gap-[9px]">
          <div
            className="flex items-center gap-[5px] px-[11px] py-[5px] rounded-[7px] text-[12px] font-medium cursor-default"
            style={{
              border: "1px solid rgba(217,70,239,0.22)",
              background: "rgba(217,70,239,0.07)",
              color: "#e879f9",
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-[13px] h-[13px]">
              <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            Sprint
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-[26px] flex flex-col gap-[22px]">

        {error && (
          <div className="rounded-[10px] px-4 py-3 text-sm" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", color: "#f87171" }}>
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
              label="Team Overview"
              value={`${activeMembers} / ${progress.length}`}
              sub={`${totals.wip} tasks in progress`}
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
        <div
          className="rounded-[12px] overflow-hidden"
          style={{ background: "#11111b", border: "1px solid rgba(255,255,255,0.07)" }}
        >
          <div
            className="flex items-center justify-between px-[18px] py-[15px]"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
          >
            <div>
              <h2 className="text-[14px] font-semibold text-slate-100">Sprint Progress</h2>
              <p className="text-[11.5px] text-slate-600 mt-[2px]">Per-member breakdown</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            {loading ? (
              <div className="px-[18px] py-10 text-center text-[13px] text-slate-600">Loading…</div>
            ) : progress.length === 0 && !error ? (
              <div className="px-[18px] py-12 text-center text-[13px] text-slate-600">
                No sprint data yet. Members will appear once they post EOD updates.
              </div>
            ) : (
              <table className="w-full border-collapse text-[12.5px]">
                <thead>
                  <tr style={{ background: "rgba(255,255,255,0.02)", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                    {["Member", "WIP", "In Review", "Closed", "Total", "Exp SP", "Act SP", "Progress"].map((h) => (
                      <th
                        key={h}
                        className="px-[13px] py-[9px] text-left text-[10px] font-semibold uppercase tracking-[0.6px] whitespace-nowrap"
                        style={{ color: "#475569" }}
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
                        style={{ borderBottom: "1px solid rgba(255,255,255,0.032)" }}
                        onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.025)")}
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
                            <span className="font-medium text-slate-100">{p.member}</span>
                          </div>
                        </td>
                        <td className="px-[13px] py-[11px] whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 px-[9px] py-[3px] rounded-[20px] text-[11px] font-semibold" style={{ background: "rgba(59,130,246,.12)", color: "#60a5fa" }}>
                            {p.wip}
                          </span>
                        </td>
                        <td className="px-[13px] py-[11px] whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 px-[9px] py-[3px] rounded-[20px] text-[11px] font-semibold" style={{ background: "rgba(245,158,11,.12)", color: "#fbbf24" }}>
                            {p.sent_for_approval}
                          </span>
                        </td>
                        <td className="px-[13px] py-[11px] whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 px-[9px] py-[3px] rounded-[20px] text-[11px] font-semibold" style={{ background: "rgba(16,185,129,.12)", color: "#34d399" }}>
                            {p.closed}
                          </span>
                        </td>
                        <td className="px-[13px] py-[11px] whitespace-nowrap text-slate-400">{p.total_tasks}</td>
                        <td className="px-[13px] py-[11px] whitespace-nowrap text-slate-400">{p.expected_sp}</td>
                        <td className="px-[13px] py-[11px] whitespace-nowrap font-semibold text-slate-100">{p.actual_sp}</td>
                        <td className="px-[13px] py-[11px] whitespace-nowrap min-w-[120px]">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-[5px] rounded-full" style={{ background: "rgba(255,255,255,0.07)" }}>
                              <div
                                className="h-full rounded-full transition-all"
                                style={{
                                  width: `${Math.min(pct, 100)}%`,
                                  background: pct >= 80 ? "#10b981" : pct >= 50 ? "#d946ef" : "#f59e0b",
                                }}
                              />
                            </div>
                            <span className="text-[11px] text-slate-400 w-8 text-right">{pct}%</span>
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
              style={{ borderTop: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.015)" }}
            >
              {[
                { label: "Total Tasks", val: totals.tasks, color: "#94a3b8" },
                { label: "WIP", val: totals.wip, color: "#60a5fa" },
                { label: "In Review", val: totals.approval, color: "#fbbf24" },
                { label: "Closed", val: totals.closed, color: "#34d399" },
                { label: "SP Done", val: `${totals.actual} / ${totals.expected}`, color: "#94a3b8" },
              ].map((s, i) => (
                <span key={s.label} className="flex items-center gap-[5px] text-[12px] text-slate-600">
                  {i > 0 && <span className="w-[1px] h-[13px] mr-[13px]" style={{ background: "rgba(255,255,255,0.07)" }} />}
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
