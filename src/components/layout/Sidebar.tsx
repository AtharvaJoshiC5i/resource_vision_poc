import { Box } from "lucide-react";

import { NavLink, useLocation } from "react-router-dom";

import {
  navigationSections,
  type NavigationItem,
} from "../config/navigation";

import { Badge } from "../ui/Badge";

interface SidebarProps {
  onNavigate?: () => void;
}

function isNavigationItemActive(
  item: NavigationItem,
  pathname: string,
): boolean {
  if (item.path === "/") {
    return pathname === "/";
  }

  if (item.matchPrefix !== undefined) {
    return (
      pathname === item.path || pathname.startsWith(`${item.matchPrefix}/`)
    );
  }

  return pathname === item.path;
}

export function Sidebar({ onNavigate }: SidebarProps) {
  const location = useLocation();

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="flex h-16 shrink-0 items-center border-b border-slate-200 px-5">
        <div className="flex size-9 items-center justify-center rounded-xl bg-blue-600">
          <Box
            className="size-5 text-white"
            strokeWidth={2}
            aria-hidden="true"
          />
        </div>

        <div className="ml-3 min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900">
            Resource Vision
          </p>

          <p className="text-xs font-medium text-slate-500">2.0</p>
        </div>
      </div>

      <nav
        className="flex-1 overflow-y-auto px-3 py-5"
        aria-label="Primary navigation"
      >
        <div className="space-y-7">
          {navigationSections.map((section) => (
            <div key={section.label}>
              <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                {section.label}
              </p>

              <div className="space-y-1">
                {section.items.map((item) => {
                  const Icon = item.icon;

                  const active = isNavigationItemActive(
                    item,
                    location.pathname,
                  );

                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 ${
                        active
                          ? "bg-blue-50 text-blue-700"
                          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                      }`}
                    >
                      <Icon
                        className={`size-4.5 shrink-0 ${
                          active ? "text-blue-600" : "text-slate-400"
                        }`}
                        strokeWidth={active ? 2.25 : 2}
                        aria-hidden="true"
                      />

                      <span>{item.label}</span>
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </nav>

      <div className="shrink-0 border-t border-slate-200 p-4">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <Badge variant="blue">POC</Badge>

          <p className="mt-2 text-xs font-medium text-slate-700">
            Proof of Concept
          </p>

          <p className="mt-1 text-xs leading-5 text-slate-500">
            Synthetic demonstration data
          </p>
        </div>
      </div>
    </div>
  );
}
