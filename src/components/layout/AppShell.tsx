import { useEffect, useId, useRef, useState } from "react";
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
import type { Meta } from "../../api/types";
import { shortDate } from "../../lib/format";
import { AvailabilityGuidePanel, AvailabilityGuideTrigger } from "./AvailabilityGuide";

const NAV: { to: string; label: string; end: boolean; icon: LucideIcon }[] = [
  { to: "/", label: "Availability", end: true, icon: LayoutGrid },
  { to: "/employee", label: "Employee 360", end: false, icon: UserRound },
  { to: "/projects", label: "Projects", end: false, icon: FolderKanban },
];

function BrandMark() {
  return (
    <span aria-hidden="true" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary">
      <svg viewBox="0 0 16 16" className="h-4 w-4" fill="var(--color-surface)">
        <rect x="1" y="1" width="4" height="4" rx="1" />
        <rect x="6" y="1" width="4" height="4" rx="1" opacity="0.45" />
        <rect x="11" y="1" width="4" height="4" rx="1" />
        <rect x="1" y="6" width="4" height="4" rx="1" opacity="0.45" />
        <rect x="6" y="6" width="4" height="4" rx="1" />
        <rect x="11" y="6" width="4" height="4" rx="1" opacity="0.45" />
        <rect x="1" y="11" width="4" height="4" rx="1" />
        <rect x="6" y="11" width="4" height="4" rx="1" opacity="0.45" />
        <rect x="11" y="11" width="4" height="4" rx="1" opacity="0.45" />
      </svg>
    </span>
  );
}

