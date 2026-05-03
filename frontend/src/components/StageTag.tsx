const STAGE_STYLES: Record<string, string> = {
  WIP: "bg-blue-100 text-blue-700",
  "Sent for Approval": "bg-yellow-100 text-yellow-700",
  Closed: "bg-green-100 text-green-700",
};

const PRIORITY_STYLES: Record<string, string> = {
  High: "bg-red-100 text-red-700",
  Medium: "bg-orange-100 text-orange-700",
  Low: "bg-gray-100 text-gray-600",
};

export function StageTag({ stage }: { stage: string }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STAGE_STYLES[stage] ?? "bg-gray-100 text-gray-600"}`}>
      {stage}
    </span>
  );
}

export function PriorityTag({ priority }: { priority: string }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${PRIORITY_STYLES[priority] ?? "bg-gray-100 text-gray-600"}`}>
      {priority}
    </span>
  );
}
