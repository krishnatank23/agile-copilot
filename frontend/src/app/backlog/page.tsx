"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";

type BacklogItem = {
  id: number;
  title: string;
  priority: "High" | "Medium" | "Low";
  story_points: number;
  status: "Pending" | "In Progress" | "Done";
  dependency?: string;
  member_id?: number;
  member_name?: string;
  created_at: string;
};

export default function BacklogPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<BacklogItem[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [dependencyOptions, setDependencyOptions] = useState<{ value: string; label: string }[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Form state
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<"High" | "Medium" | "Low">("Medium");
  const [storyPoints, setStoryPoints] = useState<number | "">("");
  const [dependency, setDependency] = useState<string>("");
  const [selectedMember, setSelectedMember] = useState<number | "">("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  
  // Filter state
  const [selectedMemberFilter, setSelectedMemberFilter] = useState<string | null>(null);

  const isMember = user?.role === "member";
  const isManager = user?.role === "manager";

  // Load backlog items
  useEffect(() => {
    if (!user) return;
    
    const loadData = async () => {
      try {
        const visibleMembers = await api.members.list() as any[];

        if (isMember) {
          setMembers(visibleMembers);
          const options = visibleMembers.map((member) => ({
            value: member.display_name,
            label: member.display_name,
          }));
          const managerName = visibleMembers[0]?.manager_name;
          if (managerName) {
            options.push({ value: `Manager: ${managerName}`, label: `Manager: ${managerName}` });
          }
          setDependencyOptions(options);

          // Members load their own backlog using member_id
          const memberId = user.member_id;
          if (memberId) {
            const storedItems = localStorage.getItem(`backlog_member_${memberId}`);
            if (storedItems) {
              setItems(JSON.parse(storedItems));
            }
          }
        } else if (isManager) {
          // Managers load all members' backlogs
          setMembers(visibleMembers);
          const options = [
            ...visibleMembers.map((member) => ({
              value: member.display_name,
              label: member.display_name,
            })),
            {
              value: `Manager: ${user.sub}`,
              label: `Manager: ${user.sub}`,
            },
          ];
          const managerName = visibleMembers[0]?.manager_name;
          if (managerName && !options.some((option) => option.value === `Manager: ${managerName}`)) {
            options.push({ value: `Manager: ${managerName}`, label: `Manager: ${managerName}` });
          }
          setDependencyOptions(options);
          
          const allItems: BacklogItem[] = [];
          // Load backlog for each member using their member_id
          visibleMembers.forEach(member => {
            const storedItems = localStorage.getItem(`backlog_member_${member.id}`);
            if (storedItems) {
              try {
                const memberItems = JSON.parse(storedItems);
                // Ensure each item has the member_name set
                const itemsWithMemberName = memberItems.map((item: BacklogItem) => ({
                  ...item,
                  member_name: member.display_name
                }));
                allItems.push(...itemsWithMemberName);
              } catch (e) {
                console.error(`Failed to parse backlog for member ${member.id}`, e);
              }
            }
          });
          setItems(allItems.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
        }
      } catch (err) {
        console.error("Failed to load backlog", err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [user, isMember, isManager]);

  const saveItems = (newItems: BacklogItem[]) => {
    if (isMember && user) {
      // Members save to their own localStorage
      const memberId = user.member_id;
      if (memberId) {
        localStorage.setItem(`backlog_member_${memberId}`, JSON.stringify(newItems));
      }
    } else if (isManager) {
      // Managers save each member's items to their respective localStorage keys
      const itemsByMemberId: Record<number, BacklogItem[]> = {};
      newItems.forEach(item => {
        const memberId = item.member_id || 0;
        if (!itemsByMemberId[memberId]) itemsByMemberId[memberId] = [];
        itemsByMemberId[memberId].push(item);
      });
      
      // Save each member's items using their member_id
      Object.entries(itemsByMemberId).forEach(([memberId, memberItems]) => {
        localStorage.setItem(`backlog_member_${memberId}`, JSON.stringify(memberItems));
      });
    }
    setItems(newItems);
  };

  const addItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    if (!storyPoints || storyPoints <= 0) {
      setError("Story points must be greater than 0");
      return;
    }
    if (isManager && !selectedMember) {
      setError("Please select a team member");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      let memberId = user?.member_id || 0;
      let memberName = "";
      
      if (isManager && selectedMember) {
        // Manager adding item for a team member
        memberId = Number(selectedMember);
        const selectedMemberObj = members.find(m => m.id === selectedMember);
        memberName = selectedMemberObj?.display_name || "";
      } else if (isMember) {
        // Team member adding their own item - set their member_id
        memberId = user?.member_id || 0;
        memberName = "";
      }

      const newItem: BacklogItem = {
        id: Date.now(),
        title: title.trim(),
        priority,
        story_points: Number(storyPoints),
        status: "Pending",
        dependency: dependency || undefined,
        member_id: memberId,
        member_name: memberName,
        created_at: new Date().toISOString(),
      };

      saveItems([newItem, ...items]);
      setTitle("");
      setPriority("Medium");
      setStoryPoints("");
      setDependency("");
      setSelectedMember("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add item");
    } finally {
      setSubmitting(false);
    }
  };

  const removeItem = (id: number) => {
    const updatedItems = items.filter(it => it.id !== id);
    saveItems(updatedItems);
  };

  const updateStatus = (id: number, status: BacklogItem["status"]) => {
    const updatedItems = items.map(it => 
      it.id === id ? { ...it, status } : it
    );
    saveItems(updatedItems);
  };

  if (loading) {
    return (
      <div className="px-6 py-6">
        <div className="h-8 w-48 bg-gray-200 rounded animate-pulse mb-6" />
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!user) return null;

  const pageTitle = isMember ? "My Backlog" : "Team Backlog";
  const pageDesc = isMember 
    ? "Manage your personal backlog for reference and sprint planning."
    : "View and manage backlog items for all team members.";

  // Get unique members from items
  const uniqueMembers = Array.from(new Set(items.map(item => item.member_name)))
    .filter(name => name)
    .sort() as string[];

  // Filter items based on selected member
  const displayedItems = selectedMemberFilter 
    ? items.filter(item => item.member_name === selectedMemberFilter)
    : items;

  return (
    <div className="px-6 py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-[20px] font-bold text-gray-900">{pageTitle}</h1>
        <p className="text-sm text-gray-600 mt-1">{pageDesc}</p>
      </div>

      {/* Member Filter (Managers only) */}
      {isManager && uniqueMembers.length > 0 && (
        <div className="mb-6 flex items-center gap-3">
          <span className="text-sm font-medium text-gray-700">Member:</span>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setSelectedMemberFilter(null)}
              className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                selectedMemberFilter === null
                  ? "bg-purple-600 text-white"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
            >
              All
            </button>
            {uniqueMembers.map((memberName) => (
              <button
                key={memberName}
                onClick={() => setSelectedMemberFilter(memberName)}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                  selectedMemberFilter === memberName
                    ? "bg-purple-600 text-white"
                    : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                }`}
              >
                {memberName}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Add Item Form */}
      <form onSubmit={addItem} className="bg-white p-5 rounded-[12px] mb-6 border border-[rgba(0,0,0,0.07)]">
        <div className="grid grid-cols-12 gap-3 items-end">
          <div className={isManager ? "col-span-4" : "col-span-6"}>
            <label className="text-[12px] font-medium text-gray-700">Title / Description</label>
            <input 
              value={title} 
              onChange={(e) => setTitle(e.target.value)} 
              placeholder="e.g. Design login page"
              className="w-full bg-transparent border border-[rgba(0,0,0,0.1)] rounded-[8px] px-3 py-2 text-[13px] text-gray-900 outline-none placeholder:text-gray-500"
              style={{ marginTop: "6px" }}
            />
          </div>

          {isManager && (
            <div className="col-span-2">
              <label className="text-[12px] font-medium text-gray-700">Member</label>
              <select 
                value={selectedMember} 
                onChange={(e) => setSelectedMember(e.target.value ? Number(e.target.value) : "")}
                className="w-full bg-transparent border border-[rgba(0,0,0,0.1)] rounded-[8px] px-3 py-2 text-[13px] text-gray-900 outline-none"
                style={{ marginTop: "6px" }}
              >
                <option value="">Select member</option>
                {members.map(m => (
                  <option key={m.id} value={m.id}>{m.display_name}</option>
                ))}
              </select>
            </div>
          )}

          <div className={isManager ? "col-span-1" : "col-span-2"}>
            <label className="text-[12px] font-medium text-gray-700">Priority</label>
            <select 
              value={priority} 
              onChange={(e) => setPriority(e.target.value as any)}
              className="w-full bg-transparent border border-[rgba(0,0,0,0.1)] rounded-[8px] px-3 py-2 text-[13px] text-gray-900 outline-none"
              style={{ marginTop: "6px" }}
            >
              <option>High</option>
              <option>Medium</option>
              <option>Low</option>
            </select>
          </div>

          <div className={isManager ? "col-span-1" : "col-span-2"}>
            <label className="text-[12px] font-medium text-gray-700">Dependency</label>
            <select 
              value={dependency} 
              onChange={(e) => setDependency(e.target.value)}
              className="w-full bg-transparent border border-[rgba(0,0,0,0.1)] rounded-[8px] px-3 py-2 text-[13px] text-gray-900 outline-none"
              style={{ marginTop: "6px" }}
            >
              <option value="">None</option>
              {dependencyOptions.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>

          <div className={isManager ? "col-span-1" : "col-span-2"}>
            <label className="text-[12px] font-medium text-gray-700">SP</label>
            <input 
              type="number" 
              value={storyPoints} 
              onChange={(e) => setStoryPoints(e.target.value === "" ? "" : parseInt(e.target.value))}
              placeholder="0"
              min="1"
              className="w-full bg-transparent border border-[rgba(0,0,0,0.1)] rounded-[8px] px-3 py-2 text-[13px] text-gray-900 outline-none placeholder:text-gray-500"
              style={{ marginTop: "6px" }}
            />
          </div>

          <div className="col-span-2">
            <button 
              type="submit" 
              disabled={submitting}
              className="w-full bg-gradient-to-r from-purple-600 to-purple-700 text-white font-medium rounded-[8px] px-4 py-2 text-[13px] transition-opacity disabled:opacity-50"
              style={{ marginTop: "6px" }}
            >
              {submitting ? "Adding..." : "+ Add Item"}
            </button>
          </div>
        </div>
        {error && <p className="text-[11px] text-red-600 mt-3">{error}</p>}
      </form>

      {/* Items Table */}
      <div className="rounded-[12px] overflow-hidden border border-[rgba(0,0,0,0.07)]">
        <div className="overflow-x-auto overflow-y-hidden" style={{ background: "#ffffff" }}>
          <table className="min-w-[1100px] w-full text-[13px]">
          <thead>
            <tr style={{ background: "#f9fafb", borderBottom: "1px solid rgba(0,0,0,0.07)" }}>
              <th className="text-left px-4 py-3 font-semibold text-gray-700">Title</th>
              {isManager && <th className="px-4 py-3 font-semibold text-gray-700">Member</th>}
              <th className="px-4 py-3 font-semibold text-gray-700">Priority</th>
              <th className="px-4 py-3 font-semibold text-gray-700">Dependency</th>
              <th className="px-4 py-3 font-semibold text-gray-700">SP</th>
              <th className="px-4 py-3 font-semibold text-gray-700">Status</th>
              <th className="px-4 py-3 font-semibold text-gray-700 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {displayedItems.length > 0 ? (
              displayedItems.map((item) => (
                <tr key={item.id} className="border-b border-[rgba(0,0,0,0.07)] hover:bg-[rgba(0,0,0,0.02)]">
                  <td className="px-4 py-3 text-gray-900">{item.title}</td>
                  {isManager && <td className="px-4 py-3 text-gray-600">{item.member_name || "—"}</td>}
                  <td className="px-4 py-3">
                    <span 
                      className="text-[11px] px-[8px] py-[3px] rounded-full font-semibold"
                      style={{
                        background: item.priority === "High" ? "rgba(239,68,68,0.1)" : 
                                  item.priority === "Medium" ? "rgba(245,158,11,0.1)" : 
                                  "rgba(34,197,94,0.1)",
                        color: item.priority === "High" ? "#dc2626" : 
                               item.priority === "Medium" ? "#d97706" : 
                               "#16a34a",
                      }}
                    >
                      {item.priority}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-[12px]">
                    {item.dependency ? (
                      <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-[11px]">
                        Depends: {item.dependency}
                      </span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600 font-semibold">{item.story_points}</td>
                  <td className="px-4 py-3">
                    <select 
                      value={item.status}
                      onChange={(e) => updateStatus(item.id, e.target.value as any)}
                      className="bg-transparent border border-[rgba(0,0,0,0.1)] rounded-[6px] px-2 py-1 text-[12px] text-gray-700 outline-none cursor-pointer"
                    >
                      <option>Pending</option>
                      <option>In Progress</option>
                      <option>Done</option>
                    </select>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button 
                      onClick={() => removeItem(item.id)}
                      className="text-[12px] text-red-600 hover:text-red-700 font-medium transition-colors"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={isManager ? 7 : 6} className="px-4 py-8 text-center text-gray-600">
                  No backlog items yet — add one above to get started.
                </td>
              </tr>
            )}
          </tbody>
          </table>
        </div>
      </div>

      {/* Summary Stats */}
      {displayedItems.length > 0 && (
        <div className="mt-6 grid grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-[12px] border border-[rgba(0,0,0,0.07)]">
            <p className="text-[11px] text-gray-600 uppercase tracking-[0.5px] font-medium">Total Items</p>
            <p className="text-[28px] font-bold text-gray-900 mt-2">{displayedItems.length}</p>
          </div>
          <div className="bg-white p-4 rounded-[12px] border border-[rgba(0,0,0,0.07)]">
            <p className="text-[11px] text-gray-600 uppercase tracking-[0.5px] font-medium">Total SP</p>
            <p className="text-[28px] font-bold text-gray-900 mt-2">{displayedItems.reduce((sum, it) => sum + it.story_points, 0)}</p>
          </div>
          <div className="bg-white p-4 rounded-[12px] border border-[rgba(0,0,0,0.07)]">
            <p className="text-[11px] text-gray-600 uppercase tracking-[0.5px] font-medium">In Progress</p>
            <p className="text-[28px] font-bold text-gray-900 mt-2">{displayedItems.filter(it => it.status === "In Progress").length}</p>
          </div>
          <div className="bg-white p-4 rounded-[12px] border border-[rgba(0,0,0,0.07)]">
            <p className="text-[11px] text-gray-600 uppercase tracking-[0.5px] font-medium">Completed</p>
            <p className="text-[28px] font-bold text-gray-900 mt-2">{displayedItems.filter(it => it.status === "Done").length}</p>
          </div>
        </div>
      )}
    </div>
  );
}