function Brand({ titleId, compact = false }: { titleId?: string; compact?: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <BrandMark />
      <div className={`min-w-0 leading-tight ${compact ? "sr-only" : ""}`}>
        <span id={titleId} className="block truncate text-sm font-semibold tracking-tight text-ink">
          Resource Vision
        </span>
        <span className="block truncate text-[11px] text-muted">Workforce planning</span>
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
    <nav id={id} aria-label="Primary" className="flex min-h-0 flex-1 flex-col px-2.5 pt-2">
      <ul className={`flex flex-col gap-0.5 ${compact ? "items-center" : ""}`}>
        {NAV.map((item) => (
          <li key={item.to} className={compact ? "" : "w-full"}>
            <NavLink
              to={item.to}
              end={item.end}
              onClick={onNavigate}
              title={compact ? item.label : undefined}
              className={({ isActive }) =>
                [
                  "flex h-9 items-center rounded-lg text-[13px] transition-colors",
                  compact ? "w-10 justify-center" : "w-full gap-3 px-2.5",
                  isActive
                    ? "bg-primary-soft font-medium text-purple-indigo shadow-[inset_0_0_0_1px_rgba(99,91,255,0.12)]"
                    : "text-ink-soft hover:bg-canvas hover:text-ink",
                ].join(" ")
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon
                    aria-hidden="true"
                    strokeWidth={isActive ? 2.1 : 1.8}
                    className={`h-[17px] w-[17px] shrink-0 ${isActive ? "text-primary" : "text-muted"}`}
                  />
                  <span className={compact ? "sr-only" : "truncate"}>{item.label}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
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
    return <div className="h-4 w-24 animate-pulse rounded bg-canvas" aria-hidden="true" />;
  }
  return (
    <p className="truncate text-[11px] text-muted">
      {meta.source === "demo" && (
        <span className="mr-1.5 font-medium text-warning-ink">Demo data</span>
      )}
      <span>As of {shortDate(meta.today)}</span>
    </p>
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

function DesktopSidebar({ meta, onOpenGuide }: { meta: Meta | null | undefined; onOpenGuide: () => void }) {
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [peek, setPeek] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const expanded = !collapsed || peek;

  const schedulePeek = (next: boolean) => {
    window.clearTimeout(timer.current);
    if (!collapsed) return;
    timer.current = window.setTimeout(() => setPeek(next), next ? PEEK_OPEN_MS : PEEK_CLOSE_MS);
  };

  useEffect(() => () => window.clearTimeout(timer.current), []);

  useEffect(() => {
    document.documentElement.style.setProperty("--rv-sidebar-width", expanded ? "15rem" : "4rem");
    return () => {
      document.documentElement.style.removeProperty("--rv-sidebar-width");
    };
  }, [expanded]);

  const toggle = () => {
    const next = !collapsed;
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
  const toggleButton = (
    <button
      type="button"
      onClick={toggle}
      aria-label={toggleLabel}
      title={toggleLabel}
      className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-canvas hover:text-ink"
    >
      <ToggleIcon aria-hidden="true" className="h-4 w-4" strokeWidth={1.8} />
    </button>
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
      className={`fixed inset-y-0 left-0 z-30 hidden flex-col overflow-hidden border-r border-hairline bg-surface transition-[width] duration-200 ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none md:flex ${
        expanded ? "w-60" : "w-16"
      }`}
    >
      <div
        className={`relative flex h-14 shrink-0 items-center border-b border-hairline ${
          expanded ? "justify-between gap-2 pl-3.5 pr-2.5" : "justify-center px-2"
        }`}
      >
        <Brand compact={!expanded} />
        {expanded ? toggleButton : <div className="absolute right-1.5 top-1/2 -translate-y-1/2">{toggleButton}</div>}
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden py-2">
        <SidebarNav compact={!expanded} onOpenGuide={onOpenGuide} />
      </div>

      <div className="shrink-0 border-t border-hairline px-3 py-2.5">
        <SidebarFootnote meta={meta} expanded={expanded} />
      </div>
    </aside>
  );
}

export function AppShell() {
  const { data: meta } = useApi<Meta>("/meta");
  const [menuOpen, setMenuOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const mobileNavId = useId();

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
    <div className="flex h-[100dvh] min-h-0 overflow-hidden font-sans">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-[100] focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2 focus:shadow-(--shadow-popover)"
      >
        Skip to content
      </a>

      <DesktopSidebar meta={meta} onOpenGuide={() => setGuideOpen(true)} />
      <AvailabilityGuidePanel open={guideOpen} onClose={() => setGuideOpen(false)} />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden md:ml-[var(--rv-sidebar-width,4rem)]">
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between gap-3 border-b border-hairline bg-surface px-4 md:hidden">
          <Brand />
          <button
            type="button"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-border text-ink hover:bg-canvas"
            aria-expanded={menuOpen}
            aria-controls={mobileNavId}
            aria-label={menuOpen ? "Close navigation" : "Open navigation"}
            onClick={() => setMenuOpen((value) => !value)}
          >
            {menuOpen ? <X aria-hidden="true" className="h-4 w-4" /> : <Menu aria-hidden="true" className="h-4 w-4" />}
          </button>
        </header>

        <main id="main" className="mx-auto w-full max-w-[1440px] flex-1 space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <Outlet />
        </main>
      </div>

      {menuOpen ? (
        <>
          <button
            type="button"
            aria-label="Dismiss menu"
            className="fixed inset-0 z-40 bg-ink/40 md:hidden"
            onClick={() => setMenuOpen(false)}
          />
          <div
            className="fixed inset-y-0 left-0 z-50 flex w-[min(18rem,88vw)] flex-col border-r border-hairline bg-surface shadow-(--shadow-popover) md:hidden"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mobile-nav-title"
          >
            <div className="flex h-14 shrink-0 items-center justify-between gap-2 px-4">
              <Brand titleId="mobile-nav-title" />
              <button
                type="button"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-ink hover:bg-canvas"
                aria-label="Close"
                onClick={() => setMenuOpen(false)}
              >
                <X aria-hidden="true" className="h-4 w-4" />
              </button>
            </div>
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto py-2">
              <SidebarNav id={mobileNavId} onNavigate={() => setMenuOpen(false)} onOpenGuide={() => setGuideOpen(true)} />
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
