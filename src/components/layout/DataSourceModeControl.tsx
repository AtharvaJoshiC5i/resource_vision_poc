import { type ChangeEvent } from "react";

import { Loader2 } from "lucide-react";

import {
  type ResourceDataMode,
  useResourceData,
} from "../../context/ResourceDataContext";

import { Badge } from "../ui/Badge";

export function DataSourceModeControl() {
  const { mode, setMode, loading, error } = useResourceData();

  function handleChange(event: ChangeEvent<HTMLSelectElement>) {
    setMode(event.target.value as ResourceDataMode);
  }

  return (
    <div className="flex flex-col items-end gap-1.5 sm:flex-row sm:items-center">
      <div className="flex items-center gap-2">
        <label
          htmlFor="data-source-mode"
          className="text-xs font-medium text-slate-600 sm:text-sm"
        >
          Data source
        </label>

        <select
          id="data-source-mode"
          value={mode}
          onChange={handleChange}
          disabled={loading}
          className="h-9 min-w-[10.5rem] rounded-lg border border-slate-300 bg-white px-2.5 text-sm font-medium text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-wait disabled:opacity-70"
        >
          <option value="mock">POC mock data</option>
          <option value="organization">Organization (Azure SQL)</option>
        </select>

        {loading && (
          <Loader2
            className="size-4 animate-spin text-blue-600"
            aria-label="Loading organization data"
          />
        )}
      </div>

      <Badge variant={mode === "mock" ? "neutral" : "blue"}>
        {mode === "mock" ? "Synthetic Data" : "Azure SQL"}
      </Badge>

      {mode === "organization" && error !== null && (
        <p
          className="max-w-xs text-right text-xs leading-5 text-red-600"
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  );
}
