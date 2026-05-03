"use client";

import { useEffect, useState } from "react";
import { api, type Workspace } from "@/lib/api";

// ── Reusable field row ──────────────────────────────────────────────────────

function Field({
  label,
  id,
  type = "text",
  value,
  onChange,
  placeholder,
  hint,
}: {
  label: string;
  id: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-gray-700">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
      />
      {hint && <p className="text-xs text-gray-400">{hint}</p>}
    </div>
  );
}

// ── Status badge ────────────────────────────────────────────────────────────

function StatusBadge({ connected }: { connected: boolean }) {
  return (
    <span
      className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
        connected ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
      }`}
    >
      {connected ? "Connected" : "Not connected"}
    </span>
  );
}

// ── Workspace card ───────────────────────────────────────────────────────────

function WorkspaceCard({
  ws,
  onUpdated,
  onDeleted,
}: {
  ws: Workspace;
  onUpdated: (ws: Workspace) => void;
  onDeleted: (id: number) => void;
}) {
  const [teamsAgileChat, setTeamsAgileChat] = useState(ws.teams_agile_chat_id);
  const [slackChannel, setSlackChannel] = useState(ws.slack_channel_id);
  const [saving, setSaving] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const [msg, setMsg] = useState("");

  async function save() {
    setSaving(true);
    setMsg("");
    try {
      const updated = await api.workspaces.update(ws.id, {
        teams_agile_chat_id: teamsAgileChat || undefined,
        slack_channel_id: slackChannel || undefined,
      });
      onUpdated(updated as unknown as Workspace);
      setMsg("Saved.");
    } catch {
      setMsg("Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function subscribe() {
    setSubscribing(true);
    setMsg("");
    try {
      await api.workspaces.subscribe(ws.id);
      setMsg("Graph subscription registered.");
    } catch (e: unknown) {
      setMsg(`Subscribe failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSubscribing(false);
    }
  }

  async function remove() {
    if (!confirm(`Delete workspace "${ws.name}"? This will remove all its members and tasks.`)) return;
    try {
      await api.workspaces.delete(ws.id);
      onDeleted(ws.id);
    } catch {
      setMsg("Delete failed.");
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="font-semibold text-gray-900">{ws.name}</p>
          <p className="text-xs text-gray-400 mt-0.5 capitalize">{ws.platform} workspace</p>
        </div>
        <div className="flex gap-2 items-center">
          {ws.platform === "teams" || ws.platform === "both" ? (
            <StatusBadge connected={ws.teams_connected} />
          ) : null}
          {ws.platform === "slack" || ws.platform === "both" ? (
            <StatusBadge connected={ws.slack_connected} />
          ) : null}
          {ws.id !== 1 && (
            <button onClick={remove} className="text-xs text-red-500 hover:text-red-700 ml-2">
              Delete
            </button>
          )}
        </div>
      </div>

      {/* Teams fields */}
      {(ws.platform === "teams" || ws.platform === "both") && ws.teams_connected && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-gray-100 pt-4">
          <div>
            <p className="text-xs text-gray-500 font-medium mb-0.5">Tenant ID</p>
            <p className="text-xs font-mono text-gray-700 truncate">{ws.azure_tenant_id || "—"}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium mb-0.5">EOD Chat ID</p>
            <p className="text-xs font-mono text-gray-700 truncate">{ws.teams_chat_id || "—"}</p>
          </div>
          <div className="sm:col-span-2">
            <Field
              label="Summary Chat ID (where morning/WIP messages go)"
              id={`agile-chat-${ws.id}`}
              value={teamsAgileChat}
              onChange={setTeamsAgileChat}
              placeholder={ws.teams_chat_id}
              hint="Leave empty to use the same chat as EOD messages."
            />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium mb-0.5">Subscription</p>
            <p className="text-xs font-mono text-gray-700 truncate">
              {ws.teams_subscription_id || "Not registered"}
            </p>
          </div>
          <div className="flex items-end">
            <button
              onClick={subscribe}
              disabled={subscribing}
              className="text-sm px-4 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {subscribing ? "Registering…" : "Register Subscription"}
            </button>
          </div>
          <div className="sm:col-span-2">
            <a
              href={`/api/workspaces/${ws.id}/login`}
              className="text-sm text-brand-600 hover:underline"
            >
              Sign in with Microsoft (enable sending messages) →
            </a>
          </div>
        </div>
      )}

      {/* Slack fields */}
      {(ws.platform === "slack" || ws.platform === "both") && ws.slack_connected && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-gray-100 pt-4">
          <div>
            <p className="text-xs text-gray-500 font-medium mb-0.5">Slack Team ID</p>
            <p className="text-xs font-mono text-gray-700">{ws.slack_team_id || "—"}</p>
          </div>
          <div>
            <Field
              label="Notification Channel ID"
              id={`slack-channel-${ws.id}`}
              value={slackChannel}
              onChange={setSlackChannel}
              placeholder="C0XXXXXXXXX"
              hint="The channel where morning summaries and WIP reports are posted."
            />
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3 border-t border-gray-100 pt-3">
        <button
          onClick={save}
          disabled={saving}
          className="text-sm px-4 py-1.5 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save Changes"}
        </button>
        {msg && <p className="text-xs text-gray-500">{msg}</p>}
      </div>
    </div>
  );
}

