"use client";

import { useEffect, useState } from "react";
import { api, type SprintProgress } from "@/lib/api";
import SprintProgressCard from "@/components/SprintProgress";

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
      expected: acc.expected + p.expected_sp,
      actual: acc.actual + p.actual_sp,
    }),
    { tasks: 0, wip: 0, closed: 0, expected: 0, actual: 0 }
  );
  const teamPct = totals.expected > 0 ? Math.round((totals.actual / totals.expected) * 100) : 0;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Sprint Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Live view of the current sprint across all members.</p>
      </div>

      {/* Team totals strip */}
      {!loading && !error && progress.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          {[
            { label: "Team Progress", value: `${teamPct}%`, color: "text-brand-600" },
            { label: "Total Tasks", value: totals.tasks, color: "text-gray-700" },
            { label: "WIP", value: totals.wip, color: "text-blue-600" },
            { label: "In Review", value: totals.closed, color: "text-yellow-600" },
            { label: "Closed", value: totals.closed, color: "text-green-600" },
          ].map((s) => (
            <div key={s.label} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
              <p className="text-xs text-gray-500 mb-1">{s.label}</p>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-xl p-5 h-32 animate-pulse" />
          ))}
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">
          {error}
        </div>
      )}

      {!loading && !error && progress.length === 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-10 text-center text-gray-400">
          No sprint data yet. Once team members post EOD updates in Teams or Slack, tasks will appear here.
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {progress.map((p) => (
          <SprintProgressCard key={p.member_id} data={p} />
        ))}
      </div>
    </div>
  );
}
