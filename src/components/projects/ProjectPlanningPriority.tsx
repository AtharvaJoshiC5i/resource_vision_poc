import {
  getProjectPlanningPriority,
  getProjectPlanningPriorityLabel,
} from "../../services/projectPlanningPriorityService";

interface ProjectPlanningPriorityProps {
  startDate: string;
  planningHorizonEnd?: string;
  today?: Date;
  showDays?: boolean;
}

const PRIORITY_STYLES = {
  STARTED: "border-slate-200 bg-slate-50 text-slate-600",
  URGENT: "border-amber-200 bg-amber-50 text-amber-800",
  UPCOMING: "border-blue-100 bg-blue-50 text-blue-700",
  FUTURE: "border-slate-200 bg-white text-slate-600",
} as const;

export function ProjectPlanningPriority({
  startDate,
  planningHorizonEnd,
  today = new Date(),
  showDays = true,
}: ProjectPlanningPriorityProps) {
  if (!startDate.trim()) {
    return <span className="text-xs text-slate-400">Not specified</span>;
  }

  const result = getProjectPlanningPriority(
    {
      projectId: "DISPLAY",
      projectName: "Project",
      startDate,
    },
    today,
    planningHorizonEnd,
  );

  const label = getProjectPlanningPriorityLabel(result.priority);

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <span
        className={`inline-flex rounded-md border px-2 py-1 text-[11px] font-semibold ${PRIORITY_STYLES[result.priority]}`}
      >
        {label}
      </span>

      {showDays && !result.isAlreadyStarted && (
        <span className="whitespace-nowrap text-[10px] tabular-nums text-slate-400">
          {result.daysUntilStart === 0
            ? "Starts today"
            : `In ${result.daysUntilStart} days`}
        </span>
      )}
    </div>
  );
}
