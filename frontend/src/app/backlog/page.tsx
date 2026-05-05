"use client";

import { useState } from "react";
import Link from "next/link";

type BacklogItem = {
  id: number;
  title: string;
  member: string;
  brand?: string;
  activity?: string;
  priority?: string;
  expected_story_points?: number;
  deadline?: string;
  comments?: string;
};

export default function BacklogPage() {
  const [items, setItems] = useState<BacklogItem[]>([]);
  const [title, setTitle] = useState("");
  const [member, setMember] = useState("");
  const [priority, setPriority] = useState("Medium");
  const [expected, setExpected] = useState<number | "">("");

  function addItem(e?: React.FormEvent) {
    e?.preventDefault();
    if (!title.trim()) return;
    const newItem: BacklogItem = {
      id: Date.now(),
      title: title.trim(),
      member: member.trim() || "",
      priority,
      expected_story_points: typeof expected === "number" ? expected : 0,
    };
    setItems((s) => [newItem, ...s]);
    setTitle("");
    setMember("");
    setExpected("");
    setPriority("Medium");
  }

  function remove(id: number) {
    setItems((s) => s.filter((it) => it.id !== id));
  }

  return (
    <div className="px-6 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[20px] font-bold">Sprint Backlog</h1>
          <p className="text-sm text-slate-500 mt-1">Add backlog items manually from the UI.</p>
        </div>
        <div>
          <Link href="/tasks" className="text-sm text-slate-400 hover:text-slate-200">Back to Tasks</Link>
        </div>
      </div>

      <form onSubmit={addItem} className="bg-[#11111b] p-4 rounded-lg mb-4 border border-[rgba(255,255,255,0.04)]">
        <div className="grid grid-cols-12 gap-3 items-end">
          <div className="col-span-5">
            <label className="text-[12px] text-slate-400">Title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Backlog title"
              className="w-full bg-transparent border border-[rgba(255,255,255,0.04)] rounded px-3 py-2 text-slate-100" />
          </div>

          <div className="col-span-3">
            <label className="text-[12px] text-slate-400">Member</label>
            <input value={member} onChange={(e) => setMember(e.target.value)} placeholder="Member name"
              className="w-full bg-transparent border border-[rgba(255,255,255,0.04)] rounded px-3 py-2 text-slate-100" />
          </div>

          <div className="col-span-2">
            <label className="text-[12px] text-slate-400">Priority</label>
            <select value={priority} onChange={(e) => setPriority(e.target.value)}
              className="w-full bg-transparent border border-[rgba(255,255,255,0.04)] rounded px-3 py-2 text-slate-100">
              <option>High</option>
              <option>Medium</option>
              <option>Low</option>
            </select>
          </div>

          <div className="col-span-1">
            <label className="text-[12px] text-slate-400">SP</label>
            <input type="number" value={expected as any} onChange={(e) => setExpected(e.target.value === "" ? "" : parseInt(e.target.value))}
              className="w-full bg-transparent border border-[rgba(255,255,255,0.04)] rounded px-3 py-2 text-slate-100" />
          </div>

          <div className="col-span-1">
            <button type="submit" className="w-full bg-purple-600 text-white rounded px-3 py-2">Add</button>
          </div>
        </div>
      </form>

      <div className="bg-[#0e0e12] rounded-lg border border-[rgba(255,255,255,0.04)]">
        <table className="w-full text-sm table-fixed">
          <thead className="text-slate-400 text-[12px] border-b border-[rgba(255,255,255,0.04)]">
            <tr>
              <th className="text-left px-4 py-3">Title</th>
              <th className="px-4 py-3">Member</th>
              <th className="px-4 py-3">Priority</th>
              <th className="px-4 py-3">SP</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id} className="border-b border-[rgba(255,255,255,0.02)] hover:bg-[rgba(255,255,255,0.02)]">
                <td className="px-4 py-3 text-slate-100">{it.title}</td>
                <td className="px-4 py-3 text-slate-400">{it.member || "—"}</td>
                <td className="px-4 py-3 text-slate-400">{it.priority}</td>
                <td className="px-4 py-3 text-slate-400">{it.expected_story_points}</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => remove(it.id)} className="text-sm text-red-400 hover:text-red-300">Delete</button>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">No backlog items yet — add one above.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
