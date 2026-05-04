const BASE = "/api";

export interface Workspace {
  id: number; name: string; platform: string; created_at: string;
  azure_tenant_id: string; azure_client_id: string; azure_client_secret: string;
  teams_chat_id: string; teams_agile_chat_id: string; teams_webhook_url: string;
  teams_subscription_id: string; teams_connected: boolean;
  slack_bot_token: string; slack_signing_secret: string;
  slack_channel_id: string; slack_team_id: string; slack_connected: boolean;
}

export interface Task {
  id: number; member_id: number; member_name?: string;
  brand: string; activity_type: string; sprint_backlog: string; backlog: string;
  dependency: string; deadline: string; priority: "High" | "Medium" | "Low";
  stage: "WIP" | "Sent for Approval" | "Closed"; comments: string;
  expected_story_points: number; actual_story_points: number;
  sprint_end_date: string; created_at: string; updated_at: string;
}

export interface Member {
  id: number; display_name: string; workspace_id: number; created_at: string;
}

export interface SprintProgress {
  member: string; member_id: number; workspace_id: number; workspace_name: string;
  total_tasks: number; wip: number; closed: number; sent_for_approval: number;
  expected_sp: number; actual_sp: number; pct: number;
}

export interface AuthUser {
  sub: string;
  role: "super_admin" | "manager" | "member";
  member_id: number | null;
  workspace_id: number | null;
}

// ── Token storage ─────────────────────────────────────────────────────────────

export const TOKEN_KEY = "agile_token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

// ── Fetch wrapper ─────────────────────────────────────────────────────────────

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { headers, ...init });

  if (res.status === 401) {
    clearToken();
    if (typeof window !== "undefined") window.location.href = "/login";
    throw new Error("Unauthenticated");
  }

  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

// ── API surface ───────────────────────────────────────────────────────────────

export const api = {
  auth: {
    login: (username: string, password: string) =>
      request<{ access_token: string; role: string; username: string; member_id: number | null; workspace_id: number | null }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      }),
    me: () => request<AuthUser>("/auth/me"),
    createUser: (body: { username: string; password: string; role: string; member_id?: number; workspace_id?: number }) =>
      request("/auth/users", { method: "POST", body: JSON.stringify(body) }),
    listUsers: () => request<{ id: number; username: string; role: string; member_id: number | null; workspace_id: number | null }[]>("/auth/users"),
    updateUser: (id: number, body: { workspace_id?: number; password?: string }) =>
      request<{ id: number; username: string; role: string; member_id: number | null; workspace_id: number | null }>(`/auth/users/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  },
  workspaces: {
    list: () => request<Workspace[]>("/workspaces"),
    get: (id: number) => request<Workspace>(`/workspaces/${id}`),
    update: (id: number, fields: Partial<Workspace>) =>
      request<Workspace>(`/workspaces/${id}`, { method: "PATCH", body: JSON.stringify(fields) }),
    connectTeams: (body: {
      name: string; teams_chat_id: string;
      teams_agile_chat_id?: string;
      azure_tenant_id?: string; azure_client_id?: string;
      azure_client_secret?: string; teams_webhook_url?: string;
    }) => request("/workspaces/teams", { method: "POST", body: JSON.stringify(body) }),
    subscribe: (id: number) => request(`/workspaces/${id}/subscribe`, { method: "POST" }),
    delete: (id: number) => request(`/workspaces/${id}`, { method: "DELETE" }),
  },
  tasks: {
    list: (params?: { member?: string; stage?: string }) => {
      const qs = new URLSearchParams();
      if (params?.member) qs.set("member", params.member);
      if (params?.stage) qs.set("stage", params.stage);
      const q = qs.toString();
      return request<Task[]>(`/tasks${q ? `?${q}` : ""}`);
    },
    update: (id: number, fields: Partial<Task>) =>
      request<Task>(`/tasks/${id}`, { method: "PATCH", body: JSON.stringify(fields) }),
  },
  members: {
    list: () => request<Member[]>("/members"),
  },
  dashboard: {
    sprintProgress: () => request<SprintProgress[]>("/dashboard/sprint-progress"),
    wipSummary: () => request<{ member: string; wip_tasks: Task[] }[]>("/dashboard/wip-summary"),
  },
};
