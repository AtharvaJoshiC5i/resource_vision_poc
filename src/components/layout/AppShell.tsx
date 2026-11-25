import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import {
  FolderKanban,
  LayoutGrid,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  UserRound,
  X,
  type LucideIcon,
} from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";

import { useApi } from "../../hooks/useApi";
import { useDialogFocus } from "../../hooks/useDialogFocus";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import type { Meta } from "../../api/types";
import { shortDate } from "../../lib/format";
import { Tooltip } from "../ui/Tooltip";
import { DataSourceSwitch } from "./DataSourceSwitch";
import { AvailabilityGuidePanel, AvailabilityGuideTrigger } from "./AvailabilityGuide";

const NAV: { to: string; label: string; end: boolean; icon: LucideIcon }[] = [
  { to: "/", label: "Availability", end: true, icon: LayoutGrid },
  { to: "/employee", label: "Employee 360", end: false, icon: UserRound },
  { to: "/projects", label: "Projects", end: false, icon: FolderKanban },
];

/** Public glyph at `/c5i-glyph.png` (do not inspect asset bytes in tooling). */
function BrandMark({ size = "md" }: { size?: "md" | "sm" }) {
  const box = size === "sm" ? "h-8 w-8" : "h-9 w-9";
  return <img src="/c5i-glyph.png" alt="" className={`${box} shrink-0 object-contain`} />;
}

function Brand({ titleId, compact = false }: { titleId?: string; compact?: boolean }) {
  return (
    <div className="flex min-h-0 min-w-0 items-center gap-2">
      <BrandMark size={compact ? "sm" : "md"} />
      <div className={`min-w-0 leading-none ${compact ? "sr-only" : ""}`}>
        <span id={titleId} className="block truncate text-sm font-semibold tracking-[-0.011em] text-ink">
          Resource Vision
        </span>
        <span className="mt-0.5 block truncate text-xs text-muted">Workforce planning</span>
      </div>
    </div>
  );
}

function SidebarNav({
  onNavigate,
  id,
  compact = false,
  onOpenGuide,
}: {
  onNavigate?: () => void;
  id?: string;
  compact?: boolean;
  onOpenGuide?: () => void;
}) {
  return (
    <nav id={id} aria-label="Primary" className="flex min-h-0 flex-1 flex-col px-2.5 pt-1">
      {!compact ? <p className="mb-1.5 px-2.5 text-[0.6875rem] font-medium text-muted">Workspace</p> : null}
      <ul className={`flex flex-col gap-0.5 ${compact ? "items-center" : ""}`}>
        {NAV.map((item) => {
          const link = (
            <NavLink
              to={item.to}
              end={item.end}
              onClick={onNavigate}
              className={({ isActive }) =>
                [
                  "relative flex h-9 touch:h-11 items-center rounded-lg text-sm transition-[background-color,color]",
                  compact ? "w-10 touch:w-11 justify-center" : "w-full gap-3 px-2.5",
                  isActive
                    ? "bg-primary-soft/80 font-medium text-ink before:absolute before:inset-y-2 before:-left-2.5 before:w-[3px] before:rounded-r-full before:bg-primary"
                    : "text-ink-soft hover:bg-canvas hover:text-ink",
                ].join(" ")
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon
                    aria-hidden="true"
                    strokeWidth={isActive ? 2.1 : 1.8}
                    className={`h-4 w-4 shrink-0 ${isActive ? "text-primary" : "text-muted"}`}
                  />
                  <span className={compact ? "sr-only" : "truncate"}>{item.label}</span>
                </>
              )}
            </NavLink>
          );
          return (
            <li key={item.to} className={compact ? "" : "w-full"}>
              {compact ? <Tooltip content={item.label}>{link}</Tooltip> : link}
            </li>
          );
        })}
      </ul>
      {onOpenGuide ? (
        <div className={`mt-auto border-t border-hairline pt-2 ${compact ? "flex justify-center" : ""}`}>
          <AvailabilityGuideTrigger expanded={!compact} onOpen={onOpenGuide} />
        </div>
      ) : null}
    </nav>
  );
}

