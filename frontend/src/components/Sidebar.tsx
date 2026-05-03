"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

const NAV_MANAGER = [
  {
    label: "Menu",
    items: [
      { href: "/", label: "Dashboard", icon: <DashIcon /> },
      { href: "/tasks", label: "Tasks", icon: <TasksIcon /> },
      { href: "/members", label: "Members", icon: <MembersIcon /> },
    ],
  },
  {
    label: "Workspace",
    items: [
      { href: "/settings", label: "Connections", icon: <SettingsIcon /> },
    ],
  },
];

const NAV_MEMBER = [
  {
    label: "Menu",
    items: [
      { href: "/", label: "My Dashboard", icon: <DashIcon /> },
      { href: "/tasks", label: "My Tasks", icon: <TasksIcon /> },
    ],
  },
];

function DashIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-[15px] h-[15px] flex-shrink-0">
      <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>
    </svg>
  );
}

function TasksIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-[15px] h-[15px] flex-shrink-0">
      <line x1="9" y1="6" x2="20" y2="6"/><line x1="9" y1="12" x2="20" y2="12"/><line x1="9" y1="18" x2="20" y2="18"/>
      <polyline points="4 6 5 7 7 5"/><polyline points="4 12 5 13 7 11"/><polyline points="4 18 5 19 7 17"/>
    </svg>
  );
}

function MembersIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-[15px] h-[15px] flex-shrink-0">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-[15px] h-[15px] flex-shrink-0">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  );
}

export default function Sidebar() {
  const path = usePathname();
  const { user, logout } = useAuth();

  if (!user || path === "/login") return null;

  const sections = user.role === "manager" ? NAV_MANAGER : NAV_MEMBER;
  const displayName = user.sub;
  const roleLabel = user.role === "manager" ? "Manager" : "Team Member";
  const avatarLetter = displayName.charAt(0).toUpperCase();

  return (
    <aside
      className="fixed left-0 top-0 bottom-0 z-20 flex flex-col"
      style={{ width: 228, background: "#11111b", borderRight: "1px solid rgba(255,255,255,0.07)" }}
    >
      {/* Brand */}
      <div className="flex items-center gap-[10px] px-[18px] py-5" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        <div
          className="flex-shrink-0 flex items-center justify-center rounded-[9px] text-[17px]"
          style={{ width: 34, height: 34, background: "linear-gradient(135deg,#d946ef,#9333ea)", boxShadow: "0 0 18px rgba(217,70,239,0.35)" }}
        >
          ⚡
        </div>
        <div>
          <div className="text-[14.5px] font-bold text-slate-100 tracking-[-0.3px]">Agile Copilot</div>
          <div className="text-[10px] text-slate-600 mt-[1px]">World Goods Market</div>
        </div>
      </div>

      {/* Role badge */}
      <div className="px-[18px] py-[10px]" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        <span
          className="text-[10px] font-semibold px-[8px] py-[3px] rounded-full"
          style={
            user.role === "manager"
              ? { background: "rgba(217,70,239,0.12)", color: "#e879f9" }
              : { background: "rgba(59,130,246,0.12)", color: "#60a5fa" }
          }
        >
          {roleLabel}
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-[10px] py-[14px]" style={{ scrollbarWidth: "none" }}>
        {sections.map((section) => (
          <div key={section.label}>
            <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-[1px] px-2 mt-[14px] mb-[5px] first:mt-[2px]">
              {section.label}
            </div>
            {section.items.map((item) => {
              const active = path === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-[9px] px-[10px] py-[9px] rounded-[7px] text-[13px] font-medium mb-[1px] transition-all border"
                  style={
                    active
                      ? { background: "rgba(217,70,239,0.11)", color: "#e879f9", borderColor: "rgba(217,70,239,0.18)" }
                      : { color: "#475569", borderColor: "transparent" }
                  }
                  onMouseEnter={(e) => { if (!active) { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)"; (e.currentTarget as HTMLElement).style.color = "#94a3b8"; } }}
                  onMouseLeave={(e) => { if (!active) { (e.currentTarget as HTMLElement).style.background = ""; (e.currentTarget as HTMLElement).style.color = "#475569"; } }}
                >
                  {item.icon}
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-[10px] py-3" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
        <div className="flex items-center gap-[9px] px-[10px] py-2 rounded-[7px]">
          <div
            className="flex-shrink-0 flex items-center justify-center rounded-full text-[11px] font-bold text-white"
            style={{ width: 30, height: 30, background: user.role === "manager" ? "linear-gradient(135deg,#d946ef,#9333ea)" : "linear-gradient(135deg,#3b82f6,#6366f1)" }}
          >
            {avatarLetter}
          </div>
          <div className="flex-1 min-w-0">
            <strong className="block text-[12px] text-slate-100 truncate">{displayName}</strong>
            <span className="text-[10.5px] text-slate-600">{roleLabel}</span>
          </div>
          <button
            onClick={logout}
            title="Sign out"
            className="flex-shrink-0 text-slate-600 hover:text-slate-400 transition-colors"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-[14px] h-[14px]">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </button>
        </div>
      </div>
    </aside>
  );
}
