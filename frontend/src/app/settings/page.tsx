"use client";

import { useEffect, useState } from "react";
import { api, type Workspace } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

// ── Shared helpers ────────────────────────────────────────────────────────────

function Field({
  label, id, type = "text", value, onChange, placeholder, hint, readOnly,
}: {
  label: string; id: string; type?: string; value: string;
  onChange?: (v: string) => void; placeholder?: string; hint?: string; readOnly?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-[12px] font-medium text-slate-400">{label}</label>
      <input
        id={id} type={type} value={value} readOnly={readOnly}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        className="px-3 py-2 rounded-[8px] text-[13px] text-slate-100 placeholder:text-slate-600 outline-none transition-colors"
        style={{
          background: "#09090f",
          border: "1px solid rgba(255,255,255,0.07)",
          cursor: readOnly ? "default" : undefined,
          color: readOnly ? "#475569" : undefined,
        }}
        onFocus={(e) => { if (!readOnly) (e.target as HTMLElement).style.borderColor = "rgba(217,70,239,0.4)"; }}
        onBlur={(e) => { if (!readOnly) (e.target as HTMLElement).style.borderColor = "rgba(255,255,255,0.07)"; }}
      />
      {hint && <p className="text-[11px] text-slate-600">{hint}</p>}
    </div>
  );
}

function StatusBadge({ connected }: { connected: boolean }) {
  return (
    <span
      className="px-[10px] py-[2px] rounded-full text-[11px] font-semibold"
      style={connected
        ? { background: "rgba(16,185,129,0.12)", color: "#34d399" }
        : { background: "rgba(255,255,255,0.06)", color: "#475569" }}
    >
      {connected ? "Connected" : "Not connected"}
    </span>
  );
}

function SaveBtn({ saving, onClick }: { saving: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick} disabled={saving}
      className="text-[12px] px-4 py-[7px] rounded-[8px] font-medium transition-colors disabled:opacity-50"
      style={{ background: "rgba(217,70,239,0.15)", color: "#e879f9", border: "1px solid rgba(217,70,239,0.2)" }}
    >
      {saving ? "Saving…" : "Save Changes"}
    </button>
  );
}

// ── Section 1: Azure App Configuration (super_admin only, edits workspace 1) ──

function AzureConfigCard({ ws, onUpdated }: { ws: Workspace; onUpdated: (ws: Workspace) => void }) {
  const [tenantId, setTenantId] = useState(ws.azure_tenant_id);
  const [clientId, setClientId] = useState(ws.azure_client_id);
  const [clientSecret, setClientSecret] = useState("");
  const [webhookUrl, setWebhookUrl] = useState(ws.teams_webhook_url);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  async function save() {
    setSaving(true); setMsg("");
    try {
      const fields: Record<string, string> = {
        azure_tenant_id: tenantId,
        azure_client_id: clientId,
        teams_webhook_url: webhookUrl,
      };
      if (clientSecret) fields.azure_client_secret = clientSecret;
      const updated = await api.workspaces.update(ws.id, fields as Partial<Workspace>);
      onUpdated(updated as unknown as Workspace);
      setClientSecret("");
      setMsg("Azure config saved.");
    } catch { setMsg("Save failed."); }
    finally { setSaving(false); }
  }

  const isConfigured = !!(ws.azure_tenant_id && ws.azure_client_id);

  return (
    <div
      className="rounded-[12px] p-5 flex flex-col gap-4"
      style={{ background: "#11111b", border: "1px solid rgba(255,255,255,0.07)" }}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[14px] font-semibold text-slate-100">Azure App Configuration</p>
          <p className="text-[11px] text-slate-600 mt-[2px]">
            Company-wide credentials — set once, shared across all team workspaces.
          </p>
        </div>
        <span
          className="text-[10px] px-[9px] py-[3px] rounded-full font-semibold flex-shrink-0"
          style={isConfigured
            ? { background: "rgba(16,185,129,0.1)", color: "#34d399" }
            : { background: "rgba(245,158,11,0.1)", color: "#f59e0b" }}
        >
          {isConfigured ? "Configured" : "Not set"}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
        <Field label="Azure Tenant ID" id="az-tid" value={tenantId} onChange={setTenantId}
          placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
          hint="Your company's Azure AD directory ID." />
        <Field label="Azure Client ID (App ID)" id="az-cid" value={clientId} onChange={setClientId}
          placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
          hint="The app registration's client ID." />
        <Field label="Client Secret" id="az-cs" type="password" value={clientSecret} onChange={setClientSecret}
          placeholder={isConfigured ? "Leave blank to keep existing" : "Enter secret…"}
          hint="Only fill this to set or rotate the secret." />
        <Field label="Webhook URL" id="az-wh" value={webhookUrl} onChange={setWebhookUrl}
          placeholder="https://your-server.com"
          hint="Public HTTPS URL for Graph API notifications. Same for all teams." />
      </div>

      <div className="flex items-center gap-3">
        <SaveBtn saving={saving} onClick={save} />
        {msg && <p className="text-[11px] text-slate-600">{msg}</p>}
      </div>
    </div>
  );
}