function SidebarFootnote({ meta, expanded }: { meta: Meta | null | undefined; expanded: boolean }) {
  if (!expanded) return null;
  if (!meta) {
    return <div className="skeleton h-4 w-24" aria-hidden="true" />;
  }
  return (
    <div>
      <p className="truncate text-xs text-muted">
        {meta.source === "demo" && (
          <span className="mr-1.5 font-medium text-warning-ink">Demo data</span>
        )}
        <span>As of {shortDate(meta.today)}</span>
      </p>
      {meta.data?.load_summary?.sampled ? (
        <p className="mt-1.5 text-xs leading-snug text-warning-ink">
          Limited sample: first {meta.data.load_summary.sample_rows_per_month ?? "?"} rows a month, {meta.data.load_summary.months_loaded ?? "?"} of{" "}
          {meta.data.load_summary.months_in_window ?? "?"} months. Totals are partial.
        </p>
      ) : null}
      {meta.data?.load_summary?.unresolved_reasons &&
      Object.keys(meta.data.load_summary.unresolved_reasons).length > 0 ? (
        <p className="mt-1.5 text-xs leading-snug text-muted">
          Rows needing review:{" "}
          {Object.entries(meta.data.load_summary.unresolved_reasons)
            .map(([reason, count]) => `${count} ${reason}`)
            .join("; ")}
          .
        </p>
      ) : null}
      {meta.sources ? <DataSourceSwitch sources={meta.sources} /> : null}
    </div>
  );
}

const COLLAPSED_KEY = "rv.sidebar.collapsed";

