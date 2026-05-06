"use client";

import { useEffect, useState, useCallback, useRef, useTransition } from "react";
import { api, type Task, type Member } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

const STAGES: Task["stage"][] = ["WIP", "Sent for Approval", "Closed"];
const PRIORITIES: Task["priority"][] = ["High", "Medium", "Low"];

const STAGE_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  WIP: { bg: "rgba(59,130,246,.12)", color: "#60a5fa", label: "WIP" },
  "Sent for Approval": { bg: "rgba(245,158,11,.12)", color: "#fbbf24", label: "In Review" },
  Closed: { bg: "rgba(16,185,129,.12)", color: "#34d399", label: "Closed" },
};

const PRI_STYLE: Record<string, { color: string }> = {
  High: { color: "#f87171" },
  Medium: { color: "#fbbf24" },
  Low: { color: "#475569" },
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
    <button onClick={onClick}
      className="px-[10px] py-[3px] rounded-[20px] text-[11.5px] font-medium whitespace-nowrap transition-all cursor-pointer flex-shrink-0"
      style={active
        ? { background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.3)", color: "#7c3aed" }
        : { background: "transparent", border: "1px solid rgba(0,0,0,0.1)", color: "#6b7280" }}>
      {children}
    </button>
  );
}

// ── Inline cell components ────────────────────────────────────────────────────

interface CellProps {
  task: Task;
  field: keyof Task;
  editing: boolean;
  onStartEdit: () => void;
  onCommit: (value: string | number) => void;
  onCancel: () => void;
}

function TextCell({ task, field, editing, onStartEdit, onCommit, onCancel }: CellProps) {
  const val = String((task[field] as string | number) ?? "");
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => { if (editing) ref.current?.select(); }, [editing]);

  if (editing) {
    return (
      <input ref={ref} defaultValue={val} autoFocus
        className="w-full bg-transparent text-gray-900 text-[12.5px] outline-none rounded px-1"
        style={{ border: "1px solid rgba(139,92,246,0.5)", minWidth: 120 }}
        onBlur={(e) => onCommit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); onCommit((e.target as HTMLInputElement).value); }
          if (e.key === "Escape") onCancel();
        }}
      />
    );
  }

  return (
    <div onClick={onStartEdit} title="Click to edit"
      className="cursor-text rounded px-1 py-[1px] transition-colors max-w-[200px] truncate"
      style={{ color: val ? "#1f2937" : "#9ca3af" }}
      onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.04)")}
      onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "")}>
      {val || <span style={{ color: "#d1d5db" }}>—</span>}
    </div>
  );
}

function TaskNameCell({ task, editing, onStartEdit, onCommit, onCancel }: CellProps) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (editing) ref.current?.select(); }, [editing]);

  if (editing) {
    return (
      <input ref={ref} defaultValue={task.sprint_backlog} autoFocus
        className="bg-transparent text-gray-900 text-[12.5px] font-medium outline-none rounded px-1"
        style={{ border: "1px solid rgba(139,92,246,0.5)", width: 210 }}
        onBlur={(e) => onCommit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); onCommit((e.target as HTMLInputElement).value); }
          if (e.key === "Escape") onCancel();
        }}
      />
    );
  }

  return (
    <div onClick={onStartEdit} title="Click to edit" className="cursor-text">
      <div className="font-medium text-gray-900 text-[12.5px] max-w-[210px] truncate rounded px-1 py-[1px]"
        onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.04)")}
        onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "")}>
        {task.sprint_backlog}
      </div>
      {task.comments && <div className="text-[11px] text-gray-500 mt-[2px] truncate px-1">{task.comments}</div>}
    </div>
  );
}

