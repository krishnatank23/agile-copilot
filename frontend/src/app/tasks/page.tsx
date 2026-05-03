"use client";

import { useEffect, useState, useCallback } from "react";
import { api, type Task, type Member } from "@/lib/api";

const STAGES: Task["stage"][] = ["WIP", "Sent for Approval", "Closed"];

const STAGE_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  WIP:               { bg: "rgba(59,130,246,.12)",  color: "#60a5fa",  label: "WIP" },
  "Sent for Approval": { bg: "rgba(245,158,11,.12)", color: "#fbbf24",  label: "In Review" },
  Closed:            { bg: "rgba(16,185,129,.12)",  color: "#34d399",  label: "Closed" },
};

const PRI_STYLE: Record<string, { color: string; dot: string }> = {
  High:   { color: "#f87171", dot: "#f87171" },
  Medium: { color: "#fbbf24", dot: "#fbbf24" },
  Low:    { color: "#475569", dot: "#475569" },
};

const MEMBER_COLORS: Record<string, string> = {
  Dhwani: "#d946ef", Shaily: "#8b5cf6", Shriya: "#3b82f6",
  Ravi: "#10b981", Yash: "#f59e0b", Yogini: "#ec4899",
  Kriishna: "#06b6d4", Harshil: "#f97316", Rinal: "#14b8a6", Prince: "#6366f1",
};

