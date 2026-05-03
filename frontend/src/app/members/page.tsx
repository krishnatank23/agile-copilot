"use client";

import { useEffect, useState } from "react";
import { api, type Member, type SprintProgress } from "@/lib/api";

export default function MembersPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [progress, setProgress] = useState<SprintProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([api.members.list(), api.dashboard.sprintProgress()])
      .then(([m, p]) => { setMembers(m); setProgress(p); })
      .catch(() => setError("Could not load member data."))
      .finally(() => setLoading(false));
  }, []);

  const progressByMember = Object.fromEntries(progress.map((p) => [p.member, p]));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Team Members</h1>
        <p className="text-sm text-gray-500 mt-1">
          Members are auto-created when they post EOD updates for the first time.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">{error}</div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-28 bg-white border border-gray-200 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : members.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-10 text-center text-gray-400">
          No members yet. Members are added automatically when they post EOD updates in Teams or Slack.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {members.map((m) => {
            const p = progressByMember[m.display_name];
            return (
              <div key={m.id} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-brand-100 text-brand-700 font-bold flex items-center justify-center text-base">
                    {m.display_name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{m.display_name}</p>
                    <p className="text-xs text-gray-400">
                      Joined {new Date(m.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                {p && (
                  <div className="grid grid-cols-3 gap-2 text-center mt-1">
                    {[
                      { label: "WIP", value: p.wip, color: "text-blue-600" },
                      { label: "Review", value: p.sent_for_approval, color: "text-yellow-600" },
                      { label: "Closed", value: p.closed, color: "text-green-600" },
                    ].map((s) => (
                      <div key={s.label} className="bg-gray-50 rounded-lg py-2">
                        <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                        <p className="text-xs text-gray-400">{s.label}</p>
                      </div>
                    ))}
                  </div>
                )}
                {p && (
                  <div className="text-xs text-gray-400 text-center">
                    {p.actual_sp} / {p.expected_sp} story points &nbsp;·&nbsp; {p.pct}% complete
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