function SelectCell({ task, field, options, renderOption, editing, onStartEdit, onCommit, onCancel }: CellProps & {
  options: string[];
  renderOption?: (v: string) => React.ReactNode;
}) {
  const val = String(task[field] ?? "");
  const ref = useRef<HTMLSelectElement>(null);
  useEffect(() => { if (editing) ref.current?.focus(); }, [editing]);

  if (editing) {
    return (
      <select ref={ref} defaultValue={val} autoFocus
        className="bg-white text-gray-900 text-[11.5px] rounded outline-none px-2 py-[3px]"
        style={{ border: "1px solid rgba(139,92,246,0.5)" }}
        onBlur={(e) => onCommit(e.target.value)}
        onChange={(e) => onCommit(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Escape") onCancel(); }}
      >
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    );
  }

  return (
    <div onClick={onStartEdit} className="cursor-pointer rounded px-1 py-[1px]"
      onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.04)")}
      onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "")}>
      {renderOption ? renderOption(val) : <span className="text-gray-500 text-[12.5px]">{val}</span>}
    </div>
  );
}

function NumberCell({ task, field, editing, onStartEdit, onCommit, onCancel }: CellProps) {
  const val = Number(task[field] ?? 0);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (editing) { ref.current?.select(); } }, [editing]);

  if (editing) {
    return (
      <input ref={ref} type="number" defaultValue={val} min={0} max={20} autoFocus
        className="w-12 bg-transparent text-gray-900 text-[12.5px] font-semibold outline-none rounded px-1 text-center"
        style={{ border: "1px solid rgba(139,92,246,0.5)" }}
        onBlur={(e) => onCommit(parseInt(e.target.value) || 0)}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); onCommit(parseInt((e.target as HTMLInputElement).value) || 0); }
          if (e.key === "Escape") onCancel();
        }}
      />
    );
  }

  return (
    <div onClick={onStartEdit} className="cursor-text rounded px-1 py-[1px] text-center"
      onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.04)")}
      onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "")}>
      <span className="text-[12.5px] font-semibold text-gray-900">{val}</span>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

type EditingCell = { id: number; field: keyof Task } | null;

