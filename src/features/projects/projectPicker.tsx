import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Search } from "lucide-react";

import { fieldClass, labelClass } from "../../components/ui/primitives";
import { integer } from "../../lib/format";

export type ProjectListOption = { id: string; label: string };

/** Options API uses `id: name`; split so ID and title are not shown twice. */
export function parseProjectOption(option: ProjectListOption): { id: string; name: string } {
  const id = option.id.trim();
  let name = option.label.trim();
  if (name.startsWith(`${id}:`)) name = name.slice(id.length + 1).trim();
  else if (name.startsWith(`${id} -`)) name = name.slice(id.length + 2).trim();
  else {
    const colon = name.indexOf(":");
    if (colon > 0 && name.slice(0, colon).trim() === id) name = name.slice(colon + 1).trim();
  }
  if (!name) name = option.label;
  return { id, name };
}

const projectIdentityGrid = "grid w-full min-w-0 items-center gap-x-3";
const projectIdentityCols = "[grid-template-columns:minmax(5.25rem,7.5rem)_1px_minmax(0,1fr)]";

export function ProjectIdentityGrid({
  id,
  name,
  nameClass = "line-clamp-2 text-[14px] font-medium leading-snug text-ink",
  idClass = "text-[12px] font-semibold tabular-nums text-ink-soft",
}: {
  id: string;
  name: string;
  nameClass?: string;
  idClass?: string;
}) {
  return (
    <div className={`${projectIdentityGrid} ${projectIdentityCols}`}>
      <span className={`min-w-0 truncate ${idClass}`} title={id}>
        {id}
      </span>
      <span aria-hidden="true" className="h-8 w-px shrink-0 bg-hairline" />
      <span className={`min-w-0 ${nameClass}`} title={name}>
        {name}
      </span>
    </div>
  );
}

function filterProjects(options: ProjectListOption[], query: string) {
  const q = query.trim().toLowerCase();
  const parsed = options.map((o) => ({ ...parseProjectOption(o), raw: o }));
  if (!q) return parsed;
  return parsed.filter((o) => o.id.toLowerCase().includes(q) || o.name.toLowerCase().includes(q));
}

function ProjectPickerResults({
  options,
  selectedId,
  search,
  onSelect,
  listId,
}: {
  options: ProjectListOption[];
  selectedId?: string;
  search: string;
  onSelect: (id: string) => void;
  listId: string;
}) {
  const filtered = useMemo(() => filterProjects(options, search), [options, search]);

  return (
    <>
      <div
        className={`${projectIdentityGrid} ${projectIdentityCols} rv-eyebrow border-b border-hairline bg-canvas/50 px-3.5 py-2`}
        aria-hidden="true"
      >
        <span>Project ID</span>
        <span />
        <span>Project name</span>
      </div>
      <ul id={listId} role="listbox" aria-label="Projects" className="max-h-72 overflow-y-auto py-1">
        {filtered.length === 0 ? (
          <li className="px-4 py-4 text-sm text-muted">No projects match your search</li>
        ) : (
          filtered.map((option) => {
            const active = option.id === selectedId;
            return (
              <li key={option.id} role="option" aria-selected={active}>
                <button
                  type="button"
                  onClick={() => onSelect(option.id)}
                  className={`flex w-full items-center gap-2 px-3.5 py-2.5 text-left hover:bg-canvas ${active ? "bg-primary-soft/50" : ""}`}
                >
                  <span className="min-w-0 flex-1">
                    <ProjectIdentityGrid
                      id={option.id}
                      name={option.name}
                      idClass="text-xs font-semibold tabular-nums text-ink-soft"
                      nameClass="line-clamp-2 text-[13px] font-medium leading-snug text-ink"
                    />
                  </span>
                  {active && selectedId ? <Check aria-hidden="true" className="h-4 w-4 shrink-0 text-primary" /> : null}
                </button>
              </li>
            );
          })
        )}
      </ul>
      <div className="border-t border-hairline px-4 py-2.5 text-xs tabular-nums text-muted">
        {integer(filtered.length)} {filtered.length === 1 ? "project" : "projects"}
        {search.trim() ? " match" : ""}
      </div>
    </>
  );
}

/** Portfolio: search field only until focused; then the ID/name list panel opens below. */
export function ProjectSearchCombobox({
  options,
  search,
  onSearchChange,
  onSelect,
  searchInputId = "project-search",
  listId = "project-portfolio-search-list",
}: {
  options: ProjectListOption[];
  search: string;
  onSearchChange: (value: string) => void;
  onSelect: (id: string) => void;
  searchInputId?: string;
  listId?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [open]);

  const pick = (id: string) => {
    setOpen(false);
    onSelect(id);
  };

  return (
    <div ref={rootRef} className={`relative w-full max-w-2xl ${open ? "z-40" : "z-0"}`}>
      <label htmlFor={searchInputId} className={labelClass}>
        Search
      </label>
      <div
        className={`rounded-xl border bg-surface px-3 py-3 shadow-(--shadow-card) transition-[border-color,box-shadow] ${
          open ? "border-primary/40 ring-2 ring-primary/15" : "border-hairline"
        }`}
      >
        <div className="relative">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
          />
          <input
            id={searchInputId}
            type="search"
            value={search}
            role="combobox"
            aria-expanded={open}
            aria-controls={open ? listId : undefined}
            autoComplete="off"
            onFocus={() => setOpen(true)}
            onChange={(event) => {
              onSearchChange(event.target.value);
              setOpen(true);
            }}
            placeholder="Search by name or ID"
            className={`${fieldClass} h-10 pl-9`}
          />
        </div>
      </div>
      {open ? (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-xl border border-hairline bg-surface shadow-(--shadow-popover) ring-1 ring-inset ring-ink/[0.03]">
          <ProjectPickerResults options={options} search={search} onSelect={pick} listId={listId} />
        </div>
      ) : null}
    </div>
  );
}

/** Project profile switcher — plain scroll list, no search or match chrome. */
export function ProjectSwitchMenu({
  options,
  selectedId,
  onSelect,
  listId = "project-select-list",
}: {
  options: ProjectListOption[];
  selectedId: string;
  onSelect: (id: string) => void;
  listId?: string;
}) {
  const rows = useMemo(() => options.map((o) => parseProjectOption(o)), [options]);

  return (
    <ul
      id={listId}
      role="listbox"
      aria-label="Projects"
      className="max-h-72 overflow-y-auto rounded-xl border border-hairline bg-surface py-1 shadow-(--shadow-popover)"
    >
      {rows.length === 0 ? (
        <li className="px-4 py-4 text-sm text-muted">No projects available</li>
      ) : (
        rows.map((option) => {
          const active = option.id === selectedId;
          return (
            <li key={option.id} role="option" aria-selected={active}>
              <button
                type="button"
                onClick={() => onSelect(option.id)}
                className={`flex w-full items-center gap-2 px-3.5 py-2.5 text-left hover:bg-canvas ${active ? "bg-primary-soft/50" : ""}`}
              >
                <span className="min-w-0 flex-1">
                  <ProjectIdentityGrid
                    id={option.id}
                    name={option.name}
                    idClass="text-xs font-semibold tabular-nums text-ink-soft"
                    nameClass="line-clamp-2 text-[13px] font-medium leading-snug text-ink"
                  />
                </span>
                {active ? <Check aria-hidden="true" className="h-4 w-4 shrink-0 text-primary" /> : null}
              </button>
            </li>
          );
        })
      )}
    </ul>
  );
}