function readCollapsed() {
  try {
    return window.localStorage.getItem(COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

const PEEK_OPEN_MS = 150;
const PEEK_CLOSE_MS = 250;

function DesktopSidebar({
  meta,
  onOpenGuide,
  onExpandedChange,
}: {
  meta: Meta | null | undefined;
  onOpenGuide: () => void;
  onExpandedChange: (expanded: boolean) => void;
}) {
  const [userCollapsed, setCollapsed] = useState(readCollapsed);
  // Below 1024px (tablets) the sidebar is always the 64px rail, so content keeps its width.
  const wide = useMediaQuery("(min-width: 1024px)");
  const collapsed = userCollapsed || !wide;
  const [peek, setPeek] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const expanded = !collapsed || peek;

  useLayoutEffect(() => {
    onExpandedChange(wide && expanded);
  }, [wide, expanded, onExpandedChange]);

  const schedulePeek = (next: boolean) => {
    window.clearTimeout(timer.current);
    if (!collapsed) return;
    timer.current = window.setTimeout(() => setPeek(next), next ? PEEK_OPEN_MS : PEEK_CLOSE_MS);
  };

  useEffect(() => () => window.clearTimeout(timer.current), []);

  // Layout effect so the content offset is correct before the first paint.
  useLayoutEffect(() => {
    document.documentElement.style.setProperty("--rv-sidebar-width", wide && expanded ? "15rem" : "4rem");
    return () => {
      document.documentElement.style.removeProperty("--rv-sidebar-width");
    };
  }, [wide, expanded]);

  const toggle = () => {
    const next = !userCollapsed;
    window.clearTimeout(timer.current);
    setCollapsed(next);
    setPeek(false);
    try {
      window.localStorage.setItem(COLLAPSED_KEY, next ? "1" : "0");
    } catch {
      /* storage unavailable */
    }
  };

  const toggleLabel = collapsed ? "Keep sidebar open" : "Collapse sidebar";
  const ToggleIcon = collapsed ? PanelLeftOpen : PanelLeftClose;
  const toggleButton = !wide ? null : (
    <Tooltip content={toggleLabel}>
      <button
        type="button"
        onClick={toggle}
        aria-label={toggleLabel}
        className="grid h-8 w-8 touch:h-11 touch:w-11 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-canvas hover:text-ink"
      >
        <ToggleIcon aria-hidden="true" className="h-4 w-4" strokeWidth={1.8} />
      </button>
    </Tooltip>
  );

  return (
    <aside
      aria-label="Application"
      onMouseEnter={() => schedulePeek(true)}
      onMouseLeave={() => schedulePeek(false)}
      onFocus={(event) => {
        if (!collapsed || !(event.target as HTMLElement).matches(":focus-visible")) return;
        window.clearTimeout(timer.current);
        setPeek(true);
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) schedulePeek(false);
      }}
      className={`rv-shell-rail fixed inset-y-0 left-0 z-30 hidden flex-col overflow-hidden bg-surface transition-[width] duration-200 ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none md:flex ${
        expanded ? "w-60" : "w-16"
      }`}
    >
      <div
        className={`flex h-14 shrink-0 items-center border-b border-hairline bg-surface ${
          expanded ? "justify-between gap-2 pl-3 pr-2" : "justify-center px-1.5"
        }`}
      >
        {expanded ? (
          <>
            <Brand />
            {toggleButton}
          </>
        ) : (
          (toggleButton ?? <BrandMark size="sm" />)
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden bg-surface py-3">
        <SidebarNav compact={!expanded} onOpenGuide={onOpenGuide} />
      </div>

      <div className="shrink-0 border-t border-hairline bg-surface px-4 py-3">
        <SidebarFootnote meta={meta} expanded={expanded} />
      </div>
    </aside>
  );
}

export function AppShell() {
  const { data: meta } = useApi<Meta>("/meta");
  const [menuOpen, setMenuOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [sidebarExpanded, setSidebarExpanded] = useState(() => !readCollapsed());
  const mobileNavId = useId();
  const drawerRef = useDialogFocus(menuOpen);

  useEffect(() => {
    if (!menuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  return (
    <div className="flex min-h-[100dvh] font-sans md:h-[100dvh] md:min-h-0 md:overflow-hidden">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-[100] focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2 focus:shadow-(--shadow-popover)"
      >
        Skip to content
      </a>

      <DesktopSidebar
        meta={meta}
        onOpenGuide={() => setGuideOpen(true)}
        onExpandedChange={setSidebarExpanded}
      />
      <AvailabilityGuidePanel open={guideOpen} onClose={() => setGuideOpen(false)} />

      <div className="flex min-w-0 flex-1 flex-col overflow-x-clip bg-canvas pr-[env(safe-area-inset-right)] max-md:pl-[env(safe-area-inset-left)] md:ml-[var(--rv-sidebar-width,4rem)] md:min-h-0 md:overflow-y-auto md:overflow-x-hidden">
        <header className="rv-chrome-bar sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between gap-3 bg-surface/90 px-4 backdrop-blur-md md:hidden">
          <Brand />
          <button
            type="button"
            className="rv-btn-secondary grid h-9 w-9 touch:h-11 touch:w-11 shrink-0 place-items-center rounded-lg text-ink hover:bg-canvas"
            aria-expanded={menuOpen}
            aria-controls={mobileNavId}
            aria-label={menuOpen ? "Close navigation" : "Open navigation"}
            onClick={() => setMenuOpen((value) => !value)}
          >
            {menuOpen ? <X aria-hidden="true" className="h-4 w-4" /> : <Menu aria-hidden="true" className="h-4 w-4" />}
          </button>
        </header>

        {!sidebarExpanded ? (
          <header className="rv-chrome-bar sticky top-0 z-20 hidden h-14 shrink-0 items-center bg-surface/90 px-6 backdrop-blur-md md:flex lg:px-8">
            <Brand />
          </header>
        ) : null}

        <main
          id="main"
          className="mx-auto w-full min-w-0 max-w-[90rem] flex-1 px-3 py-4 sm:px-5 sm:py-5 lg:px-7 lg:py-6 short:py-2"
        >
          <Outlet />
        </main>
      </div>

      {menuOpen ? (
        <>
          <button
            type="button"
            aria-label="Dismiss menu"
            className="rv-backdrop fixed inset-0 z-40 bg-ink/40 backdrop-blur-[2px] md:hidden"
            onClick={() => setMenuOpen(false)}
          />
          <div
            ref={drawerRef}
            tabIndex={-1}
            className="rv-drawer fixed inset-y-0 left-0 z-50 flex w-[min(18rem,88vw)] flex-col border-r border-hairline bg-surface pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] shadow-(--shadow-popover) outline-none md:hidden"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mobile-nav-title"
          >
            <div className="flex h-14 shrink-0 items-center justify-between gap-2 px-4">
              <Brand titleId="mobile-nav-title" />
              <button
                type="button"
                className="grid h-9 w-9 touch:h-11 touch:w-11 shrink-0 place-items-center rounded-lg text-ink hover:bg-canvas"
                aria-label="Close"
                onClick={() => setMenuOpen(false)}
              >
                <X aria-hidden="true" className="h-4 w-4" />
              </button>
            </div>
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto py-2">
              <SidebarNav
                id={mobileNavId}
                onNavigate={() => setMenuOpen(false)}
                onOpenGuide={() => {
                  setMenuOpen(false);
                  setGuideOpen(true);
                }}
              />
            </div>
            <div className="shrink-0 border-t border-hairline px-4 py-3">
              <SidebarFootnote meta={meta} expanded />
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