export default function TasksPage() {
  const { user } = useAuth();
  const isManager = user?.role === "manager" || user?.role === "super_admin";

  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [memberFilter, setMemberFilter] = useState("All");
  const [stageFilter, setStageFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState<number | null>(null);
  const [editingCell, setEditingCell] = useState<EditingCell>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [, startTransition] = useTransition();
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const bottomScrollRef = useRef<HTMLDivElement>(null);
  const syncingScrollRef = useRef(false);



  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [t, m] = await Promise.all([
        api.tasks.list({
          member: memberFilter !== "All" ? memberFilter : undefined,
          stage: stageFilter !== "All" ? stageFilter : undefined,
        }),
        api.members.list(),
      ]);
      startTransition(() => {
        setTasks(t);
        setMembers(m);
        setLastRefreshed(new Date());
        setError("");
      });
    } catch {
      setError("Could not load tasks — is the backend running?");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [memberFilter, stageFilter]);

  // Initial load
  useEffect(() => { load(); }, [load]);

  // Auto-poll every 30 seconds
  useEffect(() => {
    const pollInterval = setInterval(() => load(true), 30_000);
    return () => {
      clearInterval(pollInterval);
    };
  }, [load]);

  async function commitCell(task: Task, field: keyof Task, rawValue: string | number) {
    setEditingCell(null);
    let value: string | number = rawValue;
    if (field === "actual_story_points" || field === "expected_story_points") {
      value = parseInt(String(rawValue)) || 0;
    }
    const current = task[field];
    if (String(value) === String(current ?? "")) return; // no change
    setSaving(task.id);
    try {
      const updated = await api.tasks.update(task.id, { [field]: value } as Partial<Task>);
      setTasks((prev) => prev.map((t) => (t.id === updated.id ? { ...t, ...updated } : t)));
    } catch {
      alert("Failed to save change.");
    } finally {
      setSaving(null);
    }
  }

  function startEdit(taskId: number, field: keyof Task) {
    setEditingCell({ id: taskId, field });
  }

  function cancelEdit() {
    setEditingCell(null);
  }

  function isEditing(taskId: number, field: keyof Task) {
    return editingCell?.id === taskId && editingCell?.field === field;
  }

  function syncScroll(source: HTMLDivElement, target: HTMLDivElement | null) {
    if (!target || syncingScrollRef.current) return;
    syncingScrollRef.current = true;
    target.scrollLeft = source.scrollLeft;
    window.requestAnimationFrame(() => {
      syncingScrollRef.current = false;
    });
  }



  const q = search.toLowerCase();
  const visible = tasks.filter((t) => {
    if (!q) return true;
    return (
      t.sprint_backlog?.toLowerCase().includes(q) ||
      t.member_name?.toLowerCase().includes(q) ||
      t.brand?.toLowerCase().includes(q) ||
      t.comments?.toLowerCase().includes(q)
    );
  });

  const stageLeftBorder: Record<string, string> = {
    WIP: "#3b82f6",
    "Sent for Approval": "#f59e0b",
    Closed: "#10b981",
  };

  return (
    <>
      {/* Topbar */}
      <div className="sticky top-0 z-10 flex items-center justify-between px-[26px] py-[13px]"
        style={{ background: "rgba(255,255,255,0.95)", backdropFilter: "blur(14px)", borderBottom: "1px solid rgba(0,0,0,0.07)" }}>
        <div>
          <h1 className="text-[19px] font-bold text-gray-900 tracking-[-0.5px]">
            {user?.role === "super_admin" ? "All Tasks" : isManager ? "Tasks" : "My Tasks"}
          </h1>
          <p className="text-[11.5px] text-gray-600 mt-[2px]">
            {visible.length} task{visible.length !== 1 ? "s" : ""} · click any cell to edit
            {lastRefreshed && (
              <span className="ml-2 opacity-50">· synced {lastRefreshed.toLocaleTimeString()}</span>
            )}
          </p>
        </div>
      </div>

      <div className="p-[26px]">
        {error && (
          <div className="rounded-[10px] px-4 py-3 text-sm mb-5"
            style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#dc2626" }}>
            {error}
          </div>
        )}

        <div className="rounded-[12px] overflow-hidden"
          style={{ background: "#ffffff", border: "1px solid rgba(0,0,0,0.07)" }}>

          {/* Header */}
          <div className="flex items-center justify-between px-[18px] py-[15px]"
            style={{ borderBottom: "1px solid rgba(0,0,0,0.07)" }}>
            <div>
              <h2 className="text-[14px] font-semibold text-gray-900">Sprint Tasks</h2>
              <p className="text-[11.5px] text-gray-600 mt-[2px]">Showing {visible.length} of {tasks.length}</p>
            </div>
            <div className="flex items-center gap-[6px] px-[10px] py-[6px] rounded-[6px]"
              style={{ border: "1px solid rgba(0,0,0,0.1)", background: "rgba(0,0,0,0.02)" }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
                className="w-[13px] h-[13px] text-gray-600 flex-shrink-0">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input type="text" placeholder="Search…" value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-transparent border-none outline-none text-[12px] text-gray-900 placeholder:text-gray-500 w-36" />
            </div>
          </div>

          {/* Filter chips — manager only sees member filter */}
          <div className="flex items-center gap-[5px] px-[18px] py-[10px] overflow-x-auto"
            style={{ borderBottom: "1px solid rgba(0,0,0,0.07)", scrollbarWidth: "none" }}>
            {isManager && (
              <>
                <span className="text-[10.5px] text-gray-600 font-medium mr-[2px] flex-shrink-0">Member:</span>
                <Chip active={memberFilter === "All"} onClick={() => setMemberFilter("All")}>All</Chip>
                {members.map((m) => (
                  <Chip key={m.id} active={memberFilter === m.display_name} onClick={() => setMemberFilter(m.display_name)}>
                    {m.display_name}
                  </Chip>
                ))}
                <div className="w-[1px] h-[15px] flex-shrink-0 mx-[3px]" style={{ background: "rgba(0,0,0,0.07)" }} />
              </>
            )}
            <span className="text-[10.5px] text-gray-600 font-medium mr-[2px] flex-shrink-0">Status:</span>
            {STAGES.map((s) => (
              <Chip key={s} active={stageFilter === s} onClick={() => setStageFilter(stageFilter === s ? "All" : s)}>
                {STAGE_STYLE[s].label}
              </Chip>
            ))}
          </div>

          {/* Table */}
          <div
            ref={tableScrollRef}
            onScroll={(e) => syncScroll(e.currentTarget, bottomScrollRef.current)}
            className="tasks-scrollbar overflow-x-scroll overflow-y-auto"
            style={{ maxHeight: "calc(100vh - 220px)", scrollbarGutter: "stable both-edges" }}
          >
            {loading ? (
              <div className="px-[18px] py-10 text-center text-[13px] text-gray-500">Loading tasks…</div>
            ) : visible.length === 0 ? (
              <div className="px-[18px] py-12 text-center text-[13px] text-gray-500">No tasks match your filters.</div>
            ) : (
              <table className="min-w-[1300px] w-full border-collapse text-[12.5px]">
                <thead className="sticky top-0 z-10">
                  <tr>
                    {["Member", "Task", "Brand", "Activity", "Stage", "Priority", "Exp SP", "Act SP", "Deadline", "Comments"].map((h) => (
                      <th key={h} className="px-[13px] py-[9px] text-left text-[10px] font-semibold uppercase tracking-[0.6px] whitespace-nowrap"
                        style={{ color: "#6b7280", background: "#ffffff", borderBottom: "1px solid rgba(0,0,0,0.07)" }}>
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
                    const isSaving = saving === task.id;
                    const leftColor = stageLeftBorder[task.stage] ?? "#64748b";

                    return (
                      <tr key={task.id}
                        className="transition-colors"
                        style={{
                          borderBottom: "1px solid rgba(0,0,0,0.07)",
                          borderLeft: `3px solid ${leftColor}`,
                          opacity: isSaving ? 0.6 : 1,
                        }}
                        onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.02)")}
                        onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "")}>

                        {/* Member (read-only) */}
                        <td className="px-[13px] py-[10px] whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <div className="flex-shrink-0 flex items-center justify-center rounded-full text-[9px] font-bold text-white"
                              style={{ width: 24, height: 24, background: color }}>
                              {initials(task.member_name ?? "?")}
                            </div>
                            <span className="font-medium text-gray-900">{task.member_name}</span>
                          </div>
                        </td>

                        {/* Task name — editable */}
                        <td className="px-[13px] py-[10px]" style={{ minWidth: 180 }}>
                          <TaskNameCell task={task} field="sprint_backlog"
                            editing={isEditing(task.id, "sprint_backlog")}
                            onStartEdit={() => startEdit(task.id, "sprint_backlog")}
                            onCommit={(v) => commitCell(task, "sprint_backlog", v)}
                            onCancel={cancelEdit} />
                        </td>

                        {/* Brand — editable text */}
                        <td className="px-[13px] py-[10px] whitespace-nowrap">
                          <TextCell task={task} field="brand"
                            editing={isEditing(task.id, "brand")}
                            onStartEdit={() => startEdit(task.id, "brand")}
                            onCommit={(v) => commitCell(task, "brand", v)}
                            onCancel={cancelEdit} />
                        </td>

                        {/* Activity — editable text */}
                        <td className="px-[13px] py-[10px] whitespace-nowrap">
                          <TextCell task={task} field="activity_type"
                            editing={isEditing(task.id, "activity_type")}
                            onStartEdit={() => startEdit(task.id, "activity_type")}
                            onCommit={(v) => commitCell(task, "activity_type", v)}
                            onCancel={cancelEdit} />
                        </td>

                        {/* Stage — select */}
                        <td className="px-[13px] py-[10px] whitespace-nowrap">
                          <SelectCell task={task} field="stage" options={STAGES}
                            editing={isEditing(task.id, "stage")}
                            onStartEdit={() => startEdit(task.id, "stage")}
                            onCommit={(v) => commitCell(task, "stage", v)}
                            onCancel={cancelEdit}
                            renderOption={(v) => (
                              <span className="inline-flex items-center gap-[4px] px-[9px] py-[3px] rounded-[20px] text-[11px] font-semibold"
                                style={{ background: (STAGE_STYLE[v] ?? ss).bg, color: (STAGE_STYLE[v] ?? ss).color }}>
                                <span className="w-[5px] h-[5px] rounded-full flex-shrink-0" style={{ background: "currentColor" }} />
                                {(STAGE_STYLE[v] ?? ss).label}
                              </span>
                            )} />
                        </td>

                        {/* Priority — select */}
                        <td className="px-[13px] py-[10px] whitespace-nowrap">
                          <SelectCell task={task} field="priority" options={PRIORITIES}
                            editing={isEditing(task.id, "priority")}
                            onStartEdit={() => startEdit(task.id, "priority")}
                            onCommit={(v) => commitCell(task, "priority", v)}
                            onCancel={cancelEdit}
                            renderOption={(v) => (
                              <div className="flex items-center gap-[4px] text-[12px]" style={{ color: (PRI_STYLE[v] ?? ps).color }}>
                                <div className="w-[6px] h-[6px] rounded-full flex-shrink-0" style={{ background: "currentColor" }} />
                                {v}
                              </div>
                            )} />
                        </td>

                        {/* Expected SP — editable number (manager only) */}
                        <td className="px-[13px] py-[10px] whitespace-nowrap text-center">
                          {isManager ? (
                            <NumberCell task={task} field="expected_story_points"
                              editing={isEditing(task.id, "expected_story_points")}
                              onStartEdit={() => startEdit(task.id, "expected_story_points")}
                              onCommit={(v) => commitCell(task, "expected_story_points", v)}
                              onCancel={cancelEdit} />
                          ) : (
                            <span className="text-gray-500">{task.expected_story_points}</span>
                          )}
                        </td>

                        {/* Actual SP — editable number */}
                        <td className="px-[13px] py-[10px] whitespace-nowrap text-center">
                          <NumberCell task={task} field="actual_story_points"
                            editing={isEditing(task.id, "actual_story_points")}
                            onStartEdit={() => startEdit(task.id, "actual_story_points")}
                            onCommit={(v) => commitCell(task, "actual_story_points", v)}
                            onCancel={cancelEdit} />
                        </td>

                        {/* Deadline — editable text */}
                        <td className="px-[13px] py-[10px] whitespace-nowrap">
                          <TextCell task={task} field="deadline"
                            editing={isEditing(task.id, "deadline")}
                            onStartEdit={() => startEdit(task.id, "deadline")}
                            onCommit={(v) => commitCell(task, "deadline", v)}
                            onCancel={cancelEdit} />
                        </td>

                        {/* Comments — editable text */}
                        <td className="px-[13px] py-[10px]" style={{ minWidth: 140 }}>
                          <TextCell task={task} field="comments"
                            editing={isEditing(task.id, "comments")}
                            onStartEdit={() => startEdit(task.id, "comments")}
                            onCommit={(v) => commitCell(task, "comments", v)}
                            onCancel={cancelEdit} />
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
            <div className="flex items-center gap-[18px] px-[18px] py-[11px] flex-wrap"
              style={{ borderTop: "1px solid rgba(0,0,0,0.07)", background: "rgba(0,0,0,0.02)" }}>
              {[
                { label: "tasks", val: visible.length, color: "#94a3b8" },
                { label: "WIP", val: visible.filter((t) => t.stage === "WIP").length, color: "#60a5fa" },
                { label: "In Review", val: visible.filter((t) => t.stage === "Sent for Approval").length, color: "#fbbf24" },
                { label: "Closed", val: visible.filter((t) => t.stage === "Closed").length, color: "#34d399" },
                {
                  label: "SP done",
                  val: `${visible.reduce((s, t) => s + (t.actual_story_points || 0), 0)} / ${visible.reduce((s, t) => s + (t.expected_story_points || 0), 0)}`,
                  color: "#94a3b8"
                },
              ].map((s, i) => (
                <span key={s.label} className="flex items-center gap-[5px] text-[12px] text-gray-600">
                  {i > 0 && <span className="inline-block w-[1px] h-[13px] mr-[13px]" style={{ background: "rgba(0,0,0,0.07)" }} />}
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
