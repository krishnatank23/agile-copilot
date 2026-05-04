"use client";

import { useEffect, useState } from "react";
import { api, type Workspace } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

function Field({
  label, id, type = "text", value, onChange, placeholder, hint,
}: {
  label: string; id: string; type?: string; value: string;
  onChange: (v: string) => void; placeholder?: string; hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-[12px] font-medium text-slate-400">{label}</label>
      <input
        id={id} type={type} value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="px-3 py-2 rounded-[8px] text-[13px] text-slate-100 placeholder:text-slate-600 outline-none transition-colors"
        style={{ background: "#09090f", border: "1px solid rgba(255,255,255,0.07)" }}
        onFocus={(e) => ((e.target as HTMLElement).style.borderColor = "rgba(217,70,239,0.4)")}
        onBlur={(e) => ((e.target as HTMLElement).style.borderColor = "rgba(255,255,255,0.07)")}
      />
      {hint && <p className="text-[11px] text-slate-600">{hint}</p>}
    </div>
  );
}

function StatusBadge({ connected }: { connected: boolean }) {
  return (
    <span
      className="px-[10px] py-[2px] rounded-full text-[11px] font-semibold"
      style={
        connected
          ? { background: "rgba(16,185,129,0.12)", color: "#34d399" }
          : { background: "rgba(255,255,255,0.06)", color: "#475569" }
      }
    >
      {connected ? "Connected" : "Not connected"}
    </span>
  );
}

