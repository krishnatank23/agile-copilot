"use client";

import { useEffect, useState } from "react";
import { api, type Member, type SprintProgress } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

const MEMBER_COLORS: Record<string, string> = {
  Dhwani: "#d946ef", Shaily: "#8b5cf6", Shriya: "#3b82f6",
  Ravi: "#10b981", Yash: "#f59e0b", Yogini: "#ec4899",
  Kriishna: "#06b6d4", Harshil: "#f97316", Rinal: "#14b8a6", Prince: "#6366f1",
};

function memberColor(name: string) { return MEMBER_COLORS[name] ?? "#64748b"; }
function initials(name: string) { return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase(); }

function CreateLoginModal({
  member,
  onClose,
  onCreated,
}: {
  member: Member;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [username, setUsername] = useState(member.display_name.toLowerCase().replace(/\s+/g, ""));
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr("");
    try {
      await api.auth.createUser({ username, password, role: "member", member_id: member.id });
      onCreated();
      onClose();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed to create login");
    } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.7)" }}>
      <form
        onSubmit={submit}
        className="rounded-[14px] p-6 flex flex-col gap-4 w-full max-w-sm"
        style={{ background: "#11111b", border: "1px solid rgba(217,70,239,0.2)" }}
      >
        <div className="flex items-center justify-between">
          <p className="text-[14px] font-semibold text-slate-100">Create Login — {member.display_name}</p>
          <button type="button" onClick={onClose} className="text-slate-600 hover:text-slate-400 text-[20px] leading-none">×</button>
        </div>
        <div className="flex flex-col gap-[6px]">
          <label className="text-[12px] font-medium text-slate-400">Username</label>
          <input value={username} onChange={(e) => setUsername(e.target.value)} required
            className="px-3 py-2 rounded-[8px] text-[13px] text-slate-100 outline-none"
            style={{ background: "#09090f", border: "1px solid rgba(255,255,255,0.07)" }} />
        </div>
        <div className="flex flex-col gap-[6px]">
          <label className="text-[12px] font-medium text-slate-400">Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
            placeholder="Min 6 characters"
            className="px-3 py-2 rounded-[8px] text-[13px] text-slate-100 outline-none placeholder:text-slate-600"
            style={{ background: "#09090f", border: "1px solid rgba(255,255,255,0.07)" }} />
        </div>
        {err && <p className="text-[11px]" style={{ color: "#f87171" }}>{err}</p>}
        <div className="flex gap-3 pt-1">
          <button type="submit" disabled={busy}
            className="flex-1 py-2 rounded-[8px] text-[12px] font-semibold disabled:opacity-50"
            style={{ background: "linear-gradient(135deg,#d946ef,#9333ea)", color: "#fff" }}>
            {busy ? "Creating…" : "Create Login"}
          </button>
          <button type="button" onClick={onClose} className="px-4 py-2 text-[12px] text-slate-600 hover:text-slate-400">Cancel</button>
        </div>
      </form>
    </div>
  );
}

function AddMemberModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (member: Member, createdLogin: boolean) => void;
}) {
  const [displayName, setDisplayName] = useState("");
  const [createLoginNow, setCreateLoginNow] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  function normalizeUsername(name: string) {
    return name.toLowerCase().replace(/\s+/g, "").replace(/[^a-z0-9_.-]/g, "");
  }

  function onDisplayNameChange(name: string) {
    setDisplayName(name);
    if (!username) {
      setUsername(normalizeUsername(name));
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      const created = await api.members.create({ display_name: displayName.trim() });
      let createdLogin = false;
      if (createLoginNow) {
        if (!username.trim() || !password.trim()) {
          throw new Error("Username and password are required to create login");
        }
        await api.auth.createUser({
          username: username.trim(),
          password: password.trim(),
          role: "member",
          member_id: created.id,
        });
        createdLogin = true;
      }
      onCreated(created, createdLogin);
      onClose();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed to add member");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.7)" }}>
      <form
        onSubmit={submit}
        className="rounded-[14px] p-6 flex flex-col gap-4 w-full max-w-sm"
        style={{ background: "#11111b", border: "1px solid rgba(217,70,239,0.2)" }}
      >
        <div className="flex items-center justify-between">
          <p className="text-[14px] font-semibold text-slate-100">Add Team Member</p>
          <button type="button" onClick={onClose} className="text-slate-600 hover:text-slate-400 text-[20px] leading-none">x</button>
        </div>
        <div className="flex flex-col gap-[6px]">
          <label className="text-[12px] font-medium text-slate-400">Display Name</label>
          <input
            value={displayName}
            onChange={(e) => onDisplayNameChange(e.target.value)}
            required
            placeholder="e.g. Priya Shah"
            className="px-3 py-2 rounded-[8px] text-[13px] text-slate-100 outline-none placeholder:text-slate-600"
            style={{ background: "#09090f", border: "1px solid rgba(255,255,255,0.07)" }}
          />
        </div>
        <label className="flex items-center gap-2 text-[12px] text-slate-400">
          <input
            type="checkbox"
            checked={createLoginNow}
            onChange={(e) => setCreateLoginNow(e.target.checked)}
          />
          Create login now
        </label>
        {createLoginNow && (
          <>
            <div className="flex flex-col gap-[6px]">
              <label className="text-[12px] font-medium text-slate-400">Username</label>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required={createLoginNow}
                placeholder="e.g. priyashah"
                className="px-3 py-2 rounded-[8px] text-[13px] text-slate-100 outline-none placeholder:text-slate-600"
                style={{ background: "#09090f", border: "1px solid rgba(255,255,255,0.07)" }}
              />
            </div>
            <div className="flex flex-col gap-[6px]">
              <label className="text-[12px] font-medium text-slate-400">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required={createLoginNow}
                placeholder="Set temporary password"
                className="px-3 py-2 rounded-[8px] text-[13px] text-slate-100 outline-none placeholder:text-slate-600"
                style={{ background: "#09090f", border: "1px solid rgba(255,255,255,0.07)" }}
              />
            </div>
          </>
        )}
        {err && <p className="text-[11px]" style={{ color: "#f87171" }}>{err}</p>}
        <div className="flex gap-3 pt-1">
          <button
            type="submit"
            disabled={busy}
            className="flex-1 py-2 rounded-[8px] text-[12px] font-semibold disabled:opacity-50"
            style={{ background: "linear-gradient(135deg,#d946ef,#9333ea)", color: "#fff" }}
          >
            {busy ? "Adding..." : "Add Member"}
          </button>
          <button type="button" onClick={onClose} className="px-4 py-2 text-[12px] text-slate-600 hover:text-slate-400">Cancel</button>
        </div>
      </form>
    </div>
  );
}

