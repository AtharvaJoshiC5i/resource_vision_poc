import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { Search, UserPlus, UsersRound, X } from "lucide-react";

import type { EmployeeSearchHit } from "../../api/types";
import { Tooltip } from "../../components/ui/Tooltip";
import { useApi } from "../../hooks/useApi";
import { integer } from "../../lib/format";

const SQUAD_MAX = 50;
const PANEL_GAP = 6;

function useDebounced(value: string, ms = 250) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

/**
 * Build a short-lived working set of employees for the allocation matrix. Squad keys live in the
 * URL (`squad`) so the table can be shared; names for chips are resolved from `/employees/search`.
 */
export function EmployeeSquadBar({
  squad,
  onSquadChange,
}: {
  squad: string[];
  onSquadChange: (keys: string[]) => void;
}) {
  const inputId = useId();
  const listId = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<{ left: number; top: number; width: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const debounced = useDebounced(query);

  const roster = useApi<EmployeeSearchHit[]>(squad.length > 0 ? "/employees/search" : null);
  const search = useApi<EmployeeSearchHit[]>(
    open && debounced.trim().length > 0 ? "/employees/search" : null,
    { q: debounced.trim() },
  );

  const byKey = useMemo(() => new Map((roster.data ?? []).map((row) => [row.key, row])), [roster.data]);

  const hits = useMemo(() => {
    if (!search.data) return [];
    const inSquad = new Set(squad);
    return search.data.filter((row) => !inSquad.has(row.key)).slice(0, 12);
  }, [search.data, squad]);

  useLayoutEffect(() => {
    if (!open || !rootRef.current) return;
    const place = () => {
      const rect = rootRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.min(Math.max(rect.width, 320), window.innerWidth - 24);
      setPlacement({
        left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)),
        top: rect.bottom + PANEL_GAP,
        width,
      });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, query]);

  useEffect(() => {
    if (!open) return;
    const onOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("click", onOutside);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onOutside);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const add = (key: string) => {
    if (squad.includes(key) || squad.length >= SQUAD_MAX) return;
    onSquadChange([...squad, key]);
    setQuery("");
    setOpen(false);
  };

  const remove = (key: string) => onSquadChange(squad.filter((k) => k !== key));

  const active = squad.length > 0;

  return (
    <section className="rv-squad-bar" aria-label="Employee squad">
      <div className="rv-squad-bar__head">
        <span className="rv-squad-bar__title">
          <UsersRound aria-hidden="true" className="h-4 w-4 text-primary" />
          Squad
        </span>
        <p className="rv-squad-bar__hint">
          {active
            ? `Matrix shows ${integer(squad.length)} selected ${squad.length === 1 ? "person" : "people"} only.`
            : "Search and add people to compare availability in one table."}
        </p>
        {active ? (
          <button
            type="button"
            onClick={() => onSquadChange([])}
            className="rv-squad-bar__clear ml-auto shrink-0 text-xs font-medium text-primary hover:text-purple-indigo"
          >
            Clear squad
          </button>
        ) : null}
      </div>

      <div className="rv-squad-bar__body">
        <div ref={rootRef} className="rv-squad-bar__search">
          <label htmlFor={inputId} className="sr-only">
            Search employees to add to squad
          </label>
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted"
          />
          <input
            id={inputId}
            type="search"
            value={query}
            role="combobox"
            aria-expanded={open}
            aria-controls={open ? listId : undefined}
            autoComplete="off"
            disabled={squad.length >= SQUAD_MAX}
            onFocus={() => setOpen(true)}
            onChange={(event) => {
              setQuery(event.target.value);
              setOpen(true);
            }}
            placeholder={squad.length >= SQUAD_MAX ? "Squad is full" : "Find by name or code to add…"}
            className="rv-field h-8 w-full min-w-[12rem] max-w-sm rounded-lg bg-surface pl-8 pr-8 text-xs text-ink placeholder:text-muted focus:outline-none touch:h-10 touch:text-[1rem] disabled:cursor-not-allowed disabled:opacity-60 [&::-webkit-search-cancel-button]:hidden"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="absolute right-1.5 top-1/2 grid h-5 w-5 -translate-y-1/2 place-items-center rounded-md text-muted hover:bg-canvas hover:text-ink"
            >
              <X aria-hidden="true" className="h-3 w-3" />
            </button>
          ) : (
            <UserPlus aria-hidden="true" className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
          )}
        </div>

        {active ? (
          <ul className="rv-squad-bar__chips" aria-label="Squad members">
            {squad.map((key) => {
              const person = byKey.get(key);
              const name = person?.name ?? key;
              const code = person?.code ?? "";
              return (
                <li key={key}>
                  <span className="rv-squad-chip">
                    <Tooltip content={person?.label ?? name}>
                      <Link
                        to={`/employee?emp=${encodeURIComponent(key)}`}
                        className="rv-squad-chip__name min-w-0 truncate"
                      >
                        {name}
                      </Link>
                    </Tooltip>
                    {code ? <span className="rv-squad-chip__code tabular-nums text-muted">{code}</span> : null}
                    <button
                      type="button"
                      onClick={() => remove(key)}
                      aria-label={`Remove ${name} from squad`}
                      className="rv-squad-chip__remove"
                    >
                      <X aria-hidden="true" className="h-3 w-3" />
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-xs text-muted">No one in your squad yet.</p>
        )}
      </div>

      {open &&
        placement &&
        createPortal(
          <div
            ref={panelRef}
            id={listId}
            role="listbox"
            aria-label="Employee search results"
            style={{ left: placement.left, top: placement.top, width: placement.width, zIndex: 120 }}
            className="rv-popover rv-squad-search-panel fixed overflow-hidden rounded-xl bg-surface shadow-(--shadow-popover)"
            onMouseDown={(event) => {
              if ((event.target as HTMLElement).closest("input, textarea")) return;
              event.preventDefault();
            }}
          >
            {debounced.trim().length === 0 ? (
              <p className="px-3 py-4 text-sm text-muted">Type a name or employee code to add someone.</p>
            ) : search.loading ? (
              <p className="px-3 py-4 text-sm text-muted">Searching…</p>
            ) : search.error ? (
              <p className="px-3 py-4 text-sm text-warning-ink">{search.error}</p>
            ) : hits.length === 0 ? (
              <p className="px-3 py-4 text-sm text-muted">No employees match.</p>
            ) : (
              <ul className="rv-scroll max-h-64 overflow-y-auto py-1">
                {hits.map((row) => (
                  <li key={row.key} role="option" aria-selected={false}>
                    <button
                      type="button"
                      onClick={() => add(row.key)}
                      className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-ink-soft hover:bg-canvas"
                    >
                      <span className="min-w-0 flex-1 truncate font-medium text-ink">{row.name}</span>
                      <span className="shrink-0 text-xs tabular-nums text-muted">{row.code}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>,
          document.body,
        )}
    </section>
  );
}