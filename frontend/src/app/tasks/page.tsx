"use client";

import { useEffect, useState, useCallback } from "react";
import { api, type Task, type Member } from "@/lib/api";
import { StageTag, PriorityTag } from "@/components/StageTag";

const STAGES = ["All", "WIP", "Sent for Approval", "Closed"];

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [memberFilter, setMemberFilter] = useState("All");
  const [stageFilter, setStageFilter] = useState("All");
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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tasks</h1>
          <p className="text-sm text-gray-500 mt-1">
            {tasks.length} task{tasks.length !== 1 ? "s" : ""} shown
          </p>
        </div>

        {/* Filters */}
        <div className="flex gap-2 flex-wrap">
          <select
            value={memberFilter}
            onChange={(e) => setMemberFilter(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="All">All members</option>
            {members.map((m) => (
              <option key={m.id} value={m.display_name}>{m.display_name}</option>
            ))}
          </select>

          <div className="flex border border-gray-300 rounded-lg overflow-hidden shadow-sm bg-white">
            {STAGES.map((s) => (
              <button
                key={s}
                onClick={() => setStageFilter(s)}
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                  stageFilter === s
                    ? "bg-brand-600 text-white"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">{error}</div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400 animate-pulse">Loading tasks…</div>
        ) : tasks.length === 0 ? (
          <div className="p-10 text-center text-gray-400">No tasks match these filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100 text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
                <tr>
                  {["Member", "Task", "Brand", "Activity", "Priority", "Stage", "SP (Exp/Act)", "Deadline"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {tasks.map((task) => (
                  <tr
                    key={task.id}
                    className={`transition-colors hover:bg-gray-50 ${editing === task.id ? "opacity-60" : ""}`}
                  >
                    <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-700">
                      {task.member_name}
                    </td>
                    <td className="px-4 py-3 max-w-xs">
                      <p className="font-medium text-gray-900 truncate">{task.sprint_backlog}</p>
                      {task.comments && (
                        <p className="text-xs text-gray-400 truncate mt-0.5">{task.comments}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-600">{task.brand || "—"}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-600">{task.activity_type || "—"}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <PriorityTag priority={task.priority} />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <select
                        value={task.stage}
                        disabled={editing === task.id}
                        onChange={(e) => updateStage(task, e.target.value as Task["stage"])}
                        className="text-xs border border-gray-200 rounded-md px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-brand-500"
                      >
                        <option>WIP</option>
                        <option>Sent for Approval</option>
                        <option>Closed</option>
                      </select>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-gray-500">{task.expected_story_points} / </span>
                      <input
                        type="number"
                        min={0}
                        max={20}
                        defaultValue={task.actual_story_points}
                        disabled={editing === task.id}
                        onBlur={(e) => {
                          const v = parseInt(e.target.value);
                          if (!isNaN(v) && v !== task.actual_story_points) {
                            updateActualSP(task, v);
                          }
                        }}
                        className="w-10 text-xs border border-gray-200 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-brand-500"
                      />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-500 text-xs">
                      {task.deadline || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