export default function MembersPage() {
  const { user } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [progress, setProgress] = useState<SprintProgress[]>([]);
  const [existingUsers, setExistingUsers] = useState<{ member_id: number | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [createFor, setCreateFor] = useState<Member | null>(null);
  const [showAddMember, setShowAddMember] = useState(false);

  const isManager = user?.role === "manager" || user?.role === "super_admin";

  useEffect(() => {
    const fetches: Promise<void>[] = [
      Promise.all([api.members.list(), api.dashboard.sprintProgress()])
        .then(([m, p]) => { setMembers(m); setProgress(p); })
        .catch(() => setError("Could not load member data.")),
    ];
    if (isManager) {
      fetches.push(
        api.auth.listUsers().then(setExistingUsers).catch(() => {})
      );
    }
    Promise.all(fetches).finally(() => setLoading(false));
  }, [isManager]);

  const progressByMember = Object.fromEntries(progress.map((p) => [p.member, p]));
  const usedMemberIds = new Set(existingUsers.map((u) => u.member_id).filter(Boolean));

  return (
    <>
      {createFor && (
        <CreateLoginModal
          member={createFor}
          onClose={() => setCreateFor(null)}
          onCreated={() => {
            setExistingUsers((prev) => [...prev, { member_id: createFor.id }]);
          }}
        />
      )}

      {showAddMember && (
        <AddMemberModal
          onClose={() => setShowAddMember(false)}
          onCreated={(created, createdLogin) => {
            setMembers((prev) => [created, ...prev]);
            if (createdLogin) {
              setExistingUsers((prev) => [...prev, { member_id: created.id }]);
            }
          }}
        />
      )}

      {/* Topbar */}
      <div className="sticky top-0 z-10 flex items-center justify-between px-[26px] py-[13px]"
        style={{ background: "rgba(9,9,15,0.88)", backdropFilter: "blur(14px)", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        <div>
          <h1 className="text-[19px] font-bold text-slate-100 tracking-[-0.5px]">
            {user?.role === "super_admin" ? "All Members" : isManager ? "Team Members" : "My Profile"}
          </h1>
          <p className="text-[11.5px] text-slate-600 mt-[2px]">
            {isManager
              ? `${members.length} member${members.length !== 1 ? "s" : ""} · add manually or auto-create on first EOD`
              : "Your sprint summary"}
          </p>
        </div>
        {isManager && (
          <button
            onClick={() => setShowAddMember(true)}
            className="px-3 py-2 rounded-[9px] text-[12px] font-semibold"
            style={{ background: "linear-gradient(135deg,#d946ef,#9333ea)", color: "#fff" }}
          >
            + Add Member
          </button>
        )}
      </div>

      <div className="p-[26px]">
        {error && (
          <div className="rounded-[10px] px-4 py-3 text-sm mb-5" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", color: "#f87171" }}>{error}</div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-[13px]">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-[130px] rounded-[12px] animate-pulse" style={{ background: "#11111b", border: "1px solid rgba(255,255,255,0.07)" }} />
            ))}
          </div>
        ) : members.length === 0 ? (
          <div className="rounded-[12px] px-[18px] py-12 text-center text-[13px] text-slate-600" style={{ background: "#11111b", border: "1px solid rgba(255,255,255,0.07)" }}>
            <p>No members yet.</p>
            {isManager && (
              <button
                onClick={() => setShowAddMember(true)}
                className="mt-4 px-4 py-2 rounded-[9px] text-[12px] font-semibold"
                style={{ background: "linear-gradient(135deg,#d946ef,#9333ea)", color: "#fff" }}
              >
                + Add your first member
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-[13px]">
            {members.map((m) => {
              const p = progressByMember[m.display_name];
              const color = memberColor(m.display_name);
              const pct = p && p.expected_sp > 0 ? Math.round((p.actual_sp / p.expected_sp) * 100) : 0;
              const hasLogin = usedMemberIds.has(m.id);
              return (
                <div key={m.id} className="rounded-[12px] p-5 flex flex-col gap-4 transition-all hover:-translate-y-px"
                  style={{ background: "#11111b", border: "1px solid rgba(255,255,255,0.07)" }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.borderColor = "rgba(217,70,239,0.25)")}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.07)")}>

                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0 flex items-center justify-center rounded-full text-[12px] font-bold text-white"
                      style={{ width: 40, height: 40, background: color }}>
                      {initials(m.display_name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-semibold text-slate-100">{m.display_name}</p>
                      <p className="text-[11px] text-slate-600">Joined {new Date(m.created_at).toLocaleDateString()}</p>
                    </div>
                    {isManager && (
                      hasLogin ? (
                        <span className="text-[10px] px-[8px] py-[3px] rounded-full flex-shrink-0"
                          style={{ background: "rgba(16,185,129,0.1)", color: "#34d399" }}>
                          Has login
                        </span>
                      ) : (
                        <button onClick={() => setCreateFor(m)}
                          className="text-[10px] px-[8px] py-[3px] rounded-full flex-shrink-0 transition-colors"
                          style={{ background: "rgba(217,70,239,0.1)", color: "#e879f9", border: "1px solid rgba(217,70,239,0.2)" }}>
                          + Login
                        </button>
                      )
                    )}
                  </div>

                  {p ? (
                    <>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        {[
                          { label: "WIP",       val: p.wip,               bg: "rgba(59,130,246,.1)",  color: "#60a5fa" },
                          { label: "In Review", val: p.sent_for_approval,  bg: "rgba(245,158,11,.1)", color: "#fbbf24" },
                          { label: "Closed",    val: p.closed,             bg: "rgba(16,185,129,.1)", color: "#34d399" },
                        ].map((s) => (
                          <div key={s.label} className="rounded-[8px] py-2" style={{ background: s.bg }}>
                            <p className="text-[18px] font-bold" style={{ color: s.color }}>{s.val}</p>
                            <p className="text-[11px] text-slate-600">{s.label}</p>
                          </div>
                        ))}
                      </div>
                      <div>
                        <div className="flex justify-between text-[11px] text-slate-600 mb-[6px]">
                          <span>{p.actual_sp} / {p.expected_sp} SP</span>
                          <span style={{ color: pct >= 80 ? "#34d399" : pct >= 50 ? "#e879f9" : "#fbbf24" }}>{pct}%</span>
                        </div>
                        <div className="h-[4px] rounded-full" style={{ background: "rgba(255,255,255,0.07)" }}>
                          <div className="h-full rounded-full transition-all"
                            style={{ width: `${Math.min(pct, 100)}%`, background: pct >= 80 ? "#10b981" : pct >= 50 ? "#d946ef" : "#f59e0b" }} />
                        </div>
                      </div>
                    </>
                  ) : (
                    <p className="text-[12px] text-slate-600">No tasks this sprint.</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
