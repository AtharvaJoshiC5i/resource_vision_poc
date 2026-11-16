import { useMemo, useState } from "react";

import type { SkillOptions } from "../../api/types";
import { MultiSelect } from "./MultiSelect";

function hasSkillLists(o: Pick<SkillOptions, "names" | "levels"> | null | undefined) {
  return (o?.names?.length ?? 0) > 0 || (o?.levels?.length ?? 0) > 0;
}

/**
 * Skill name + proficiency level filters for the filter bar, shared by the Availability page and
 * Employee 360. Match Any only, mirroring the Power BI report: Skill and Skill level both narrow
 * the same skill row (an employee counts if a documented skill matches whichever of the two are
 * set), not two independent conditions. Skill family and "last used" are left out, since the
 * source view deliberately doesn't load them (no approved classification, unvalidated dates).
 */
export function SkillsFilter({
  options,
  names,
  levels,
  onNamesChange,
  onLevelsChange,
}: {
  options: SkillOptions | null | undefined;
  names: string[];
  levels: string[];
  onNamesChange: (values: string[]) => void;
  onLevelsChange: (values: string[]) => void;
}) {
  // Remember the last non-empty option lists so the pills don't flicker empty while a refetch is in
  // flight. Updated during render (React's "store info from previous renders" pattern), not in a ref.
  const [stable, setStable] = useState<Pick<SkillOptions, "available" | "names" | "levels"> | null>(null);
  if (options?.available && hasSkillLists(options) && (stable?.names !== options.names || stable?.levels !== options.levels)) {
    setStable({ available: options.available, names: options.names, levels: options.levels });
  }

  let resolved: Pick<SkillOptions, "available" | "names" | "levels"> | null | undefined;
  if (options?.available && hasSkillLists(options)) resolved = options;
  else if (stable?.available && hasSkillLists(stable)) resolved = stable;
  else if (options?.available) resolved = options;
  else resolved = stable ?? options;

  const nameList = resolved?.names;
  const levelList = resolved?.levels;
  const nameOptions = useMemo(() => (nameList ?? []).map((v) => ({ value: v, label: v })), [nameList]);
  const levelOptions = useMemo(() => (levelList ?? []).map((v) => ({ value: v, label: v })), [levelList]);

  if (resolved && !resolved.available) {
    return (
      <span className="inline-flex h-8 items-center rounded-lg border border-dashed border-card-border px-2.5 text-xs text-muted">
        Skills unavailable
      </span>
    );
  }

  const listsReady = nameOptions.length > 0 || levelOptions.length > 0;

  return (
    <div className="rv-filter-skill-group">
      <MultiSelect
        variant="pill"
        label="Skill"
        disabled={!listsReady}
        options={nameOptions}
        selected={names}
        onChange={onNamesChange}
      />
      <MultiSelect
        variant="pill"
        label="Skill level"
        disabled={!listsReady}
        options={levelOptions}
        selected={levels}
        onChange={onLevelsChange}
      />
    </div>
  );
}