import type { SprintProgress } from "@/lib/api";

function ProgressBar({ pct }: { pct: number }) {
  const clamped = Math.min(100, Math.max(0, pct));
  const color = clamped >= 80 ? "bg-green-500" : clamped >= 40 ? "bg-blue-500" : "bg-amber-400";
  return (
    <div className="w-full bg-gray-200 rounded-full h-2">
      <div className={`h-2 rounded-full transition-all ${color}`} style={{ width: `${clamped}%` }} />
    </div>
  );
}

export default function SprintProgressCard({ data }: { data: SprintProgress }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col gap-3 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-semibold text-gray-900">{data.member}</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {data.total_tasks} tasks &nbsp;·&nbsp;
            <span className="text-blue-600">{data.wip} WIP</span> &nbsp;·&nbsp;
            <span className="text-yellow-600">{data.sent_for_approval} In Review</span> &nbsp;·&nbsp;
            <span className="text-green-600">{data.closed} Closed</span>
          </p>
        </div>
        <span className="text-2xl font-bold text-gray-800">{data.pct}%</span>
      </div>
      <ProgressBar pct={data.pct} />
      <p className="text-xs text-gray-400">
        {data.actual_sp} / {data.expected_sp} story points
      </p>
    </div>
  );
}
