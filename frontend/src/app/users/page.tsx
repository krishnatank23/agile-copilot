"use client";

import { useEffect, useState } from "react";
import { api, type Workspace } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

interface UserRecord {
  id: number;
  username: string;
  role: string;
  member_id: number | null;
  workspace_id: number | null;
}

// ── Create Manager Modal ──────────────────────────────────────────────────────

function CreateManagerModal({
  workspaces,
  onClose,
  onCreated,
}: {
  workspaces: Workspace[];
  onClose: () => void;
  onCreated: (user: UserRecord) => void;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [workspaceId, setWorkspaceId] = useState<number | "">(
    workspaces[0]?.id ?? ""
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!workspaceId) { setErr("Please select a workspace."); return; }
    setBusy(true); setErr("");
    try {
      const created = await api.auth.createUser({
        username,
        password,
        role: "manager",
        workspace_id: Number(workspaceId),
      }) as UserRecord;
      onCreated(created);
      onClose();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed to create manager");
    } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.7)" }}>
      <form
        onSubmit={submit}
        className="rounded-[14px] p-6 flex flex-col gap-4 w-full max-w-sm"
        style={{ background: "#ffffff", border: "1px solid rgba(139,92,246,0.2)" }}
      >
        <div className="flex items-center justify-between">
          <p className="text-[14px] font-semibold text-gray-900">Create Team Manager</p>
          <button type="button" onClick={onClose} className="text-gray-600 hover:text-gray-900 text-[20px] leading-none">×</button>
        </div>

        <div className="flex flex-col gap-[6px]">
          <label className="text-[12px] font-medium text-gray-700">Workspace / Team</label>
          <select
            value={workspaceId}
            onChange={(e) => setWorkspaceId(Number(e.target.value))}
            required
            className="px-3 py-2 rounded-[8px] text-[13px] text-gray-900 outline-none"
            style={{ background: "#f9fafb", border: "1px solid rgba(0,0,0,0.1)" }}
          >
            {workspaces.map((ws) => (
              <option key={ws.id} value={ws.id}>{ws.name}</option>
            ))}
          </select>
          <p className="text-[11px] text-gray-600">This manager will only see their team&apos;s data.</p>
        </div>

        <div className="flex flex-col gap-[6px]">
          <label className="text-[12px] font-medium text-gray-700">Username</label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required placeholder="e.g. design_manager"
            className="px-3 py-2 rounded-[8px] text-[13px] text-gray-900 outline-none placeholder:text-gray-500"
            style={{ background: "#f9fafb", border: "1px solid rgba(0,0,0,0.1)" }}
          />
        </div>

        <div className="flex flex-col gap-[6px]">
          <label className="text-[12px] font-medium text-gray-700">Password</label>
          <input
            type="password" value={password}
            onChange={(e) => setPassword(e.target.value)}
            required placeholder="Min 6 characters"
            className="px-3 py-2 rounded-[8px] text-[13px] text-gray-900 outline-none placeholder:text-gray-500"
            style={{ background: "#f9fafb", border: "1px solid rgba(0,0,0,0.1)" }}
          />
        </div>

        {err && <p className="text-[11px]" style={{ color: "#dc2626" }}>{err}</p>}

        <div className="flex gap-3 pt-1">
          <button
            type="submit" disabled={busy}
            className="flex-1 py-2 rounded-[8px] text-[12px] font-semibold disabled:opacity-50"
            style={{ background: "linear-gradient(135deg,#d946ef,#9333ea)", color: "#fff" }}
          >
            {busy ? "Creating…" : "Create Manager"}
          </button>
          <button type="button" onClick={onClose} className="px-4 py-2 text-[12px] text-gray-600 hover:text-gray-900">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Edit User Modal ───────────────────────────────────────────────────────────

function EditUserModal({
  user,
  workspaces,
  onClose,
  onUpdated,
  onDeleted,
}: {
  user: UserRecord;
  workspaces: Workspace[];
  onClose: () => void;
  onUpdated: (u: UserRecord) => void;
  onDeleted: (id: number) => void;
}) {
  const [workspaceId, setWorkspaceId] = useState<number | "">(user.workspace_id ?? "");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [err, setErr] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr("");
    try {
      const body: { workspace_id?: number; password?: string } = {};
      if (workspaceId !== "") body.workspace_id = Number(workspaceId);
      if (password) body.password = password;
      const updated = await api.auth.updateUser(user.id, body);
      onUpdated(updated);
      onClose();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed to update user");
    } finally { setBusy(false); }
  }

  async function handleDelete() {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setDeleting(true); setErr("");
    try {
      await api.auth.deleteUser(user.id);
      onDeleted(user.id);
      onClose();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed to delete user");
    } finally { setDeleting(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.7)" }}>
      <form
        onSubmit={submit}
        className="rounded-[14px] p-6 flex flex-col gap-4 w-full max-w-sm"
        style={{ background: "#ffffff", border: "1px solid rgba(139,92,246,0.2)" }}
      >
        <div className="flex items-center justify-between">
          <p className="text-[14px] font-semibold text-gray-900">Edit — {user.username}</p>
          <button type="button" onClick={onClose} className="text-gray-600 hover:text-gray-900 text-[20px] leading-none">×</button>
        </div>

        <div className="flex flex-col gap-[6px]">
          <label className="text-[12px] font-medium text-gray-700">Workspace / Team</label>
          <select
            value={workspaceId}
            onChange={(e) => setWorkspaceId(Number(e.target.value))}
            className="px-3 py-2 rounded-[8px] text-[13px] text-gray-900 outline-none"
            style={{ background: "#f9fafb", border: "1px solid rgba(0,0,0,0.1)" }}
          >
            {workspaces.map((ws) => (
              <option key={ws.id} value={ws.id}>{ws.name}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-[6px]">
          <label className="text-[12px] font-medium text-gray-700">New Password <span className="text-gray-600">(leave blank to keep current)</span></label>
          <input
            type="password" value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Min 6 characters"
            className="px-3 py-2 rounded-[8px] text-[13px] text-gray-900 outline-none placeholder:text-gray-500"
            style={{ background: "#f9fafb", border: "1px solid rgba(0,0,0,0.1)" }}
          />
        </div>

        {err && <p className="text-[11px]" style={{ color: "#dc2626" }}>{err}</p>}

        <div className="flex gap-3 pt-1">
          <button
            type="submit" disabled={busy || deleting}
            className="flex-1 py-2 rounded-[8px] text-[12px] font-semibold disabled:opacity-50"
            style={{ background: "linear-gradient(135deg,#d946ef,#9333ea)", color: "#fff" }}
          >
            {busy ? "Saving…" : "Save Changes"}
          </button>
          <button type="button" onClick={onClose} className="px-4 py-2 text-[12px] text-gray-600 hover:text-gray-900">
            Cancel
          </button>
        </div>

        <div className="pt-1 border-t" style={{ borderColor: "rgba(0,0,0,0.1)" }}>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting || busy}
            className="w-full py-2 rounded-[8px] text-[12px] font-semibold disabled:opacity-50 transition-colors"
            style={{
              background: confirmDelete ? "rgba(239,68,68,0.1)" : "transparent",
              color: confirmDelete ? "#dc2626" : "#9ca3af",
              border: `1px solid ${confirmDelete ? "rgba(239,68,68,0.2)" : "rgba(0,0,0,0.1)"}`,
            }}
          >
            {deleting ? "Deleting…" : confirmDelete ? "Click again to confirm delete" : "Delete User"}
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Role badge ────────────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: string }) {
  const styles: Record<string, { bg: string; color: string; label: string }> = {
    super_admin: { bg: "rgba(245,158,11,0.1)", color: "#d97706", label: "Super Admin" },
    manager: { bg: "rgba(139,92,246,0.1)", color: "#7c3aed", label: "Manager" },
    member: { bg: "rgba(59,130,246,0.1)", color: "#2563eb", label: "Member" },
  };
  const s = styles[role] ?? { bg: "rgba(0,0,0,0.06)", color: "#6b7280", label: role };
  return (
    <span className="text-[10px] px-[8px] py-[3px] rounded-full font-semibold" style={{ background: s.bg, color: s.color }}>
      {s.label}
    </span>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function UsersPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editUser, setEditUser] = useState<UserRecord | null>(null);
  const [expandedManagerId, setExpandedManagerId] = useState<number | null>(null);

  useEffect(() => {
    Promise.all([
      api.auth.listUsers() as Promise<UserRecord[]>,
      api.workspaces.list(),
    ])
      .then(([u, w]) => { setUsers(u); setWorkspaces(w); })
      .catch(() => setError("Could not load data — is the backend running?"))
      .finally(() => setLoading(false));
  }, []);

  if (user?.role !== "super_admin") {
    return (
      <div className="p-[26px] flex items-center justify-center min-h-[300px]">
        <p className="text-[13px] text-gray-600">Super admin access required.</p>
      </div>
    );
  }

  const wsMap = Object.fromEntries(workspaces.map((w) => [w.id, w.name]));
  const managers = users.filter((u) => u.role === "manager");
  const superAdmins = users.filter((u) => u.role === "super_admin");
  const members = users.filter((u) => u.role === "member");

  // Group member accounts by workspace_id
  const membersByWorkspace: Record<number, UserRecord[]> = {};
  for (const m of members) {
    const wsId = m.workspace_id ?? 0;
    if (!membersByWorkspace[wsId]) membersByWorkspace[wsId] = [];
    membersByWorkspace[wsId].push(m);
  }

  function toggleManager(managerId: number) {
    setExpandedManagerId((prev) => (prev === managerId ? null : managerId));
  }

  return (
    <>
      {showCreate && (
        <CreateManagerModal
          workspaces={workspaces}
          onClose={() => setShowCreate(false)}
          onCreated={(u) => setUsers((prev) => [...prev, u])}
        />
      )}
      {editUser && (
        <EditUserModal
          user={editUser}
          workspaces={workspaces}
          onClose={() => setEditUser(null)}
          onUpdated={(u) => { setUsers((prev) => prev.map((x) => x.id === u.id ? u : x)); setEditUser(null); }}
          onDeleted={(id) => { setUsers((prev) => prev.filter((x) => x.id !== id)); setEditUser(null); }}
        />
      )}

      {/* Topbar */}
      <div
        className="sticky top-0 z-10 flex items-center justify-between px-[26px] py-[13px]"
        style={{ background: "rgba(255,255,255,0.95)", backdropFilter: "blur(14px)", borderBottom: "1px solid rgba(0,0,0,0.07)" }}
      >
        <div>
          <h1 className="text-[19px] font-bold text-gray-900 tracking-[-0.5px]">Users & Access</h1>
          <p className="text-[11.5px] text-gray-600 mt-[2px]">
            {users.length} account{users.length !== 1 ? "s" : ""} · {managers.length} manager{managers.length !== 1 ? "s" : ""} across {workspaces.length} workspace{workspaces.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-[6px] px-[13px] py-[7px] rounded-[8px] text-[12px] font-semibold transition-colors"
          style={{ background: "linear-gradient(135deg,#d946ef,#9333ea)", color: "#fff", boxShadow: "0 0 12px rgba(217,70,239,0.3)" }}
        >
          <span className="text-[15px] leading-none">+</span>
          New Manager
        </button>
      </div>

      <div className="p-[26px] flex flex-col gap-[22px] max-w-4xl">

        {error && (
          <div className="rounded-[10px] px-4 py-3 text-sm" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", color: "#f87171" }}>
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-[56px] rounded-[10px] animate-pulse" style={{ background: "#f0f0f0", border: "1px solid rgba(0,0,0,0.07)" }} />
            ))}
          </div>
        ) : (
          <>
            {/* Super admins */}
            <Section title="Super Admins" count={superAdmins.length} color="#f59e0b">
              {superAdmins.map((u) => (
                <UserRow key={u.id} user={u} workspaceName="All workspaces" />
              ))}
            </Section>

            {/* Managers — click to expand their members */}
            <Section
              title="Team Managers"
              count={managers.length}
              color="#e879f9"
              action={<button onClick={() => setShowCreate(true)} className="text-[11px] text-fuchsia-400 hover:text-fuchsia-300 transition-colors">+ Add manager</button>}
            >
              {managers.length === 0 ? (
                <EmptyRow message="No managers yet. Click '+ Add manager' to create one." />
              ) : managers.map((mgr) => {
                const wsId = mgr.workspace_id ?? 0;
                const wsName = wsId ? (wsMap[wsId] ?? `Workspace #${wsId}`) : "—";
                const teamMembers = membersByWorkspace[wsId] ?? [];
                const isExpanded = expandedManagerId === mgr.id;

                return (
                  <div key={mgr.id}>
                    <UserRow
                      user={mgr}
                      workspaceName={wsName}
                      onEdit={() => setEditUser(mgr)}
                      expandable
                      expanded={isExpanded}
                      memberCount={teamMembers.length}
                      onToggle={() => toggleManager(mgr.id)}
                    />
                    {isExpanded && (
                      <div style={{ background: "rgba(139,92,246,0.03)", borderTop: "1px solid rgba(139,92,246,0.08)" }}>
                        {teamMembers.length === 0 ? (
                          <div className="pl-[58px] pr-[18px] py-[12px] text-[11.5px] text-gray-500">
                            No member accounts in this workspace yet.
                          </div>
                        ) : teamMembers.map((m) => (
                          <div
                            key={m.id}
                            className="flex items-center gap-4 pl-[58px] pr-[18px] py-[11px] transition-colors"
                            style={{ borderBottom: "1px solid rgba(0,0,0,0.03)" }}
                            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.02)")}
                            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "")}
                          >
                            <div
                              className="flex-shrink-0 flex items-center justify-center rounded-full text-[9px] font-bold text-white"
                              style={{ width: 26, height: 26, background: "linear-gradient(135deg,#3b82f6,#6366f1)" }}
                            >
                              {m.username.slice(0, 2).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[12.5px] font-medium text-gray-900 truncate">{m.username}</p>
                              {m.member_id && (
                                <p className="text-[11px] text-gray-500">Member ID #{m.member_id}</p>
                              )}
                            </div>
                            <RoleBadge role="member" />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </Section>
          </>
        )}

        {/* Help box */}
        <div
          className="rounded-[12px] p-5 text-[12.5px] text-gray-600 flex flex-col gap-2"
          style={{ background: "rgba(0,0,0,0.02)", border: "1px solid rgba(0,0,0,0.07)" }}
        >
          <p className="font-semibold text-gray-700">How access works</p>
          <ul className="list-disc list-inside space-y-1">
            <li><span className="text-gray-700">Super Admin:</span> Manages workspaces and user accounts across all teams.</li>
            <li><span className="text-gray-700">Manager:</span> Scoped to one workspace — sees their team&apos;s tasks and members only.</li>
            <li><span className="text-gray-700">Member:</span> Sees only their own tasks. Click a manager row to view their team.</li>
            <li>Members are auto-created when someone posts an EOD update in Teams or Slack.</li>
          </ul>
        </div>
      </div>
    </>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Section({
  title, count, color, action, children,
}: {
  title: string; count: number; color: string; action?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div className="rounded-[12px] overflow-hidden" style={{ background: "#ffffff", border: "1px solid rgba(0,0,0,0.07)" }}>
      <div
        className="flex items-center justify-between px-[18px] py-[13px]"
        style={{ borderBottom: "1px solid rgba(0,0,0,0.07)" }}
      >
        <div className="flex items-center gap-[9px]">
          <span className="text-[13px] font-semibold text-gray-900">{title}</span>
          <span
            className="text-[10px] px-[7px] py-[2px] rounded-full font-semibold"
            style={{ background: "rgba(0,0,0,0.06)", color }}
          >
            {count}
          </span>
        </div>
        {action}
      </div>
      <div>{children}</div>
    </div>
  );
}

function UserRow({
  user, workspaceName, onEdit, expandable, expanded, memberCount, onToggle,
}: {
  user: UserRecord;
  workspaceName: string;
  onEdit?: () => void;
  expandable?: boolean;
  expanded?: boolean;
  memberCount?: number;
  onToggle?: () => void;
}) {
  const initials = user.username.slice(0, 2).toUpperCase();
  const avatarColor =
    user.role === "super_admin" ? "linear-gradient(135deg,#f59e0b,#d97706)" :
      user.role === "manager" ? "linear-gradient(135deg,#d946ef,#9333ea)" :
        "linear-gradient(135deg,#3b82f6,#6366f1)";

  return (
    <div
      className="flex items-center gap-4 px-[18px] py-[13px] transition-colors group"
      style={{
        borderBottom: "1px solid rgba(0,0,0,0.04)",
        cursor: expandable ? "pointer" : "default",
        background: expanded ? "rgba(139,92,246,0.04)" : "",
      }}
      onClick={expandable ? onToggle : undefined}
      onMouseEnter={(e) => { if (!expanded) (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.02)"; }}
      onMouseLeave={(e) => { if (!expanded) (e.currentTarget as HTMLElement).style.background = ""; }}
    >
      <div
        className="flex-shrink-0 flex items-center justify-center rounded-full text-[10px] font-bold text-white"
        style={{ width: 32, height: 32, background: avatarColor }}
      >
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium text-gray-900 truncate">{user.username}</p>
        <p className="text-[11px] text-gray-600 mt-[1px] truncate">
          {workspaceName}
          {expandable && memberCount !== undefined && (
            <span className="ml-[6px]" style={{ color: "#a78bfa" }}>
              · {memberCount} member{memberCount !== 1 ? "s" : ""}
            </span>
          )}
        </p>
      </div>
      <RoleBadge role={user.role} />
      {expandable && (
        <svg
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
          className="w-[13px] h-[13px] flex-shrink-0 transition-transform"
          style={{ color: "#9ca3af", transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      )}
      {onEdit && (
        <button
          onClick={(e) => { e.stopPropagation(); onEdit(); }}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-[11px] px-[10px] py-[4px] rounded-[6px] text-gray-600 hover:text-gray-900"
          style={{ border: "1px solid rgba(0,0,0,0.1)" }}
        >
          Edit
        </button>
      )}
    </div>
  );
}

function EmptyRow({ message }: { message: string }) {
  return (
    <div className="px-[18px] py-[16px] text-[12px] text-gray-600">{message}</div>
  );
}
