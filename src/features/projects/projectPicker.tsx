import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Search, X } from "lucide-react";

import { integer } from "../../lib/format";
import { Tooltip } from "../../components/ui/Tooltip";

export type ProjectListOption = { id: string; label: string };

/** Options API uses `id: name`; split so ID and title are not shown twice. */
function parseProjectOption(option: ProjectListOption): { id: string; name: string } {
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
  nameClass = "line-clamp-2 text-base font-medium leading-snug text-ink",
  idClass = "text-xs font-medium tabular-nums text-ink-soft",
}: {
  id: string;
  name: string;
  nameClass?: string;
  idClass?: string;
}) {
  return (
    <div className={`${projectIdentityGrid} ${projectIdentityCols}`}>
      <Tooltip content={id}>
        <span className={`min-w-0 truncate ${idClass}`}>{id}</span>
      </Tooltip>
      <span aria-hidden="true" className="h-8 w-px shrink-0 bg-hairline" />
      <Tooltip content={name}>
        <span className={`min-w-0 ${nameClass}`}>{name}</span>
      </Tooltip>
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
      <ul id={listId} role="listbox" aria-label="Projects" className="rv-scroll max-h-72 overflow-y-auto py-1">
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
                      idClass="text-xs font-medium tabular-nums text-ink-soft"
                      nameClass="line-clamp-2 text-sm font-medium leading-snug text-ink"
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

/**
 * Portfolio search for the filter bar: a compact field that narrows the table as you type, and
 * opens a floating ID / name list to jump straight to one project. The list is portaled so the
 * card around the filter bar never clips it.
 */
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
  const [rect, setRect] = useState<{ left: number; top: number; width: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open || !rootRef.current) return;
    const place = () => {
      const r = rootRef.current?.getBoundingClientRect();
      if (!r) return;
      const width = Math.min(Math.max(r.width, 420), window.innerWidth - 24);
      setRect({ left: Math.max(12, Math.min(r.left, window.innerWidth - width - 12)), top: r.bottom + 6, width });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const pick = (id: string) => {
    setOpen(false);
    onSelect(id);
  };

  return (
    <div ref={rootRef} className="relative w-full sm:w-72">
      <label htmlFor={searchInputId} className="sr-only">
        Search projects
      </label>
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted"
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
        placeholder="Search project name or ID"
        className={`h-8 w-full rounded-lg border bg-surface pl-8 pr-8 text-xs text-ink shadow-(--shadow-control) transition-[border-color,box-shadow] placeholder:text-muted hover:border-border focus:outline-none touch:h-10 touch:text-[1rem] [&::-webkit-search-cancel-button]:hidden ${
          open ? "border-primary shadow-(--shadow-focus)" : "border-card-border"
        }`}
      />
      {search ? (
        <button
          type="button"
          onClick={() => onSearchChange("")}
          aria-label="Clear search"
          className="absolute right-1.5 top-1/2 grid h-5 w-5 -translate-y-1/2 place-items-center rounded-md text-muted transition-colors hover:bg-canvas hover:text-ink"
        >
          <X aria-hidden="true" className="h-3 w-3" />
        </button>
      ) : null}
      {open && rect
        ? createPortal(
            <div
              ref={panelRef}
              style={{ left: rect.left, top: rect.top, width: rect.width }}
              className="rv-popover fixed overflow-hidden rounded-xl bg-surface shadow-(--shadow-popover)"
            >
              <ProjectPickerResults options={options} search={search} onSelect={pick} listId={listId} />
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

/** Project profile switcher: plain scroll list, no search or match chrome. */
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
                    idClass="text-xs font-medium tabular-nums text-ink-soft"
                    nameClass="line-clamp-2 text-sm font-medium leading-snug text-ink"
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