// ── Add Teams form ───────────────────────────────────────────────────────────

function AddTeamsForm({ onCreated }: { onCreated: (ws: Workspace) => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [form, setForm] = useState({
    name: "",
    azure_tenant_id: "",
    azure_client_id: "",
    azure_client_secret: "",
    teams_chat_id: "",
    teams_agile_chat_id: "",
    teams_webhook_url: "",
  });

  function set(key: string, val: string) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      const result = await api.workspaces.connectTeams(form) as { workspace: Workspace };
      onCreated(result.workspace);
      setOpen(false);
      setForm({ name: "", azure_tenant_id: "", azure_client_id: "", azure_client_secret: "", teams_chat_id: "", teams_agile_chat_id: "", teams_webhook_url: "" });
    } catch {
      setErr("Failed to connect. Check credentials and try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2 border-2 border-dashed border-gray-300 rounded-xl text-sm text-gray-500 hover:border-brand-400 hover:text-brand-600 transition-colors w-full"
      >
        <span className="text-lg">+</span> Connect Teams Workspace
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="bg-white border border-brand-200 rounded-xl p-5 flex flex-col gap-4 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="font-semibold text-gray-900">Connect MS Teams Workspace</p>
        <button type="button" onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Workspace name" id="ws-name" value={form.name} onChange={(v) => set("name", v)} placeholder="My Team" />
        <Field label="Azure Tenant ID" id="ws-tid" value={form.azure_tenant_id} onChange={(v) => set("azure_tenant_id", v)} placeholder="xxxxxxxx-xxxx-…" />
        <Field label="Azure Client ID (App ID)" id="ws-cid" value={form.azure_client_id} onChange={(v) => set("azure_client_id", v)} placeholder="xxxxxxxx-xxxx-…" />
        <Field label="Azure Client Secret" id="ws-cs" type="password" value={form.azure_client_secret} onChange={(v) => set("azure_client_secret", v)} placeholder="ciS8Q…" />
        <Field label="EOD Chat ID" id="ws-chat" value={form.teams_chat_id} onChange={(v) => set("teams_chat_id", v)} placeholder="19:xxx…@thread.v2" hint="The Teams chat where members post EOD updates." />
        <Field label="Summary Chat ID" id="ws-agile" value={form.teams_agile_chat_id} onChange={(v) => set("teams_agile_chat_id", v)} placeholder="19:xxx…@thread.v2" hint="Where morning/WIP summaries are sent. Defaults to EOD chat." />
        <div className="sm:col-span-2">
          <Field label="Webhook URL" id="ws-wh" value={form.teams_webhook_url} onChange={(v) => set("teams_webhook_url", v)} placeholder="https://your-server.com" hint="Public URL where Graph API sends notifications. Must be HTTPS." />
        </div>
      </div>

      {err && <p className="text-sm text-red-600">{err}</p>}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={busy}
          className="px-5 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 disabled:opacity-50"
        >
          {busy ? "Connecting…" : "Connect"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">
          Cancel
        </button>
      </div>
    </form>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api.workspaces.list()
      .then(setWorkspaces)
      .catch(() => setError("Could not load workspaces — is the backend running?"))
      .finally(() => setLoading(false));
  }, []);

  function handleUpdated(updated: Workspace) {
    setWorkspaces((ws) => ws.map((w) => (w.id === updated.id ? updated : w)));
  }

  function handleCreated(ws: Workspace) {
    setWorkspaces((prev) => [...prev, ws]);
  }

  function handleDeleted(id: number) {
    setWorkspaces((prev) => prev.filter((w) => w.id !== id));
  }

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Connections</h1>
        <p className="text-sm text-gray-500 mt-1">
          Connect Teams and Slack workspaces. Each connection has its own credentials and chat routing.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">{error}</div>
      )}

      {loading ? (
        <div className="flex flex-col gap-4">
          {[1, 2].map((i) => <div key={i} className="h-32 bg-white border border-gray-200 rounded-xl animate-pulse" />)}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {workspaces.map((ws) => (
            <WorkspaceCard
              key={ws.id}
              ws={ws}
              onUpdated={handleUpdated}
              onDeleted={handleDeleted}
            />
          ))}

          {/* Add Teams workspace */}
          <AddTeamsForm onCreated={handleCreated} />

          {/* Connect Slack (OAuth) */}
          <a
            href="/api/slack/install"
            className="flex items-center gap-2 px-4 py-2 border-2 border-dashed border-gray-300 rounded-xl text-sm text-gray-500 hover:border-purple-400 hover:text-purple-600 transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 54 54" fill="currentColor">
              <path d="M19.712.133a5.381 5.381 0 0 0-5.376 5.387 5.381 5.381 0 0 0 5.376 5.386h5.376V5.52A5.381 5.381 0 0 0 19.712.133m0 14.365H5.376A5.381 5.381 0 0 0 0 19.884a5.381 5.381 0 0 0 5.376 5.387h14.336a5.381 5.381 0 0 0 5.376-5.387 5.381 5.381 0 0 0-5.376-5.386" />
              <path d="M53.76 19.884a5.381 5.381 0 0 0-5.376-5.386 5.381 5.381 0 0 0-5.376 5.386v5.387h5.376a5.381 5.381 0 0 0 5.376-5.387m-14.336 0V5.52A5.381 5.381 0 0 0 34.048.133a5.381 5.381 0 0 0-5.376 5.387v14.364a5.381 5.381 0 0 0 5.376 5.387 5.381 5.381 0 0 0 5.376-5.387" />
              <path d="M34.048 54a5.381 5.381 0 0 0 5.376-5.387 5.381 5.381 0 0 0-5.376-5.386h-5.376v5.386A5.381 5.381 0 0 0 34.048 54m0-14.365h14.336a5.381 5.381 0 0 0 5.376-5.386 5.381 5.381 0 0 0-5.376-5.387H34.048a5.381 5.381 0 0 0-5.376 5.387 5.381 5.381 0 0 0 5.376 5.386" />
              <path d="M0 34.249a5.381 5.381 0 0 0 5.376 5.386 5.381 5.381 0 0 0 5.376-5.386v-5.387H5.376A5.381 5.381 0 0 0 0 34.249m14.336 0v14.364A5.381 5.381 0 0 0 19.712 54a5.381 5.381 0 0 0 5.376-5.387V34.249a5.381 5.381 0 0 0-5.376-5.387 5.381 5.381 0 0 0-5.376 5.387" />
            </svg>
            Add Slack Workspace via OAuth
          </a>
        </div>
      )}

      {/* How it works */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 text-sm text-gray-600 flex flex-col gap-2 mt-2">
        <p className="font-semibold text-gray-700">How connections work</p>
        <ul className="list-disc list-inside space-y-1">
          <li><b>Teams:</b> Paste your Azure app credentials. Each workspace gets its own Graph subscription — notifications are routed back here by workspace ID encoded in the clientState.</li>
          <li><b>Slack:</b> Click "Add Slack Workspace" — you'll approve the app in Slack and a bot token is stored automatically. No credential copy-paste needed.</li>
          <li>Members are auto-created the first time someone posts an EOD in either platform.</li>
          <li>The default workspace (id=1) is seeded from your <code>.env</code> file and cannot be deleted.</li>
        </ul>
      </div>
    </div>
  );
}
