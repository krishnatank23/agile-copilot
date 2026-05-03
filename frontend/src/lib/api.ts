const BASE = "/api";

export interface Workspace {
  id: number;
  name: string;
  platform: string;
  created_at: string;
  // Teams
  azure_tenant_id: string;
  azure_client_id: string;
  azure_client_secret: string;
  teams_chat_id: string;
  teams_agile_chat_id: string;
  teams_webhook_url: string;
  teams_subscription_id: string;
  teams_connected: boolean;
  // Slack
  slack_bot_token: string;
  slack_signing_secret: string;
  slack_channel_id: string;
  slack_team_id: string;
  slack_connected: boolean;
}

export interface Task {
  id: number;
  member_id: number;
  member_name?: string;
  brand: string;
  activity_type: string;
  sprint_backlog: string;
  backlog: string;
  dependency: string;
  deadline: string;
  priority: "High" | "Medium" | "Low";
  stage: "WIP" | "Sent for Approval" | "Closed";
  comments: string;
  expected_story_points: number;
  actual_story_points: number;
  sprint_end_date: string;
  created_at: string;
  updated_at: string;
}

export interface Member {
  id: number;
  display_name: string;
  workspace_id: number;
  created_at: string;
}

export interface SprintProgress {
  member: string;
  member_id: number;
  total_tasks: number;
  wip: number;
  closed: number;
  sent_for_approval: number;
  expected_sp: number;
  actual_sp: number;
  pct: number;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export const api = {
  workspaces: {
    list: () => request<Workspace[]>("/workspaces"),
    get: (id: number) => request<Workspace>(`/workspaces/${id}`),
    update: (id: number, fields: Partial<Workspace>) =>
      request<Workspace>(`/workspaces/${id}`, { method: "PATCH", body: JSON.stringify(fields) }),
    connectTeams: (body: {
      name: string;
      azure_tenant_id: string;
      azure_client_id: string;
      azure_client_secret: string;
      teams_chat_id: string;
      teams_agile_chat_id?: string;
      teams_webhook_url: string;
    }) => request("/workspaces/teams", { method: "POST", body: JSON.stringify(body) }),
    subscribe: (id: number) =>
      request(`/workspaces/${id}/subscribe`, { method: "POST" }),
    delete: (id: number) =>
      request(`/workspaces/${id}`, { method: "DELETE" }),
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