function WorkspaceCard({ ws, isSuperAdmin, onUpdated, onDeleted }: {
  ws: Workspace; isSuperAdmin: boolean;
  onUpdated: (ws: Workspace) => void; onDeleted: (id: number) => void;
}) {
  const [teamsAgileChat, setTeamsAgileChat] = useState(ws.teams_agile_chat_id);
  const [slackChannel, setSlackChannel] = useState(ws.slack_channel_id);
  const [saving, setSaving] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const [msg, setMsg] = useState("");

  async function save() {
    setSaving(true); setMsg("");
    try {
      const updated = await api.workspaces.update(ws.id, {
        teams_agile_chat_id: teamsAgileChat || undefined,
        slack_channel_id: slackChannel || undefined,
      });
      onUpdated(updated as unknown as Workspace);
      setMsg("Saved.");
    } catch { setMsg("Save failed."); }
    finally { setSaving(false); }
  }

  async function subscribe() {
    setSubscribing(true); setMsg("");
    try {
      await api.workspaces.subscribe(ws.id);
      setMsg("Graph subscription registered.");
    } catch (e: unknown) {
      setMsg(`Subscribe failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally { setSubscribing(false); }
  }

  async function remove() {
    if (!confirm(`Delete workspace "${ws.name}"? This will remove all its members and tasks.`)) return;
    try { await api.workspaces.delete(ws.id); onDeleted(ws.id); }
    catch { setMsg("Delete failed."); }
  }

  return (
    <div
      className="rounded-[12px] p-5 flex flex-col gap-4"
      style={{ background: "#11111b", border: "1px solid rgba(255,255,255,0.07)" }}
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[14px] font-semibold text-slate-100">{ws.name}</p>
          <p className="text-[11px] text-slate-600 mt-[2px] capitalize">{ws.platform} workspace</p>
        </div>
        <div className="flex gap-2 items-center">
          {(ws.platform === "teams" || ws.platform === "both") && <StatusBadge connected={ws.teams_connected} />}
          {(ws.platform === "slack" || ws.platform === "both") && <StatusBadge connected={ws.slack_connected} />}
          {isSuperAdmin && ws.id !== 1 && (
            <button onClick={remove} className="text-[11px] text-red-500 hover:text-red-400 ml-1 transition-colors">Delete</button>
          )}
        </div>
      </div>

      {/* Teams section */}
      {(ws.platform === "teams" || ws.platform === "both") && ws.teams_connected && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>

          {/* Super admin sees credentials; manager only sees chat IDs */}
          {isSuperAdmin ? (
            <>
              <div>
                <p className="text-[11px] text-slate-600 font-medium mb-[3px]">Tenant ID</p>
                <p className="text-[11px] font-mono text-slate-400 truncate">{ws.azure_tenant_id || "—"}</p>
              </div>
              <div>
                <p className="text-[11px] text-slate-600 font-medium mb-[3px]">Client ID</p>
                <p className="text-[11px] font-mono text-slate-400 truncate">{ws.azure_client_id || "—"}</p>
              </div>
            </>
          ) : (
            <div className="sm:col-span-2 flex items-center gap-2 px-3 py-2 rounded-[8px]"
              style={{ background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.12)" }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth={2} className="w-[13px] h-[13px] flex-shrink-0">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
              <p className="text-[11px]" style={{ color: "#60a5fa" }}>
                Azure credentials managed by your admin.
              </p>
            </div>
          )}

          <div>
            <p className="text-[11px] text-slate-600 font-medium mb-[3px]">EOD Chat ID</p>
            <p className="text-[11px] font-mono text-slate-400 truncate">{ws.teams_chat_id || "—"}</p>
          </div>

          <div className="sm:col-span-2">
            <Field label="Summary Chat ID" id={`agile-chat-${ws.id}`} value={teamsAgileChat} onChange={setTeamsAgileChat}
              placeholder={ws.teams_chat_id} hint="Where morning/WIP summaries are sent. Defaults to EOD chat." />
          </div>

          {/* Subscription management — super admin only */}
          {isSuperAdmin && (
            <>
              <div>
                <p className="text-[11px] text-slate-600 font-medium mb-[3px]">Subscription</p>
                <p className="text-[11px] font-mono text-slate-400 truncate">{ws.teams_subscription_id || "Not registered"}</p>
              </div>
              <div className="flex items-end">
                <button
                  onClick={subscribe} disabled={subscribing}
                  className="text-[12px] px-4 py-[7px] rounded-[8px] font-medium transition-colors disabled:opacity-50"
                  style={{ background: "rgba(59,130,246,0.15)", color: "#60a5fa", border: "1px solid rgba(59,130,246,0.2)" }}
                >
                  {subscribing ? "Registering…" : "Register Subscription"}
                </button>
              </div>
              <div className="sm:col-span-2">
                <a href={`/api/workspaces/${ws.id}/login`} className="text-[12px] text-fuchsia-400 hover:text-fuchsia-300 transition-colors">
                  Sign in with Microsoft (enable sending messages) →
                </a>
              </div>
            </>
          )}
        </div>
      )}

      {/* Slack section */}
      {(ws.platform === "slack" || ws.platform === "both") && ws.slack_connected && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
          {isSuperAdmin && (
            <div>
              <p className="text-[11px] text-slate-600 font-medium mb-[3px]">Slack Team ID</p>
              <p className="text-[11px] font-mono text-slate-400">{ws.slack_team_id || "—"}</p>
            </div>
          )}
          <Field label="Notification Channel ID" id={`slack-channel-${ws.id}`} value={slackChannel}
            onChange={setSlackChannel} placeholder="C0XXXXXXXXX"
            hint="Channel where morning summaries and WIP reports are posted." />
        </div>
      )}

      <div className="flex items-center gap-3 pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
        <button
          onClick={save} disabled={saving}
          className="text-[12px] px-4 py-[7px] rounded-[8px] font-medium transition-colors disabled:opacity-50"
          style={{ background: "rgba(217,70,239,0.15)", color: "#e879f9", border: "1px solid rgba(217,70,239,0.2)" }}
        >
          {saving ? "Saving…" : "Save Changes"}
        </button>
        {msg && <p className="text-[11px] text-slate-600">{msg}</p>}
      </div>
    </div>
  );
}

function AddTeamsForm({ onCreated }: { onCreated: (ws: Workspace) => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [form, setForm] = useState({
    name: "", azure_tenant_id: "", azure_client_id: "",
    azure_client_secret: "", teams_chat_id: "", teams_agile_chat_id: "", teams_webhook_url: "",
  });

  function set(key: string, val: string) { setForm((f) => ({ ...f, [key]: val })); }

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr("");
    try {
      const result = await api.workspaces.connectTeams(form) as { workspace: Workspace };
      onCreated(result.workspace); setOpen(false);
      setForm({ name: "", azure_tenant_id: "", azure_client_id: "", azure_client_secret: "", teams_chat_id: "", teams_agile_chat_id: "", teams_webhook_url: "" });
    } catch { setErr("Failed to connect. Check credentials and try again."); }
    finally { setBusy(false); }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-3 rounded-[12px] text-[13px] text-slate-600 transition-colors w-full"
        style={{ border: "2px dashed rgba(255,255,255,0.1)" }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(217,70,239,0.3)"; (e.currentTarget as HTMLElement).style.color = "#e879f9"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.1)"; (e.currentTarget as HTMLElement).style.color = "#475569"; }}
      >
        <span className="text-[18px] leading-none">+</span> Connect Teams Workspace
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-[12px] p-5 flex flex-col gap-4" style={{ background: "#11111b", border: "1px solid rgba(217,70,239,0.2)" }}>
      <div className="flex items-center justify-between">
        <p className="font-semibold text-[14px] text-slate-100">Connect MS Teams Workspace</p>
        <button type="button" onClick={() => setOpen(false)} className="text-slate-600 hover:text-slate-400 text-[20px] leading-none">×</button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Workspace name" id="ws-name" value={form.name} onChange={(v) => set("name", v)} placeholder="My Team" />
        <Field label="Azure Tenant ID" id="ws-tid" value={form.azure_tenant_id} onChange={(v) => set("azure_tenant_id", v)} placeholder="xxxxxxxx-xxxx-…" />
        <Field label="Azure Client ID" id="ws-cid" value={form.azure_client_id} onChange={(v) => set("azure_client_id", v)} placeholder="xxxxxxxx-xxxx-…" />
        <Field label="Azure Client Secret" id="ws-cs" type="password" value={form.azure_client_secret} onChange={(v) => set("azure_client_secret", v)} placeholder="ciS8Q…" />
        <Field label="EOD Chat ID" id="ws-chat" value={form.teams_chat_id} onChange={(v) => set("teams_chat_id", v)} placeholder="19:xxx…@thread.v2" hint="The Teams chat where members post EOD updates." />
        <Field label="Summary Chat ID" id="ws-agile" value={form.teams_agile_chat_id} onChange={(v) => set("teams_agile_chat_id", v)} placeholder="19:xxx…@thread.v2" hint="Where morning/WIP summaries are sent." />
        <div className="sm:col-span-2">
          <Field label="Webhook URL" id="ws-wh" value={form.teams_webhook_url} onChange={(v) => set("teams_webhook_url", v)} placeholder="https://your-server.com" hint="Public HTTPS URL where Graph API sends notifications." />
        </div>
      </div>
      {err && <p className="text-[12px]" style={{ color: "#f87171" }}>{err}</p>}
      <div className="flex gap-3">
        <button type="submit" disabled={busy}
          className="px-5 py-2 rounded-[8px] text-[12px] font-medium transition-colors disabled:opacity-50"
          style={{ background: "rgba(217,70,239,0.15)", color: "#e879f9", border: "1px solid rgba(217,70,239,0.2)" }}
        >
          {busy ? "Connecting…" : "Connect"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="px-4 py-2 text-[12px] text-slate-600 hover:text-slate-400 transition-colors">
          Cancel
        </button>
      </div>
    </form>
  );
}

export default function SettingsPage() {
  const { user } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const isSuperAdmin = user?.role === "super_admin";

  useEffect(() => {
    api.workspaces.list()
      .then(setWorkspaces)
      .catch(() => setError("Could not load workspaces — is the backend running?"))
      .finally(() => setLoading(false));
  }, []);

  if (user?.role === "member") {
    return (
      <div className="p-[26px] flex items-center justify-center min-h-[300px]">
        <p className="text-[13px] text-slate-600">You don&apos;t have access to this page.</p>
      </div>
    );
  }

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
          <h1 className="text-[19px] font-bold text-slate-100 tracking-[-0.5px]">
            {isSuperAdmin ? "Workspaces" : "Connections"}
          </h1>
          <p className="text-[11.5px] text-slate-600 mt-[2px]">
            {isSuperAdmin
              ? `${workspaces.length} workspace${workspaces.length !== 1 ? "s" : ""} · manage Teams and Slack connections`
              : "Connect Teams and Slack workspaces. Each has its own credentials and chat routing."}
          </p>
        </div>
      </div>

      <div className="p-[26px] flex flex-col gap-[14px] max-w-3xl">
        {error && (
          <div className="rounded-[10px] px-4 py-3 text-sm" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", color: "#f87171" }}>
            {error}
          </div>
        )}

        {loading ? (
          <>
            {[1, 2].map((i) => (
              <div key={i} className="h-32 rounded-[12px] animate-pulse" style={{ background: "#11111b", border: "1px solid rgba(255,255,255,0.07)" }} />
            ))}
          </>
        ) : (
          <>
            {workspaces.map((ws) => (
              <WorkspaceCard
                key={ws.id} ws={ws} isSuperAdmin={isSuperAdmin}
                onUpdated={(updated) => setWorkspaces((ws) => ws.map((w) => (w.id === updated.id ? updated : w)))}
                onDeleted={(id) => setWorkspaces((prev) => prev.filter((w) => w.id !== id))}
              />
            ))}

            {isSuperAdmin && <AddTeamsForm onCreated={(ws) => setWorkspaces((prev) => [...prev, ws])} />}

            {isSuperAdmin && <a
              href="/api/slack/install"
              className="flex items-center gap-2 px-4 py-3 rounded-[12px] text-[13px] text-slate-600 transition-colors"
              style={{ border: "2px dashed rgba(255,255,255,0.1)" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(139,92,246,0.35)"; (e.currentTarget as HTMLElement).style.color = "#a78bfa"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.1)"; (e.currentTarget as HTMLElement).style.color = "#475569"; }}
            >
              <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 54 54" fill="currentColor">
                <path d="M19.712.133a5.381 5.381 0 0 0-5.376 5.387 5.381 5.381 0 0 0 5.376 5.386h5.376V5.52A5.381 5.381 0 0 0 19.712.133m0 14.365H5.376A5.381 5.381 0 0 0 0 19.884a5.381 5.381 0 0 0 5.376 5.387h14.336a5.381 5.381 0 0 0 5.376-5.387 5.381 5.381 0 0 0-5.376-5.386"/>
                <path d="M53.76 19.884a5.381 5.381 0 0 0-5.376-5.386 5.381 5.381 0 0 0-5.376 5.386v5.387h5.376a5.381 5.381 0 0 0 5.376-5.387m-14.336 0V5.52A5.381 5.381 0 0 0 34.048.133a5.381 5.381 0 0 0-5.376 5.387v14.364a5.381 5.381 0 0 0 5.376 5.387 5.381 5.381 0 0 0 5.376-5.387"/>
                <path d="M34.048 54a5.381 5.381 0 0 0 5.376-5.387 5.381 5.381 0 0 0-5.376-5.386h-5.376v5.386A5.381 5.381 0 0 0 34.048 54m0-14.365h14.336a5.381 5.381 0 0 0 5.376-5.386 5.381 5.381 0 0 0-5.376-5.387H34.048a5.381 5.381 0 0 0-5.376 5.387 5.381 5.381 0 0 0 5.376 5.386"/>
                <path d="M0 34.249a5.381 5.381 0 0 0 5.376 5.386 5.381 5.381 0 0 0 5.376-5.386v-5.387H5.376A5.381 5.381 0 0 0 0 34.249m14.336 0v14.364A5.381 5.381 0 0 0 19.712 54a5.381 5.381 0 0 0 5.376-5.387V34.249a5.381 5.381 0 0 0-5.376-5.387 5.381 5.381 0 0 0-5.376 5.387"/>
              </svg>
              Add Slack Workspace via OAuth
            </a>}
          </>
        )}

        {/* How it works */}
        <div className="rounded-[12px] p-5 text-[12.5px] text-slate-600 flex flex-col gap-2 mt-2" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <p className="font-semibold text-slate-400">How connections work</p>
          <ul className="list-disc list-inside space-y-1">
            <li><span className="text-slate-300">Teams:</span> Paste your Azure app credentials. Notifications are routed by workspace ID in clientState.</li>
            <li><span className="text-slate-300">Slack:</span> Click "Add Slack Workspace" — approve the app and a bot token is stored automatically.</li>
            <li>Members are auto-created the first time someone posts an EOD in either platform.</li>
            <li>The default workspace (id=1) is seeded from your <code className="font-mono text-slate-400">.env</code> file.</li>
          </ul>
        </div>
      </div>
    </>
  );
}