// ── Section 2: Team workspace cards (chat IDs only) ───────────────────────────

function TeamCard({
  ws, isSuperAdmin, onUpdated, onDeleted,
}: {
  ws: Workspace; isSuperAdmin: boolean;
  onUpdated: (ws: Workspace) => void; onDeleted: (id: number) => void;
}) {
  const [eodChat, setEodChat] = useState(ws.teams_chat_id);
  const [summaryChat, setSummaryChat] = useState(ws.teams_agile_chat_id);
  const [slackChannel, setSlackChannel] = useState(ws.slack_channel_id);
  const [saving, setSaving] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const [msg, setMsg] = useState("");

  async function save() {
    setSaving(true); setMsg("");
    try {
      const updated = await api.workspaces.update(ws.id, {
        teams_chat_id: eodChat || undefined,
        teams_agile_chat_id: summaryChat || undefined,
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
      setMsg("Subscription registered.");
    } catch (e: unknown) {
      setMsg(`Failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally { setSubscribing(false); }
  }

  async function remove() {
    if (!confirm(`Delete "${ws.name}"? This removes all its members and tasks.`)) return;
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
            <button onClick={remove} className="text-[11px] text-red-500 hover:text-red-400 ml-2 transition-colors">Delete</button>
          )}
        </div>
      </div>

      {/* Teams chat IDs */}
      {(ws.platform === "teams" || ws.platform === "both") && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
          <Field label="EOD Chat ID" id={`eod-${ws.id}`} value={eodChat} onChange={isSuperAdmin ? setEodChat : undefined}
            readOnly={!isSuperAdmin}
            placeholder="19:xxx…@thread.v2"
            hint="The Teams chat where members post end-of-day updates." />
          <Field label="Summary Chat ID" id={`summary-${ws.id}`} value={summaryChat} onChange={setSummaryChat}
            placeholder={eodChat || "19:xxx…@thread.v2"}
            hint="Where morning/WIP summaries are posted. Defaults to EOD chat." />

          {/* Subscription — super admin only */}
          {isSuperAdmin && (
            <div className="sm:col-span-2 flex flex-wrap items-center gap-3 pt-1">
              <div className="text-[11px] text-slate-600">
                Subscription: <span className="font-mono text-slate-400">{ws.teams_subscription_id || "not registered"}</span>
              </div>
              <button
                onClick={subscribe} disabled={subscribing}
                className="text-[11px] px-3 py-[5px] rounded-[7px] font-medium transition-colors disabled:opacity-50"
                style={{ background: "rgba(59,130,246,0.12)", color: "#60a5fa", border: "1px solid rgba(59,130,246,0.18)" }}
              >
                {subscribing ? "Registering…" : "Register Subscription"}
              </button>
              <a href={`/api/workspaces/${ws.id}/login`}
                className="text-[11px] transition-colors"
                style={{ color: "#a78bfa" }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "#c4b5fd")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "#a78bfa")}
              >
                Sign in with Microsoft →
              </a>
            </div>
          )}
        </div>
      )}

      {/* Slack channel */}
      {(ws.platform === "slack" || ws.platform === "both") && ws.slack_connected && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
          <Field label="Notification Channel ID" id={`slack-${ws.id}`} value={slackChannel} onChange={setSlackChannel}
            placeholder="C0XXXXXXXXX"
            hint="Channel where summaries and WIP reports are posted." />
        </div>
      )}

      <div className="flex items-center gap-3 pt-1" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
        <SaveBtn saving={saving} onClick={save} />
        {msg && <p className="text-[11px] text-slate-600">{msg}</p>}
      </div>
    </div>
  );
}

// ── Section 3: Add new team (chat IDs only) ───────────────────────────────────

function AddTeamForm({ onCreated }: { onCreated: (ws: Workspace) => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [name, setName] = useState("");
  const [eodChat, setEodChat] = useState("");
  const [summaryChat, setSummaryChat] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr("");
    try {
      const result = await api.workspaces.connectTeams({
        name,
        teams_chat_id: eodChat,
        teams_agile_chat_id: summaryChat,
        // Azure credentials and webhook URL inherited from workspace 1 on the backend
        azure_tenant_id: "", azure_client_id: "", azure_client_secret: "", teams_webhook_url: "",
      }) as { workspace: Workspace };
      onCreated(result.workspace);
      setOpen(false);
      setName(""); setEodChat(""); setSummaryChat("");
    } catch { setErr("Failed to add team. Make sure Azure config is saved first."); }
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
        <span className="text-[18px] leading-none">+</span> Add New Team
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-[12px] p-5 flex flex-col gap-4"
      style={{ background: "#11111b", border: "1px solid rgba(217,70,239,0.2)" }}>
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold text-[14px] text-slate-100">Add New Team</p>
          <p className="text-[11px] text-slate-600 mt-[2px]">
            Azure credentials are inherited from the config above automatically.
          </p>
        </div>
        <button type="button" onClick={() => setOpen(false)} className="text-slate-600 hover:text-slate-400 text-[20px] leading-none">×</button>
      </div>

      {/* Inherited credentials notice */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-[8px]"
        style={{ background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.15)" }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth={2} className="w-[13px] h-[13px] flex-shrink-0">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
        <p className="text-[11px]" style={{ color: "#34d399" }}>
          Azure app credentials and webhook URL will be shared from your base configuration.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2">
          <Field label="Team Name" id="team-name" value={name} onChange={setName} placeholder="e.g. Design Team" />
        </div>
        <Field label="EOD Chat ID" id="team-eod" value={eodChat} onChange={setEodChat}
          placeholder="19:xxx…@thread.v2"
          hint="The Teams chat where this team posts EOD updates." />
        <Field label="Summary Chat ID (optional)" id="team-summary" value={summaryChat} onChange={setSummaryChat}
          placeholder="19:xxx…@thread.v2"
          hint="Defaults to the EOD chat if left blank." />
      </div>

      {err && <p className="text-[12px]" style={{ color: "#f87171" }}>{err}</p>}
      <div className="flex gap-3">
        <button type="submit" disabled={busy}
          className="px-5 py-2 rounded-[8px] text-[12px] font-medium transition-colors disabled:opacity-50"
          style={{ background: "rgba(217,70,239,0.15)", color: "#e879f9", border: "1px solid rgba(217,70,239,0.2)" }}
        >
          {busy ? "Adding…" : "Add Team"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="px-4 py-2 text-[12px] text-slate-600 hover:text-slate-400 transition-colors">
          Cancel
        </button>
      </div>
    </form>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

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

  function updateWs(updated: Workspace) {
    setWorkspaces((prev) => prev.map((w) => (w.id === updated.id ? updated : w)));
  }

  const defaultWs = workspaces.find((w) => w.id === 1);
  const teamWs = isSuperAdmin ? workspaces : workspaces; // managers see only their own (backend-filtered)

  return (
    <>
      {/* Topbar */}
      <div
        className="sticky top-0 z-10 flex items-center justify-between px-[26px] py-[13px]"
        style={{ background: "rgba(9,9,15,0.88)", backdropFilter: "blur(14px)", borderBottom: "1px solid rgba(255,255,255,0.07)" }}
      >
        <div>
          <h1 className="text-[19px] font-bold text-slate-100 tracking-[-0.5px]">
            {isSuperAdmin ? "Workspaces & Connections" : "Connections"}
          </h1>
          <p className="text-[11.5px] text-slate-600 mt-[2px]">
            {isSuperAdmin
              ? "Set Azure credentials once, then add a team workspace per department"
              : "Update your team's notification chat settings"}
          </p>
        </div>
      </div>

      <div className="p-[26px] flex flex-col gap-[18px] max-w-3xl">
        {error && (
          <div className="rounded-[10px] px-4 py-3 text-sm" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", color: "#f87171" }}>
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex flex-col gap-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-32 rounded-[12px] animate-pulse" style={{ background: "#11111b", border: "1px solid rgba(255,255,255,0.07)" }} />
            ))}
          </div>
        ) : (
          <>
            {/* ── Step 1: Azure base config (super admin only) ── */}
            {isSuperAdmin && defaultWs && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-[1px] text-slate-600">Step 1</span>
                  <span className="text-[10px] text-slate-700">Set once</span>
                </div>
                <AzureConfigCard ws={defaultWs} onUpdated={updateWs} />
              </div>
            )}

            {/* ── Step 2: Team workspaces ── */}
            <div className="flex flex-col gap-3">
              {isSuperAdmin && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-[1px] text-slate-600">Step 2</span>
                  <span className="text-[10px] text-slate-700">One workspace per team / department</span>
                </div>
              )}
              {teamWs.map((ws) => (
                <TeamCard
                  key={ws.id} ws={ws} isSuperAdmin={isSuperAdmin}
                  onUpdated={updateWs}
                  onDeleted={(id) => setWorkspaces((prev) => prev.filter((w) => w.id !== id))}
                />
              ))}
              {isSuperAdmin && (
                <AddTeamForm onCreated={(ws) => setWorkspaces((prev) => [...prev, ws])} />
              )}
            </div>

            {/* ── Slack OAuth ── */}
            {isSuperAdmin && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-[1px] text-slate-600">Slack</span>
                  <span className="text-[10px] text-slate-700">Optional</span>
                </div>
                <a
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
                </a>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