function memberColor(name: string) { return MEMBER_COLORS[name] ?? "#64748b"; }
function initials(name: string) { return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase(); }

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="px-[10px] py-[3px] rounded-[20px] text-[11.5px] font-medium whitespace-nowrap transition-all cursor-pointer flex-shrink-0"
      style={
        active
          ? { background: "rgba(217,70,239,0.12)", borderColor: "rgba(217,70,239,0.25)", color: "#e879f9", border: "1px solid" }
          : { background: "transparent", border: "1px solid rgba(255,255,255,0.07)", color: "#475569" }
      }
    >
      {children}
    </button>
  );
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [memberFilter, setMemberFilter] = useState("All");
  const [stageFilter, setStageFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [t, m] = await Promise.all([
        api.tasks.list({
          member: memberFilter !== "All" ? memberFilter : undefined,
          stage: stageFilter !== "All" ? stageFilter : undefined,
        }),
        api.members.list(),
      ]);
      setTasks(t);
      setMembers(m);
    } catch {
      setError("Could not load tasks — is the backend running?");
    } finally {
      setLoading(false);
    }
  }, [memberFilter, stageFilter]);

  useEffect(() => { load(); }, [load]);

  async function updateStage(task: Task, newStage: Task["stage"]) {
    setEditing(task.id);
    try {
      const updated = await api.tasks.update(task.id, { stage: newStage });
      setTasks((prev) => prev.map((t) => (t.id === updated.id ? { ...t, ...updated } : t)));
    } catch {
      alert("Failed to update task stage.");
    } finally {
      setEditing(null);
    }
  }

  async function updateActualSP(task: Task, value: number) {
    setEditing(task.id);
    try {
      const updated = await api.tasks.update(task.id, { actual_story_points: value });
      setTasks((prev) => prev.map((t) => (t.id === updated.id ? { ...t, ...updated } : t)));
    } catch {
      alert("Failed to update story points.");
    } finally {
      setEditing(null);
    }
  }

  const q = search.toLowerCase();
  const visible = tasks.filter((t) => {
    if (!q) return true;
    return (
      t.sprint_backlog?.toLowerCase().includes(q) ||
      t.member_name?.toLowerCase().includes(q) ||
      t.brand?.toLowerCase().includes(q)
    );
  });

  const stageRowClass: Record<string, string> = {
    WIP: "border-l-[3px] border-l-blue-500",
    "Sent for Approval": "border-l-[3px] border-l-amber-400",
    Closed: "border-l-[3px] border-l-emerald-500",
  };

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
          <h1 className="text-[19px] font-bold text-slate-100 tracking-[-0.5px]">Tasks</h1>
          <p className="text-[11.5px] text-slate-600 mt-[2px]">{visible.length} task{visible.length !== 1 ? "s" : ""} shown</p>
        </div>
      </div>

      <div className="p-[26px]">
        {error && (
          <div className="rounded-[10px] px-4 py-3 text-sm mb-5" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", color: "#f87171" }}>
            {error}
          </div>
        )}

        {/* Table card */}
        <div className="rounded-[12px] overflow-hidden" style={{ background: "#11111b", border: "1px solid rgba(255,255,255,0.07)" }}>

          {/* Header */}
          <div className="flex items-center justify-between px-[18px] py-[15px]" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
            <div>
              <h2 className="text-[14px] font-semibold text-slate-100">Sprint Tasks</h2>
              <p className="text-[11.5px] text-slate-600 mt-[2px]">Showing {visible.length} of {tasks.length} tasks</p>
            </div>
            <div
              className="flex items-center gap-[6px] px-[10px] py-[6px] rounded-[6px]"
              style={{ border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.03)" }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-[13px] h-[13px] text-slate-600 flex-shrink-0">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                type="text"
                placeholder="Search tasks, members, brands…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-transparent border-none outline-none text-[12px] text-slate-100 placeholder:text-slate-600 w-44"
              />
            </div>
          </div>

          {/* Filter chips */}
          <div
            className="flex items-center gap-[5px] px-[18px] py-[10px] overflow-x-auto"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.07)", scrollbarWidth: "none" }}
          >
            <span className="text-[10.5px] text-slate-600 font-medium mr-[2px] flex-shrink-0 whitespace-nowrap">Member:</span>
            <Chip active={memberFilter === "All"} onClick={() => setMemberFilter("All")}>All</Chip>
            {members.map((m) => (
              <Chip key={m.id} active={memberFilter === m.display_name} onClick={() => setMemberFilter(m.display_name)}>
                {m.display_name}
              </Chip>
            ))}
            <div className="w-[1px] h-[15px] flex-shrink-0 mx-[3px]" style={{ background: "rgba(255,255,255,0.07)" }} />
            <span className="text-[10.5px] text-slate-600 font-medium mr-[2px] flex-shrink-0 whitespace-nowrap">Status:</span>
            {STAGES.map((s) => (
              <Chip key={s} active={stageFilter === s} onClick={() => setStageFilter(stageFilter === s ? "All" : s)}>
                {STAGE_STYLE[s].label}
              </Chip>
            ))}
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            {loading ? (
              <div className="px-[18px] py-10 text-center text-[13px] text-slate-600">Loading tasks…</div>
            ) : visible.length === 0 ? (
              <div className="px-[18px] py-12 text-center text-[13px] text-slate-600">No tasks match your filters.</div>
            ) : (
              <table className="w-full border-collapse text-[12.5px]">
                <thead>
                  <tr style={{ background: "rgba(255,255,255,0.02)", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                    {["Member", "Sprint Backlog", "Brand", "Activity", "Status", "Priority", "SP Exp / Act", "Deadline"].map((h) => (
                      <th key={h} className="px-[13px] py-[9px] text-left text-[10px] font-semibold uppercase tracking-[0.6px] whitespace-nowrap" style={{ color: "#475569" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visible.map((task) => {
                    const ss = STAGE_STYLE[task.stage] ?? STAGE_STYLE.WIP;
                    const ps = PRI_STYLE[task.priority] ?? PRI_STYLE.Medium;
                    const color = memberColor(task.member_name ?? "");
                    return (
                      <tr
                        key={task.id}
                        className={`transition-colors ${stageRowClass[task.stage] ?? ""} ${editing === task.id ? "opacity-60" : ""}`}
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
                              {initials(task.member_name ?? "?")}
                            </div>
                            <span className="font-medium text-slate-100">{task.member_name}</span>
                          </div>
                        </td>
                        <td className="px-[13px] py-[11px] max-w-[210px]">
                          <div className="font-medium text-slate-100 whitespace-nowrap overflow-hidden text-ellipsis" title={task.sprint_backlog}>
                            {task.sprint_backlog}
                          </div>
                          {task.comments && (
                            <div className="text-[11px] text-slate-600 mt-[2px] whitespace-nowrap overflow-hidden text-ellipsis">{task.comments}</div>
                          )}
                        </td>
                        <td className="px-[13px] py-[11px] whitespace-nowrap">
                          {task.brand ? (
                            <span
                              className="inline-flex px-[8px] py-[2px] rounded-[4px] text-[11px] font-semibold"
                              style={{ background: "rgba(139,92,246,.15)", color: "#a78bfa" }}
                            >
                              {task.brand}
                            </span>
                          ) : <span className="text-slate-600">—</span>}
                        </td>
                        <td className="px-[13px] py-[11px] whitespace-nowrap">
                          {task.activity_type ? (
                            <span
                              className="inline-flex px-[8px] py-[2px] rounded-[20px] text-[11px] font-medium"
                              style={{ background: "rgba(255,255,255,0.06)", color: "#94a3b8" }}
                            >
                              {task.activity_type}
                            </span>
                          ) : <span className="text-slate-600">—</span>}
                        </td>
                        <td className="px-[13px] py-[11px] whitespace-nowrap">
                          <select
                            value={task.stage}
                            disabled={editing === task.id}
                            onChange={(e) => updateStage(task, e.target.value as Task["stage"])}
                            className="rounded-[20px] text-[11px] font-semibold px-[9px] py-[3px] border-none cursor-pointer outline-none"
                            style={{ background: ss.bg, color: ss.color }}
                          >
                            <option value="WIP">WIP</option>
                            <option value="Sent for Approval">In Review</option>
                            <option value="Closed">Closed</option>
                          </select>
                        </td>
                        <td className="px-[13px] py-[11px] whitespace-nowrap">
                          <div className="flex items-center gap-[4px] text-[12px]" style={{ color: ps.color }}>
                            <div className="w-[6px] h-[6px] rounded-full flex-shrink-0" style={{ background: ps.dot }} />
                            {task.priority}
                          </div>
                        </td>
                        <td className="px-[13px] py-[11px] whitespace-nowrap text-center text-[12px] text-slate-400">
                          {task.expected_story_points} /&nbsp;
                          <input
                            type="number"
                            min={0}
                            max={20}
                            defaultValue={task.actual_story_points}
                            disabled={editing === task.id}
                            onBlur={(e) => {
                              const v = parseInt(e.target.value);
                              if (!isNaN(v) && v !== task.actual_story_points) updateActualSP(task, v);
                            }}
                            className="w-10 border-none outline-none text-slate-100 font-semibold bg-transparent text-center"
                          />
                        </td>
                        <td className="px-[13px] py-[11px] whitespace-nowrap text-[12px] text-slate-600">
                          {task.deadline || "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Footer */}
          {!loading && visible.length > 0 && (
            <div
              className="flex items-center gap-[18px] px-[18px] py-[11px] flex-wrap"
              style={{ borderTop: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.015)" }}
            >
              {[
                { label: "tasks", val: visible.length, color: "#94a3b8" },
                { label: "WIP",      val: visible.filter((t) => t.stage === "WIP").length,               color: "#60a5fa" },
                { label: "In Review",val: visible.filter((t) => t.stage === "Sent for Approval").length, color: "#fbbf24" },
                { label: "Closed",   val: visible.filter((t) => t.stage === "Closed").length,            color: "#34d399" },
              ].map((s, i) => (
                <span key={s.label} className="flex items-center gap-[5px] text-[12px] text-slate-600">
                  {i > 0 && <span className="inline-block w-[1px] h-[13px] mr-[13px]" style={{ background: "rgba(255,255,255,0.07)" }} />}
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
